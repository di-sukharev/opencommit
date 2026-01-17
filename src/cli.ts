#!/usr/bin/env node

import { cli } from 'cleye';

import packageJSON from '../package.json';
import { commit } from './commands/commit';
import { commitlintConfigCommand } from './commands/commitlint';
import { configCommand } from './commands/config';
import { hookCommand, isHookCalled } from './commands/githook.js';
import { prepareCommitMessageHook } from './commands/prepare-commit-msg-hook';
import {
  setupCommand,
  isFirstRun,
  runSetup,
  promptForMissingApiKey
} from './commands/setup';
import { checkIsLatestVersion } from './utils/checkIsLatestVersion';
import { runMigrations } from './migrations/_run.js';

const extraArgs = process.argv.slice(2);

cli(
  {
    version: packageJSON.version,
    name: 'opencommit',
    commands: [configCommand, hookCommand, commitlintConfigCommand, setupCommand],
    flags: {
      fgm: {
        type: Boolean,
        description: 'Use full GitMoji specification',
        default: false
      },
      context: {
        type: String,
        alias: 'c',
        description: 'Additional user input context for the commit message',
        default: ''
      },
      yes: {
        type: Boolean,
        alias: 'y',
        description: 'Skip commit confirmation prompt',
        default: false
      }
    },
    ignoreArgv: (type) => type === 'unknown-flag' || type === 'argument',
    help: { description: packageJSON.description }
  },
  async ({ flags }) => {
    await runMigrations();
    await checkIsLatestVersion();

    if (await isHookCalled()) {
      prepareCommitMessageHook();
    } else {
      // Check for first run and trigger setup wizard
      if (isFirstRun()) {
        const setupComplete = await runSetup();
        if (!setupComplete) {
          process.exit(1);
        }
      }

      // Check for missing API key and prompt if needed
      const hasApiKey = await promptForMissingApiKey();
      if (!hasApiKey) {
        process.exit(1);
      }

      commit(extraArgs, flags.context, false, flags.fgm, flags.yes);
    }
  },
  extraArgs
);
