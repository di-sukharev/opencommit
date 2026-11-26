import { execFileSync, spawnSync } from 'child_process';
import {
  chmodSync,
  chownSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'fs';
import { parse as iniParse } from 'ini';
import { dirname, resolve } from 'path';
import 'cli-testing-library/extend-expect';
import {
  assertGitStatus,
  assertHeadCommit,
  getCliPath,
  getHeadCommitFiles,
  getMockOpenAiEnv,
  prepareEnvironment,
  prepareRepo,
  prepareSubmoduleEnvironment,
  prepareTempDir,
  runCli,
  runGit,
  runProcess,
  seedMigrations,
  seedModelCache,
  startMockOpenAiServer,
  waitForExit,
  writeGlobalConfig,
  writeRepoFile
} from './utils';

it('cli flow passes --context through to the model prompt and skips confirmation with --yes', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();
  const server = await startMockOpenAiServer(
    'fix(context): handle production incident'
  );

  try {
    await prepareRepo(
      gitDir,
      {
        'index.ts': 'console.log("Hello World");\n'
      },
      { stage: true }
    );

    const oco = await runCli(['--yes', '--context=production-incident'], {
      cwd: gitDir,
      env: getMockOpenAiEnv(server.baseUrl)
    });

    expect(
      await oco.queryByText('Confirm the commit message?')
    ).not.toBeInTheConsole();
    expect(
      await oco.queryByText('Do you want to run `git push`?')
    ).not.toBeInTheConsole();
    expect(await waitForExit(oco)).toBe(0);
    await assertHeadCommit(gitDir, 'fix(context): handle production incident');

    const requestPayload = server.requestBodies[
      server.requestBodies.length - 1
    ] as { messages: Array<{ content: string }> };
    const requestContents = requestPayload.messages
      .map((message) => message.content)
      .join('\n');

    expect(requestContents).toContain('<context>production-incident</context>');
    expect(requestContents).toContain('console.log("Hello World");');
    expect(server.authHeaders).toContain('Bearer test-openai-key');
  } finally {
    await server.cleanup();
    await cleanup();
  }
});

it('cli flow passes --fgm through to the full GitMoji prompt', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();
  const server = await startMockOpenAiServer(
    'feat(fgm): use the extended gitmoji specification'
  );

  try {
    await prepareRepo(
      gitDir,
      {
        'index.ts': 'console.log("Hello World");\n'
      },
      { stage: true }
    );

    const oco = await runCli(['--fgm', '--yes'], {
      cwd: gitDir,
      env: getMockOpenAiEnv(server.baseUrl)
    });

    expect(await waitForExit(oco)).toBe(0);
    await assertHeadCommit(
      gitDir,
      'feat(fgm): use the extended gitmoji specification'
    );

    const requestPayload = server.requestBodies[
      server.requestBodies.length - 1
    ] as { messages: Array<{ content: string }> };
    const requestContents = requestPayload.messages
      .map((message) => message.content)
      .join('\n');

    expect(requestContents).toContain(
      '🎨, Improve structure / format of the code;'
    );
    expect(requestContents).toContain('GitMoji specification');
  } finally {
    await server.cleanup();
    await cleanup();
  }
});

it('cli flow uses the full GitMoji prompt when OCO_EMOJI_FULL_SPEC is set', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();
  const server = await startMockOpenAiServer(
    'feat(fgm): use the extended gitmoji specification'
  );

  try {
    await prepareRepo(
      gitDir,
      {
        'index.ts': 'console.log("Hello World");\n'
      },
      { stage: true }
    );

    const oco = await runCli(['--yes'], {
      cwd: gitDir,
      env: getMockOpenAiEnv(server.baseUrl, { OCO_EMOJI_FULL_SPEC: 'true' })
    });

    expect(await waitForExit(oco)).toBe(0);

    const requestPayload = server.requestBodies[
      server.requestBodies.length - 1
    ] as { messages: Array<{ content: string }> };
    const requestContents = requestPayload.messages
      .map((message) => message.content)
      .join('\n');

    expect(requestContents).toContain(
      '🎨, Improve structure / format of the code;'
    );
    expect(requestContents).toContain('GitMoji specification');
  } finally {
    await server.cleanup();
    await cleanup();
  }
});

it('cli flow processes a large minified diff without stalling', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();
  const server = await startMockOpenAiServer(
    'fix(diff): process a large minified file',
    { responseDelayMs: 50 }
  );

  try {
    await prepareRepo(
      gitDir,
      {
        'content.json': `{"content":"${'a'.repeat(100_000)}"}`
      },
      { stage: true }
    );

    const oco = await runCli(['--yes'], {
      cwd: gitDir,
      env: getMockOpenAiEnv(server.baseUrl, {
        OCO_TOKENS_MAX_INPUT: '4096',
        OCO_TOKENS_MAX_OUTPUT: '500'
      })
    });

    expect(await waitForExit(oco, 30_000)).toBe(0);
    await assertHeadCommit(gitDir, 'fix(diff): process a large minified file');
    expect(server.requestBodies.length).toBeGreaterThan(1);
    expect(server.maxActiveRequests).toBe(3);
    const requestDiffs = server.requestBodies.map((body) => {
      const messages = (body as { messages: Array<{ content: string }> })
        .messages;
      return messages[messages.length - 1].content;
    });
    expect(
      requestDiffs.every((diff) =>
        diff.startsWith('diff --git a/content.json b/content.json')
      )
    ).toBe(true);
  } finally {
    await server.cleanup();
    await cleanup();
  }
});

it('cli flow preserves changed-line boundaries when splitting a multiline diff', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();
  const server = await startMockOpenAiServer(
    'fix(diff): preserve multiline diff boundaries'
  );
  const sourceLines = Array.from(
    { length: 600 },
    (_, index) => `const value${index} = "line-${index}";`
  );

  try {
    await prepareRepo(
      gitDir,
      { 'values.ts': `${sourceLines.join('\n')}\n` },
      { stage: true }
    );

    const oco = await runCli(['--yes'], {
      cwd: gitDir,
      env: getMockOpenAiEnv(server.baseUrl, {
        OCO_TOKENS_MAX_INPUT: '4096',
        OCO_TOKENS_MAX_OUTPUT: '500'
      })
    });

    expect(await waitForExit(oco, 30_000)).toBe(0);
    expect(server.requestBodies.length).toBeGreaterThan(1);

    const changedLines = server.requestBodies.flatMap((body) => {
      const messages = (body as { messages: Array<{ content: string }> })
        .messages;
      return messages[messages.length - 1].content
        .split('\n')
        .filter((line) => line.startsWith('+const value'));
    });

    expect(changedLines).toEqual(sourceLines.map((line) => `+${line}`));
  } finally {
    await server.cleanup();
    await cleanup();
  }
});

