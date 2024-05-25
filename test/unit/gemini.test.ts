import { Gemini } from '../../src/engine/gemini';
import { ChatCompletionRequestMessage } from 'openai';
import { GenerativeModel, GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import { CONFIG_MODES, ConfigType, DEFAULT_TOKEN_LIMITS, getConfig, MODEL_LIST } from '../../src/commands/config';

jest.mock('@google/generative-ai');
jest.mock('../src/commands/config');

describe('Gemini', () => {
  let gemini: Gemini;
  let mockConfig: ConfigType;
  let mockGoogleGenerativeAi: GoogleGenerativeAI;
  let mockGenerativeModel: GenerativeModel;
  let mockExit: jest.SpyInstance<never, [code?: number | undefined], any>;
  
  const noop: (code?: number | undefined) => never = (code?: number | undefined) => { console.log('noop process.exit(1)') };

  beforeEach(() => {
    mockExit = jest.spyOn(process, 'exit').mockImplementation(noop);
    mockConfig = getConfig() as ConfigType;
    mockGoogleGenerativeAi = new GoogleGenerativeAI(mockConfig.OCO_GEMINI_API_KEY);
    mockGenerativeModel = mockGoogleGenerativeAi.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: '',
    });
  });
  
  afterEach(() => {
    gemini = undefined as any;
  })
  
  afterAll(() => {
    mockExit.mockRestore();
  })

  it('should initialize with correct config', () => {
    gemini = new Gemini();
    expect(gemini).toBeDefined();
  });

  it('should generate commit message', async () => {
    const messages: ChatCompletionRequestMessage[] = [
      { role: 'system', content: 'system message' },
      { role: 'assistant', content: 'assistant message' },
    ];

    const mockGenerateContent = jest.fn().mockResolvedValue({ response: { text: () => 'generated content' } });
    mockGenerativeModel.generateContent = mockGenerateContent;

    const result = await gemini.generateCommitMessage(messages);

    expect(result).toEqual('generated content');
    expect(mockGenerateContent).toHaveBeenCalledWith({
      contents: [{ parts: [{ text: 'assistant message' }], role: 'assistant' }],
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
      ],
      generationConfig: {
        maxOutputTokens: DEFAULT_TOKEN_LIMITS.DEFAULT_MAX_TOKENS_OUTPUT,
        temperature: 0,
        topP: 0.1,
      },
    });
  });

  it('should warmup correctly', () => {
    expect(gemini).toBeDefined();
  });

  it('should exit process if OCO_GEMINI_API_KEY is not set and command is not config', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation();

    mockConfig.OCO_AI_PROVIDER = 'gemini';
    mockConfig.OCO_GEMINI_API_KEY = undefined;
    process.argv = ['node', 'script.js', 'not-config', 'not-set'];

    new Gemini();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit process if model is not supported and command is not config', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation();

    mockConfig.OCO_AI_PROVIDER = 'gemini';
    mockConfig.OCO_MODEL = 'unsupported-model';
    process.argv = ['node', 'script.js', 'not-config', 'not-set'];

    new Gemini();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});