import { OpenAI } from 'openai';
import {
  DEFAULT_CONFIG,
  OCO_AI_PROVIDER_ENUM
} from '../../src/commands/config';
import { TrustedRouterEngine } from '../../src/engine/trustedrouter';
import { getEngine } from '../../src/utils/engine';
import { ApiKeyMissingError } from '../../src/utils/errors';

describe('TrustedRouterEngine', () => {
  const baseConfig = {
    apiKey: 'test-trustedrouter-key',
    maxTokensInput: 4096,
    maxTokensOutput: 256
  };

  const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
    { role: 'system', content: 'system message' },
    { role: 'user', content: 'diff --git a/file b/file' }
  ];

  it('sends only the configured gateway credentials to the TrustedRouter endpoint', async () => {
    const env = jest.replaceProperty(process, 'env', {
      ...process.env,
      OPENAI_API_KEY: 'test-ambient-openai-key',
      OPENAI_ORG_ID: 'test-openai-org',
      OPENAI_PROJECT_ID: 'test-openai-project'
    });
    const fetch = jest.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      Response.json({
        choices: [{ message: { content: 'feat: add trustedrouter provider' } }]
      })
    );

    try {
      const engine = new TrustedRouterEngine({
        ...baseConfig,
        model: 'anthropic/claude-sonnet-4.5',
        customHeaders: { 'X-Custom-Header': 'gateway' }
      });

      await expect(engine.generateCommitMessage(messages)).resolves.toBe(
        'feat: add trustedrouter provider'
      );

      const [url, request] = fetch.mock.calls[0];
      const headers = new Headers(request?.headers);
      expect(url).toBe('https://api.trustedrouter.com/v1/chat/completions');
      expect(headers.get('Authorization')).toBe(
        'Bearer test-trustedrouter-key'
      );
      expect(headers.get('X-Custom-Header')).toBe('gateway');
      expect(headers.has('OpenAI-Organization')).toBe(false);
      expect(headers.has('OpenAI-Project')).toBe(false);
      const payload = JSON.parse(request?.body as string);
      expect(payload).toMatchObject({
        model: 'anthropic/claude-sonnet-4.5',
        messages,
        max_tokens: 256
      });
      expect(payload).not.toHaveProperty('temperature');
      expect(payload).not.toHaveProperty('top_p');
    } finally {
      fetch.mockRestore();
      env.restore();
    }
  });

  it.each([undefined, '', ' '])(
    'requires a configured gateway key when OCO_API_KEY is %p',
    (key) => {
      const env = jest.replaceProperty(process, 'env', {
        ...process.env,
        OPENAI_API_KEY: 'test-ambient-openai-key'
      });

      try {
        expect(() =>
          getEngine({
            ...DEFAULT_CONFIG,
            OCO_AI_PROVIDER: OCO_AI_PROVIDER_ENUM.TRUSTEDROUTER,
            OCO_API_KEY: key
          })
        ).toThrow(ApiKeyMissingError);
      } finally {
        env.restore();
      }
    }
  );

  it('allows a custom base URL to override the default', () => {
    const engine = new TrustedRouterEngine({
      ...baseConfig,
      model: 'deepseek/deepseek-v4-flash',
      baseURL: 'https://custom.example.com/v1'
    });

    expect(engine.config.baseURL).toBe('https://custom.example.com/v1');
  });

  it('preserves the default base URL through the real engine factory', () => {
    const engine = getEngine({
      ...DEFAULT_CONFIG,
      OCO_AI_PROVIDER: OCO_AI_PROVIDER_ENUM.TRUSTEDROUTER,
      OCO_MODEL: 'deepseek/deepseek-v4-flash',
      OCO_API_KEY: 'test-trustedrouter-key',
      OCO_API_URL: undefined
    } as any) as TrustedRouterEngine;

    expect(engine).toBeInstanceOf(TrustedRouterEngine);
    expect(engine.config.baseURL).toBe('https://api.trustedrouter.com/v1');
    expect(engine.client.baseURL).toBe('https://api.trustedrouter.com/v1');
  });
});