it('cli flow preserves every file marker when grouping a multi-file diff', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();
  const server = await startMockOpenAiServer(
    'fix(diff): preserve multi-file boundaries'
  );
  const files = Object.fromEntries(
    Array.from({ length: 18 }, (_, fileIndex) => [
      `src/file-${fileIndex}.ts`,
      `${Array.from(
        { length: 20 },
        (_, lineIndex) =>
          `export const value${fileIndex}_${lineIndex} = "content-${lineIndex}";`
      ).join('\n')}\n`
    ])
  );

  try {
    await prepareRepo(gitDir, files, { stage: true });

    const oco = await runCli(['--yes'], {
      cwd: gitDir,
      env: getMockOpenAiEnv(server.baseUrl, {
        OCO_TOKENS_MAX_INPUT: '4096',
        OCO_TOKENS_MAX_OUTPUT: '500'
      })
    });

    expect(await waitForExit(oco, 30_000)).toBe(0);
    expect(server.requestBodies.length).toBeGreaterThan(1);

    const fileMarkers = server.requestBodies.flatMap((body) => {
      const messages = (body as { messages: Array<{ content: string }> })
        .messages;
      return messages[messages.length - 1].content
        .split('\n')
        .filter((line) => line.startsWith('diff --git '));
    });

    expect(fileMarkers).toHaveLength(Object.keys(files).length);
    for (const file of Object.keys(files)) {
      expect(fileMarkers).toContain(`diff --git a/${file} b/${file}`);
    }
  } finally {
    await server.cleanup();
    await cleanup();
  }
});

it('cli flow allows editing the generated commit message before committing', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();
  const server = await startMockOpenAiServer(
    'fix(cli): allow editing the generated message'
  );

  try {
    await prepareRepo(
      gitDir,
      {
        'index.ts': 'console.log("Hello World");\n'
      },
      { stage: true }
    );

    const oco = await runCli([], {
      cwd: gitDir,
      env: getMockOpenAiEnv(server.baseUrl)
    });

    expect(
      await oco.findByText('Confirm the commit message?')
    ).toBeInTheConsole();
    oco.userEvent.keyboard('[ArrowDown][ArrowDown][Enter]');

    expect(
      await oco.findByText(
        'Please edit the commit message: (press Enter to continue)'
      )
    ).toBeInTheConsole();
    oco.userEvent.keyboard(' before commit[Enter]');

    expect(await oco.findByText('Successfully committed')).toBeInTheConsole();
    expect(await waitForExit(oco)).toBe(0);
    await assertHeadCommit(
      gitDir,
      'fix(cli): allow editing the generated message before commit'
    );
  } finally {
    await server.cleanup();
    await cleanup();
  }
});

it('cli flow cancels when editing the generated commit message is interrupted', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();
  const server = await startMockOpenAiServer(
    'fix(cli): allow editing the generated message'
  );

  try {
    await prepareRepo(
      gitDir,
      {
        'index.ts': 'console.log("Hello World");\n'
      },
      { stage: true }
    );

    const oco = await runCli([], {
      cwd: gitDir,
      env: getMockOpenAiEnv(server.baseUrl)
    });

    expect(
      await oco.findByText('Confirm the commit message?')
    ).toBeInTheConsole();
    oco.userEvent.keyboard('[ArrowDown][ArrowDown][Enter]');

    expect(
      await oco.findByText(
        'Please edit the commit message: (press Enter to continue)'
      )
    ).toBeInTheConsole();
    oco.process.stdin.write('\x03');

    expect(await waitForExit(oco)).toBe(1);
    expect(
      await oco.queryByText('Successfully committed')
    ).not.toBeInTheConsole();
    await assertGitStatus(gitDir, 'A  index.ts');
  } finally {
    await server.cleanup();
    await cleanup();
  }
});

it('cli flow regenerates the message when the user rejects the first suggestion', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();
  const server = await startMockOpenAiServer(({ requestIndex }) => ({
    body: {
      choices: [
        {
          message: {
            content:
              requestIndex === 0
                ? 'fix(cli): first generated message'
                : 'fix(cli): regenerated message after retry'
          }
        }
      ]
    }
  }));

  try {
    await prepareRepo(
      gitDir,
      {
        'index.ts': 'console.log("Hello World");\n'
      },
      { stage: true }
    );

    const oco = await runCli([], {
      cwd: gitDir,
      env: getMockOpenAiEnv(server.baseUrl)
    });

    expect(
      await oco.findByText('Confirm the commit message?')
    ).toBeInTheConsole();
    oco.userEvent.keyboard('[ArrowDown][Enter]');

    expect(
      await oco.findByText('Do you want to regenerate the message?')
    ).toBeInTheConsole();
    oco.userEvent.keyboard('[Enter]');

    oco.clear();
    expect(
      await oco.findByText('fix(cli): regenerated message after retry')
    ).toBeInTheConsole();
    expect(
      await oco.findByText('Confirm the commit message?')
    ).toBeInTheConsole();
    oco.userEvent.keyboard('[Enter]');

    expect(await oco.findByText('Successfully committed')).toBeInTheConsole();
    expect(await waitForExit(oco)).toBe(0);
    await assertHeadCommit(gitDir, 'fix(cli): regenerated message after retry');
    expect(server.requestBodies).toHaveLength(2);
  } finally {
    await server.cleanup();
    await cleanup();
  }
});

it('cli flow lets the user select only specific unstaged files', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();
  const server = await startMockOpenAiServer(
    'fix(cli): commit only the selected files'
  );

  try {
    await prepareRepo(gitDir, {
      'alpha.ts': 'console.log("alpha");\n',
      'beta.ts': 'console.log("beta");\n'
    });

    const oco = await runCli([], {
      cwd: gitDir,
      env: getMockOpenAiEnv(server.baseUrl)
    });

    expect(await oco.findByText('No files are staged')).toBeInTheConsole();
    expect(
      await oco.findByText(
        'Do you want to stage all files and generate commit message?'
      )
    ).toBeInTheConsole();
    oco.userEvent.keyboard('[ArrowDown][Enter]');

    expect(
      await oco.findByText('Select the files you want to add to the commit:')
    ).toBeInTheConsole();
    oco.userEvent.keyboard('[Space][Enter]');

    expect(
      await oco.findByText('Confirm the commit message?')
    ).toBeInTheConsole();
    oco.userEvent.keyboard('[Enter]');

    expect(await oco.findByText('Successfully committed')).toBeInTheConsole();
    expect(await waitForExit(oco)).toBe(0);
    expect(await getHeadCommitFiles(gitDir)).toEqual(['alpha.ts']);
    await assertGitStatus(gitDir, '?? beta.ts');
  } finally {
    await server.cleanup();
    await cleanup();
  }
});

it('cli applies the documented message template placeholder from extra args', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();
  const server = await startMockOpenAiServer(
    'feat(template): keep generated subject'
  );

  try {
    await prepareRepo(
      gitDir,
      {
        'index.ts': 'console.log("Hello World");\n'
      },
      { stage: true }
    );

    const oco = await runCli(["'$msg #205'"], {
      cwd: gitDir,
      env: getMockOpenAiEnv(server.baseUrl)
    });

    expect(
      await oco.findByText('Confirm the commit message?')
    ).toBeInTheConsole();
    oco.userEvent.keyboard('[Enter]');

    expect(await oco.findByText('Successfully committed')).toBeInTheConsole();
    expect(await waitForExit(oco)).toBe(0);
    await assertHeadCommit(
      gitDir,
      'feat(template): keep generated subject #205'
    );
  } finally {
    await server.cleanup();
    await cleanup();
  }
});

