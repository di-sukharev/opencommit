#!/usr/bin/env node

import { cli } from 'cleye';
import packageJSON from '../package.json' assert { type: 'json' };

import { configCommand } from './commands/config';
import { hookCommand, isHookCalled } from './commands/githook.js';
import { prepareCommitMessageHook } from './commands/prepare-commit-msg-hook';
import { commit } from './commands/commit';

const rawArgv = process.argv.slice(2);

cli(
  {
    version: packageJSON.version,
    name: 'opencommit',
    commands: [configCommand, hookCommand],
    flags: {},
    ignoreArgv: (type) => type === 'unknown-flag' || type === 'argument',
    help: { description: packageJSON.description }
  },
  () => {
    if (isHookCalled) {
      prepareCommitMessageHook();
    } else {
      commit();
    }
  },
  rawArgv
);
