import core from '@actions/core';
import github from '@actions/github';
import { execa } from 'execa';
import { intro, outro } from '@clack/prompts';
import { PullRequestEvent } from '@octokit/webhooks-types';
import { generateCommitMessageByDiff } from './generateCommitMessageFromGitDiff';

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
type DiffBySHA = Record<SHA, Diff>;

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
    outro('No commits with a message "oc" found.');
    outro(
      'If you want OpenCommit Action to generate a commit message for you — commit the message as two letters: "oc"'
    );
    return;
  }

  outro(`Found ${commitsToImprove.length} commits, improving`);

  const commitShas = commitsToImprove.map((commit) => commit.sha);
  const diffPromises = commitShas.map((sha) => getCommitDiff(sha));

  const commitDiffBySha: DiffBySHA = await Promise.all(diffPromises)
    .then((results) =>
      results.reduce((acc, result) => {
        acc[result.sha] = result.diff;
        return acc;
      }, {} as DiffBySHA)
    )
    .catch((error) => {
      outro(`error in Promise.all(getCommitDiffs(SHAs)): ${error}`);
      throw error;
    });

  outro('Starting interactive rebase: `$ rebase -i`.');
  await execa('git', [
    'rebase',
    '-i',
    commitsToImprove
      .map((commit) => commit.sha)
      .join(' ')
      .trim()
  ]);

  for (const commit of commitsToImprove) {
    try {
      const commitDiff = commitDiffBySha[commit.sha];

      const improvedMessage = await generateCommitMessageByDiff(commitDiff);

      await execa('git', ['commit', '--amend', '-m', improvedMessage]);
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

  outro('Done 🙏');
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

      outro('testing outro');

      await improveCommitMessagesWithRebase(commits);
    } else {
      outro('wrong action');
      core.error(
        `OpenCommit was called on ${github.context.payload.action}. OpenCommit is not supposed to be used on actions other from "pull_request.opened" and "push".`
      );
    }
  } catch (error: any) {
    if (retries) run(--retries);
    else core.setFailed(error?.message || error);
  }
}

run();
