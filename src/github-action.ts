import core from '@actions/core';
import github from '@actions/github';
import { execa } from 'execa';
import { Commit, PushEvent } from '@octokit/webhooks-types';
import { intro, outro, spinner } from '@clack/prompts';
import { PullRequestEvent } from '@octokit/webhooks-types';

// This should be a token with access to your repository scoped in as a secret.
// The YML workflow will need to set GITHUB_TOKEN with the GitHub Secret Token
// GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
// https://help.github.com/en/actions/automating-your-workflow-with-github-actions/authenticating-with-the-github_token#about-the-github_token-secret
const GITHUB_TOKEN = core.getInput('GITHUB_TOKEN');
const octokit = github.getOctokit(GITHUB_TOKEN);
const context = github.context;
const owner = context.repo.owner;
const repo = context.repo.repo;

type ListCommitsResponse = ReturnType<typeof octokit.rest.pulls.listCommits>; // This gives you Promise<OctokitResponse<PullsListCommitsResponseData>>

type CommitsData = ListCommitsResponse extends Promise<infer T> ? T : never; // This gives you OctokitResponse<PullsListCommitsResponseData>

type CommitsArray = CommitsData['data'];

async function improveCommitMessagesWithRebase(commits: CommitsArray) {
  const commitsToImprove = [];
  // TODO: fix the error
  for (const commit of commits) {
    if (commit.message === 'oc' && commit.distinct) {
      commitsToImprove.push(commit);
    }
  }

  if (commitsToImprove.length) {
    const commitSpinner = spinner();
    commitSpinner.start(
      `found ${commitsToImprove.length} commits with a message "oc", improving`
    );

    // Start an interactive rebase
    await execa('git', ['rebase', '-i', commitsToImprove.join(' ').trim()]);

    for (const commit of commitsToImprove) {
      // Question: how to get commit diff here?
      const improvedMessage = `improved: ${commit.id}`;

      await execa('git', ['commit', '--amend', '-m', improvedMessage]);
      await execa('git', ['rebase', '--continue']);
    }

    // Force push the rebased commits
    await execa('git', ['push', 'origin', `+${context.ref}`]);

    commitSpinner.stop('📝 Commit messages improved with a `rebase -i`');
  } else {
    console.log(
      'No commits with a message "oc" found. If you want OpenCommit to generate a commit message for you — leave the message as "oc".'
    );
  }
}

async function run() {
  intro('OpenCommit — improving commit messages with GPT');
  try {
    if (github.context.eventName === 'pull_request') {
      if (github.context.payload.action === 'opened')
        outro('Pull Request opened');
      else if (github.context.payload.action === 'synchronize')
        outro('New commits are pushed');
      else return outro('Unhandled action: ' + github.context.payload.action);

      const payload = github.context.payload as PullRequestEvent;
      // Question: how to get proper Input type
      const commitsResponse = await octokit.rest.pulls.listCommits({
        owner,
        repo,
        pull_number: payload.pull_request.number
      });

      const commits = commitsResponse.data;
      core.info('testing core.info');
      outro('testing outro');

      return await improveCommitMessagesWithRebase(commits);
    } else {
      outro('wrong action');
      core.error(
        `OpenCommit was called on ${github.context.payload.action}. OpenCommit is not supposed to be used on actions other from "pull_request.opened" and "push".`
      );
    }
  } catch (error: any) {
    // TODO: fix any after test
    core.setFailed(error!.message || error);
  }
}

run();
