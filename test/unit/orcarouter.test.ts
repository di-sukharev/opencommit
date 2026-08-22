import { OpenAI } from 'openai';
import { OrcaRouterEngine } from '../../src/engine/orcarouter';

describe('OrcaRouterEngine', () => {
  const baseConfig = {
    apiKey: 'test-orcarouter-key',
    maxTokensInput: 4096,
    maxTokensOutput: 256
  };

  const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
    { role: 'system', content: 'system message' },
    { role: 'user', content: 'diff --git a/file b/file' }
  ];

  it('uses the OrcaRouter base URL and sends the model and messages', async () => {
    const engine = new OrcaRouterEngine({
      ...baseConfig,
      model: 'orcarouter/auto'
    });

    const create = jest
      .spyOn(engine.client.chat.completions, 'create')
      .mockResolvedValue({
        choices: [{ message: { content: 'feat(orcarouter): standard path' } }]
      } as any);

    await engine.generateCommitMessage(messages);

    expect(engine.config.baseURL).toBe('https://api.orcarouter.ai/v1');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'orcarouter/auto',
        temperature: 0,
        top_p: 0.1,
        max_tokens: 256
      })
    );
  });

  it('allows a custom base URL to override the default', async () => {
    const engine = new OrcaRouterEngine({
      ...baseConfig,
      model: 'orcarouter/auto',
      baseURL: 'https://custom.example.com/v1'
    });

    expect(engine.config.baseURL).toBe('https://custom.example.com/v1');
  });

  it('strips <think> tags from response content', async () => {
    const engine = new OrcaRouterEngine({
      ...baseConfig,
      model: 'orcarouter/auto'
    });

    jest.spyOn(engine.client.chat.completions, 'create').mockResolvedValue({
      choices: [
        {
          message: {
            content:
              '<think>reasoning here</think>feat: add orcarouter provider'
          }
        }
      ]
    } as any);

    const result = await engine.generateCommitMessage(messages);

    expect(result).toBe('feat: add orcarouter provider');
  });
});
