import { OpenAI } from 'openai';
import {
  DEFAULT_CONFIG,
  OCO_AI_PROVIDER_ENUM
} from '../../src/commands/config';
import { AtlasCloudEngine } from '../../src/engine/atlascloud';
import { getEngine } from '../../src/utils/engine';

describe('AtlasCloudEngine', () => {
  const baseConfig = {
    apiKey: 'test-atlas-cloud-key',
    maxTokensInput: 4096,
    maxTokensOutput: 256
  };

  const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
    { role: 'system', content: 'system message' },
    { role: 'user', content: 'diff --git a/file b/file' }
  ];

  it('uses the Atlas Cloud base URL without automatic POST retries', async () => {
    const engine = new AtlasCloudEngine({
      ...baseConfig,
      model: 'qwen/qwen3.5-397b-a17b'
    });

    const create = jest
      .spyOn(engine.client.chat.completions, 'create')
      .mockResolvedValue({
        choices: [{ message: { content: 'feat: add atlas cloud provider' } }]
      } as any);

    await engine.generateCommitMessage(messages);

    expect(engine.config.baseURL).toBe('https://api.atlascloud.ai/v1');
    expect(engine.client.maxRetries).toBe(0);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'qwen/qwen3.5-397b-a17b',
        temperature: 0,
        top_p: 0.1,
        max_tokens: 256
      })
    );
  });

  it('allows a custom base URL to override the default', () => {
    const engine = new AtlasCloudEngine({
      ...baseConfig,
      model: 'qwen/qwen3.5-397b-a17b',
      baseURL: 'https://custom.example.com/v1'
    });

    expect(engine.config.baseURL).toBe('https://custom.example.com/v1');
    expect(engine.client.maxRetries).toBe(0);
  });

  it('is available through the engine factory', () => {
    const engine = getEngine({
      ...DEFAULT_CONFIG,
      OCO_AI_PROVIDER: OCO_AI_PROVIDER_ENUM.ATLAS_CLOUD,
      OCO_MODEL: 'qwen/qwen3.5-397b-a17b',
      OCO_API_KEY: 'test-atlas-cloud-key',
      OCO_API_URL: undefined
    } as any) as AtlasCloudEngine;

    expect(engine).toBeInstanceOf(AtlasCloudEngine);
    expect(engine.client.baseURL).toBe('https://api.atlascloud.ai/v1');
    expect(engine.client.maxRetries).toBe(0);
  });
});
