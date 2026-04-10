import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from 'fs';
import { resolve } from 'path';
import 'cli-testing-library/extend-expect';
import {
  assertGitStatus,
  assertHeadCommit,
  getHeadCommitFiles,
  getMockOpenAiEnv,
  prepareEnvironment,
  prepareRepo,
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
    expect(await oco.findByText('Successfully committed')).toBeInTheConsole();
    expect(await waitForExit(oco)).toBe(0);
    await assertHeadCommit(gitDir, 'fix(context): handle production incident');

    const requestPayload = server.requestBodies[
      server.requestBodies.length - 1
    ] as { messages: Array<{ content: string }> };
    const requestContents = requestPayload.messages
      .map((message) => message.content)
      .join('\n');

    expect(requestContents).toContain(
      '<context>production-incident</context>'
    );
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

    expect(await oco.findByText('Successfully committed')).toBeInTheConsole();
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

    expect(await oco.findByText('Confirm the commit message?')).toBeInTheConsole();
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

    expect(await oco.findByText('Confirm the commit message?')).toBeInTheConsole();
    oco.userEvent.keyboard('[ArrowDown][Enter]');

    expect(
      await oco.findByText('Do you want to regenerate the message?')
    ).toBeInTheConsole();
    oco.userEvent.keyboard('[Enter]');

    oco.clear();
    expect(
      await oco.findByText('fix(cli): regenerated message after retry')
    ).toBeInTheConsole();
    expect(await oco.findByText('Confirm the commit message?')).toBeInTheConsole();
    oco.userEvent.keyboard('[Enter]');

    expect(await oco.findByText('Successfully committed')).toBeInTheConsole();
    expect(await waitForExit(oco)).toBe(0);
    await assertHeadCommit(
      gitDir,
      'fix(cli): regenerated message after retry'
    );
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

    expect(await oco.findByText('Confirm the commit message?')).toBeInTheConsole();
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

    expect(await oco.findByText('Confirm the commit message?')).toBeInTheConsole();
    oco.userEvent.keyboard('[Enter]');

    expect(await oco.findByText('Successfully committed')).toBeInTheConsole();
    expect(await waitForExit(oco)).toBe(0);
    await assertHeadCommit(gitDir, 'feat(template): keep generated subject #205');
  } finally {
    await server.cleanup();
    await cleanup();
  }
});

it('hook command sets and unsets the prepare-commit-msg symlink', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();
  const hookPath = resolve(gitDir, '.git/hooks/prepare-commit-msg');
  const cliPath = resolve('./out/cli.cjs');

  try {
    const setHook = await runCli(['hook', 'set'], {
      cwd: gitDir
    });

    expect(await setHook.findByText('Hook set')).toBeInTheConsole();
    expect(await waitForExit(setHook)).toBe(0);
    expect(existsSync(hookPath)).toBe(true);
    expect(lstatSync(hookPath).isSymbolicLink()).toBe(true);
    expect(realpathSync(hookPath)).toBe(cliPath);

    const unsetHook = await runCli(['hook', 'unset'], {
      cwd: gitDir
    });

    expect(await unsetHook.findByText('Hook is removed')).toBeInTheConsole();
    expect(await waitForExit(unsetHook)).toBe(0);
    expect(existsSync(hookPath)).toBe(false);
  } finally {
    await cleanup();
  }
});

it('prepare-commit-msg hook writes the generated message into the commit message file', async () => {
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
      env: getMockOpenAiEnv(server.baseUrl)
    });

    expect(await hookRun.findByText('Done')).toBeInTheConsole();
    expect(await waitForExit(hookRun)).toBe(0);

    const commitMessage = readFileSync(messageFile, 'utf8');
    expect(commitMessage).toContain(
      '# fix(hook): populate the commit message file'
    );
    expect(commitMessage).toContain('# ---------- [OpenCommit] ---------- #');
    expect(commitMessage).toContain('# existing');
  } finally {
    await server.cleanup();
    await cleanup();
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
    expect(await oco.findByText('Confirm the commit message?')).toBeInTheConsole();
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

    expect(await oco.findByText('Confirm the commit message?')).toBeInTheConsole();
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
    expect(await oco.findByText('Confirm the commit message?')).toBeInTheConsole();
    oco.userEvent.keyboard('[Enter]');

    expect(await oco.findByText('Successfully committed')).toBeInTheConsole();
    expect(await waitForExit(oco)).toBe(0);
    await assertHeadCommit(
      gitDir,
      'feat(setup): finish first run successfully'
    );
    expect(readFileSync(configPath, 'utf8')).toContain('OCO_AI_PROVIDER=openai');
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
    expect(await oco.findByText('Confirm the commit message?')).toBeInTheConsole();
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
        'logo.svg': '<svg viewBox="0 0 1 1"><rect width="1" height="1" /></svg>\n'
      },
      { stage: true }
    );

    const oco = await runCli([], {
      cwd: gitDir,
      env: getMockOpenAiEnv(server.baseUrl)
    });

    expect(await oco.findByText('Confirm the commit message?')).toBeInTheConsole();
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
    expect(oco.getStdallStr()).toMatch(/No changes detected|not a git repository/);
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});
