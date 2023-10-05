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
const isYesFlagSet = extraArgs.includes('--yes') || extraArgs.includes('-y');

cli(
  {
    version: packageJSON.version,
    name: 'opencommit',
    commands: [configCommand, hookCommand, commitlintConfigCommand],
    flags: {
      yes: {
        type: Boolean,
        alias: 'y',
        description: 'Automatically add all files, accept the commit message, and push the code',
        default: 'n'
      }
    },
    ignoreArgv: (type) => type === 'unknown-flag' || type === 'argument',
    help: { description: packageJSON.description }
  },
  async () => {
    await checkIsLatestVersion();

    if (await isHookCalled()) {
      prepareCommitMessageHook();
    } else {
      commit(extraArgs, false, isYesFlagSet);
    }
  },
  extraArgs
);
