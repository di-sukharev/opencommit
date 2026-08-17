import { OpenAI } from 'openai';
import { OpenAiEngine } from '../../src/engine/openAi';

describe('OpenAiEngine', () => {
  const baseConfig = {
    apiKey: 'test-openai-key',
    maxTokensInput: 4096,
    maxTokensOutput: 256
  };

  const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
    { role: 'system', content: 'system message' },
    { role: 'user', content: 'diff --git a/file b/file' }
  ];

  it('uses max_completion_tokens for reasoning models', async () => {
    const engine = new OpenAiEngine({
      ...baseConfig,
      model: 'o3-mini'
    });

    const create = jest
      .spyOn(engine.client.chat.completions, 'create')
      .mockResolvedValue({
        choices: [{ message: { content: 'feat(openai): reasoning path' } }]
      } as any);

    await engine.generateCommitMessage(messages);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'o3-mini',
        max_completion_tokens: 256
      })
    );
    expect(create).toHaveBeenCalledWith(
      expect.not.objectContaining({
        max_tokens: expect.anything()
      })
    );
  });

  it('uses max_tokens and sampling params for non-reasoning models', async () => {
    const engine = new OpenAiEngine({
      ...baseConfig,
      model: 'gpt-4o-mini'
    });

    const create = jest
      .spyOn(engine.client.chat.completions, 'create')
      .mockResolvedValue({
        choices: [{ message: { content: 'feat(openai): standard path' } }]
      } as any);

    await engine.generateCommitMessage(messages);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini',
        max_tokens: 256,
        temperature: 0,
        top_p: 0.1
      })
    );
    expect(create).toHaveBeenCalledWith(
      expect.not.objectContaining({
        max_completion_tokens: expect.anything()
      })
    );
  });
});
