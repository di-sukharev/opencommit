import {
  confirm,
  intro,
  isCancel,
  multiselect,
  outro,
  select,
  spinner
} from '@clack/prompts';
import chalk from 'chalk';
import { execa } from 'execa';
import { generateCommitMessageByDiff } from '../generateCommitMessageFromGitDiff';
import {
  assertGitRepo,
  getChangedFiles,
  getDiff,
  getStagedFiles,
  gitAdd
} from '../utils/git';
import { trytm } from '../utils/trytm';
import { getConfig } from './config';
import { CommitCache } from '../utils/commitCache';
import { Logger } from '../utils/logger';

const config = getConfig();

const getGitRemotes = async () => {
  const { stdout } = await execa('git', ['remote']);
  return stdout.split('\n').filter((remote) => Boolean(remote.trim()));
};

// Check for the presence of message templates
const checkMessageTemplate = (extraArgs: string[]): string | false => {
  for (const key in extraArgs) {
    if (extraArgs[key].includes(config.OCO_MESSAGE_TEMPLATE_PLACEHOLDER))
      return extraArgs[key];
  }
  return false;
};

interface GenerateCommitMessageFromGitDiffParams {
  diff: string;
  extraArgs: string[];
  context?: string;
  fullGitMojiSpec?: boolean;
  skipCommitConfirmation?: boolean;
}

const generateCommitMessageFromGitDiff = async ({
  diff,
  extraArgs,
  context = '',
  fullGitMojiSpec = false,
  skipCommitConfirmation = false
}: GenerateCommitMessageFromGitDiffParams): Promise<void> => {
  await assertGitRepo();
  const commitGenerationSpinner = spinner();
  commitGenerationSpinner.start('Generating the commit message');
  Logger.spinner('Generating the commit message');

  try {
    let commitMessage = await generateCommitMessageByDiff(
      diff,
      fullGitMojiSpec,
      context
    );
    Logger.debug('Generated commit message:', commitMessage);

    const messageTemplate = checkMessageTemplate(extraArgs);
    if (
      config.OCO_MESSAGE_TEMPLATE_PLACEHOLDER &&
      typeof messageTemplate === 'string'
    ) {
      const messageTemplateIndex = extraArgs.indexOf(messageTemplate);
      extraArgs.splice(messageTemplateIndex, 1);

      commitMessage = messageTemplate.replace(
        config.OCO_MESSAGE_TEMPLATE_PLACEHOLDER,
        commitMessage
      );
      Logger.debug('Applied message template:', commitMessage);
    }

    commitGenerationSpinner.stop('📝 Commit message generated');
    Logger.spinnerSuccess('Commit message generated');

    const separator = '─'.repeat(50);
    const messageBox = `Generated commit message:\n│ ${chalk.grey(separator)}\n│ ${commitMessage}\n│ ${chalk.grey(separator)}`;
    outro(messageBox);
    // Remove duplicate logging
    Logger.debug('Generated commit message:', commitMessage);

    const isCommitConfirmedByUser =
      skipCommitConfirmation ||
      (await confirm({
        message: `Confirm the commit message?`
      }));

    if (isCancel(isCommitConfirmedByUser)) {
      Logger.info('User cancelled commit');
      process.exit(0);
    }

    if (isCommitConfirmedByUser) {
      Logger.info('User confirmed commit message');
      // Save commit message to cache before committing
      await CommitCache.saveCommitMessage(commitMessage);
      Logger.debug('Saved commit message to cache');

      const committingChangesSpinner = spinner();
      committingChangesSpinner.start('Committing the changes');
      Logger.spinner('Committing the changes');

      try {
        const { stdout } = await execa('git', [
          'commit',
          '-m',
          commitMessage,
          ...extraArgs
        ]);
        const successMessage = `${chalk.green('✔')} Successfully committed`;
        committingChangesSpinner.stop(successMessage);
        Logger.spinnerSuccess('Successfully committed');
        
        await CommitCache.clearCache();
        Logger.debug('Cleared commit cache');
        
        // Only output git commit result once
        outro(`│ ${stdout}`);

        const remotes = await getGitRemotes();

        // user isn't pushing, return early
        if (config.OCO_GITPUSH === false) return;

        if (!remotes.length) {
          const { stdout } = await execa('git', ['push']);
          if (stdout) outro(stdout);
          process.exit(0);
        }

        if (remotes.length === 1) {
          const isPushConfirmedByUser = await confirm({
            message: 'Do you want to run `git push`?'
          });

          if (isCancel(isPushConfirmedByUser)) process.exit(1);

          if (isPushConfirmedByUser) {
            const pushSpinner = spinner();

            pushSpinner.start(`Running 'git push ${remotes[0]}'`);

            const { stdout } = await execa('git', [
              'push',
              '--verbose',
              remotes[0]
            ]);

            pushSpinner.stop(
              `│ ${chalk.green('✔')} Successfully pushed all commits to ${remotes[0]}`
            );

            if (stdout) outro(`│\n│ ${stdout}\n│`);
          } else {
            outro('│\n│ `git push` aborted\n│');
            process.exit(0);
          }
        } else {
          const skipOption = `don't push`
          const selectedRemote = (await select({
            message: 'Choose a remote to push to:',
            options: [...remotes, skipOption].map((remote) => ({
              value: remote,
              label: remote
            }))
          })) as string;

          if (isCancel(selectedRemote)) process.exit(1);

          if (selectedRemote !== skipOption) {
            const pushSpinner = spinner();
    
            pushSpinner.start(`Running 'git push ${selectedRemote}'`);
    
            const { stdout } = await execa('git', ['push', selectedRemote]);
    
            if (stdout) outro(`│\n│ ${stdout}\n│`);
    
            pushSpinner.stop(
              `│ ${chalk.green('✔')} Successfully pushed all commits to ${selectedRemote}`
            );
          }
        }
      } catch (error: any) {
        const failMessage = `${chalk.red('✖')} Commit failed`;
        committingChangesSpinner.stop(failMessage);
        Logger.spinnerError('Commit failed');
        
        outro(formatErrorOutput(error, 'Commit Failed'));
        // Remove duplicate logging
        Logger.debug('Commit error:', error);
        
        process.exit(1);
      }
    } else {
      const regenerateMessage = await confirm({
        message: 'Do you want to regenerate the message?'
      });

      if (isCancel(regenerateMessage)) process.exit(0);

      if (regenerateMessage) {
        await generateCommitMessageFromGitDiff({
          diff,
          extraArgs,
          fullGitMojiSpec
        });
      } else {
        process.exit(0);
      }
    }
  } catch (error: any) {
    const failMessage = `${chalk.red('✖')} Failed to generate the commit message`;
    commitGenerationSpinner.stop(failMessage);
    Logger.spinnerError('Failed to generate the commit message');
    
    outro(formatErrorOutput(error, 'Commit Failed'));
    // Remove duplicate logging
    Logger.debug('Generation error:', error);
    
    process.exit(1);
  }
};

