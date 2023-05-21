import core from '@actions/core';
import github from '@actions/github';
import exec from '@actions/exec';
import { intro, outro } from '@clack/prompts';
import { PullRequestEvent } from '@octokit/webhooks-types';
import { generateCommitMessageByDiff } from './generateCommitMessageFromGitDiff';
import { sleep } from './utils/sleep';
import { randomIntFromInterval } from './utils/randomIntFromInterval';
import { unlinkSync, writeFileSync } from 'fs';
import { promisify } from 'util';
import { exec as cpExec } from 'child_process';
const execPromise = promisify(cpExec);

// This should be a token with access to your repository scoped in as a secret.
// The YML workflow will need to set GITHUB_TOKEN with the GitHub Secret Token
// GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
// https://help.github.com/en/actions/automating-your-workflow-with-github-actions/authenticating-with-the-github_token#about-the-github_token-secret
const GITHUB_TOKEN = core.getInput('GITHUB_TOKEN');
const pattern = core.getInput('pattern');
const octokit = github.getOctokit(GITHUB_TOKEN);
const context = github.context;
const owner = context.repo.owner;
const repo = context.repo.repo;

type ListCommitsResponse = ReturnType<typeof octokit.rest.pulls.listCommits>;

type CommitsData = ListCommitsResponse extends Promise<infer T> ? T : never;

type CommitsArray = CommitsData['data'];

type SHA = string;
type Diff = string;
type MessageBySha = Record<SHA, Diff>;

async function getCommitDiff(commitSha: string) {
  const diffResponse = await octokit.request<string>(
    'GET /repos/{owner}/{repo}/commits/{ref}',
    {
      owner,
      repo,
      ref: commitSha,
      headers: {
        Accept: 'application/vnd.github.v3.diff'
      }
    }
  );
  return { sha: commitSha, diff: diffResponse.data };
}

interface DiffAndSHA {
  sha: string;
  diff: string;
}

interface DiffAndImprovedMessage {
  sha: string;
  improvedMessage: string;
}

