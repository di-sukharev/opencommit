import { OllamaEngine } from '../../src/engine/ollama';

describe('OllamaEngine', () => {
  it('sends think=false when configured', async () => {
    const engine = new OllamaEngine({
      apiKey: 'ollama',
      model: 'qwen3.5:2b',
      maxTokensOutput: 500,
      maxTokensInput: 4096,
      ollamaThink: false
    });

    const post = jest.fn().mockResolvedValue({
      data: {
        message: {
          content: 'feat: add support for ollama think config'
        }
      }
    });

    engine.client = { post } as any;

    await engine.generateCommitMessage([
      { role: 'user', content: 'diff --git a/file b/file' }
    ]);

    expect(post).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      expect.objectContaining({
        think: false
      })
    );
  });

  it('omits think when not configured', async () => {
    const engine = new OllamaEngine({
      apiKey: 'ollama',
      model: 'qwen3.5:2b',
      maxTokensOutput: 500,
      maxTokensInput: 4096
    });

    const post = jest.fn().mockResolvedValue({
      data: {
        message: {
          content: 'feat: add support for ollama think config'
        }
      }
    });

    engine.client = { post } as any;

    await engine.generateCommitMessage([
      { role: 'user', content: 'diff --git a/file b/file' }
    ]);

    expect(post).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      expect.not.objectContaining({
        think: expect.anything()
      })
    );
  });
});
