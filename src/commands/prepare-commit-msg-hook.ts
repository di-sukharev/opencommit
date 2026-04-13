import chalk from 'chalk';
import fs from 'fs/promises';

import { intro, outro, spinner } from '@clack/prompts';

import { generateCommitMessageByDiff } from '../generateCommitMessageFromGitDiff';
import { getChangedFiles, getDiff, getStagedFiles, gitAdd } from '../utils/git';
import { getConfig } from './config';

const [messageFilePath, commitSource] = process.argv.slice(2);

export const prepareCommitMessageHook = async (
  isStageAllFlag: Boolean = false
) => {
  try {
    if (!messageFilePath) {
      throw new Error(
        'Commit message file path is missing. This file should be called from the "prepare-commit-msg" git hook'
      );
    }

    if (commitSource) return;

    if (isStageAllFlag) {
      const changedFiles = await getChangedFiles();

      if (changedFiles) await gitAdd({ files: changedFiles });
      else {
        outro('No changes detected, write some code and run `oco` again');
        process.exit(1);
      }
    }

    const staged = await getStagedFiles();

    if (!staged) return;

    intro('opencommit');

    const config = getConfig();

    if (!config.OCO_API_KEY) {
      outro(
        'No OCO_API_KEY is set. Set your key via `oco config set OCO_API_KEY=<value>. For more info see https://github.com/di-sukharev/opencommit'
      );
      return;
    }

    const spin = spinner();
    spin.start('Generating commit message');

    let commitMessage: string;
    try {
      commitMessage = await generateCommitMessageByDiff(
        await getDiff({ files: staged })
      );
    } catch (error) {
      spin.stop('Done');
      throw error;
    }

    spin.stop('Done');

    const fileContent = await fs.readFile(messageFilePath);

    const messageWithComment = `# ${commitMessage}\n\n# ---------- [OpenCommit] ---------- #\n# Remove the # above to use this generated commit message.\n# To cancel the commit, just close this window without making any changes.\n\n${fileContent.toString()}`;
    const messageWithoutComment = `${commitMessage}\n\n${fileContent.toString()}`;

    const message = config.OCO_HOOK_AUTO_UNCOMMENT
      ? messageWithoutComment
      : messageWithComment;

    await fs.writeFile(messageFilePath, message);
  } catch (error) {
    try {
      outro(`${chalk.red('✖')} ${error}`);
      const fileContent = await fs.readFile(messageFilePath);

      const commentedError = String(error).replace(new RegExp('^', 'gm'), '# ');
      const message = `\n\n# ---------- [OpenCommit] ---------- #\n# Failed to generate the commit message.\n# To cancel the commit, just close this window without making any changes.\n\n${commentedError}\n\n${fileContent.toString()}`

      await fs.writeFile(messageFilePath, message);
    } catch (error) {
      outro(`${chalk.red('✖')} ${error}`);
      process.exit(1);
    }
  }
};