async function improveCommitMessagesWithRebase({
  commits,
  diffs,
  source,
  base
}: {
  commits: CommitsArray;
  diffs?: DiffAndSHA[];
  base: string;
  source: string;
}): Promise<void> {
  let commitsToImprove = pattern
    ? commits.filter(({ commit }) => new RegExp(pattern).test(commit.message))
    : commits;

  if (!commitsToImprove.length) {
    outro('No new commits found.');

    return;
  }

  outro(`Found ${commitsToImprove.length} commits to improve.`);

  if (!diffs) {
    const commitShas = commitsToImprove.map((commit) => commit.sha);
    const diffPromises = commitShas.map((sha) => getCommitDiff(sha));

    outro('Fetching commit diffs by SHAs.');
    diffs = await Promise.all(diffPromises).catch((error) => {
      outro(`error in Promise.all(getCommitDiffs(SHAs)): ${error}`);
      throw error;
    });

    outro('Done.');
  }

  // send chunks of diffs in parallel, because openAI restricts too many requests at once with 429 error
  async function improveMessagesInChunks() {
    const chunkSize = diffs!.length % 2 === 0 ? 4 : 3;
    outro(`Improving commit messages with GPT in chunks of ${chunkSize}.`);
    const improvePromises = diffs!.map((commit) =>
      generateCommitMessageByDiff(commit.diff)
    );

    let improvedMessagesBySha: MessageBySha = {};
    for (let step = 0; step < improvePromises.length; step += chunkSize) {
      const chunkOfPromises = improvePromises.slice(step, step + chunkSize);

      try {
        // TODO: refactor to Promise.allSettled, to only retry rejected promises
        const chunkOfImprovedMessages = await Promise.all(chunkOfPromises);

        const chunkOfImprovedMessagesBySha = chunkOfImprovedMessages.reduce(
          (acc, improvedMsg, i) => {
            const index = Object.keys(improvedMessagesBySha).length;
            acc[diffs![index + i].sha] = improvedMsg;

            return acc;
          },
          {} as MessageBySha
        );

        improvedMessagesBySha = {
          ...improvedMessagesBySha,
          ...chunkOfImprovedMessagesBySha
        };

        // openAI errors with 429 code (too many requests) so lets sleep a bit
        const sleepFor =
          3000 + 200 * (step / chunkSize) + 100 * randomIntFromInterval(1, 5);

        outro(
          `Improved ${chunkOfPromises.length} messages. Sleeping for ${sleepFor}`
        );

        await sleep(sleepFor);
      } catch (error) {
        outro(error as string);
        const sleepFor = 5000 + 1000 * randomIntFromInterval(1, 5);
        outro(`Retrying after sleeping for ${sleepFor}`);
        await sleep(sleepFor);
        step -= chunkSize;
      }
    }

    return improvedMessagesBySha;
  }

  const improvedMessagesBySha: MessageBySha = await improveMessagesInChunks();

  console.log({ improvedMessagesBySha });

  outro('Done.');

  outro(
    `Starting interactive rebase: "$ rebase -i ${commitsToImprove[0].sha}^".`
  );

  // fetch all commits inside the process
  await exec.exec('git', ['checkout', source]);
  await exec.exec('git', ['fetch', '--all']);
  await exec.exec('git', ['pull']);

  commitsToImprove.forEach((commit, i) => {
    outro(`creating -F file for ${commit.sha}`);
    writeFileSync(`./commit-${i}.txt`, improvedMessagesBySha[commit.sha]);
  });
  // echo 0 > count.txt && git rebase <sha>^ --exec "git commit --amend -F \$(cat count.txt).txt && echo \$((\$(cat count.txt) + 1)) > count.txt"

  // const done = await exec.exec(
  //   `echo 0 > count.txt && git rebase -i ${commitsToImprove[0].sha}^ --exec "git commit --amend -F commit-$(cat count.txt).txt && echo $(($(cat count.txt) + 1)) > count.txt"`,
  //   [],
  //   {
  //     env: {
  //       GIT_SEQUENCE_EDITOR: 'sed -i -e "s/^pick/reword/g"',
  //       GIT_COMMITTER_NAME: process.env.GITHUB_ACTOR!,
  //       GIT_COMMITTER_EMAIL: `${process.env.GITHUB_ACTOR}@users.noreply.github.com`
  //     }
  //   }
  // );

  // todo: unlink
  writeFileSync(`./count.txt`, '0');

  // todo: unlink
  writeFileSync(
    `./rebase-exec.sh`,
    `
#!/bin/bash
count=$(cat count.txt)
git commit --amend -F commit-$count.txt
echo $(( count + 1 )) > count.txt
        `
  );

  await exec.exec(`chmod +x ./rebase-exec.sh`);

  await exec.exec(
    `git`,
    ['rebase', `${commitsToImprove[0].sha}^`, '--exec', './rebase-exec.sh'],
    {
      env: {
        GIT_SEQUENCE_EDITOR: 'sed -i -e "s/^pick/reword/g"',
        GIT_COMMITTER_NAME: process.env.GITHUB_ACTOR!,
        GIT_COMMITTER_EMAIL: `${process.env.GITHUB_ACTOR}@users.noreply.github.com`
      },
      listeners: {
        stderr: async (data) => {
          outro(`Error: ${data.toString()}`);
          await exec.exec('git', ['rebase', 'abort']);
        }
      }
    }
  );

  // const done = await exec.exec(
  //   'git',
  //   [
  //     'rebase',
  //     `${commitsToImprove[0].sha}^`,
  //     '--exec',
  //     'git commit --amend -F $(git rev-parse HEAD).txt'
  //   ],
  //   {
  //     env: {
  //       GIT_SEQUENCE_EDITOR: 'sed -i -e "s/^pick/reword/g"',
  //       GIT_COMMITTER_NAME: process.env.GITHUB_ACTOR!,
  //       GIT_COMMITTER_EMAIL: `${process.env.GITHUB_ACTOR}@users.noreply.github.com`
  //     }
  //   }
  // );

  // outro(`!!!done: ${done}`);

  commitsToImprove.forEach((_commit, i) => unlinkSync(`./commit-${i}.txt`));

  // async function changeCommitMessages(
  //   commitsToUpdate: DiffAndImprovedMessage[]
  // ) {
  //   const messageFilterScript = commitsToUpdate
  //     .map(
  //       (commit: DiffAndImprovedMessage) =>
  //         `if [ "$GIT_COMMIT" = "${commit.sha}" ]; then echo "${commit.improvedMessage}"; else cat; fi`
  //     )
  //     .join(' | ');

  //   await exec.exec('git', [
  //     'filter-branch',
  //     '--msg-filter',
  //     messageFilterScript,
  //     '--',
  //     '--all'
  //   ]);
  // }

  // const diffsAndImprovedMessages: DiffAndImprovedMessage[] =
  //   commitsToImprove.map((commit) => ({
  //     sha: commit.sha,
  //     improvedMessage: improvedMessagesBySha[commit.sha]
  //   }));

  // await changeCommitMessages(diffsAndImprovedMessages);

  // for (const commit of commitsToImprove) {
  //   try {
  //     const improvedMessage = improvedMessagesBySha[commit.sha];
  //     outro(`SHA: ${commit.sha} improving...`);
  //     await exec.exec('git', ['commit', '--amend', '-m', improvedMessage]);
  //     await exec.exec('git', ['rebase', '--continue']);
  //     outro(`SHA: ${commit.sha} commit improved.`);
  //   } catch (error) {
  //     throw error;
  //   }
  // }

  // // Once all commits have been amended, you'll need to rebase the original branch onto the last amended commit
  // const lastCommit = commits[0];
  // await exec.exec('git', ['checkout', source]);
  // await exec.exec('git', ['rebase', lastCommit.sha]);

  outro('Force pushing interactively rebased commits into remote origin.');

  await exec.exec('git', ['status']);

  // Force push the rebased commits
  await exec.exec('git', ['push', 'origin', `--force`]);

  outro('Done ⏱️');
}

