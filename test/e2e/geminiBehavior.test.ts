import 'cli-testing-library/extend-expect';
import {
  assertHeadCommit,
  getHeadCommitMessage,
  getMockGeminiEnv,
  prepareEnvironment,
  prepareRepo,
  runCli,
  startMockGeminiServer,
  waitForExit
} from './utils';

it('built CLI ignores Gemini executable code parts when creating the commit message', async () => {
  const { gitDir, cleanup } = await prepareEnvironment({ remotes: 0 });
  const server = await startMockGeminiServer({
    candidates: [
      {
        index: 0,
        content: {
          role: 'model',
          parts: [
            { text: 'feat(gemini): keep text output only' },
            {
              executableCode: {
                language: 'python',
                code: 'print("debug")'
              }
            },
            {
              codeExecutionResult: {
                outcome: 'outcome_ok',
                output: 'debug'
              }
            }
          ]
        },
        finishReason: 'STOP'
      }
    ]
  });

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
      env: getMockGeminiEnv(server.baseUrl)
    });

    expect(await waitForExit(oco)).toBe(0);
    await assertHeadCommit(gitDir, 'feat(gemini): keep text output only');
    expect(await getHeadCommitMessage(gitDir)).toBe(
      'feat(gemini): keep text output only'
    );
    expect(server.apiKeys).toContain('test-gemini-key');
  } finally {
    await server.cleanup();
    await cleanup();
  }
});

it('built CLI surfaces Gemini LANGUAGE finish reasons as errors', async () => {
  const { gitDir, cleanup } = await prepareEnvironment({ remotes: 0 });
  const server = await startMockGeminiServer({
    candidates: [
      {
        index: 0,
        content: {
          role: 'model',
          parts: [{ text: 'feat(gemini): should not commit' }]
        },
        finishReason: 'LANGUAGE',
        finishMessage: 'Unsupported language'
      }
    ]
  });

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
      env: getMockGeminiEnv(server.baseUrl)
    });

    expect(
      await oco.findByText(
        'Gemini response was blocked due to LANGUAGE: Unsupported language'
      )
    ).toBeInTheConsole();
    expect(await waitForExit(oco)).toBe(1);
  } finally {
    await server.cleanup();
    await cleanup();
  }
});
