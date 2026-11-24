import { OpenAI } from 'openai';
import {
  DEFAULT_CONFIG,
  OCO_AI_PROVIDER_ENUM
} from '../../src/commands/config';
import { OnomeoEngine } from '../../src/engine/onomeo';
import { getEngine } from '../../src/utils/engine';

describe('OnomeoEngine', () => {
  const baseConfig = {
    apiKey: 'test-onomeo-key',
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

  it('requires an onomeo key even when an OpenAI key is available', () => {
    jest.replaceProperty(process, 'env', {
      ...process.env,
      OPENAI_API_KEY: 'unused-openai-test-key'
    });

    expect(() =>
      getEngine({
        ...DEFAULT_CONFIG,
        OCO_AI_PROVIDER: OCO_AI_PROVIDER_ENUM.ONOMEO,
        OCO_API_KEY: undefined
      })
    ).toThrow(/onomeo/i);
  });

  it('sends a standard completion request without sampling parameters', async () => {
    const engine = new OnomeoEngine({
      ...baseConfig,
      model: 'deepseek-v4.1-flash'
    });

    const fetchCompletion = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        choices: [{ message: { content: 'feat(onomeo): standard path' } }]
      })
    );

    const result = await engine.generateCommitMessage(messages);

    expect(result).toBe('feat(onomeo): standard path');
    expect(fetchCompletion).toHaveBeenCalledTimes(1);
    const [url, request] = fetchCompletion.mock.calls[0];
    expect(url).toBe('https://onomeo.com/v1/chat/completions');
    expect(JSON.parse(request?.body as string)).toEqual({
      model: 'deepseek-v4.1-flash',
      messages,
      max_tokens: 256
    });
  });

  it('allows a custom base URL to override the default', async () => {
    const engine = new OnomeoEngine({
      ...baseConfig,
      model: 'deepseek-v4.1-flash',
      baseURL: 'https://custom.example.com/v1'
    });

    expect(engine.config.baseURL).toBe('https://custom.example.com/v1');
  });

  it.each([undefined, ''])(
    'uses the default base URL when the configured URL is %p',
    (baseURL) => {
      const engine = getEngine({
        ...DEFAULT_CONFIG,
        OCO_AI_PROVIDER: OCO_AI_PROVIDER_ENUM.ONOMEO,
        OCO_MODEL: 'deepseek-v4.1-flash',
        OCO_API_KEY: 'test-onomeo-key',
        OCO_API_URL: baseURL
      }) as OnomeoEngine;

      expect(engine.client.baseURL).toBe('https://onomeo.com/v1');
    }
  );

  it('strips <think> tags from response content', async () => {
    const engine = new OnomeoEngine({
      ...baseConfig,
      model: 'deepseek-v4.1-flash'
    });

    jest.spyOn(engine.client.chat.completions, 'create').mockResolvedValue({
      choices: [
        {
          message: {
            content: '<think>reasoning here</think>feat: add onomeo provider'
          }
        }
      ]
    } as any);

    const result = await engine.generateCommitMessage(messages);

    expect(result).toBe('feat: add onomeo provider');
  });
});