async function run(retries = 3) {
  intro('OpenCommit — improving commit messages with GPT');

  // Set the Git identity
  await exec.exec('git', [
    'config',
    'user.email',
    `${process.env.GITHUB_ACTOR}@users.noreply.github.com`
  ]);
  await exec.exec('git', ['config', 'user.name', process.env.GITHUB_ACTOR!]);

  // await exec.exec('git', ['commit', '--amend', '-m', 'NEW_DAT_MSG']);

  // await exec.exec('git', ['push', '--force']);

  try {
    if (github.context.eventName === 'pull_request') {
      const baseBranch = github.context.payload.pull_request?.base.ref;
      const sourceBranch = github.context.payload.pull_request?.head.ref;
      outro(
        `Processing commits in a Pull Request from source: (${sourceBranch}) to base: (${baseBranch})`
      );
      if (github.context.payload.action === 'opened')
        outro('Pull Request action: opened');
      else if (github.context.payload.action === 'synchronize')
        outro('Pull Request action: synchronize');
      else
        return outro(
          'Pull Request unhandled action: ' + github.context.payload.action
        );

      const payload = github.context.payload as PullRequestEvent;

      const commitsResponse = await octokit.rest.pulls.listCommits({
        owner,
        repo,
        pull_number: payload.pull_request.number
      });

      const commits = commitsResponse.data;

      // --- TEST ---
      await exec.exec('git', ['checkout', sourceBranch]);
      await exec.exec('git', ['fetch', '--all']);
      await exec.exec('git', ['pull']);
      await exec.exec('git', ['status']);
      await exec.exec('git', ['log', '--oneline']);
      // --- TEST ---

      await improveCommitMessagesWithRebase({
        commits,
        base: baseBranch,
        source: sourceBranch
      });
    } else {
      outro('Wrong action.');
      core.error(
        `OpenCommit was called on ${github.context.payload.action}. OpenCommit is not supposed to be used on actions other from "pull_request.opened" and "pull_request.synchronize".`
      );
    }
  } catch (error: any) {
    const err = error?.message || error;
    outro(err);
    // if (retries) run(--retries);
    // else core.setFailed(error?.message || error);
    core.setFailed(err);
  }
}

run();
