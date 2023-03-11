import fs from 'fs/promises';
import chalk from 'chalk';
import { intro, outro } from '@clack/prompts';
import { getChangedFiles, getDif, getStagedFiles, gitAdd } from '../utils/git';
import { getConfig } from './config';
import { generateCommitMessageWithChatCompletion } from '../generateCommitMessageFromGitDiff';

const [messageFilePath, commitSource] = process.argv.slice(2);

export const prepareCommitMessageHook = async () => {
  try {
    if (!messageFilePath) {
      throw new Error(
        'Commit message file path is missing. This file should be called from the "prepare-commit-msg" git hook'
      );
    }

    if (commitSource) return;

    await gitAdd({ files: await getChangedFiles() });

    const staged = await getStagedFiles();

    if (!staged) return;

    intro('opencommit');

    const config = getConfig();

    if (!config?.OPENAI_API_KEY) {
      throw new Error(
        'No OPEN_AI_API exists. Set your OPEN_AI_API=<key> in ~/.opencommit'
      );
    }

    const commitMessage = await generateCommitMessageWithChatCompletion(
      await getDif({ files: staged })
    );

    if (typeof commitMessage !== 'string') throw new Error(commitMessage.error);

    const fileContent = await fs.readFile(messageFilePath);

    await fs.writeFile(
      messageFilePath,
      commitMessage + '\n' + fileContent.toString()
    );
  } catch (error) {
    outro(`${chalk.red('✖')} ${error}`);
    process.exit(1);
  }
};
