import { OpenAI } from 'openai';
import {
  DEFAULT_CONFIG,
  OCO_AI_PROVIDER_ENUM
} from '../../src/commands/config';
import { TeamoRouterEngine } from '../../src/engine/teamorouter';
import { getEngine } from '../../src/utils/engine';

describe('TeamoRouterEngine', () => {
  const baseConfig = {
    apiKey: 'test-teamorouter-key',
    maxTokensInput: 4096,
    maxTokensOutput: 256
  };

  const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
    { role: 'system', content: 'system message' },
    { role: 'user', content: 'diff --git a/file b/file' }
  ];

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requires a TeamoRouter key even when an OpenAI key is available', () => {
    jest.replaceProperty(process, 'env', {
      ...process.env,
      OPENAI_API_KEY: 'unused-openai-test-key'
    });

    expect(() =>
      getEngine({
        ...DEFAULT_CONFIG,
        OCO_AI_PROVIDER: OCO_AI_PROVIDER_ENUM.TEAMOROUTER,
        OCO_API_KEY: undefined
      })
    ).toThrow(/teamorouter/i);
  });

  it('sends a standard completion request without sampling parameters', async () => {
    const engine = new TeamoRouterEngine({
      ...baseConfig,
      model: 'claude-haiku-5-5'
    });

    const fetchCompletion = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        choices: [{ message: { content: 'feat(teamorouter): standard path' } }]
      })
    );

    const result = await engine.generateCommitMessage(messages);

    expect(result).toBe('feat(teamorouter): standard path');
    expect(fetchCompletion).toHaveBeenCalledTimes(1);
    const [url, request] = fetchCompletion.mock.calls[0];
    expect(url).toBe('https://api.teamorouter.com/v1/chat/completions');
    expect(JSON.parse(request?.body as string)).toEqual({
      model: 'claude-haiku-5-5',
      messages,
      max_tokens: 256
    });
  });

  it('allows a custom base URL to override the default', async () => {
    const engine = new TeamoRouterEngine({
      ...baseConfig,
      model: 'claude-haiku-5-5',
      baseURL: 'https://custom.example.com/v1'
    });

    expect(engine.config.baseURL).toBe('https://custom.example.com/v1');
  });

  it.each([undefined, ''])(
    'uses the default base URL when the configured URL is %p',
    (baseURL) => {
      const engine = getEngine({
        ...DEFAULT_CONFIG,
        OCO_AI_PROVIDER: OCO_AI_PROVIDER_ENUM.TEAMOROUTER,
        OCO_MODEL: 'claude-haiku-5-5',
        OCO_API_KEY: 'test-teamorouter-key',
        OCO_API_URL: baseURL
      }) as TeamoRouterEngine;

      expect(engine.client.baseURL).toBe('https://api.teamorouter.com/v1');
    }
  );

  it('strips <think> tags from response content', async () => {
    const engine = new TeamoRouterEngine({
      ...baseConfig,
      model: 'claude-haiku-5-5'
    });

    jest.spyOn(engine.client.chat.completions, 'create').mockResolvedValue({
      choices: [
        {
          message: {
            content:
              '<think>reasoning here</think>feat: add teamorouter provider'
          }
        }
      ]
    } as any);

    const result = await engine.generateCommitMessage(messages);

    expect(result).toBe('feat: add teamorouter provider');
  });
});