const formatErrorOutput = (error: any, type: string = 'Commit Failed') => {
  const separator = chalk.gray('─'.repeat(50));
  const formatLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return '│';
    
    // Format check results with proper alignment
    if (trimmed.match(/\.(Passed|Failed|Skipped)$/)) {
      const [name, result] = trimmed.split(/\.{2,}/);
      const dots = '.'.repeat(Math.max(0, 50 - name.length - result.length));
      const formattedResult = result.trim();
      
      if (formattedResult === 'Failed') {
        return `│ ${name}${dots}${chalk.red(formattedResult)}`;
      }
      if (formattedResult === 'Passed') {
        return `│ ${name}${dots}${chalk.green(formattedResult)}`;
      }
      if (formattedResult === 'Skipped') {
        return `│ ${name}${dots}${chalk.gray(formattedResult)}`;
      }
    }

    // Format error details with indentation
    if (trimmed.startsWith('-')) {
      return `│   ${chalk.gray(trimmed)}`;
    }

    // Format file paths and error messages
    if (trimmed.includes(':')) {
      return `│   ${trimmed.replace(/([^:]+):(\d+)?/g, (_, file, line) => {
        return chalk.cyan(file) + (line ? chalk.yellow(':' + line) : '');
      })}`;
    }

    // Format warnings and info
    if (trimmed.includes('[WARNING]')) return `│ ${chalk.yellow(trimmed)}`;
    if (trimmed.includes('[INFO]')) return `│ ${chalk.blue(trimmed)}`;

    return `│ ${trimmed}`;
  };

  const isPreCommitError = type === 'Pre-commit Hook Failed';
  const lines = [
    chalk.red(type),
    separator
  ];

  if (error.stderr) {
    const formattedLines = error.stderr
      .split('\n')
      .map(formatLine)
      .filter(line => line.length > 0);
    
    lines.push(...formattedLines);
  } else {
    lines.push(`│ ${chalk.red(error.message || String(error))}`);
  }

  lines.push(
    separator,
    '│ ' + chalk.yellow(isPreCommitError 
      ? 'Please fix the issues in your code before committing'
      : 'Fix the issues or generate a new commit message'
    ),
    '│ ' + `Logs: ${Logger.getLogPath()}`
  );

  if (!isPreCommitError) {
    lines.push('│ ' + chalk.gray('Consider generating a new commit message if the issue persists'));
  }

  return lines.join('\n');
};

