import { OpenAI } from 'openai';
import {
  DEFAULT_CONFIG,
  OCO_AI_PROVIDER_ENUM
} from '../../src/commands/config';
import { CheaperInferenceEngine } from '../../src/engine/cheaperinference';
import { getEngine } from '../../src/utils/engine';

describe('CheaperInferenceEngine', () => {
  const baseConfig = {
    apiKey: 'ci_live_test_key',
    maxTokensInput: 4096,
    maxTokensOutput: 256
  };

  const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
    { role: 'system', content: 'system message' },
    { role: 'user', content: 'diff --git a/file b/file' }
  ];

  it('uses the Cheaper Inference base URL and sends the model and messages', async () => {
    const engine = new CheaperInferenceEngine({
      ...baseConfig,
      model: 'gpt-5.4-mini'
    });

    const create = jest
      .spyOn(engine.client.chat.completions, 'create')
      .mockResolvedValue({
        choices: [
          { message: { content: 'feat(cheaperinference): standard path' } }
        ]
      } as any);

    await engine.generateCommitMessage(messages);

    expect(engine.config.baseURL).toBe('https://api.cheaperinference.com/v1');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5.4-mini',
        messages,
        max_completion_tokens: 1000
      })
    );
  });

  it('allows a custom base URL to override the default', async () => {
    const engine = new CheaperInferenceEngine({
      ...baseConfig,
      model: 'gpt-5.4-mini',
      baseURL: 'https://custom.example.com/v1'
    });

    expect(engine.config.baseURL).toBe('https://custom.example.com/v1');
  });

  it('preserves the default base URL through the real engine factory', () => {
    const engine = getEngine({
      ...DEFAULT_CONFIG,
      OCO_AI_PROVIDER: OCO_AI_PROVIDER_ENUM.CHEAPERINFERENCE,
      OCO_MODEL: 'gpt-5.4-mini',
      OCO_API_KEY: 'ci_live_test_key',
      OCO_API_URL: undefined
    } as any) as CheaperInferenceEngine;

    expect(engine.config.baseURL).toBe('https://api.cheaperinference.com/v1');
    expect(engine.client.baseURL).toBe('https://api.cheaperinference.com/v1');
  });

  it('strips <think> tags from response content', async () => {
    const engine = new CheaperInferenceEngine({
      ...baseConfig,
      model: 'gpt-5.4-mini'
    });

    jest.spyOn(engine.client.chat.completions, 'create').mockResolvedValue({
      choices: [
        {
          message: {
            content:
              '<think>reasoning here</think>feat: add cheaperinference provider'
          }
        }
      ]
    } as any);

    const result = await engine.generateCommitMessage(messages);

    expect(result).toBe('feat: add cheaperinference provider');
  });
});
