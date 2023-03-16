import { execa } from 'execa';
import {
  GenerateCommitMessageErrorEnum,
  generateCommitMessageWithChatCompletion
} from '../generateCommitMessageFromGitDiff';
import { assertGitRepo, getStagedGitDiff } from '../utils/git';
import { spinner, confirm, outro, isCancel, intro, select } from '@clack/prompts';
import chalk from 'chalk';

// Adding a function to get the list of remotes
const getGitRemotes = async () => {
  const { stdout } = await execa('git', ['remote']);
  return stdout.split('\n').filter((remote) => remote.trim() !== '');
};

const generateCommitMessageFromGitDiff = async (
  diff: string
): Promise<void> => {
  await assertGitRepo();

  const commitSpinner = spinner();
  commitSpinner.start('Generating the commit message');
  const commitMessage = await generateCommitMessageWithChatCompletion(diff);

  // TODO: show proper error messages
  if (typeof commitMessage !== 'string') {
    const errorMessages = {
      [GenerateCommitMessageErrorEnum.emptyMessage]:
        'empty openAI response, weird, try again',
      [GenerateCommitMessageErrorEnum.internalError]:
        'internal error, try again',
      [GenerateCommitMessageErrorEnum.tooMuchTokens]:
        'too much tokens in git diff, stage and commit files in parts'
    };

    outro(`${chalk.red('✖')} ${errorMessages[commitMessage.error]}`);
    process.exit(1);
  }

  commitSpinner.stop('📝 Commit message generated');

  outro(
    `Commit message:
${chalk.grey('——————————————————')}
${commitMessage}
${chalk.grey('——————————————————')}`
  );

  const isCommitConfirmedByUser = await confirm({
    message: 'Confirm the commit message'
  });

  if (isCommitConfirmedByUser && !isCancel(isCommitConfirmedByUser)) {
    const { stdout } = await execa('git', ['commit', '-m', commitMessage]);
    outro(`${chalk.green('✔')} successfully committed`);
    outro(stdout);
    const isPushConfirmedByUser = await confirm({
      message: 'Do you want to run `git push`?'
    });

    if (isPushConfirmedByUser && !isCancel(isPushConfirmedByUser)) {
      const pushSpinner = spinner();

      // Get the list of remotes and ask the user to choose the desired remote
      const remotes = await getGitRemotes();
      const selectedRemote = await select({
        message: 'Choose a remote to push to',
        choices: remotes.map((remote) => ({ title: remote, value: remote })),
      });
      
      if (!isCancel(selectedRemote)) {
      pushSpinner.start(`Running \`git push ${selectedRemote}\``);
      const { stdout } = await execa('git', ['push', selectedRemote]);
      pushSpinner.stop(`${chalk.green('✔')} successfully pushed all commits to ${selectedRemote}`);

      if (stdout) outro(stdout);
    }
  } else outro(`${chalk.gray('✖')} process cancelled`);
};

export async function commit(isStageAllFlag = false) {
  intro('open-commit');

  const stagedFilesSpinner = spinner();
  stagedFilesSpinner.start('Counting staged files');
  const staged = await getStagedGitDiff(isStageAllFlag);

  if (!staged && isStageAllFlag) {
    outro(
      `${chalk.red(
        'No changes detected'
      )} — write some code, stage the files ${chalk
        .hex('0000FF')
        .bold('`git add .`')} and rerun ${chalk
        .hex('0000FF')
        .bold('`oc`')} command.`
    );

    process.exit(1);
  }

  if (!staged) {
    outro(
      `${chalk.red('Nothing to commit')} — stage the files ${chalk
        .hex('0000FF')
        .bold('`git add .`')} and rerun ${chalk
        .hex('0000FF')
        .bold('`oc`')} command.`
    );

    stagedFilesSpinner.stop('No files are staged');
    const isStageAllAndCommitConfirmedByUser = await confirm({
      message: 'Do you want to stage all files and generate commit message?'
    });

    if (
      isStageAllAndCommitConfirmedByUser &&
      !isCancel(isStageAllAndCommitConfirmedByUser)
    ) {
      await commit(true);
    }

    process.exit(1);
  }

  stagedFilesSpinner.stop(
    `${staged.files.length} staged files:\n${staged.files
      .map((file) => `  ${file}`)
      .join('\n')}`
  );

  await generateCommitMessageFromGitDiff(staged.diff);
}