import core from '@actions/core';
import github from '@actions/github';
import { execa } from 'execa';
import { intro, outro } from '@clack/prompts';
import { PullRequestEvent } from '@octokit/webhooks-types';
import { generateCommitMessageByDiff } from './generateCommitMessageFromGitDiff';
import { sleep } from './utils/sleep';

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

async function improveCommitMessagesWithRebase(commits: CommitsArray) {
  let commitsToImprove = pattern
    ? commits.filter(({ commit }) => new RegExp(pattern).test(commit.message))
    : commits;

  if (!commitsToImprove.length) {
    outro('No new commits found.');

    return;
  }

  outro(`Found ${commitsToImprove.length} commits to improve.`);

  const commitShas = commitsToImprove.map((commit) => commit.sha);
  const diffPromises = commitShas.map((sha) => getCommitDiff(sha));

  outro('Fetching commit diffs by SHAs.');
  const commitDiffs: { sha: string; diff: string }[] = await Promise.all(
    diffPromises
  ).catch((error) => {
    outro(`error in Promise.all(getCommitDiffs(SHAs)): ${error}`);
    throw error;
  });
  outro('Done.');

  outro('Improving commit messages by diffs.');
  const improvePromises = commitDiffs.map((commit) =>
    generateCommitMessageByDiff(commit.diff)
  );

  // send chunks of 3 diffs in parallel, because openAI restricts too many requests at once with 429 error
  async function improveMessagesInChunks() {
    const chunkSize = improvePromises.length % 2 === 0 ? 4 : 3;
    console.log({ chunkSize, improvePromisesLength: improvePromises.length });
    let improvedMessagesBySha: MessageBySha = {};
    for (let i = 0; i < improvePromises.length; i += chunkSize) {
      const promises = improvePromises.slice(i, i + chunkSize);
      console.log({ i, promises, improvedMessagesBySha });
      await Promise.all(promises)
        .then((results) => {
          return results.reduce((acc, improvedMsg, i) => {
            acc[commitDiffs[i].sha] = improvedMsg;

            return acc;
          }, improvedMessagesBySha);
        })
        .catch((error) => {
          outro(`error in Promise.all(getCommitDiffs(SHAs)): ${error}`);
          throw error;
        });

      // openAI errors with 429 code (too many requests) so lets sleep a bit
      outro('Sleeping for 1s');
      await sleep(1000);
    }

    return improvedMessagesBySha;
  }

  const improvedMessagesBySha = await improveMessagesInChunks();

  console.log({ improvedMessagesBySha });

  outro('Done.');

  outro(
    `Starting interactive rebase: "$ rebase -i ${commitsToImprove[0].parents[0].sha}".`
  );
  await execa('git', ['rebase', '-i', commitsToImprove[0].parents[0].sha]);

  for (const commit of commitsToImprove) {
    try {
      const commitDiff = improvedMessagesBySha[commit.sha];

      console.log({ commitDiff });

      await execa('git', ['commit', '--amend', '-m', commitDiff]);
      await execa('git', ['rebase', '--continue']);
    } catch (error) {
      throw error;
    } finally {
      outro(
        '📝 Commit messages improved with an interactive rebase: `$ rebase -i`'
      );
    }
  }

  outro('Force pushing interactively rebased commits into remote origin.');

  // Force push the rebased commits
  await execa('git', ['push', 'origin', `+${context.ref}`]);

  outro('Done ⏱️');
}

async function run(retries = 3) {
  intro('OpenCommit — improving commit messages with GPT');

  try {
    if (github.context.eventName === 'pull_request') {
      if (github.context.payload.action === 'opened')
        outro('Pull Request opened');
      else if (github.context.payload.action === 'synchronize')
        outro('New commits are pushed');
      else return outro('Unhandled action: ' + github.context.payload.action);

      const payload = github.context.payload as PullRequestEvent;

      const commitsResponse = await octokit.rest.pulls.listCommits({
        owner,
        repo,
        pull_number: payload.pull_request.number
      });

      const commits = commitsResponse.data;

      await improveCommitMessagesWithRebase(commits);
    } else {
      outro('Wrong action.');
      core.error(
        `OpenCommit was called on ${github.context.payload.action}. OpenCommit is not supposed to be used on actions other from "pull_request.opened" and "pull_request.synchronize".`
      );
    }
  } catch (error: any) {
    if (retries) run(--retries);
    else core.setFailed(error?.message || error);
  }
}

run();
