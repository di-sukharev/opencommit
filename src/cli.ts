#!/usr/bin/env node

import { cli } from 'cleye';

import packageJSON from '../package.json';
import { commit } from './commands/commit';
import { commitlintConfigCommand } from './commands/commitlint';
import { configCommand } from './commands/config';
import { hookCommand, isHookCalled } from './commands/githook.js';
import { prepareCommitMessageHook } from './commands/prepare-commit-msg-hook';
import { checkIsLatestVersion } from './utils/checkIsLatestVersion';

const extraArgs = process.argv.slice(2);

cli(
  {
    version: packageJSON.version,
    name: 'opencommit',
    commands: [configCommand, hookCommand, commitlintConfigCommand],
    flags: {
      'confirm-commit': {
        type: 'boolean',
        default: false,
        description: 'Confirm commit'
      },
      'confirm-push': {
        type: 'boolean',
        default: false,
        description: 'Confirm push'
      }
    },
    ignoreArgv: (type) => type === 'unknown-flag' || type === 'argument',
    help: { description: packageJSON.description }
  },
  async ({ flags }) => {
    await checkIsLatestVersion();

    if (await isHookCalled()) {
      prepareCommitMessageHook();
    } else {
      commit(extraArgs, flags['confirm-commit'], flags['confirm-push']);
    }
  },
  extraArgs
);
