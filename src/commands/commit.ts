// Importing necessary libraries and modules
import chalk from 'chalk';  // Library to style terminal strings
import { execa } from 'execa';  // Process execution for Node

// Importing custom modules
import {
  confirm,
  intro,
  isCancel,
  multiselect,
  outro,
  select,
  spinner
} from '@clack/prompts';  // Custom prompt functions

import { generateCommitMessageByDiff } from '../generateCommitMessageFromGitDiff';  // Function to generate commit message based on git diff
import {
  assertGitRepo,
  getChangedFiles,
  getDiff,
  getStagedFiles,
  gitAdd
} from '../utils/git';  // Utility functions for git operations
import { trytm } from '../utils/trytm';  // Utility function for try-catch block
import { getConfig } from './config';  // Function to get configuration

// Getting configuration
const config = getConfig();

/**
 * Function to get git remotes
 * @async
 * @function
 * @returns {Promise<string[]>} - An array of remote names
 */
const getGitRemotes = async () => {
  const { stdout } = await execa('git', ['remote']);  // Execute git remote command
  return stdout.split('\n').filter((remote) => Boolean(remote.trim()));  // Split stdout by newline, filter out empty strings and return
};

/**
 * Function to check for message template in extra arguments
 * @param {string[]} extraArgs - Extra arguments passed to the commit command
 * @returns {string | false} - Returns the message template if found, otherwise false
 */
const checkMessageTemplate = (extraArgs) => {
  for (const key in extraArgs) {
    if (extraArgs[key].includes(config?.OCO_MESSAGE_TEMPLATE_PLACEHOLDER))
      return extraArgs[key];
  }
  return false;
};

/**
 * Function to generate commit message from git diff, and commit changes
 * @async
 * @function
 * @param {string} diff - The git diff string
 * @param {string[]} extraArgs - Extra arguments passed to the commit command
 * @param {Boolean} isYesFlagSet - Flag to skip confirmation prompts
 * @returns {Promise<void>} - Resolves when the operation completes
 */
const generateCommitMessageFromGitDiff = async (
  diff: string,
  extraArgs: string[],
  isYesFlagSet: Boolean
) => {
  await assertGitRepo();  // Ensure the directory is a git repository
  const commitSpinner = spinner();  // Create a spinner for visual feedback
  commitSpinner.start('Generating the commit message');  // Start spinner

  try {
    let commitMessage = await generateCommitMessageByDiff(diff);  // Generate commit message based on git diff

    const messageTemplate = checkMessageTemplate(extraArgs);  // Check for message template in extra args
    if (
      config?.OCO_MESSAGE_TEMPLATE_PLACEHOLDER &&
      typeof messageTemplate === 'string'
    ) {
      commitMessage = messageTemplate.replace(
        config?.OCO_MESSAGE_TEMPLATE_PLACEHOLDER,
        commitMessage
      );  // Replace placeholder in message template with generated commit message
    }

    commitSpinner.stop('📝 Commit message generated');  // Stop spinner

    // Confirm commit message with user or proceed if isYesFlagSet is true
    const isCommitConfirmedByUser = isYesFlagSet 
      ? true 
      : await confirm({ message: 'Confirm the commit message?' });

    if (isCommitConfirmedByUser && !isCancel(isCommitConfirmedByUser)) {
      // If commit is confirmed, execute git commit command
      const { stdout } = await execa('git', [
        'commit',
        '-m',
        commitMessage,
        ...extraArgs
      ]);

      outro(`${chalk.green('✔')} Successfully committed`);  // Log success message
      outro(stdout);  // Log stdout from git commit command

      const remotes = await getGitRemotes();  // Get git remotes

      // If no remotes, run git push without specifying remote
      if (!remotes.length) {
        const { stdout } = await execa('git', ['push']);
        if (stdout) outro(stdout);
        process.exit(0);
      }

      // If a single remote, confirm with user to push or proceed if isYesFlagSet is true
      if (remotes.length === 1) {
        const isPushConfirmedByUser = isYesFlagSet 
          ? true 
          : await confirm({ message: 'Do you want to run `git push`?' });

        if (isPushConfirmedByUser && !isCancel(isPushConfirmedByUser)) {
          const pushSpinner = spinner();  // Create a spinner for visual feedback
          pushSpinner.start(`Running 'git push ${remotes[0]}'`);  // Start spinner

          // Execute git push command
          const { stdout } = await execa('git', [
            'push',
            '--verbose',
            remotes[0]
          ]);

          pushSpinner.stop(
            `${chalk.green('✔')} Successfully pushed all commits to ${
              remotes[0]
            }`
          );  // Stop spinner and log success message

          if (stdout) outro(stdout);  // Log stdout from git push command
        } else {
          outro('`git push` aborted');  // Log abort message
          process.exit(0);
        }
      } else {
        // If multiple remotes, prompt user to select a remote
        const selectedRemote = (await select({
          message: 'Choose a remote to push to',
          options: remotes.map((remote) => ({ value: remote, label: remote }))
        })) as string;

        if (!isCancel(selectedRemote)) {
          const pushSpinner = spinner();  // Create a spinner for visual feedback
          pushSpinner.start(`Running 'git push ${selectedRemote}'`);  // Start spinner

          // Execute git push command for selected remote
          const { stdout } = await execa('git', ['push', selectedRemote]);

          pushSpinner.stop(
            `${chalk.green(
              '✔'
            )} Successfully pushed all commits to ${selectedRemote}`
          );  // Stop spinner and log success message

          if (stdout) outro(stdout);  // Log stdout from git push command
        } else outro(`${chalk.gray('✖')} process cancelled`);  // Log cancellation message
      }
    }
  } catch (error) {
    commitSpinner.stop('📝 Commit message generated');  // Stop spinner

    const err = error as Error;
    outro(`${chalk.red('✖')} ${err?.message || err}`);  // Log error message
    process.exit(1);
  }
};

