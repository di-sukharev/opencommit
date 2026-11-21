import { intro, outro } from '@clack/prompts';
import chalk from 'chalk';
import { command } from 'cleye';
import { constants, existsSync, type Stats } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { assertGitRepo, getGitHooksPath } from '../utils/git.js';
import { COMMANDS } from './ENUMS';

const HOOK_NAME = 'prepare-commit-msg';
const HOOK_MARKER = '# opencommit prepare-commit-msg hook';

// Keep the hook path in argv[1] so the CLI detects the hook by its path.
const LOAD_CLI = 'const [cli] = process.argv.splice(1, 1); require(cli);';

const shellQuote = (value: string): string =>
  `'${value.replace(/'/g, `'\\''`)}'`;

const quoteHookPath = (value: string): string =>
  shellQuote(process.platform === 'win32' ? value.replace(/\\/g, '/') : value);

// Git GUI clients often run hooks with a PATH that does not include node,
// so the hook launches the CLI with absolute paths instead of the shebang.
const renderHookScript = (quotedNode: string, quotedCli: string): string =>
  [
    '#!/bin/sh',
    HOOK_MARKER,
    `if [ ! -x ${quotedNode} ] || [ ! -f ${quotedCli} ]; then`,
    "  printf '%s\\n' 'OpenCommit hook skipped. Reinstall OpenCommit or Node.js and run oco hook set, or remove this hook.' >&2",
    '  exit 0',
    'fi',
    `exec ${quotedNode} --input-type=commonjs -e ${shellQuote(LOAD_CLI)} -- ${quotedCli} "$0" "$@"`,
    ''
  ].join('\n');

export const buildHookScript = (nodePath: string, cliPath: string): string =>
  renderHookScript(quoteHookPath(nodePath), quoteHookPath(cliPath));

const quotedShellWord = String.raw`'[^']*'(?:\\''[^']*')*`;
const hookInvocation = new RegExp(
  String.raw`\nexec (${quotedShellWord}) --input-type=commonjs -e ${quotedShellWord} -- (${quotedShellWord}) "\$0" "\$@"\n$`
);

const isGeneratedLauncher = (content: string): boolean => {
  const invocation = hookInvocation.exec(content);
  if (!invocation) return false;

  const [, quotedNode, quotedCli] = invocation;
  return content === renderHookScript(quotedNode, quotedCli);
};

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

const statHook = async (hookPath: string): Promise<Stats | undefined> => {
  try {
    return await fs.lstat(hookPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
};

const sameFile = (current: Stats | undefined, previous: Stats): boolean =>
  current !== undefined &&
  current.dev === previous.dev &&
  current.ino === previous.ino &&
  current.ctimeMs === previous.ctimeMs;

const hookChanged = () =>
  new Error(`The ${HOOK_NAME} hook changed during this operation. Try again.`);

const openKnownHook = async (hookPath: string, stats: Stats) => {
  // On POSIX these flags also protect against a concurrent symlink or FIFO.
  const file = await fs.open(
    hookPath,
    constants.O_RDONLY |
      (constants.O_NOFOLLOW ?? 0) |
      (constants.O_NONBLOCK ?? 0)
  );
  try {
    const current = await file.stat();
    if (!current.isFile() || !sameFile(current, stats)) throw hookChanged();
    return file;
  } catch (error) {
    await file.close();
    throw error;
  }
};

type ExistingHook = { stats: Stats; owned: boolean; content?: string };

const inspectHook = async (
  hookPath: string,
  cliPath: string
): Promise<ExistingHook | undefined> => {
  const stats = await statHook(hookPath);
  if (!stats) return undefined;

  const uid = process.geteuid?.();
  if (uid !== undefined && stats.uid !== uid) return { stats, owned: false };

  if (stats.isSymbolicLink()) {
    // A legacy symlink can be identified safely when it resolves to this CLI.
    const owned =
      existsSync(hookPath) &&
      (await fs.realpath(hookPath)) === (await fs.realpath(cliPath));
    return { stats, owned };
  }
  if (!stats.isFile()) return { stats, owned: false };

  const file = await openKnownHook(hookPath, stats);
  try {
    const content = await file.readFile('utf8');
    return { stats, content, owned: isGeneratedLauncher(content) };
  } finally {
    await file.close();
  }
};

const restoreHookExecuteBit = async (hookPath: string, previous: Stats) => {
  const file = await openKnownHook(hookPath, previous);
  try {
    if (!sameFile(await statHook(hookPath), previous)) throw hookChanged();
    await file.chmod((previous.mode & 0o7777) | 0o100);
  } finally {
    await file.close();
  }
};

const installHook = async (
  hookPath: string,
  script: string,
  previous?: Stats
): Promise<void> => {
  const directory = path.dirname(hookPath);
  await fs.mkdir(directory, { recursive: true });
  const temporary = await fs.mkdtemp(path.join(directory, `.${HOOK_NAME}-`));
  const launcher = path.join(temporary, HOOK_NAME);
  const mode = previous?.isFile() ? (previous.mode & 0o777) | 0o100 : 0o755;

  try {
    await fs.writeFile(launcher, script, { flag: 'wx', mode });
    if (previous?.isFile()) {
      if (process.getgid) {
        const { uid, gid } = await fs.stat(launcher);
        if (gid !== previous.gid) await fs.chown(launcher, uid, previous.gid);
      }
      await fs.chmod(launcher, mode);
    }

    if (previous) {
      if (!sameFile(await statHook(hookPath), previous)) throw hookChanged();
      await fs.rename(launcher, hookPath);
    } else {
      // Publish the complete launcher only if no other hook took this name.
      await fs.link(launcher, hookPath);
    }
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
};

export const hookCommand = command(
  {
    name: COMMANDS.hook,
    parameters: ['<set/unset>']
  },
  async (argv) => {
    const cliPath = __filename;
    try {
      await assertGitRepo();
      const hookPath = await getHooksPath();

      const { setUnset: mode } = argv._;

      if (mode === 'set') {
        intro(`setting opencommit as '${HOOK_NAME}' hook at ${hookPath}`);

        const script = buildHookScript(process.execPath, cliPath);
        const existing = await inspectHook(hookPath, cliPath);

        if (existing && !existing.owned)
          throw new Error(
            `Different ${HOOK_NAME} is already set. Remove it before setting opencommit as '${HOOK_NAME}' hook.`
          );

        if (
          existing?.content === script &&
          (process.platform === 'win32' || (existing.stats.mode & 0o100) !== 0)
        )
          return outro(`OpenCommit is already set as '${HOOK_NAME}'`);

        if (existing?.content === script && existing.stats.nlink === 1) {
          await restoreHookExecuteBit(hookPath, existing.stats);
        } else {
          await installHook(hookPath, script, existing?.stats);
        }
        return outro(`${chalk.green('✔')} Hook set`);
      }

      if (mode === 'unset') {
        intro(`unsetting opencommit as '${HOOK_NAME}' hook from ${hookPath}`);

        const existing = await inspectHook(hookPath, cliPath);
        if (!existing) {
          return outro(
            `OpenCommit wasn't previously set as '${HOOK_NAME}' hook, nothing to remove`
          );
        }

        if (!existing.owned) {
          return outro(
            `OpenCommit wasn't previously set as '${HOOK_NAME}' hook, but different hook was, if you want to remove it — do it manually`
          );
        }

        if (!sameFile(await statHook(hookPath), existing.stats))
          throw hookChanged();
        await fs.unlink(hookPath);
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
