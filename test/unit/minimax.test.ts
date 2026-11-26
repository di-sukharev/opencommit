import { OpenAI } from 'openai';
import {
  DEFAULT_CONFIG,
  OCO_AI_PROVIDER_ENUM
} from '../../src/commands/config';
import { getEngine } from '../../src/utils/engine';

describe('MiniMax provider', () => {
  const minimaxConfig = {
    ...DEFAULT_CONFIG,
    OCO_AI_PROVIDER: OCO_AI_PROVIDER_ENUM.MINIMAX,
    OCO_MODEL: 'MiniMax-M3',
    OCO_API_KEY: 'test-minimax-key',
    OCO_TOKENS_MAX_OUTPUT: 256
  };

  const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
    { role: 'system', content: 'system message' },
    { role: 'user', content: 'diff --git a/file b/file' }
  ];

  const mockCompletion = () =>
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        choices: [{ message: { content: 'feat(minimax): add the provider' } }]
      })
    );

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requires a MiniMax key even when an OpenAI key is available', () => {
    jest.replaceProperty(process, 'env', {
      ...process.env,
      OPENAI_API_KEY: 'unused-openai-test-key'
    });

    expect(() =>
      getEngine({ ...minimaxConfig, OCO_API_KEY: undefined })
    ).toThrow(/minimax/i);
  });

  it('sends the completion to the MiniMax API without sampling parameters', async () => {
    const fetchCompletion = mockCompletion();

    const result = await getEngine({
      ...minimaxConfig,
      OCO_API_URL: undefined
    }).generateCommitMessage(messages);

    expect(result).toBe('feat(minimax): add the provider');
    const [url, request] = fetchCompletion.mock.calls[0];
    expect(url).toBe('https://api.minimax.io/v1/chat/completions');
    expect(JSON.parse(request?.body as string)).toEqual({
      model: 'MiniMax-M3',
      messages,
      max_tokens: 256
    });
  });

  it('uses OCO_API_URL instead of the default endpoint', async () => {
    const fetchCompletion = mockCompletion();

    await getEngine({
      ...minimaxConfig,
      OCO_API_URL: 'https://api.minimaxi.com/v1'
    }).generateCommitMessage(messages);

    expect(fetchCompletion.mock.calls[0][0]).toBe(
      'https://api.minimaxi.com/v1/chat/completions'
    );
  });
});
