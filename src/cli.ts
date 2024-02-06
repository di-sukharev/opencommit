#!/usr/bin/env node

import { cli } from 'cleye';

import packageJSON from '../package.json';
import { commit } from './commands/commit';
import { commitlintConfigCommand } from './commands/commitlint';
import { configCommand } from './commands/config';
import { hookCommand, isHookCalled } from './commands/githook.js';
import { prepareCommitMessageHook } from './commands/prepare-commit-message-hook';
import { checkIsLatestVersion } from './utils/check-is-latest-version';

const extraArguments = process.argv.slice(2);

cli(
  {
    commands: [configCommand, hookCommand, commitlintConfigCommand],
    flags: {},
    help: { description: packageJSON.description },
    ignoreArgv: (type) => type === 'unknown-flag' || type === 'argument',
    name: 'opencommit',
    version: packageJSON.version
  },
  async () => {
    await checkIsLatestVersion();

    if (await isHookCalled()) {
      prepareCommitMessageHook();
    } else {
      commit(extraArguments);
    }
  },
  extraArguments
);
