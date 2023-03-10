#!/usr/bin/env node

import { cli } from 'cleye';
import packageJSON from '../package.json' assert { type: 'json' };

import { configCommand } from './commands/config';
import { hookCommand, isHookCalled } from './commands/githook.js';
import { prepareCommitMessageHook } from './commands/prepare-commit-msg-hook';
import { commit } from './commands/commit';
import { execa } from 'execa';
import { outro } from '@clack/prompts';

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
  async () => {
    if (isHookCalled) {
      await prepareCommitMessageHook();
    } else {
      await commit();
      const { stdout } = await execa('npm', ['view', 'opencommit', 'version']);

      if (stdout !== packageJSON.version)
        outro(
          'new opencommit version is available, update with `npm i -g opencommit`'
        );
    }
  },
  rawArgv
);