const getHookCliPath = () => realpathSync(resolve('./out/cli.cjs'));

const installCopiedHook = async (gitDir: string, cliPath: string) => {
  copyFileSync(getHookCliPath(), cliPath);
  copyFileSync(
    resolve('./out/tiktoken_bg.wasm'),
    resolve(dirname(cliPath), 'tiktoken_bg.wasm')
  );

  const setHook = await runProcess(process.execPath, [cliPath, 'hook', 'set'], {
    cwd: gitDir
  });
  expect(await waitForExit(setHook)).toBe(0);
};

const expectHookLauncher = (hookPath: string): void => {
  const hookStats = lstatSync(hookPath);

  expect(hookStats.isFile()).toBe(true);
  if (process.platform !== 'win32') expect(hookStats.mode & 0o111).not.toBe(0);
};

const expectHookSetAndUnset = async ({
  cwd,
  hookPath
}: {
  cwd: string;
  hookPath: string;
}): Promise<void> => {
  const setHook = await runCli(['hook', 'set'], { cwd });

  expect(await setHook.findByText('Hook set')).toBeInTheConsole();
  expect(await waitForExit(setHook)).toBe(0);
  expectHookLauncher(hookPath);

  const unsetHook = await runCli(['hook', 'unset'], { cwd });

  expect(await unsetHook.findByText('Hook is removed')).toBeInTheConsole();
  expect(await waitForExit(unsetHook)).toBe(0);
  expect(existsSync(hookPath)).toBe(false);
};

it('hook command respects a relative core.hooksPath from a nested directory', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();
  const nestedDir = resolve(gitDir, 'packages/app');
  const hookPath = resolve(gitDir, 'custom-hooks/prepare-commit-msg');

  try {
    writeRepoFile(gitDir, 'packages/app/.gitkeep', '');
    await runGit(['config', 'core.hooksPath', 'custom-hooks'], gitDir);

    await expectHookSetAndUnset({
      cwd: nestedDir,
      hookPath
    });
  } finally {
    await cleanup();
  }
});

it('hook command sets and unsets the prepare-commit-msg hook in a submodule', async () => {
  const { submoduleDir, cleanup } = await prepareSubmoduleEnvironment();
  const { stdout: absoluteGitDir } = await runGit(
    ['rev-parse', '--absolute-git-dir'],
    submoduleDir
  );
  const hookPath = resolve(absoluteGitDir.trim(), 'hooks/prepare-commit-msg');

  try {
    await expectHookSetAndUnset({
      cwd: submoduleDir,
      hookPath
    });
  } finally {
    await cleanup();
  }
});

it('hook command uses the shared hooks directory from a linked worktree', async () => {
  const { tempDir, gitDir, cleanup } = await prepareEnvironment();
  const worktreeDir = resolve(tempDir, 'worktree');

  try {
    await prepareRepo(
      gitDir,
      { 'README.md': '# fixture\n' },
      { commitMessage: 'test: initialize repository' }
    );
    await runGit(
      ['worktree', 'add', '-b', 'hook-worktree', worktreeDir],
      gitDir
    );

    const { stdout: commonGitDir } = await runGit(
      ['rev-parse', '--git-common-dir'],
      worktreeDir
    );
    const hookPath = resolve(
      worktreeDir,
      commonGitDir.trim(),
      'hooks/prepare-commit-msg'
    );

    await expectHookSetAndUnset({
      cwd: worktreeDir,
      hookPath
    });
  } finally {
    await cleanup();
  }
});

it('hook command replaces a legacy symlink and an outdated launcher', async () => {
  const { tempDir, gitDir, cleanup } = await prepareEnvironment();
  const hookPath = resolve(gitDir, '.git/hooks/prepare-commit-msg');
  const previousCli = resolve(tempDir, 'cli.cjs');

  try {
    symlinkSync(getHookCliPath(), hookPath);

    const replaceSymlink = await runCli(['hook', 'set'], { cwd: gitDir });
    expect(await replaceSymlink.findByText('Hook set')).toBeInTheConsole();
    expect(await waitForExit(replaceSymlink)).toBe(0);
    expectHookLauncher(hookPath);

    await installCopiedHook(gitDir, previousCli);
    rmSync(previousCli);
    if (process.platform !== 'win32') {
      const { uid, gid } = lstatSync(hookPath);
      const teamGroup = process.getgroups?.().find((group) => group !== gid);
      if (teamGroup !== undefined) chownSync(hookPath, uid, teamGroup);
      chmodSync(hookPath, 0o750);
    }
    const { gid } = lstatSync(hookPath);

    const replaceLauncher = await runCli(['hook', 'set'], { cwd: gitDir });
    expect(await replaceLauncher.findByText('Hook set')).toBeInTheConsole();
    expect(await waitForExit(replaceLauncher)).toBe(0);
    expectHookLauncher(hookPath);
    if (process.platform !== 'win32') {
      expect(lstatSync(hookPath).mode & 0o777).toBe(0o750);
      expect(lstatSync(hookPath).gid).toBe(gid);
    }

    const setAgain = await runCli(['hook', 'set'], { cwd: gitDir });
    expect(await setAgain.findByText('already set')).toBeInTheConsole();
    expect(await waitForExit(setAgain)).toBe(0);
    expectHookLauncher(hookPath);
  } finally {
    await cleanup();
  }
});

const itPosix = process.platform === 'win32' ? it.skip : it;

itPosix.each(['launcher', 'legacy symlink'])(
  'hook set and unset preserve another user’s %s',
  async (hookType) => {
    const { tempDir, gitDir, cleanup } = await prepareEnvironment();
    const hookPath = resolve(gitDir, '.git/hooks/prepare-commit-msg');
    const preload = resolve(tempDir, 'other-user.cjs');

    try {
      if (hookType === 'legacy symlink')
        symlinkSync(getHookCliPath(), hookPath);
      else await installCopiedHook(gitDir, resolve(tempDir, 'cli.cjs'));
      const { ino, uid } = lstatSync(hookPath);
      writeFileSync(preload, `process.geteuid = () => ${uid + 1};\n`);
      const env = { NODE_OPTIONS: `--require ${JSON.stringify(preload)}` };

      const setHook = await runCli(['hook', 'set'], { cwd: gitDir, env });
      expect(await waitForExit(setHook)).toBe(1);
      expect(lstatSync(hookPath).ino).toBe(ino);

      const unsetHook = await runCli(['hook', 'unset'], { cwd: gitDir, env });
      expect(await waitForExit(unsetHook)).toBe(0);
      expect(lstatSync(hookPath).ino).toBe(ino);
    } finally {
      await cleanup();
    }
  }
);

