import { OpenAI } from 'openai';
import {
  DEFAULT_CONFIG,
  OCO_AI_PROVIDER_ENUM
} from '../../src/commands/config';
import { TrustedRouterEngine } from '../../src/engine/trustedrouter';
import { getEngine } from '../../src/utils/engine';

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

  it('uses the TrustedRouter base URL and sends the model and messages', async () => {
    const engine = new TrustedRouterEngine({
      ...baseConfig,
      model: 'deepseek/deepseek-v4-flash'
    });

    const create = jest
      .spyOn(engine.client.chat.completions, 'create')
      .mockResolvedValue({
        choices: [{ message: { content: 'feat: add trustedrouter provider' } }]
      } as any);

    const result = await engine.generateCommitMessage(messages);

    expect(result).toBe('feat: add trustedrouter provider');
    expect(engine.config.baseURL).toBe('https://api.trustedrouter.com/v1');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'deepseek/deepseek-v4-flash',
        messages,
        temperature: 0,
        top_p: 0.1,
        max_tokens: 256
      })
    );
  });

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
