import { OpenAI } from 'openai';
import {
  DEFAULT_CONFIG,
  OCO_AI_PROVIDER_ENUM
} from '../../src/commands/config';
import { UberLLMEngine } from '../../src/engine/uberllm';
import { getEngine } from '../../src/utils/engine';

describe('UberLLMEngine', () => {
  const baseConfig = {
    apiKey: 'test-uberllm-key',
    maxTokensInput: 4096,
    maxTokensOutput: 256
  };

  const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
    { role: 'system', content: 'system message' },
    { role: 'user', content: 'diff --git a/file b/file' }
  ];

  it('uses the UberLLM base URL and sends the model and messages', async () => {
    const engine = new UberLLMEngine({
      ...baseConfig,
      model: 'deepseek/deepseek-v3.2'
    });

    const create = jest
      .spyOn(engine.client.chat.completions, 'create')
      .mockResolvedValue({
        choices: [{ message: { content: 'feat(uberllm): standard path' } }]
      } as any);

    await engine.generateCommitMessage(messages);

    expect(engine.config.baseURL).toBe('https://api.uberllm.dev/v1');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'deepseek/deepseek-v3.2',
        temperature: 0,
        top_p: 0.1,
        max_tokens: 256
      })
    );
  });

  it('allows a custom base URL to override the default', async () => {
    const engine = new UberLLMEngine({
      ...baseConfig,
      model: 'deepseek/deepseek-v3.2',
      baseURL: 'https://custom.example.com/v1'
    });

    expect(engine.config.baseURL).toBe('https://custom.example.com/v1');
  });

  it('preserves the default base URL through the real engine factory', () => {
    const engine = getEngine({
      ...DEFAULT_CONFIG,
      OCO_AI_PROVIDER: OCO_AI_PROVIDER_ENUM.UBERLLM,
      OCO_MODEL: 'deepseek/deepseek-v3.2',
      OCO_API_KEY: 'test-uberllm-key',
      OCO_API_URL: undefined
    } as any) as UberLLMEngine;

    expect(engine.config.baseURL).toBe('https://api.uberllm.dev/v1');
    expect(engine.client.baseURL).toBe('https://api.uberllm.dev/v1');
  });

  it('strips <think> tags from response content', async () => {
    const engine = new UberLLMEngine({
      ...baseConfig,
      model: 'deepseek/deepseek-v3.2'
    });

    jest.spyOn(engine.client.chat.completions, 'create').mockResolvedValue({
      choices: [
        {
          message: {
            content: '<think>reasoning here</think>feat: add uberllm provider'
          }
        }
      ]
    } as any);

    const result = await engine.generateCommitMessage(messages);

    expect(result).toBe('feat: add uberllm provider');
  });
});
