import { LlamaCppEngine } from '../../src/engine/llamacpp';

describe('LlamaCppEngine', () => {
  it('sends request to /v1/chat/completions', async () => {
    const engine = new LlamaCppEngine({
      apiKey: 'llamacpp',
      model: 'llama-3',
      maxTokensOutput: 500,
      maxTokensInput: 4096
    });

    const post = jest.fn().mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: 'feat: add support for llama.cpp provider'
            }
          }
        ]
      }
    });

    engine.client = { post } as any;

    await engine.generateCommitMessage([
      { role: 'user', content: 'diff --git a/file b/file' }
    ]);

    expect(post).toHaveBeenCalledWith(
      'http://localhost:8080/v1/chat/completions',
      expect.objectContaining({
        temperature: 0,
        top_p: 0.1,
        repeat_penalty: 1.1,
        stream: false
      })
    );
  });

  it('uses custom baseURL when provided', async () => {
    const engine = new LlamaCppEngine({
      apiKey: 'llamacpp',
      model: 'llama-3',
      maxTokensOutput: 500,
      maxTokensInput: 4096,
      baseURL: 'http://192.168.1.10:8080'
    });

    const post = jest.fn().mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: 'fix: resolve connection issue'
            }
          }
        ]
      }
    });

    engine.client = { post } as any;

    await engine.generateCommitMessage([
      { role: 'user', content: 'diff --git a/file b/file' }
    ]);

    expect(post).toHaveBeenCalledWith(
      'http://192.168.1.10:8080/v1/chat/completions',
      expect.anything()
    );
  });

  it('strips <think> tags from response content', async () => {
    const engine = new LlamaCppEngine({
      apiKey: 'llamacpp',
      model: 'llama-3',
      maxTokensOutput: 500,
      maxTokensInput: 4096
    });

    const post = jest.fn().mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content:
                '<think>reasoning here</think>feat: add support for llama.cpp provider'
            }
          }
        ]
      }
    });

    engine.client = { post } as any;

    const result = await engine.generateCommitMessage([
      { role: 'user', content: 'diff --git a/file b/file' }
    ]);

    expect(result).toBe('feat: add support for llama.cpp provider');
  });
});