itPosix(
  'hook set honors umask and repairs only the owner execute bit',
  async () => {
    const { tempDir, gitDir, cleanup } = await prepareEnvironment();
    const hookPath = resolve(gitDir, '.git/hooks/prepare-commit-msg');
    const preload = resolve(tempDir, 'umask.cjs');
    const env = { NODE_OPTIONS: `--require ${JSON.stringify(preload)}` };

    try {
      writeFileSync(preload, 'process.umask(0o077);\n');
      expect(
        await waitForExit(await runCli(['hook', 'set'], { cwd: gitDir, env }))
      ).toBe(0);
      expect(lstatSync(hookPath).mode & 0o777).toBe(0o700);

      expect(
        await waitForExit(await runCli(['hook', 'set'], { cwd: gitDir }))
      ).toBe(0);
      expect(lstatSync(hookPath).mode & 0o777).toBe(0o700);

      chmodSync(hookPath, 0o640);
      const { ino } = lstatSync(hookPath);
      expect(
        await waitForExit(await runCli(['hook', 'set'], { cwd: gitDir, env }))
      ).toBe(0);
      expect(lstatSync(hookPath).mode & 0o777).toBe(0o740);
      expect(lstatSync(hookPath).ino).toBe(ino);
    } finally {
      await cleanup();
    }
  }
);

it('hook command keeps a foreign or dangling prepare-commit-msg hook', async () => {
  const { tempDir, gitDir, cleanup } = await prepareEnvironment();
  const hookPath = resolve(gitDir, '.git/hooks/prepare-commit-msg');
  const missingTarget = resolve(tempDir, 'missing-hook');

  try {
    const install = await runCli(['hook', 'set'], { cwd: gitDir });
    expect(await waitForExit(install)).toBe(0);
    const foreignHook = readFileSync(hookPath, 'utf8').replace(
      '\nexec ',
      '\necho custom\nexec '
    );
    writeFileSync(hookPath, foreignHook);

    const setHook = await runCli(['hook', 'set'], { cwd: gitDir });
    expect(await setHook.findByText('already set')).toBeInTheConsole();
    expect(await waitForExit(setHook)).toBe(1);

    const unsetHook = await runCli(['hook', 'unset'], { cwd: gitDir });
    expect(await unsetHook.findByText('different hook')).toBeInTheConsole();
    expect(await waitForExit(unsetHook)).toBe(0);
    expect(readFileSync(hookPath, 'utf8')).toBe(foreignHook);

    rmSync(hookPath);
    symlinkSync(missingTarget, hookPath);

    const setDangling = await runCli(['hook', 'set'], { cwd: gitDir });
    expect(await setDangling.findByText('already set')).toBeInTheConsole();
    expect(await waitForExit(setDangling)).toBe(1);
    expect(lstatSync(hookPath).isSymbolicLink()).toBe(true);
    expect(existsSync(missingTarget)).toBe(false);
  } finally {
    await cleanup();
  }
});

it('git preserves a supplied message after OpenCommit is downgraded', async () => {
  const { tempDir, gitDir, cleanup } = await prepareEnvironment();
  const installedCli = resolve(tempDir, 'cli.cjs');

  try {
    await installCopiedHook(gitDir, installedCli);
    writeFileSync(
      installedCli,
      `const { realpathSync } = require('fs');
if (realpathSync(process.argv[1]) !== realpathSync('.git/hooks/prepare-commit-msg') || process.argv[3] !== 'message') {
  throw new Error('Expected a legacy hook call with a supplied message');
}
`
    );

    await runGit(
      ['commit', '--allow-empty', '-m', 'docs: keep this message'],
      gitDir
    );
    await assertHeadCommit(gitDir, 'docs: keep this message');
  } finally {
    await cleanup();
  }
});

it('git commit still works after OpenCommit is uninstalled', async () => {
  const { tempDir, gitDir, cleanup } = await prepareEnvironment();
  const installedCli = resolve(tempDir, 'cli.cjs');

  try {
    await installCopiedHook(gitDir, installedCli);
    rmSync(installedCli);

    const { stderr } = await runGit(
      ['commit', '--allow-empty', '-m', 'docs: update repository'],
      gitDir
    );
    expect(stderr).toContain('oco hook set');
    await assertHeadCommit(gitDir, 'docs: update repository');
  } finally {
    await cleanup();
  }
});

itPosix(
  'prepare-commit-msg hook runs from git commit without node in PATH',
  async () => {
    const { tempDir, gitDir, cleanup } = await prepareEnvironment();
    const server = await startMockOpenAiServer(
      'fix(hook): run without node in PATH'
    );

    try {
      const limitedPath = resolve(tempDir, 'bin');
      const gitPath = execFileSync('/bin/sh', ['-c', 'command -v git'], {
        encoding: 'utf8'
      }).trim();
      mkdirSync(limitedPath);
      symlinkSync(gitPath, resolve(limitedPath, 'git'));
      writeGlobalConfig(tempDir, ['OCO_HOOK_AUTO_UNCOMMENT=true']);
      const env = { HOME: tempDir };

      await prepareRepo(
        gitDir,
        {
          'index.ts': 'console.log("Hello World");\n'
        },
        { stage: true }
      );

      const setHook = await runCli(['hook', 'set'], {
        cwd: gitDir,
        env
      });
      expect(await waitForExit(setHook)).toBe(0);

      await runGit(
        ['commit'],
        gitDir,
        getMockOpenAiEnv(server.baseUrl, {
          ...env,
          PATH: limitedPath,
          GIT_EDITOR: ':'
        })
      );

      await assertHeadCommit(gitDir, 'fix(hook): run without node in PATH');
    } finally {
      await server.cleanup();
      await cleanup();
    }
  }
);

it.each([false, true])(
  'prepare-commit-msg hook writes the message with full GitMoji set to %s',
  async (fullSpec) => {
    const { gitDir, cleanup } = await prepareEnvironment();
    const server = await startMockOpenAiServer(
      'fix(hook): populate the commit message file'
    );
    const hookPath = resolve(gitDir, '.git/hooks/prepare-commit-msg');
    const messageFile = resolve(gitDir, '.git/COMMIT_EDITMSG');

    try {
      await prepareRepo(
        gitDir,
        {
          'index.ts': 'console.log("Hello World");\n'
        },
        { stage: true }
      );

      const setHook = await runCli(['hook', 'set'], {
        cwd: gitDir
      });
      expect(await setHook.findByText('Hook set')).toBeInTheConsole();
      expect(await waitForExit(setHook)).toBe(0);

      writeFileSync(messageFile, '# existing\n');

      const hookRun = await runProcess(hookPath, [messageFile], {
        cwd: gitDir,
        env: getMockOpenAiEnv(server.baseUrl, {
          OCO_EMOJI_FULL_SPEC: String(fullSpec)
        })
      });

      expect(await hookRun.findByText('Done')).toBeInTheConsole();
      expect(await waitForExit(hookRun)).toBe(0);

      const commitMessage = readFileSync(messageFile, 'utf8');
      expect(commitMessage).toContain(
        '# fix(hook): populate the commit message file'
      );
      expect(commitMessage).toContain('# ---------- [OpenCommit] ---------- #');
      expect(commitMessage).toContain('# existing');

      const payload = server.requestBodies[0] as {
        messages: Array<{ content: string }>;
      };
      const fullSpecInstruction = '🎨, Improve structure / format of the code';
      expect(payload.messages[0].content.includes(fullSpecInstruction)).toBe(
        fullSpec
      );
    } finally {
      await server.cleanup();
      await cleanup();
    }
  }
);

