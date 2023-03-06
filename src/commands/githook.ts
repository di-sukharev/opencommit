import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { command } from 'cleye';
import { assertGitRepo } from '../utils/git.js';
import { existsSync } from 'fs';
import chalk from 'chalk';
import { intro, outro } from '@clack/prompts';

const HOOK_NAME = 'prepare-commit-msg';
const SYMLINK_URL = `.git/hooks/${HOOK_NAME}`;

export const isHookCalled = process.argv[1].endsWith(`/${SYMLINK_URL}`);

const isHookExists = existsSync(SYMLINK_URL);

export const hookCommand = command(
  {
    name: 'hook',
    parameters: ['<set/unset>']
  },
  async (argv) => {
    const HOOK_PATH = fileURLToPath(new URL('cli.cjs', import.meta.url));

    try {
      await assertGitRepo();

      const { setUnset: mode } = argv._;

      if (mode === 'set') {
        intro(`setting opencommit as '${HOOK_NAME}' hook`);
        if (isHookExists) {
          const realPath = await fs.realpath(SYMLINK_URL);

          if (realPath === HOOK_PATH)
            return outro(`opencommit is already set as '${HOOK_NAME}'`);

          throw new Error(
            `Different ${HOOK_NAME} is already set. Remove it before setting opencommit as '${HOOK_NAME}' hook.`
          );
        }

        await fs.mkdir(path.dirname(SYMLINK_URL), { recursive: true });
        await fs.symlink(HOOK_PATH, SYMLINK_URL, 'file');
        await fs.chmod(SYMLINK_URL, 0o755);

        return outro(`${chalk.green('✔')} Hook set`);
      }

      if (mode === 'unset') {
        intro(`unsetting opencommit as '${HOOK_NAME}' hook`);
        if (!isHookExists) {
          return outro(
            `opencommit wasn't previously set as '${HOOK_NAME}' hook, nothing to remove`
          );
        }

        const realpath = await fs.realpath(SYMLINK_URL);
        if (realpath !== HOOK_PATH) {
          return outro(
            `opencommit wasn't previously set as '${HOOK_NAME}' hook, but different hook was, if you want to remove it — do it manually`
          );
        }

        await fs.rm(SYMLINK_URL);
        return outro(`${chalk.green('✔')} Hook is removed`);
      }

      throw new Error(
        `unsupported mode: ${mode}. Supported modes are: 'set' or 'unset'`
      );
    } catch (error) {
      outro(`${chalk.red('✖')} ${error}`);
      process.exit(1);
    }
  }
);
