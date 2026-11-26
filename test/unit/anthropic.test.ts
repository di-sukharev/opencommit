import { OpenAI } from 'openai';
import { Message } from '@anthropic-ai/sdk/resources/messages.mjs';
import { AnthropicEngine } from '../../src/engine/anthropic';
import { GenerateCommitMessageErrorEnum } from '../../src/utils/generateCommitMessageErrors';

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

  afterEach(() => jest.restoreAllMocks());

  const mockResponse = (
    engine: AnthropicEngine,
    response: { content?: unknown[]; stop_reason?: string | null }
  ) =>
    jest
      .spyOn(engine.client.messages, 'create')
      .mockResolvedValue(response as unknown as Message);

  it.each([
    ['claude-3-haiku-20240307', 0.1],
    ['claude-3-5-haiku-latest', 0.1],
    ['claude-3-7-sonnet-20250219', 0.1],
    ['claude-sonnet-4-20250514', 0.1],
    ['claude-haiku-4-5', undefined],
    ['claude-haiku-4-5-20251001', undefined],
    ['claude-sonnet-4-5-20250929', undefined],
    ['claude-sonnet-4-6', undefined],
    ['claude-opus-4-8', undefined],
    ['custom-proxy-model', 0.1]
  ])('preserves the existing request for %s', async (model, topP) => {
    const engine = new AnthropicEngine({ ...baseConfig, model });
    const create = mockResponse(engine, {
      content: [{ type: 'text', text: 'fix: preserve legacy behavior' }]
    });

    await expect(engine.generateCommitMessage(messages)).resolves.toBe(
      'fix: preserve legacy behavior'
    );

    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      model,
      system: 'system message',
      messages: [messages[1]],
      temperature: 0,
      ...(topP === undefined ? {} : { top_p: topP }),
      max_tokens: baseConfig.maxTokensOutput
    });
  });

  it.each([256, 500, 1024])(
    'uses Haiku 5.5 parameters and respects an output limit of %i',
    async (maxTokensOutput) => {
      const engine = new AnthropicEngine({
        ...baseConfig,
        model: 'claude-haiku-5-5',
        maxTokensOutput
      });
      const create = mockResponse(engine, {
        content: [{ type: 'text', text: 'fix: support Haiku 5.5' }],
        stop_reason: 'end_turn'
      });

      await expect(engine.generateCommitMessage(messages)).resolves.toBe(
        'fix: support Haiku 5.5'
      );

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith({
        model: 'claude-haiku-5-5',
        system: 'system message',
        messages: [messages[1]],
        max_tokens: maxTokensOutput,
        thinking: { type: 'disabled' }
      });
    }
  );

  it('extracts Haiku 5.5 text after an opaque thinking block', async () => {
    const engine = new AnthropicEngine({
      ...baseConfig,
      model: 'claude-haiku-5-5'
    });
    mockResponse(engine, {
      content: [
        { type: 'thinking', thinking: '', signature: 'opaque-signature' },
        { type: 'text', text: 'fix: extract the response text' }
      ],
      stop_reason: 'end_turn'
    });

    await expect(engine.generateCommitMessage(messages)).resolves.toBe(
      'fix: extract the response text'
    );
  });

  it.each([
    ['refusal', 'refused'],
    ['max_tokens', 'OCO_TOKENS_MAX_OUTPUT'],
    ['model_context_window_exceeded', 'context window']
  ])(
    'rejects Haiku 5.5 %s responses even with text',
    async (stopReason, error) => {
      const engine = new AnthropicEngine({
        ...baseConfig,
        model: 'claude-haiku-5-5'
      });
      const create = mockResponse(engine, {
        content: [{ type: 'text', text: 'fix: should not be committed' }],
        stop_reason: stopReason
      });

      await expect(engine.generateCommitMessage(messages)).rejects.toThrow(
        error
      );
      expect(create).toHaveBeenCalledTimes(1);
    }
  );

  it.each([
    { content: [] },
    {
      content: [
        { type: 'thinking', thinking: '', signature: 'opaque-signature' }
      ]
    },
    { content: [{ type: 'text', text: '   ' }] }
  ])(
    'rejects Haiku 5.5 responses without usable text ($content)',
    async ({ content }) => {
      const engine = new AnthropicEngine({
        ...baseConfig,
        model: 'claude-haiku-5-5'
      });
      mockResponse(engine, { content, stop_reason: 'end_turn' });

      await expect(engine.generateCommitMessage(messages)).rejects.toThrow(
        GenerateCommitMessageErrorEnum.emptyMessage
      );
    }
  );

  it('retains the legacy behavior for truncated text responses', async () => {
    const engine = new AnthropicEngine({
      ...baseConfig,
      model: 'claude-sonnet-4-6'
    });
    mockResponse(engine, {
      content: [{ type: 'text', text: 'fix: preserve legacy output' }],
      stop_reason: 'max_tokens'
    });

    await expect(engine.generateCommitMessage(messages)).resolves.toBe(
      'fix: preserve legacy output'
    );
  });

  it('checks the Haiku 5.5 input budget before calling the API', async () => {
    const engine = new AnthropicEngine({
      ...baseConfig,
      model: 'claude-haiku-5-5',
      maxTokensInput: baseConfig.maxTokensOutput
    });
    const create = mockResponse(engine, { content: [] });

    await expect(engine.generateCommitMessage(messages)).rejects.toThrow(
      GenerateCommitMessageErrorEnum.tooMuchTokens
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('forwards a custom baseURL to the Anthropic client', () => {
    const engine = new AnthropicEngine({
      ...baseConfig,
      model: 'claude-sonnet-4-6',
      baseURL: 'https://my-proxy.example.com/anthropic'
    });

    expect(engine.client.baseURL).toBe(
      'https://my-proxy.example.com/anthropic'
    );
  });

  it('extracts the text block when the response starts with a thinking block', async () => {
    const engine = new AnthropicEngine({
      ...baseConfig,
      model: 'claude-sonnet-4-6'
    });

    jest.spyOn(engine.client.messages, 'create').mockResolvedValue({
      content: [
        { type: 'thinking', thinking: 'analyzing the diff step by step' },
        { type: 'text', text: 'feat(anthropic): support thinking models' }
      ]
    } as any);

    const result = await engine.generateCommitMessage(messages);

    expect(result).toBe('feat(anthropic): support thinking models');
  });
});
