import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import 'cli-testing-library/extend-expect';
import {
  assertGitStatus,
  assertHeadCommit,
  prepareEnvironment,
  prepareRepo,
  runCli,
  runGit,
  seedMigrations,
  startMockAnthropicServer,
  waitForExit,
  writeGlobalConfig,
  writeRepoFile
} from './utils';

const getAnthropicEnv = (
  baseUrl: string,
  homeDir: string,
  model: string
): NodeJS.ProcessEnv => ({
  HOME: homeDir,
  OCO_AI_PROVIDER: 'anthropic',
  OCO_API_KEY: 'test-anthropic-key',
  OCO_API_URL: baseUrl,
  OCO_MODEL: model,
  OCO_TOKENS_MAX_OUTPUT: '256',
  OCO_PROXY: 'null',
  OCO_GITPUSH: 'false'
});

it('uses saved legacy Anthropic transport when a repository selects Anthropic', async () => {
  const { tempDir, gitDir, cleanup } = await prepareEnvironment({ remotes: 0 });
  const message = 'fix(anthropic): use the saved API settings';
  const server = await startMockAnthropicServer({
    content: [{ type: 'text', text: message }],
    stop_reason: 'end_turn'
  });

  try {
    const configPath = writeGlobalConfig(tempDir, [
      'OCO_AI_PROVIDER=openai',
      'OCO_OPENAI_API_KEY=test-legacy-openai-key',
      'OCO_ANTHROPIC_API_KEY=test-legacy-anthropic-key',
      `OCO_ANTHROPIC_BASE_PATH=${server.baseUrl}`,
      'OCO_GITPUSH=false',
      'OCO_PROXY=null'
    ]);
    const savedConfig = readFileSync(configPath, 'utf8');
    await prepareRepo(gitDir, { 'index.ts': 'export {};\n' }, { stage: true });
    writeRepoFile(gitDir, '.env', 'OCO_AI_PROVIDER=anthropic\n');

    const oco = await runCli(['--yes'], {
      cwd: gitDir,
      env: { HOME: tempDir }
    });

    expect(await waitForExit(oco)).toBe(0);
    await assertHeadCommit(gitDir, message);
    expect(server.apiKeys).toEqual(['test-legacy-anthropic-key']);
    expect(readFileSync(configPath, 'utf8')).toBe(savedConfig);
    expect(existsSync(join(tempDir, '.opencommit_migrations'))).toBe(false);
  } finally {
    await server.cleanup();
    await cleanup();
  }
});

it('migrates missing transport for the saved provider and keeps its modern key', async () => {
  const { tempDir, gitDir, cleanup } = await prepareEnvironment({ remotes: 0 });
  const message = 'fix(anthropic): use the migrated API settings';
  const server = await startMockAnthropicServer({
    content: [{ type: 'text', text: message }],
    stop_reason: 'end_turn'
  });

  try {
    const configPath = writeGlobalConfig(tempDir, [
      'OCO_AI_PROVIDER=anthropic',
      'OCO_API_KEY=test-modern-anthropic-key',
      'OCO_ANTHROPIC_API_KEY=test-legacy-anthropic-key',
      `OCO_ANTHROPIC_BASE_PATH=${server.baseUrl}`,
      'OCO_GITPUSH=false',
      'OCO_PROXY=null'
    ]);
    await prepareRepo(gitDir, { 'index.ts': 'export {};\n' }, { stage: true });
    const options = { cwd: gitDir, env: { HOME: tempDir } };

    const migration = await runCli(['--yes'], options);
    expect(await waitForExit(migration)).toBe(0);
    expect(existsSync(join(tempDir, '.opencommit_migrations'))).toBe(true);
    const savedConfig = readFileSync(configPath, 'utf8');
    expect(savedConfig).toContain('OCO_API_KEY=test-modern-anthropic-key');
    expect(savedConfig).toContain(`OCO_API_URL=${server.baseUrl}`);
    expect(savedConfig).not.toContain('OCO_ANTHROPIC_API_KEY');
    expect(savedConfig).not.toContain('OCO_ANTHROPIC_BASE_PATH');

    const oco = await runCli(['--yes'], options);
    expect(await waitForExit(oco)).toBe(0);
    await assertHeadCommit(gitDir, message);
    expect(server.apiKeys).toEqual(['test-modern-anthropic-key']);
  } finally {
    await server.cleanup();
    await cleanup();
  }
});

