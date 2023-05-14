import * as child_process from 'child_process';
import * as core from '@actions/core';
import * as github from '@actions/github';

// TODO: add all OpenCommit configs

// TODO: replace with execa package
function execShellCommand(cmd: string) {
  return new Promise<string>((resolve, reject) => {
    child_process.exec(
      cmd,
      (
        error: child_process.ExecException | null,
        stdout: string,
        stderr: string
      ) => {
        if (error) {
          reject(stderr);
        } else {
          resolve(stdout);
        }
      }
    );
  });
}

async function run() {
  try {
    const token = core.getInput('token');
    const octokit = github.getOctokit(token);

    const context = github.context;
    const owner = context.repo.owner;
    const repo = context.repo.repo;

    const commits = await octokit.rest.repos.get({
      owner: owner,
      repo: repo
    });

    let shasToReword = '';

    // TODO: fix the error
    for (const commit of commits) {
      if (commit.commit.message.includes('oc')) {
        shasToReword += `${commit.sha} `;
      }
    }

    if (shasToReword) {
      // Start an interactive rebase
      await execShellCommand(`git rebase -i ${shasToReword.trim()}`);

      // For each commit to be modified, change the message
      for (const sha of shasToReword.split(' ')) {
        // TODO: call openAI
        const improvedMessage = 'TODO';
        await execShellCommand(
          `git commit --amend -m "$${improvedMessage}" && git rebase --continue`
        );
      }

      // Force push the rebased commits
      await execShellCommand(`git push origin +${context.ref}`);
    }
  } catch (error: any) {
    // TODO: fix any after test
    core.setFailed(error!.message || error);
  }
}

run();
