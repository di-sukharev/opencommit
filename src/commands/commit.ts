import { execa } from 'execa';
import {
  GenerateCommitMessageErrorEnum,
  generateCommitMessageWithChatCompletion
} from '../generateCommitMessageFromGitDiff';
import {
  assertGitRepo,
  getChangedFiles,
  getDiff,
  getStagedFiles,
  gitAdd
} from '../utils/git';
import {
  spinner,
  confirm,
  outro,
  isCancel,
  intro,
  multiselect,
  select,
  text
} from '@clack/prompts';
import chalk from 'chalk';
import { trytm } from '../utils/trytm';

const getGitRemotes = async () => {
  const { stdout } = await execa('git', ['remote']);
  return stdout.split('\n').filter((remote) => Boolean(remote.trim()));
};

const generateCommitMessageFromGitDiff = async (
  diff: string,
  extraArgs: string[]
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
  
  const promptUserConfirm = async(commitText: string ) => {

    const isCommitConfirmedByUser = await select({
      message: 'Confirm the commit message',
      options: [
        {value: "yes", label: "Yes"},
        {value: "no", label: "No"},
        {value: "edit", label: "Edit"}
      ]
      
    });

    if (isCommitConfirmedByUser == "yes" && !isCancel(isCommitConfirmedByUser)) {
      const { stdout } = await execa('git', [
        'commit',
        '-m',
        commitText,
        ...extraArgs
      ]);

      outro(`${chalk.green('✔')} successfully committed`);

      outro(stdout);
      
      const remotes = await getGitRemotes();

      if (remotes.length === 1) {
        const isPushConfirmedByUser = await confirm({
          message: 'Do you want to run `git push`?'
        });

        if (isPushConfirmedByUser && !isCancel(isPushConfirmedByUser)) {
          const pushSpinner = spinner();
          
          pushSpinner.start(`Running \`git push ${remotes[0]}\``);
          
          const { stdout } = await execa('git', [
            'push',
            '--verbose',
            remotes[0]
          ]);
          
          pushSpinner.stop(
            `${chalk.green('✔')} successfully pushed all commits to ${remotes[0]}`
          );
          
          if (stdout) outro(stdout);
        }
      } else {
        const selectedRemote = (await select({
          message: 'Choose a remote to push to',
          options: remotes.map((remote) => ({ value: remote, label: remote }))
        })) as string;

        if (!isCancel(selectedRemote)) {
          const pushSpinner = spinner();
          pushSpinner.start(`Running \`git push ${selectedRemote}\``);
          const { stdout } = await execa('git', ['push', selectedRemote]);
          pushSpinner.stop(
            `${chalk.green(
              '✔'
            )} successfully pushed all commits to ${selectedRemote}`
          );

        if (stdout) outro(stdout);
      } else {
        outro('`git push` aborted');
        process.exit(0);
      }
    } else if (isCommitConfirmedByUser == "edit" && !isCancel(isCommitConfirmedByUser)) {
      await promptUserEdit(commitText)
    } else if (isCommitConfirmedByUser == "no" && !isCancel(isCommitConfirmedByUser)) {
      outro(`👋 exiting`);
    } 
  }
  
  const promptUserEdit = async(commitText: string) => {
    let commitLines = commitText.split("\n") 
    let updatedCommitMessage

    if (commitLines.length > 1 ) {
      let newCommitLines = []

      for (const line of commitLines) {
        if (line !== "") {
          const newLine = await text({
            message: 'Update line:',
            initialValue: line,
            placeholder: "",
            validate(value) {
              if (line == commitLines[commitLines.length -1] && newCommitLines.length == 0 && value == "") {
                return "Message cannot be empty" 
              } 
            }
          })
          
          if (isCancel(newLine)) { 
            process.exit(0) 
          }

          if (newLine !== undefined) {
            newCommitLines.push(newLine)
          }
        }
      }
      
      updatedCommitMessage = newCommitLines.join("\n\n")

    } else {

      updatedCommitMessage = await text({
        message: 'Update the commit message:',
        initialValue: commitLines[0],
        validate: (value) => value == "" ? "Message cannot be empty" : ""
      })
    }
    
    if (isCancel(updatedCommitMessage)) { 
      process.exit(0) 
    }
    outro(
      `Commit message:
${chalk.grey('——————————————————')}
${updatedCommitMessage}
${chalk.grey('——————————————————')}`
    );

    await promptUserConfirm(updatedCommitMessage as string)
  }

  await promptUserConfirm(commitMessage)

};

export async function commit(
  extraArgs: string[] = [],
  isStageAllFlag: Boolean = false
) {
  if (isStageAllFlag) {
    const changedFiles = await getChangedFiles();

    if (changedFiles) await gitAdd({ files: changedFiles });
    else {
      outro('No changes detected, write some code and run `oc` again');
      process.exit(1);
    }
  }

  const [stagedFiles, errorStagedFiles] = await trytm(getStagedFiles());
  const [changedFiles, errorChangedFiles] = await trytm(getChangedFiles());

  if (!changedFiles?.length && !stagedFiles?.length) {
    outro(chalk.red('No changes detected'));
    process.exit(1);
  }

  intro('open-commit');
  if (errorChangedFiles ?? errorStagedFiles) {
    outro(`${chalk.red('✖')} ${errorChangedFiles ?? errorStagedFiles}`);
    process.exit(1);
  }

  const stagedFilesSpinner = spinner();

  stagedFilesSpinner.start('Counting staged files');

  if (!stagedFiles.length) {
    stagedFilesSpinner.stop('No files are staged');
    const isStageAllAndCommitConfirmedByUser = await confirm({
      message: 'Do you want to stage all files and generate commit message?'
    });

    if (
      isStageAllAndCommitConfirmedByUser &&
      !isCancel(isStageAllAndCommitConfirmedByUser)
    ) {
      await commit(extraArgs, true);
      process.exit(1);
    }

    if (stagedFiles.length === 0 && changedFiles.length > 0) {
      const files = (await multiselect({
        message: chalk.cyan('Select the files you want to add to the commit:'),
        options: changedFiles.map((file) => ({
          value: file,
          label: file
        }))
      })) as string[];

      if (isCancel(files)) process.exit(1);

      await gitAdd({ files });
    }

    await commit(extraArgs, false);
    process.exit(1);
  }

  stagedFilesSpinner.stop(
    `${stagedFiles.length} staged files:\n${stagedFiles
      .map((file) => `  ${file}`)
      .join('\n')}`
  );

  const [, generateCommitError] = await trytm(
    generateCommitMessageFromGitDiff(
      await getDiff({ files: stagedFiles }),
      extraArgs
    )
  );

  if (generateCommitError) {
    outro(`${chalk.red('✖')} ${generateCommitError}`);
    process.exit(1);
  }

  process.exit(0);
}
