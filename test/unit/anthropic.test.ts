import { OpenAI } from 'openai';
import { AnthropicEngine } from '../../src/engine/anthropic';

describe('AnthropicEngine', () => {
  const baseConfig = {
    apiKey: 'test-anthropic-key',
    maxTokensInput: 4096,
    maxTokensOutput: 256
  };

  const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
    { role: 'system', content: 'system message' },
    { role: 'user', content: 'diff --git a/file b/file' }
  ];

  it('does not send top_p for Claude 4.5 models', async () => {
    const engine = new AnthropicEngine({
      ...baseConfig,
      model: 'claude-haiku-4-5-20251001'
    });

    const create = jest
      .spyOn(engine.client.messages, 'create')
      .mockResolvedValue({
        content: [{ type: 'text', text: 'feat(theme): update colors' }]
      } as any);

    await engine.generateCommitMessage(messages);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-haiku-4-5-20251001',
        temperature: 0,
        max_tokens: 256
      })
    );
    expect(create).toHaveBeenCalledWith(
      expect.not.objectContaining({
        top_p: expect.anything()
      })
    );
  });

  it('does not send top_p for Claude 4.6+ models', async () => {
    const engine = new AnthropicEngine({
      ...baseConfig,
      model: 'claude-sonnet-4-6'
    });

    const create = jest
      .spyOn(engine.client.messages, 'create')
      .mockResolvedValue({
        content: [{ type: 'text', text: 'feat(theme): update colors' }]
      } as any);

    await engine.generateCommitMessage(messages);

    expect(create).toHaveBeenCalledWith(
      expect.not.objectContaining({
        top_p: expect.anything()
      })
    );
  });

  it('sends top_p for legacy Claude models', async () => {
    const engine = new AnthropicEngine({
      ...baseConfig,
      model: 'claude-sonnet-4-20250514'
    });

    const create = jest
      .spyOn(engine.client.messages, 'create')
      .mockResolvedValue({
        content: [{ type: 'text', text: 'feat(theme): update colors' }]
      } as any);

    await engine.generateCommitMessage(messages);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-4-20250514',
        temperature: 0,
        top_p: 0.1,
        max_tokens: 256
      })
    );
  });
});
