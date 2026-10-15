import { OpenAI } from 'openai';
import {
  DEFAULT_CONFIG,
  OCO_AI_PROVIDER_ENUM
} from '../../src/commands/config';
import { RequestyEngine } from '../../src/engine/requesty';
import { getEngine } from '../../src/utils/engine';

describe('RequestyEngine', () => {
  const baseConfig = {
    apiKey: 'test-requesty-key',
    maxTokensInput: 4096,
    maxTokensOutput: 256
  };

  const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
    { role: 'system', content: 'system message' },
    { role: 'user', content: 'diff --git a/file b/file' }
  ];

  it('uses the Requesty base URL and sends the model and messages', async () => {
    const engine = new RequestyEngine({
      ...baseConfig,
      model: 'openai/gpt-4o-mini'
    });

    const create = jest
      .spyOn(engine.client.chat.completions, 'create')
      .mockResolvedValue({
        choices: [{ message: { content: 'feat(requesty): standard path' } }]
      } as any);

    await engine.generateCommitMessage(messages);

    expect(engine.config.baseURL).toBe('https://router.requesty.ai/v1');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'openai/gpt-4o-mini',
        temperature: 0,
        top_p: 0.1,
        max_tokens: 256
      })
    );
  });

  it('allows a custom base URL to override the default', async () => {
    const engine = new RequestyEngine({
      ...baseConfig,
      model: 'openai/gpt-4o-mini',
      baseURL: 'https://custom.example.com/v1'
    });

    expect(engine.config.baseURL).toBe('https://custom.example.com/v1');
  });

  it('preserves the default base URL through the real engine factory', () => {
    const engine = getEngine({
      ...DEFAULT_CONFIG,
      OCO_AI_PROVIDER: OCO_AI_PROVIDER_ENUM.REQUESTY,
      OCO_MODEL: 'openai/gpt-4o-mini',
      OCO_API_KEY: 'test-requesty-key',
      OCO_API_URL: undefined
    } as any) as RequestyEngine;

    expect(engine.config.baseURL).toBe('https://router.requesty.ai/v1');
    expect(engine.client.baseURL).toBe('https://router.requesty.ai/v1');
  });

  it('strips <think> tags from response content', async () => {
    const engine = new RequestyEngine({
      ...baseConfig,
      model: 'openai/gpt-4o-mini'
    });

    jest.spyOn(engine.client.chat.completions, 'create').mockResolvedValue({
      choices: [
        {
          message: {
            content: '<think>reasoning here</think>feat: add requesty provider'
          }
        }
      ]
    } as any);

    const result = await engine.generateCommitMessage(messages);

    expect(result).toBe('feat: add requesty provider');
  });
});
