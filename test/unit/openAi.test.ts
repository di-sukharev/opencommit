import { OpenAI } from 'openai';
import { getConfig } from '../../src/commands/config';
import { OpenAiEngine } from '../../src/engine/openAi';
import { getEngine } from '../../src/utils/engine';
import { prepareFile } from './utils';

describe('OpenAiEngine', () => {
  const baseConfig = {
    apiKey: 'test-openai-key',
    maxTokensInput: 4096,
    maxTokensOutput: 256,
    tokensMaxReasoning: 1024
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
        max_completion_tokens: 1024
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

  it('forces standard params when isReasoning is explicitly false', async () => {
    const engine = new OpenAiEngine({
      ...baseConfig,
      model: 'o3-mini',
      isReasoning: false
    });

    const create = jest
      .spyOn(engine.client.chat.completions, 'create')
      .mockResolvedValue({
        choices: [{ message: { content: 'feat(openai): forced standard' } }]
      } as any);

    await engine.generateCommitMessage(messages);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'o3-mini',
        max_tokens: 256,
        temperature: 0,
        top_p: 0.1
      })
    );
  });

  it('throws TOO_MUCH_TOKENS error when input exceeds token limit boundary', async () => {
    const engine = new OpenAiEngine({
      ...baseConfig,
      model: 'o3-mini',
      maxTokensInput: 1024,
      tokensMaxReasoning: 1024
      // 1024 (input) - 1024 (reasoning limit) leaves 0 tokens for the prompt.
      // This guarantees the request will exceed the allowed boundary.
    });

    await expect(engine.generateCommitMessage(messages)).rejects.toThrow(
      /TOO_MUCH_TOKENS/
    );
  });

  it('forces reasoning params when isReasoning is explicitly true', async () => {
    const engine = new OpenAiEngine({
      ...baseConfig,
      model: 'gpt-4',
      isReasoning: true
    });

    const create = jest
      .spyOn(engine.client.chat.completions, 'create')
      .mockResolvedValue({
        choices: [{ message: { content: 'feat(openai): forced reasoning' } }]
      } as any);

    await engine.generateCommitMessage(messages);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4',
        max_completion_tokens: 1024
      })
    );
  });

  it('auto-detects a reasoning model through the real default config and engine path', async () => {
    const envFile = await prepareFile('.env', '');

    try {
      const config = getConfig({
        envPath: envFile.filePath,
        globalPath: `${envFile.filePath}.missing`
      });
      config.OCO_MODEL = 'o3-mini';
      config.OCO_API_KEY = 'test-key';

      expect(config.OCO_REASONING).toBeUndefined();
      expect(config.OCO_REASONING_MAX_TOKENS).toBe(1000);

      const engine = getEngine(config) as OpenAiEngine;
      const create = jest
        .spyOn(engine.client.chat.completions, 'create')
        .mockResolvedValue({
          choices: [{ message: { content: 'feat(default): success' } }]
        } as any);

      const result = await engine.generateCommitMessage(messages);

      expect(result).toBe('feat(default): success');
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'o3-mini',
          max_completion_tokens: 1000
        })
      );
    } finally {
      await envFile.cleanup();
    }
  });
});