/**
 * Main commit function to handle staging, committing and pushing changes
 * @async
 * @function
 * @param {string[]} extraArgs - Extra arguments passed to the commit command
 * @param {Boolean} isStageAllFlag - Flag to stage all changes
 * @param {Boolean} isYesFlagSet - Flag to skip confirmation prompts
 * @returns {Promise<void>} - Resolves when the operation completes
 */
export async function commit(
  extraArgs = [],
  isStageAllFlag = false,
  isYesFlagSet = false
) {
  // Try to get staged and changed files, handle errors
  const [stagedFiles, errorStagedFiles] = await trytm(getStagedFiles());
  const [changedFiles, errorChangedFiles] = await trytm(getChangedFiles());

  // If no changes detected, log message and exit
  if (!changedFiles?.length && !stagedFiles?.length) {
    outro(chalk.red('No changes detected'));
    process.exit(1);
  }

  intro('open-commit');  // Log intro message
  if (errorChangedFiles ?? errorStagedFiles) {
    outro(`${chalk.red('✖')} ${errorChangedFiles ?? errorStagedFiles}`);  // Log error message
    process.exit(1);
  }

  const stagedFilesSpinner = spinner();  // Create a spinner for visual feedback
  stagedFilesSpinner.start('Counting staged files');  // Start spinner

  // Handle staging files and committing changes
  if (!stagedFiles.length) {
    if (isYesFlagSet) {
      await execa('git', ['add', '.']);
    }

    stagedFilesSpinner.stop('No files are staged');  // Stop spinner

    // Confirm with user to stage all files and commit or proceed if isYesFlagSet is true
    const isStageAllAndCommitConfirmedByUser = isYesFlagSet
      ? true
      : await confirm({
          message: 'Do you want to stage all files and generate commit message?'
        });

    if (
      isStageAllAndCommitConfirmedByUser &&
      !isCancel(isStageAllAndCommitConfirmedByUser)
    ) {
      await commit(extraArgs, true, isYesFlagSet);  // Stage all files and commit
      process.exit(1);
    }

    if (stagedFiles.length === 0 && changedFiles.length > 0) {
      // Prompt user to select files to stage
      const files = (await multiselect({
        message: chalk.cyan('Select the files you want to add to the commit:'),
        options: changedFiles.map((file) => ({
          value: file,
          label: file
        }))
      })) as string[];

      if (isCancel(files)) process.exit(1);

      await gitAdd({ files });  // Stage selected files
    }

    await commit(extraArgs, false, isYesFlagSet);  // Commit changes
    process.exit(1);
  }

  stagedFilesSpinner.stop(
    `${stagedFiles.length} staged files:\n${stagedFiles
      .map((file) => `  ${file}`)
      .join('\n')}`
  );  // Stop spinner and log staged files

  // Try to generate commit message from git diff and handle errors
  const [, generateCommitError] = await trytm(
    generateCommitMessageFromGitDiff(
      await getDiff({ files: stagedFiles }),
      extraArgs,
      isYesFlagSet
    )
  );

  if (generateCommitError) {
    outro(`${chalk.red('✖')} ${generateCommitError}`);  // Log error message
    process.exit(1);
  }

  process.exit(0);  // Exit with success status
}