export async function commit(
  extraArgs: string[] = [],
  context: string = '',
  isStageAllFlag: Boolean = false,
  fullGitMojiSpec: boolean = false,
  skipCommitConfirmation: boolean = false
) {
  try {
    if (isStageAllFlag) {
      const changedFiles = await getChangedFiles();

      if (changedFiles) await gitAdd({ files: changedFiles });
      else {
        outro('No changes detected, write some code and run `oco` again');
        process.exit(0);
      }
    }

    const [stagedFiles, errorStagedFiles] = await trytm(getStagedFiles());
    const [changedFiles, errorChangedFiles] = await trytm(getChangedFiles());

    if (!changedFiles?.length && !stagedFiles?.length) {
      outro(chalk.red('No changes detected'));
      process.exit(0);
    }

    intro('open-commit');
    if (errorChangedFiles ?? errorStagedFiles) {
      outro(`${chalk.red('✖')} ${errorChangedFiles ?? errorStagedFiles}`);
      process.exit(1);
    }

    const stagedFilesSpinner = spinner();
    stagedFilesSpinner.start('Counting staged files');

    // Clean up old caches periodically
    await CommitCache.cleanupOldCaches();

    // Check for cached commit message
    const cachedCommit = await CommitCache.getLastCommitMessage();
    if (cachedCommit) {
      // Stop the spinner before showing the cached message prompt
      stagedFilesSpinner.stop('Files counted');
      Logger.spinner('Files counted');

      Logger.info('Found cached commit message');
      const separator = '─'.repeat(50);
      const useCachedMessage = await confirm({
        message: `Found cached commit message for the same files. Use it?\n│ ${chalk.grey(separator)}\n│ ${cachedCommit.message}\n│ ${chalk.grey(separator)}`
      });

      if (isCancel(useCachedMessage)) {
        Logger.info('User cancelled using cached message');
        process.exit(0);
      }

      if (useCachedMessage) {
        Logger.info('Using cached commit message');
        const committingChangesSpinner = spinner();
        
        try {
          // Start the commit spinner
          committingChangesSpinner.start('Committing with cached message');
          Logger.spinner('Committing with cached message');

          const { stdout } = await execa('git', [
            'commit',
            '-m',
            cachedCommit.message,
            ...extraArgs
          ]);

          const successMessage = `${chalk.green('✔')} Successfully committed with cached message`;
          committingChangesSpinner.stop(successMessage);
          Logger.spinnerSuccess('Successfully committed with cached message');

          await CommitCache.clearCache();
          Logger.debug('Cleared commit cache');

          // Only output git commit result once
          outro(`│ ${stdout}`);
          
          process.exit(0);
        } catch (error: any) {
          const failMessage = `${chalk.red('✖')} Commit failed`;
          committingChangesSpinner.stop(failMessage);
          Logger.spinnerError('Commit failed with cached message');
          
          outro(formatErrorOutput(error, 'Pre-commit Hook Failed'));
          
          process.exit(1);
        }
      }
    }

    if (!stagedFiles.length) {
      stagedFilesSpinner.stop('No files are staged');
      const isStageAllAndCommitConfirmedByUser = await confirm({
        message: 'Do you want to stage all files and generate commit message?'
      });

      if (isCancel(isStageAllAndCommitConfirmedByUser)) process.exit(1);

      if (isStageAllAndCommitConfirmedByUser) {
        await commit(extraArgs, context, true, fullGitMojiSpec);
        process.exit(1);
      }

      if (stagedFiles.length === 0 && changedFiles.length > 0) {
        const files = (await multiselect({
          message: chalk.cyan('Select the files you want to add to the commit:'),
          options: changedFiles.map((file) => ({
            value: file,
            label: `  ${file}`
          }))
        })) as string[];

        if (isCancel(files)) process.exit(1);

        await gitAdd({ files });
      }

      await commit(extraArgs, context, false, fullGitMojiSpec);
      process.exit(1);
    }

    stagedFilesSpinner.stop(
      `${stagedFiles.length} staged files:\n${stagedFiles
        .map((file) => `  ${file}`)
        .join('\n')}`
    );

    const [, generateCommitError] = await trytm(
      generateCommitMessageFromGitDiff({
        diff: await getDiff({ files: stagedFiles }),
        extraArgs,
        context,
        fullGitMojiSpec,
        skipCommitConfirmation
      })
    );

    if (generateCommitError) {
      outro(chalk.red(generateCommitError));
      process.exit(1);
    }

    process.exit(0);
  } catch (error: any) {
    outro(chalk.red(error.message || String(error)));
    process.exit(1);
  }
}
