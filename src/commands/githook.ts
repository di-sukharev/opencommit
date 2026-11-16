import { intro, outro } from '@clack/prompts';
import chalk from 'chalk';
import { command } from 'cleye';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { assertGitRepo, getGitHooksPath } from '../utils/git.js';
import { COMMANDS } from './ENUMS';

const HOOK_NAME = 'prepare-commit-msg';
const HOOK_MARKER = '# opencommit prepare-commit-msg hook';
const HOOK_ENV = 'OCO_GIT_HOOK';

const shellQuote = (value: string): string =>
  `'${value.replace(/'/g, `'\\''`)}'`;

// Git GUI clients often run hooks with a PATH that does not include node,
// so the hook launches the CLI with absolute paths instead of the shebang.
export const buildHookScript = (nodePath: string, cliPath: string): string =>
  [
    '#!/bin/sh',
    HOOK_MARKER,
    `${HOOK_ENV}=1`,
    `export ${HOOK_ENV}`,
    `exec ${shellQuote(nodePath)} ${shellQuote(cliPath)} "$@"`,
    ''
  ].join('\n');

const getHooksPath = async (): Promise<string> => {
  return path.join(await getGitHooksPath(), HOOK_NAME);
};

const normalizeHookPath = async (hookPath: string): Promise<string> => {
  const absolutePath = path.resolve(hookPath);
  const realDirectory = await fs.realpath(path.dirname(absolutePath));
  return path.join(realDirectory, path.basename(absolutePath));
};

export const isHookCalled = async (): Promise<boolean> => {
  if (process.env[HOOK_ENV] === '1') return true;

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

// lstat so a dangling symlink counts as an existing hook and is never written through
const isHookExists = async (hooksPath: string): Promise<boolean> => {
  try {
    await fs.lstat(hooksPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
};

const isOpenCommitHook = async (
  hooksPath: string,
  hookUrl: string
): Promise<boolean> => {
  // hooks set by older versions are symlinks to the CLI itself
  if ((await fs.lstat(hooksPath)).isSymbolicLink())
    return existsSync(hooksPath) && (await fs.realpath(hooksPath)) === hookUrl;

  const content = await fs.readFile(hooksPath, 'utf8');
  return content.includes(HOOK_MARKER);
};

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

        const hookScript = buildHookScript(process.execPath, HOOK_URL);

        if (await isHookExists(SYMLINK_URL)) {
          if (!(await isOpenCommitHook(SYMLINK_URL, HOOK_URL)))
            throw new Error(
              `Different ${HOOK_NAME} is already set. Remove it before setting opencommit as '${HOOK_NAME}' hook.`
            );

          if ((await fs.readFile(SYMLINK_URL, 'utf8')) === hookScript)
            return outro(`OpenCommit is already set as '${HOOK_NAME}'`);

          await fs.rm(SYMLINK_URL);
        }

        await fs.mkdir(path.dirname(SYMLINK_URL), { recursive: true });
        await fs.writeFile(SYMLINK_URL, hookScript);
        await fs.chmod(SYMLINK_URL, 0o755);

        return outro(`${chalk.green('✔')} Hook set`);
      }

      if (mode === 'unset') {
        intro(
          `unsetting opencommit as '${HOOK_NAME}' hook from ${SYMLINK_URL}`
        );

        if (!(await isHookExists(SYMLINK_URL))) {
          return outro(
            `OpenCommit wasn't previously set as '${HOOK_NAME}' hook, nothing to remove`
          );
        }

        if (!(await isOpenCommitHook(SYMLINK_URL, HOOK_URL))) {
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