it('prepare-commit-msg hook supports llama.cpp without an API key', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();
  const homeDir = await prepareTempDir();
  const server = await startMockOpenAiServer(
    'fix(hook): support local providers without keys'
  );
  const hookPath = resolve(gitDir, '.git/hooks/prepare-commit-msg');
  const messageFile = resolve(gitDir, '.git/COMMIT_EDITMSG');

  try {
    await prepareRepo(
      gitDir,
      {
        'index.ts': 'console.log("Hello World");\n'
      },
      { stage: true }
    );

    const setHook = await runCli(['hook', 'set'], { cwd: gitDir });
    expect(await waitForExit(setHook)).toBe(0);

    writeFileSync(messageFile, '# existing\n');

    const hookRun = await runProcess(hookPath, [messageFile], {
      cwd: gitDir,
      env: {
        HOME: homeDir,
        OCO_AI_PROVIDER: 'llamacpp',
        OCO_API_KEY: '',
        OCO_API_URL: new URL(server.baseUrl).origin,
        OCO_MODEL: 'local-test-model',
        OCO_GITPUSH: 'false'
      }
    });

    expect(await hookRun.findByText('Done')).toBeInTheConsole();
    expect(await waitForExit(hookRun)).toBe(0);
    expect(readFileSync(messageFile, 'utf8')).toContain(
      '# fix(hook): support local providers without keys'
    );
    expect(server.requestBodies).toHaveLength(1);
    expect(server.authHeaders).toHaveLength(0);
  } finally {
    await server.cleanup();
    await cleanup();
    rmSync(homeDir, { force: true, recursive: true });
  }
});

it('prepare-commit-msg hook preserves the message when OpenAI has no API key', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();
  const homeDir = await prepareTempDir();
  const hookPath = resolve(gitDir, '.git/hooks/prepare-commit-msg');
  const messageFile = resolve(gitDir, '.git/COMMIT_EDITMSG');
  const originalMessage = '# existing\n';

  try {
    await prepareRepo(
      gitDir,
      {
        'index.ts': 'console.log("Hello World");\n'
      },
      { stage: true }
    );

    const setHook = await runCli(['hook', 'set'], { cwd: gitDir });
    expect(await waitForExit(setHook)).toBe(0);

    writeFileSync(messageFile, originalMessage);

    const hookRun = await runProcess(hookPath, [messageFile], {
      cwd: gitDir,
      env: getMockOpenAiEnv('http://127.0.0.1:1/v1', {
        HOME: homeDir,
        OCO_API_KEY: ''
      })
    });

    expect(
      await hookRun.findByText('No OCO_API_KEY is set')
    ).toBeInTheConsole();
    expect(await waitForExit(hookRun)).toBe(0);
    expect(readFileSync(messageFile, 'utf8')).toBe(originalMessage);
  } finally {
    await cleanup();
    rmSync(homeDir, { force: true, recursive: true });
  }
});

it('cli flow prompts for a missing API key, saves it, and completes the commit', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();
  const homeDir = await prepareTempDir();
  const server = await startMockOpenAiServer(
    'fix(api): recovered after prompt'
  );

  try {
    const configPath = writeGlobalConfig(homeDir, [
      'OCO_AI_PROVIDER=openai',
      'OCO_MODEL=gpt-4o-mini',
      `OCO_API_URL=${server.baseUrl}`,
      'OCO_GITPUSH=false'
    ]);
    seedMigrations(homeDir);

    await prepareRepo(
      gitDir,
      {
        'index.ts': 'console.log("Hello World");\n'
      },
      { stage: true }
    );

    const oco = await runCli([], {
      cwd: gitDir,
      env: {
        HOME: homeDir
      }
    });

    expect(
      await oco.findByText("API key missing for openai. Let's set it up.")
    ).toBeInTheConsole();
    expect(await oco.findByText('Enter your API key:')).toBeInTheConsole();
    oco.userEvent.keyboard('test-openai-key[Enter]');

    expect(await oco.findByText('API key saved')).toBeInTheConsole();
    expect(
      await oco.findByText('Confirm the commit message?')
    ).toBeInTheConsole();
    oco.userEvent.keyboard('[Enter]');

    expect(await oco.findByText('Successfully committed')).toBeInTheConsole();
    expect(await waitForExit(oco)).toBe(0);
    await assertHeadCommit(gitDir, 'fix(api): recovered after prompt');
    expect(server.authHeaders).toContain('Bearer test-openai-key');
    expect(readFileSync(configPath, 'utf8')).toContain(
      'OCO_API_KEY=test-openai-key'
    );
  } finally {
    await server.cleanup();
    rmSync(homeDir, { force: true, recursive: true });
    await cleanup();
  }
});

it('saves provider credentials without displaying them', async () => {
  const homeDir = await prepareTempDir();
  const apiKey = 'test-openrouter-config-key';
  const headerValue = 'test-openrouter-config-header';

  try {
    const result = spawnSync(
      process.execPath,
      [
        getCliPath(),
        'config',
        'set',
        'OCO_AI_PROVIDER=openrouter',
        `OCO_API_KEY=${apiKey}`,
        `OCO_API_CUSTOM_HEADERS=${JSON.stringify({ Authorization: `Bearer ${headerValue}` })}`
      ],
      {
        cwd: homeDir,
        env: { ...process.env, HOME: homeDir },
        encoding: 'utf8'
      }
    );

    expect(result.status).toBe(0);
    const output = result.stdout + result.stderr;
    expect(output).not.toContain(apiKey);
    expect(output).not.toContain(headerValue);

    const config = readFileSync(resolve(homeDir, '.opencommit'), 'utf8');
    expect(config).toContain(apiKey);
    expect(config).toContain(headerValue);
  } finally {
    rmSync(homeDir, { force: true, recursive: true });
  }
});

it('uses a key prompted for a repository provider without saving it globally', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();
  const homeDir = await prepareTempDir();
  const message = 'fix(api): use the repository provider';
  const server = await startMockOpenAiServer(message);

  try {
    const configPath = writeGlobalConfig(homeDir, [
      'OCO_AI_PROVIDER=openai',
      'OCO_API_KEY=test-global-key',
      'OCO_API_CUSTOM_HEADERS={"Authorization":"Bearer test-global-header"}',
      'OCO_GITPUSH=false'
    ]);
    const savedConfig = readFileSync(configPath, 'utf8');
    await prepareRepo(gitDir, { 'index.ts': 'export {};\n' }, { stage: true });
    writeRepoFile(
      gitDir,
      '.env',
      `OCO_AI_PROVIDER=deepseek\nOCO_API_URL=${server.baseUrl}\n`
    );

    const oco = await runCli(['--yes'], {
      cwd: gitDir,
      env: { HOME: homeDir }
    });

    await oco.findByText('Enter your API key:');
    oco.userEvent.keyboard('test-repo-key[Enter]');

    expect(await waitForExit(oco)).toBe(0);
    await assertHeadCommit(gitDir, message);
    expect(server.authHeaders).toEqual(['Bearer test-repo-key']);
    expect(oco.getStdallStr()).not.toContain('test-repo-key');
    expect(server.requestBodies[0].model).toBe('deepseek-v4-flash');
    expect(readFileSync(configPath, 'utf8')).toBe(savedConfig);
  } finally {
    await server.cleanup();
    rmSync(homeDir, { force: true, recursive: true });
    await cleanup();
  }
});

