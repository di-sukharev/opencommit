import { intro, outro } from '@clack/prompts';
import chalk from 'chalk';
import { command } from 'cleye';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { assertGitRepo, getGitHooksPath } from '../utils/git.js';
import { COMMANDS } from './ENUMS';

const HOOK_NAME = 'prepare-commit-msg';

const getHooksPath = async (): Promise<string> => {
  return path.join(await getGitHooksPath(), HOOK_NAME);
};

const normalizeHookPath = async (hookPath: string): Promise<string> => {
  const absolutePath = path.resolve(hookPath);
  const realDirectory = await fs.realpath(path.dirname(absolutePath));
  return path.join(realDirectory, path.basename(absolutePath));
};

export const isHookCalled = async (): Promise<boolean> => {
  try {
    const invokedPath = process.argv[1];
    if (!invokedPath) return false;

    return (
      (await normalizeHookPath(invokedPath)) ===
      (await normalizeHookPath(await getHooksPath()))
    );
  } catch {
    return false;
  }
};

const isHookExists = (hooksPath: string): boolean => existsSync(hooksPath);

export const hookCommand = command(
  {
    name: COMMANDS.hook,
    parameters: ['<set/unset>']
  },
  async (argv) => {
    const HOOK_URL = __filename;
    try {
      await assertGitRepo();
      const SYMLINK_URL = await getHooksPath();

      const { setUnset: mode } = argv._;

      if (mode === 'set') {
        intro(`setting opencommit as '${HOOK_NAME}' hook at ${SYMLINK_URL}`);

        if (isHookExists(SYMLINK_URL)) {
          let realPath;
          try {
            realPath = await fs.realpath(SYMLINK_URL);
          } catch (error) {
            outro(error as string);
            realPath = null;
          }

          if (realPath === HOOK_URL)
            return outro(`OpenCommit is already set as '${HOOK_NAME}'`);

          throw new Error(
            `Different ${HOOK_NAME} is already set. Remove it before setting opencommit as '${HOOK_NAME}' hook.`
          );
        }

        await fs.mkdir(path.dirname(SYMLINK_URL), { recursive: true });
        await fs.symlink(HOOK_URL, SYMLINK_URL, 'file');
        await fs.chmod(SYMLINK_URL, 0o755);

        return outro(`${chalk.green('✔')} Hook set`);
      }

      if (mode === 'unset') {
        intro(
          `unsetting opencommit as '${HOOK_NAME}' hook from ${SYMLINK_URL}`
        );

        if (!isHookExists(SYMLINK_URL)) {
          return outro(
            `OpenCommit wasn't previously set as '${HOOK_NAME}' hook, nothing to remove`
          );
        }

        const realpath = await fs.realpath(SYMLINK_URL);
        if (realpath !== HOOK_URL) {
          return outro(
            `OpenCommit wasn't previously set as '${HOOK_NAME}' hook, but different hook was, if you want to remove it — do it manually`
          );
        }

        await fs.rm(SYMLINK_URL);
        return outro(`${chalk.green('✔')} Hook is removed`);
      }

      throw new Error(
        `Unsupported mode: ${mode}. Supported modes are: 'set' or 'unset'. Run: \`oco hook set\``
      );
    } catch (error) {
      outro(`${chalk.red('✖')} ${error}`);
      process.exit(1);
    }
  }
);
