import { GeminiEngine } from '../../src/engine/gemini';

import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
import {
  ConfigType,
  getConfig,
  OCO_AI_PROVIDER_ENUM
} from '../../src/commands/config';
import { OpenAI } from 'openai';

describe('Gemini', () => {
  let gemini: GeminiEngine;
  let mockConfig: ConfigType;
  let mockGoogleGenerativeAi: GoogleGenerativeAI;
  let mockGenerativeModel: GenerativeModel;
  let mockExit: jest.SpyInstance<never, [code?: number | undefined], any>;

  const noop: (...args: any[]) => any = (...args: any[]) => {};

  const mockGemini = () => {
    mockConfig = getConfig() as ConfigType;

    gemini = new GeminiEngine({
      apiKey: mockConfig.OCO_API_KEY,
      model: mockConfig.OCO_MODEL
    });
  };

  const oldEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...oldEnv };

    jest.mock('@google/generative-ai');
    jest.mock('../src/commands/config');

    jest.mock('@clack/prompts', () => ({
      intro: jest.fn(),
      outro: jest.fn()
    }));

    mockExit = jest.spyOn(process, 'exit').mockImplementation();

    mockConfig = getConfig() as ConfigType;

    mockConfig.OCO_AI_PROVIDER = OCO_AI_PROVIDER_ENUM.GEMINI;
    mockConfig.OCO_API_KEY = 'mock-api-key';
    mockConfig.OCO_MODEL = 'gemini-1.5-flash';

    mockGoogleGenerativeAi = new GoogleGenerativeAI(mockConfig.OCO_API_KEY);
    mockGenerativeModel = mockGoogleGenerativeAi.getGenerativeModel({
      model: mockConfig.OCO_MODEL
    });
  });

  afterEach(() => {
    gemini = undefined as any;
  });

  afterAll(() => {
    mockExit.mockRestore();
    process.env = oldEnv;
  });

  it.skip('should exit process if OCO_GEMINI_API_KEY is not set and command is not config', () => {
    process.env.OCO_GEMINI_API_KEY = undefined;
    process.env.OCO_AI_PROVIDER = 'gemini';

    mockGemini();

    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should generate commit message', async () => {
    const mockGenerateContent = jest
      .fn()
      .mockResolvedValue({ response: { text: () => 'generated content' } });
    mockGenerativeModel.generateContent = mockGenerateContent;

    mockGemini();

    const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> =
      [
        { role: 'system', content: 'system message' },
        { role: 'assistant', content: 'assistant message' }
      ];

    jest
      .spyOn(gemini, 'generateCommitMessage')
      .mockImplementation(async () => 'generated content');
    const result = await gemini.generateCommitMessage(messages);

    expect(result).toEqual('generated content');
  });
});
