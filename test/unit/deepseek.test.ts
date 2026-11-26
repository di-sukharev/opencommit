import { OpenAI } from 'openai';
import {
  DEFAULT_CONFIG,
  OCO_AI_PROVIDER_ENUM
} from '../../src/commands/config';
import { DeepseekEngine } from '../../src/engine/deepseek';
import { getEngine } from '../../src/utils/engine';

describe('DeepseekEngine', () => {
  const baseConfig = {
    apiKey: 'test-deepseek-key',
    maxTokensInput: 4096,
    maxTokensOutput: 256
  };

  const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
    { role: 'system', content: 'system message' },
    { role: 'user', content: 'diff --git a/file b/file' }
  ];

  it('disables thinking mode via a top-level request body field', async () => {
    const engine = new DeepseekEngine({
      ...baseConfig,
      model: 'deepseek-v4-flash'
    });

    const create = jest
      .spyOn(engine.client.chat.completions, 'create')
      .mockResolvedValue({
        choices: [{ message: { content: 'feat(deepseek): thinking off' } }]
      } as any);

    await engine.generateCommitMessage(messages);

    // The JavaScript OpenAI SDK forwards unknown top-level fields as-is, so
    // `thinking` must be a top-level key in the request body for DeepSeek to
    // honour it. See https://api-docs.deepseek.com/guides/thinking_mode
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'deepseek-v4-flash',
        max_tokens: 256,
        temperature: 0,
        top_p: 0.1,
        thinking: { type: 'disabled' }
      })
    );
  });

  it('does not send extra_body (a Python SDK helper) in the request', async () => {
    const engine = new DeepseekEngine({
      ...baseConfig,
      model: 'deepseek-v4-flash'
    });

    const create = jest
      .spyOn(engine.client.chat.completions, 'create')
      .mockResolvedValue({
        choices: [{ message: { content: 'feat(deepseek): no extra_body' } }]
      } as any);

    await engine.generateCommitMessage(messages);

    // `extra_body` is only understood by the Python SDK. If it ever sneaks
    // back into the JS request, DeepSeek receives an `extra_body` field and
    // thinking mode stays enabled, re-introducing EMPTY_MESSAGE failures.
    expect(create).toHaveBeenCalledWith(
      expect.not.objectContaining({
        extra_body: expect.anything()
      })
    );
  });

  it.each([undefined, ''])(
    'uses the DeepSeek endpoint when OCO_API_URL is %p',
    (apiUrl) => {
      const engine = getEngine({
        ...DEFAULT_CONFIG,
        OCO_AI_PROVIDER: OCO_AI_PROVIDER_ENUM.DEEPSEEK,
        OCO_API_KEY: 'test-deepseek-key',
        OCO_API_URL: apiUrl
      }) as DeepseekEngine;

      expect(engine.client.baseURL).toBe('https://api.deepseek.com/v1');
    }
  );

  it('uses OCO_API_URL instead of the DeepSeek endpoint', () => {
    const engine = getEngine({
      ...DEFAULT_CONFIG,
      OCO_AI_PROVIDER: OCO_AI_PROVIDER_ENUM.DEEPSEEK,
      OCO_API_KEY: 'test-deepseek-key',
      OCO_API_URL: 'https://deepseek.example.com/v1'
    }) as DeepseekEngine;

    expect(engine.client.baseURL).toBe('https://deepseek.example.com/v1');
  });
});