it('uses a prompted key despite a blank repository key', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();
  const homeDir = await prepareTempDir();
  const message = 'fix(api): use the prompted key';
  const server = await startMockOpenAiServer(message);

  try {
    const configPath = writeGlobalConfig(homeDir, [
      'OCO_AI_PROVIDER=deepseek',
      `OCO_API_URL=${server.baseUrl}`,
      'OCO_GITPUSH=false'
    ]);
    await prepareRepo(gitDir, { 'index.ts': 'export {};\n' }, { stage: true });
    writeRepoFile(gitDir, '.env', 'OCO_API_KEY=\n');

    const oco = await runCli(['--yes'], {
      cwd: gitDir,
      env: { HOME: homeDir }
    });

    await oco.findByText('Enter your API key:');
    oco.userEvent.keyboard('test-prompted-key[Enter]');

    expect(await waitForExit(oco)).toBe(0);
    await assertHeadCommit(gitDir, message);
    expect(server.authHeaders).toEqual(['Bearer test-prompted-key']);
    expect(readFileSync(configPath, 'utf8')).toContain(
      'OCO_API_KEY=test-prompted-key'
    );
  } finally {
    await server.cleanup();
    rmSync(homeDir, { force: true, recursive: true });
    await cleanup();
  }
});

it('keeps the global provider key when a repository provider has a legacy key', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();
  const homeDir = await prepareTempDir();
  const message = 'fix(api): use the repository key';
  const server = await startMockOpenAiServer(message);

  try {
    const configPath = writeGlobalConfig(homeDir, [
      'OCO_AI_PROVIDER=openrouter',
      'OCO_API_KEY=test-global-openrouter-key',
      'OCO_OPENAI_API_KEY=test-legacy-openai-key',
      'OCO_GITPUSH=false'
    ]);
    const savedConfig = readFileSync(configPath, 'utf8');
    await prepareRepo(gitDir, { 'index.ts': 'export {};\n' }, { stage: true });
    writeRepoFile(
      gitDir,
      '.env',
      [
        'OCO_AI_PROVIDER=openai',
        'OCO_API_KEY=test-repo-openai-key',
        `OCO_API_URL=${server.baseUrl}`
      ].join('\n')
    );

    const oco = await runCli(['--yes'], {
      cwd: gitDir,
      env: { HOME: homeDir }
    });

    expect(await waitForExit(oco)).toBe(0);
    expect(readFileSync(configPath, 'utf8')).toBe(savedConfig);
    expect(server.authHeaders).toEqual(['Bearer test-repo-openai-key']);
    await assertHeadCommit(gitDir, message);
  } finally {
    await server.cleanup();
    rmSync(homeDir, { force: true, recursive: true });
    await cleanup();
  }
});

it.each([
  ['aimlapi', 'https://api.aimlapi.com/v1'],
  ['orcarouter', 'https://api.orcarouter.ai/v1'],
  ['cheaperinference', 'https://api.cheaperinference.com/v1'],
  ['requesty', 'https://router.requesty.ai/v1'],
  ['atlascloud', 'https://api.atlascloud.ai/v1'],
  ['uberllm', 'https://api.uberllm.dev/v1'],
  ['trustedrouter', 'https://api.trustedrouter.com/v1'],
  ['aigrow', 'https://aigrow.gg/v1']
])(
  'migrates a global %s config to the openai provider at %s',
  async (provider, apiUrl) => {
    const homeDir = await prepareTempDir();

    try {
      // The setup wizard config of a removed provider, without migration records.
      const configPath = writeGlobalConfig(homeDir, [
        `OCO_AI_PROVIDER=${provider}`,
        `OCO_API_KEY=test-${provider}-key`,
        'OCO_MODEL=vendor/test-model'
      ]);

      const oco = await runCli([], { cwd: homeDir, env: { HOME: homeDir } });

      expect(await waitForExit(oco)).toBe(0);
      expect(iniParse(readFileSync(configPath, 'utf8'))).toMatchObject({
        OCO_AI_PROVIDER: 'openai',
        OCO_API_URL: apiUrl,
        OCO_API_KEY: `test-${provider}-key`,
        OCO_MODEL: 'vendor/test-model'
      });
    } finally {
      rmSync(homeDir, { force: true, recursive: true });
    }
  }
);

it.each([
  { provider: 'aimlapi', path: '/chat/completions' },
  { provider: 'requesty', path: '' }
])(
  'commits through the saved $provider API URL after the migration',
  async ({ provider, path }) => {
    const { gitDir, cleanup } = await prepareEnvironment();
    const homeDir = await prepareTempDir();
    const message = `feat(${provider}): commit through the gateway`;
    const server = await startMockOpenAiServer(message);

    try {
      const configPath = writeGlobalConfig(homeDir, [
        `OCO_AI_PROVIDER=${provider}`,
        `OCO_API_KEY=test-${provider}-key`,
        'OCO_MODEL=vendor/test-model',
        `OCO_API_URL=${server.baseUrl}${path}`,
        'OCO_GITPUSH=false'
      ]);
      // The migrations recorded before the providers were removed.
      seedMigrations(homeDir, [
        '00_use_single_api_key_and_url',
        '01_remove_obsolete_config_keys_from_global_file',
        '02_set_missing_default_values'
      ]);
      await prepareRepo(
        gitDir,
        { 'index.ts': 'export {};\n' },
        { stage: true }
      );

      const migrate = await runCli(['--yes'], {
        cwd: gitDir,
        env: { HOME: homeDir }
      });
      expect(await waitForExit(migrate)).toBe(0);
      expect(iniParse(readFileSync(configPath, 'utf8'))).toMatchObject({
        OCO_AI_PROVIDER: 'openai',
        OCO_API_URL: server.baseUrl
      });

      const oco = await runCli(['--yes'], {
        cwd: gitDir,
        env: { HOME: homeDir }
      });

      expect(await waitForExit(oco)).toBe(0);
      await assertHeadCommit(gitDir, message);
      expect(server.authHeaders).toEqual([`Bearer test-${provider}-key`]);
      expect(server.requestBodies[0].model).toBe('vendor/test-model');
    } finally {
      await server.cleanup();
      rmSync(homeDir, { force: true, recursive: true });
      await cleanup();
    }
  }
);

