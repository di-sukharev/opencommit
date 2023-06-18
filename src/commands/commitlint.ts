import { command } from 'cleye';
import { intro, outro } from '@clack/prompts';
import chalk from 'chalk';
import { COMMANDS } from '../CommandsEnum';
import fs from 'fs/promises';

import { COMMITLINT_LLM_CONFIG_PATH } from '../modules/commitlint/constants';
import { configureCommitlintIntegration } from '../modules/commitlint/config';

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
        const commitLintConfig = await fs.readFile(COMMITLINT_LLM_CONFIG_PATH);

        outro(commitLintConfig.toString());
      } else if (mode === CONFIG_MODES.force) {
        await configureCommitlintIntegration(true);
      } else {
        throw new Error(
          `Unsupported mode: ${mode}. Valid modes are: "force" and "get"`
        );
      }
    } catch (error) {
      outro(`${chalk.red('✖')} ${error}`);
      process.exit(1);
    }
  }
);