it.each(['claude-haiku-5-5', 'claude-haiku-4-5-20251001'])(
  'built CLI generates a commit with %s through a custom Anthropic endpoint',
  async (model) => {
    const { tempDir, gitDir, cleanup } = await prepareEnvironment({
      remotes: 0
    });
    const server = await startMockAnthropicServer({
      content: [
        { type: 'thinking', thinking: '', signature: 'opaque-signature' },
        { type: 'text', text: 'fix(anthropic): support the configured model' }
      ],
      stop_reason: 'end_turn'
    });

    try {
      seedMigrations(tempDir);
      writeGlobalConfig(tempDir, ['OCO_LANGUAGE=en']);
      await prepareRepo(
        gitDir,
        { 'index.ts': 'console.log("Hello World");\n' },
        { stage: true }
      );

      const oco = await runCli(['--yes'], {
        cwd: gitDir,
        env: getAnthropicEnv(server.baseUrl, tempDir, model)
      });

      expect(await waitForExit(oco)).toBe(0);
      await assertHeadCommit(
        gitDir,
        'fix(anthropic): support the configured model'
      );
      expect(server.apiKeys).toEqual(['test-anthropic-key']);
      expect(server.requestBodies).toHaveLength(1);

      const payload = server.requestBodies[0];
      expect(payload.model).toBe(model);
      expect(payload.max_tokens).toBe(256);
      expect(payload.system).toEqual(expect.any(String));
      const messages = payload.messages as Array<{
        role: string;
        content: string;
      }>;
      expect(messages[messages.length - 1].role).toBe('user');
      expect(messages[messages.length - 1].content).toContain('diff --git');
      expect(payload).not.toHaveProperty('top_p');
      expect(payload).not.toHaveProperty('top_k');
      expect(payload).not.toHaveProperty('output_config');

      if (model === 'claude-haiku-5-5') {
        expect(payload).not.toHaveProperty('temperature');
        expect(payload.thinking).toEqual({ type: 'disabled' });
      } else {
        expect(payload.temperature).toBe(0);
        expect(payload).not.toHaveProperty('thinking');
      }
    } finally {
      await server.cleanup();
      await cleanup();
    }
  }
);

it.each([
  ['refusal', 'refused'],
  ['max_tokens', 'OCO_TOKENS_MAX_OUTPUT'],
  ['model_context_window_exceeded', 'context window']
])(
  'built CLI does not commit a Haiku 5.5 %s response',
  async (stopReason, error) => {
    const { tempDir, gitDir, cleanup } = await prepareEnvironment({
      remotes: 0
    });
    const server = await startMockAnthropicServer({
      content: [{ type: 'text', text: 'fix: should not be committed' }],
      stop_reason: stopReason
    });

    try {
      seedMigrations(tempDir);
      writeGlobalConfig(tempDir, ['OCO_LANGUAGE=en']);
      await prepareRepo(
        gitDir,
        { 'index.ts': 'console.log("Hello World");\n' },
        { stage: true }
      );

      const oco = await runCli(['--yes'], {
        cwd: gitDir,
        env: getAnthropicEnv(server.baseUrl, tempDir, 'claude-haiku-5-5')
      });

      expect(await oco.findByText(error)).toBeInTheConsole();
      expect(await waitForExit(oco)).toBe(1);
      await assertGitStatus(gitDir, 'A  index.ts');
      const { stdout } = await runGit(['log', '--all', '--format=%s'], gitDir);
      expect(stdout).toBe('');
      expect(server.requestBodies).toHaveLength(1);
    } finally {
      await server.cleanup();
      await cleanup();
    }
  }
);