it.each([
  {
    source: 'the shell',
    env: { OCO_AI_PROVIDER: 'requesty', OCO_API_KEY: 'test-requesty-key' }
  },
  {
    source: 'the repository .env file',
    envFile: 'OCO_AI_PROVIDER=requesty\nOCO_API_KEY=test-requesty-key\n'
  }
])(
  'does not send the key when $source sets a removed provider',
  async ({ env = {}, envFile }) => {
    const { gitDir, cleanup } = await prepareEnvironment();
    const homeDir = await prepareTempDir();
    // The OpenAI SDK sends requests here when no OCO_API_URL is configured.
    const server = await startMockOpenAiServer('feat: unexpected request');

    try {
      writeGlobalConfig(homeDir, [
        'OCO_AI_PROVIDER=openai',
        'OCO_API_KEY=test-openai-key',
        'OCO_GITPUSH=false'
      ]);
      seedMigrations(homeDir);
      if (envFile) writeFileSync(resolve(gitDir, '.env'), envFile);
      await prepareRepo(
        gitDir,
        { 'index.ts': 'export {};\n' },
        { stage: true }
      );

      const oco = await runCli(['--yes'], {
        cwd: gitDir,
        env: { HOME: homeDir, OPENAI_BASE_URL: server.baseUrl, ...env }
      });

      expect(await waitForExit(oco)).toBe(1);
      expect(oco.getStdallStr()).toContain(
        'OCO_API_URL=https://router.requesty.ai/v1'
      );
      expect(server.authHeaders).toEqual([]);
    } finally {
      await server.cleanup();
      rmSync(homeDir, { force: true, recursive: true });
      await cleanup();
    }
  }
);

it('prepare-commit-msg hook does not send the key of a removed provider', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();
  const homeDir = await prepareTempDir();
  // The OpenAI SDK sends requests here when no OCO_API_URL is configured.
  const server = await startMockOpenAiServer('feat: unexpected request');
  const hookPath = resolve(gitDir, '.git/hooks/prepare-commit-msg');
  const messageFile = resolve(gitDir, '.git/COMMIT_EDITMSG');

  try {
    // The hook runs no migrations, so the removed provider stays in place.
    writeGlobalConfig(homeDir, [
      'OCO_AI_PROVIDER=requesty',
      'OCO_API_KEY=test-requesty-key'
    ]);
    await prepareRepo(gitDir, { 'index.ts': 'export {};\n' }, { stage: true });

    const setHook = await runCli(['hook', 'set'], {
      cwd: gitDir,
      env: { HOME: homeDir }
    });
    expect(await waitForExit(setHook)).toBe(0);
    writeFileSync(messageFile, '# existing\n');

    const hookRun = await runProcess(hookPath, [messageFile], {
      cwd: gitDir,
      env: { HOME: homeDir, OPENAI_BASE_URL: server.baseUrl }
    });

    await waitForExit(hookRun);
    expect(hookRun.getStdallStr()).toContain(
      'OCO_API_URL=https://router.requesty.ai/v1'
    );
    expect(server.authHeaders).toEqual([]);
  } finally {
    await server.cleanup();
    rmSync(homeDir, { force: true, recursive: true });
    await cleanup();
  }
});

it('oco config set rejects a removed provider with its replacement', async () => {
  const homeDir = await prepareTempDir();

  try {
    const configPath = writeGlobalConfig(homeDir, [
      'OCO_AI_PROVIDER=openai',
      'OCO_API_KEY=test-openai-key'
    ]);
    seedMigrations(homeDir);
    const savedConfig = readFileSync(configPath, 'utf8');

    const oco = await runCli(['config', 'set', 'OCO_AI_PROVIDER=requesty'], {
      cwd: homeDir,
      env: { HOME: homeDir }
    });

    expect(await waitForExit(oco)).toBe(1);
    expect(oco.getStdallStr()).toContain(
      'OCO_API_URL=https://router.requesty.ai/v1'
    );
    expect(readFileSync(configPath, 'utf8')).toBe(savedConfig);
  } finally {
    rmSync(homeDir, { force: true, recursive: true });
  }
});

it.each([{ provider: 'minimax', model: 'MiniMax-M3' }])(
  'cli commits after a fresh $provider setup without migration records',
  async ({ provider, model }) => {
    const { gitDir, cleanup } = await prepareEnvironment();
    const homeDir = await prepareTempDir();
    const message = `feat(${provider}): first commit`;
    const apiKey = `test-${provider}-key`;
    const server = await startMockOpenAiServer(message);

    try {
      // The global config the setup wizard writes, with no migrations recorded yet.
      writeGlobalConfig(homeDir, [
        `OCO_AI_PROVIDER=${provider}`,
        `OCO_API_KEY=${apiKey}`,
        `OCO_MODEL=${model}`,
        `OCO_API_URL=${server.baseUrl}`,
        'OCO_GITPUSH=false'
      ]);

      await prepareRepo(
        gitDir,
        {
          'index.ts': 'console.log("Hello World");\n'
        },
        { stage: true }
      );

      const oco = await runCli(['--yes'], {
        cwd: gitDir,
        env: {
          HOME: homeDir
        }
      });

      expect(await waitForExit(oco)).toBe(0);
      await assertHeadCommit(gitDir, message);
      expect(server.authHeaders).toContain(`Bearer ${apiKey}`);
    } finally {
      await server.cleanup();
      rmSync(homeDir, { force: true, recursive: true });
      await cleanup();
    }
  }
);

it('cli ignores files listed in .opencommitignore when they are the only staged changes', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();

  try {
    await prepareRepo(
      gitDir,
      {
        '.opencommitignore': 'ignored.ts\n'
      },
      {
        stage: true,
        commitMessage: 'add opencommit ignore'
      }
    );

    writeRepoFile(gitDir, 'ignored.ts', 'console.log("ignored");\n');
    await runGit(['add', 'ignored.ts'], gitDir);

    const oco = await runCli([], {
      cwd: gitDir,
      env: {
        OCO_AI_PROVIDER: 'openai',
        OCO_API_KEY: 'dummy-openai-key',
        OCO_GITPUSH: 'false'
      }
    });

    expect(await oco.findByText('No changes detected')).toBeInTheConsole();
    expect(await waitForExit(oco)).toBe(1);
    await assertHeadCommit(gitDir, 'add opencommit ignore');
  } finally {
    await cleanup();
  }
});

it('cli excludes .opencommitignore files from the generated prompt while still committing staged changes', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();
  const server = await startMockOpenAiServer(
    'fix(ignore): keep only relevant diff context'
  );

  try {
    await prepareRepo(
      gitDir,
      {
        '.opencommitignore': 'ignored.ts\n'
      },
      {
        stage: true,
        commitMessage: 'add opencommit ignore'
      }
    );

    writeRepoFile(gitDir, 'kept.ts', 'console.log("kept");\n');
    writeRepoFile(gitDir, 'ignored.ts', 'console.log("ignored");\n');
    await runGit(['add', 'kept.ts', 'ignored.ts'], gitDir);

    const oco = await runCli([], {
      cwd: gitDir,
      env: getMockOpenAiEnv(server.baseUrl)
    });

    expect(
      await oco.findByText('Confirm the commit message?')
    ).toBeInTheConsole();
    oco.userEvent.keyboard('[Enter]');

    expect(await oco.findByText('Successfully committed')).toBeInTheConsole();
    expect(await waitForExit(oco)).toBe(0);

    const requestPayload = server.requestBodies[
      server.requestBodies.length - 1
    ] as { messages: Array<{ content: string }> };
    const requestContents = requestPayload.messages
      .map((message) => message.content)
      .join('\n');

    expect(requestContents).toContain('kept.ts');
    expect(requestContents).toContain('console.log("kept");');
    expect(requestContents).not.toContain('ignored.ts');
    expect(requestContents).not.toContain('console.log("ignored");');
    expect(await getHeadCommitFiles(gitDir)).toEqual(['ignored.ts', 'kept.ts']);
  } finally {
    await server.cleanup();
    await cleanup();
  }
});

