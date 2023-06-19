import chalk from 'chalk';
import { command } from 'cleye';

import { intro, outro } from '@clack/prompts';

import { COMMANDS } from '../CommandsEnum';
import { configureCommitlintIntegration } from '../modules/commitlint/config';
import { getCommitlintLLMConfig } from '../modules/commitlint/utils';

export enum CONFIG_MODES {
  get = 'get',
  force = 'force'
}

export const commitlintConfigCommand = command(
  {
    name: COMMANDS.commitlint,
    parameters: ['<mode>']
  },
  async (argv) => {
    intro('opencommit — configure @commitlint');
    try {
      const { mode } = argv._;

      if (mode === CONFIG_MODES.get) {
        const commitLintConfig = await getCommitlintLLMConfig();

        outro(commitLintConfig.toString());

        return;
      }

      if (mode === CONFIG_MODES.force) {
        await configureCommitlintIntegration(true);
        return;
      }

      throw new Error(
        `Unsupported mode: ${mode}. Valid modes are: "force" and "get"`
      );
    } catch (error) {
      outro(`${chalk.red('✖')} ${error}`);
      process.exit(1);
    }
  }
);
