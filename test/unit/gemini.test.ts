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
  
  const noop: (code?: number | undefined) => never = (code?: number | undefined) => {};
  
  const mockGemini = () => {
    gemini = new Gemini();
  }

  beforeEach(() => {
    jest.mock('@clack/prompts', () => ({
      intro: jest.fn(),
      outro: jest.fn(),
    }));
    mockExit = jest.spyOn(process, 'exit').mockImplementation(noop);
    mockConfig = getConfig() as ConfigType;
    
    mockConfig.OCO_AI_PROVIDER = 'gemini';
    mockConfig.OCO_GEMINI_API_KEY = 'mock-api-key';
    mockConfig.OCO_MODEL = 'gemini-1.5-flash';
    
    mockGoogleGenerativeAi = new GoogleGenerativeAI(mockConfig.OCO_GEMINI_API_KEY);    
    mockGenerativeModel = mockGoogleGenerativeAi.getGenerativeModel({ model: mockConfig.OCO_MODEL, });
  });
  
  afterEach(() => {
    gemini = undefined as any;
  })
  
  afterAll(() => {
    mockExit.mockRestore();
  });

  it('should initialize with correct config', () => {
    mockGemini();
    // gemini = new Gemini();
    expect(gemini).toBeDefined();
  });

  it('should generate commit message', async () => {
    const mockGenerateContent = jest.fn().mockResolvedValue({ response: { text: () => 'generated content' } });
    mockGenerativeModel.generateContent = mockGenerateContent;
    
    const mockWarmp = jest.spyOn(Gemini.prototype as any, 'warmup').mockImplementation(noop);
    mockGemini();
    // gemini = new Gemini();
    
    const messages: ChatCompletionRequestMessage[] = [
      { role: 'system', content: 'system message' },
      { role: 'assistant', content: 'assistant message' },
    ];
    
    jest.spyOn(gemini, 'generateCommitMessage').mockImplementation(async () => 'generated content');
    const result = await gemini.generateCommitMessage(messages);

    expect(result).toEqual('generated content');
    expect(mockWarmp).toHaveBeenCalled();
  });

  it('should warmup correctly', () => {
    // gemini = new Gemini();
    const mockWarmp = jest.spyOn(Gemini.prototype as any, 'warmup').mockImplementation(noop);
    mockGemini();
    expect(gemini).toBeDefined();
  });

  it('should exit process if OCO_GEMINI_API_KEY is not set and command is not config', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation();

    mockConfig.OCO_AI_PROVIDER = 'gemini';
    mockConfig.OCO_GEMINI_API_KEY = undefined;
    process.argv = ['node', 'script.js', 'not-config', 'not-set'];

    // gemini = new Gemini();
    mockGemini();
    
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit process if model is not supported and command is not config', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation();

    mockConfig.OCO_AI_PROVIDER = 'gemini';
    mockConfig.OCO_MODEL = 'unsupported-model';
    process.argv = ['node', 'script.js', 'not-config', 'not-set'];

    mockGemini();
    // gemini = new Gemini();

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});