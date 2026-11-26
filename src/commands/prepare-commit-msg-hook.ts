import chalk from 'chalk';
import fs from 'fs/promises';

import { intro, outro, spinner } from '@clack/prompts';

import { generateCommitMessageByDiff } from '../generateCommitMessageFromGitDiff';
import {
  getChangedFiles,
  getCurrentBranch,
  getDiff,
  getStagedFiles,
  gitAdd
} from '../utils/git';
import { getProviderConfigRequirement } from '../utils/provider';
import { addTicketReference } from '../utils/ticketReference';
import { getConfig, OCO_AI_PROVIDER_ENUM } from './config';

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
    const provider = config.OCO_AI_PROVIDER || OCO_AI_PROVIDER_ENUM.OPENAI;

    if (
      getProviderConfigRequirement(provider) === 'apiKey' &&
      !config.OCO_API_KEY
    ) {
      outro(
        `No OCO_API_KEY is set. Add it to the repository .env file or configure ${provider} globally with oco config set OCO_AI_PROVIDER=${provider} OCO_API_KEY=<value>.`
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

    if (config.OCO_TICKET_FROM_BRANCH) {
      commitMessage = addTicketReference(
        commitMessage,
        await getCurrentBranch(),
        { oneLine: config.OCO_ONE_LINE_COMMIT }
      );
    }

    const fileContent = await fs.readFile(messageFilePath);

    // Comment every line, or an untouched message would commit its body
    const commentedMessage = commitMessage
      .split('\n')
      .map((line) => (line ? `# ${line}` : '#'))
      .join('\n');

    const messageWithComment = `${commentedMessage}\n\n# ---------- [OpenCommit] ---------- #\n# Remove the # above to use this generated commit message.\n# To cancel the commit, just close this window without making any changes.\n\n${fileContent.toString()}`;
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
      const message = `\n\n# ---------- [OpenCommit] ---------- #\n# Failed to generate the commit message.\n# To cancel the commit, just close this window without making any changes.\n\n${commentedError}\n\n${fileContent.toString()}`;

      await fs.writeFile(messageFilePath, message);
    } catch (error) {
      outro(`${chalk.red('✖')} ${error}`);
      process.exit(1);
    }
  }
};