it('first run launches setup, saves config, and completes a commit with the configured provider', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();
  const homeDir = await prepareTempDir();
  const server = await startMockOpenAiServer(
    'feat(setup): finish first run successfully'
  );

  try {
    const configPath = resolve(homeDir, '.opencommit');

    await seedModelCache(homeDir, {
      openai: ['gpt-4o-mini', 'gpt-4o']
    });
    seedMigrations(homeDir);

    await prepareRepo(
      gitDir,
      {
        'index.ts': 'console.log("Hello World");\n'
      },
      { stage: true }
    );

    const oco = await runCli([], {
      cwd: gitDir,
      env: {
        HOME: homeDir,
        OCO_API_URL: server.baseUrl,
        OCO_GITPUSH: 'false'
      }
    });

    expect(await oco.findByText('Select your AI provider:')).toBeInTheConsole();
    oco.userEvent.keyboard('[Enter]');

    expect(await oco.findByText('Enter your API key:')).toBeInTheConsole();
    oco.userEvent.keyboard('first-run-openai-key[Enter]');

    expect(await oco.findByText('Select a model:')).toBeInTheConsole();
    oco.userEvent.keyboard('[Enter]');

    expect(
      await oco.findByText('Configuration saved to ~/.opencommit')
    ).toBeInTheConsole();
    expect(
      await oco.findByText('Confirm the commit message?')
    ).toBeInTheConsole();
    oco.userEvent.keyboard('[Enter]');

    expect(await oco.findByText('Successfully committed')).toBeInTheConsole();
    expect(await waitForExit(oco)).toBe(0);
    await assertHeadCommit(
      gitDir,
      'feat(setup): finish first run successfully'
    );
    expect(readFileSync(configPath, 'utf8')).toContain(
      'OCO_AI_PROVIDER=openai'
    );
    expect(readFileSync(configPath, 'utf8')).toContain(
      'OCO_API_KEY=first-run-openai-key'
    );
    expect(readFileSync(configPath, 'utf8')).toContain('OCO_MODEL=gpt-4o-mini');
    expect(server.authHeaders).toContain('Bearer first-run-openai-key');
  } finally {
    await server.cleanup();
    rmSync(homeDir, { force: true, recursive: true });
    await cleanup();
  }
});

it('cli recovers from a missing model by prompting for an alternative and retrying', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();
  const homeDir = await prepareTempDir();
  const server = await startMockOpenAiServer(({ requestIndex, body }) => {
    if (requestIndex === 0) {
      return {
        status: 404,
        body: {
          error: {
            message: `The model '${body?.model}' does not exist`,
            type: 'invalid_request_error',
            code: 'model_not_found'
          }
        }
      };
    }

    return {
      body: {
        choices: [
          {
            message: {
              content: 'fix(model): recover from invalid default model'
            }
          }
        ]
      }
    };
  });

  try {
    const configPath = writeGlobalConfig(homeDir, [
      'OCO_AI_PROVIDER=openai',
      'OCO_API_KEY=test-openai-key',
      'OCO_MODEL=missing-model',
      `OCO_API_URL=${server.baseUrl}`,
      'OCO_GITPUSH=false'
    ]);
    seedMigrations(homeDir);

    await prepareRepo(
      gitDir,
      {
        'index.ts': 'console.log("Hello World");\n'
      },
      { stage: true }
    );

    const oco = await runCli([], {
      cwd: gitDir,
      env: {
        HOME: homeDir
      }
    });

    expect(
      await oco.findByText("Model 'missing-model' not found")
    ).toBeInTheConsole();
    expect(
      await oco.findByText('Select an alternative model:')
    ).toBeInTheConsole();
    oco.userEvent.keyboard('[Enter]');

    expect(await oco.findByText('Save as default model?')).toBeInTheConsole();
    oco.userEvent.keyboard('[Enter]');

    expect(await oco.findByText('Model saved as default')).toBeInTheConsole();
    expect(
      await oco.findByText('Confirm the commit message?')
    ).toBeInTheConsole();
    oco.userEvent.keyboard('[Enter]');

    expect(await oco.findByText('Successfully committed')).toBeInTheConsole();
    expect(await waitForExit(oco)).toBe(0);
    await assertHeadCommit(
      gitDir,
      'fix(model): recover from invalid default model'
    );
    expect(server.requestBodies.map((request) => request.model)).toEqual([
      'missing-model',
      'gpt-4o-mini'
    ]);
    expect(readFileSync(configPath, 'utf8')).toContain('OCO_MODEL=gpt-4o-mini');
  } finally {
    await server.cleanup();
    rmSync(homeDir, { force: true, recursive: true });
    await cleanup();
  }
});

it('cli excludes lockfiles and assets from the generated prompt while still committing them', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();
  const server = await startMockOpenAiServer(
    'fix(diff): focus prompt on meaningful source changes'
  );

  try {
    await prepareRepo(
      gitDir,
      {
        'kept.ts': 'console.log("kept");\n',
        'package-lock.json': '{"name":"opencommit","lockfileVersion":3}\n',
        'logo.svg':
          '<svg viewBox="0 0 1 1"><rect width="1" height="1" /></svg>\n'
      },
      { stage: true }
    );

    const oco = await runCli([], {
      cwd: gitDir,
      env: getMockOpenAiEnv(server.baseUrl)
    });

    expect(
      await oco.findByText('Confirm the commit message?')
    ).toBeInTheConsole();
    oco.userEvent.keyboard('[Enter]');

    expect(await oco.findByText('Successfully committed')).toBeInTheConsole();
    expect(await waitForExit(oco)).toBe(0);

    const requestPayload = server.requestBodies[
      server.requestBodies.length - 1
    ] as { messages: Array<{ content: string }> };
    const requestContents = requestPayload.messages
      .map((message) => message.content)
      .join('\n');

    expect(requestContents).toContain('kept.ts');
    expect(requestContents).toContain('console.log("kept");');
    expect(requestContents).not.toContain('package-lock.json');
    expect(requestContents).not.toContain('lockfileVersion');
    expect(requestContents).not.toContain('logo.svg');
    expect(requestContents).not.toContain('<svg');
    expect(await getHeadCommitFiles(gitDir)).toEqual([
      'kept.ts',
      'logo.svg',
      'package-lock.json'
    ]);
  } finally {
    await server.cleanup();
    await cleanup();
  }
});

it('fails with a non-zero exit code outside a git repository', async () => {
  const tempDir = await prepareTempDir();

  try {
    const oco = await runCli([], {
      cwd: tempDir,
      env: {
        OCO_AI_PROVIDER: 'openai',
        OCO_API_KEY: 'dummy-openai-key',
        OCO_GITPUSH: 'false'
      }
    });

    expect(await waitForExit(oco)).toBe(1);
    expect(oco.getStdallStr()).toMatch(
      /No changes detected|not a git repository/
    );
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});
