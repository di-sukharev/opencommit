import { OpenAI } from 'openai';
import { GeminiEngine } from '../../src/engine/gemini';

describe('GeminiEngine', () => {
  it('maps OpenAI-style chat messages into Gemini request payloads', async () => {
    const engine = new GeminiEngine({
      apiKey: 'mock-api-key',
      model: 'gemini-1.5-flash',
      baseURL: 'http://127.0.0.1:8080/v1',
      maxTokensOutput: 256,
      maxTokensInput: 4096
    });

    const generateContent = jest.fn().mockResolvedValue({
      response: {
        text: () => 'feat(gemini): translate the diff<think>hidden</think>'
      }
    });
    const getGenerativeModel = jest.fn().mockReturnValue({
      generateContent
    });

    engine.client = {
      getGenerativeModel
    } as any;

    const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
      { role: 'system', content: 'system message' },
      { role: 'assistant', content: 'assistant guidance' },
      { role: 'user', content: 'diff --git a/file b/file' }
    ];

    const result = await engine.generateCommitMessage(messages);

    expect(result).toEqual('feat(gemini): translate the diff');
    expect(getGenerativeModel).toHaveBeenCalledWith(
      {
        model: 'gemini-1.5-flash',
        systemInstruction: 'system message'
      },
      {
        baseUrl: 'http://127.0.0.1:8080/v1'
      }
    );
    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: [
          {
            parts: [{ text: 'assistant guidance' }],
            role: 'model'
          },
          {
            parts: [{ text: 'diff --git a/file b/file' }],
            role: 'user'
          }
        ],
        generationConfig: expect.objectContaining({
          maxOutputTokens: 256,
          temperature: 0,
          topP: 0.1
        })
      })
    );
  });
});
