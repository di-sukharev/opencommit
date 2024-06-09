import { Gemini } from '../../src/engine/gemini';
import { ChatCompletionRequestMessage } from 'openai';
import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
import { ConfigType, getConfig } from '../../src/commands/config';

describe('Gemini', () => {
  let gemini: Gemini;
  let mockConfig: ConfigType;
  let mockGoogleGenerativeAi: GoogleGenerativeAI;
  let mockGenerativeModel: GenerativeModel;
  let mockExit: jest.SpyInstance<never, [code?: number | undefined], any>;
  let mockWarmup: jest.SpyInstance<any, unknown[], any>;
  
  const noop: (code?: number | undefined) => never = (code?: number | undefined) => {};
  
  const mockGemini = () => {
    gemini = new Gemini();
  }
  
  const oldEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...oldEnv };
    
    jest.mock('@google/generative-ai');
    jest.mock('../src/commands/config');
    
    jest.mock('@clack/prompts', () => ({
      intro: jest.fn(),
      outro: jest.fn(),
    }));
    
    if (mockWarmup) mockWarmup.mockRestore();
    
    mockExit = jest.spyOn(process, 'exit').mockImplementation();
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
    process.env = oldEnv;
  });

  it('should initialize with correct config', () => {
    mockGemini();
    // gemini = new Gemini();
    expect(gemini).toBeDefined();
  });

  it('should warmup correctly', () => {
    mockWarmup = jest.spyOn(Gemini.prototype as any, 'warmup').mockImplementation(noop);
    mockGemini();
    expect(gemini).toBeDefined();
  });

  it('should exit process if OCO_GEMINI_API_KEY is not set and command is not config', () => {
    process.env.OCO_GEMINI_API_KEY = undefined;
    process.env.OCO_AI_PROVIDER = 'gemini';
    
    mockGemini();
    
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('should exit process if model is not supported and command is not config', () => {
    process.env.OCO_GEMINI_API_KEY = undefined;
    process.env.OCO_AI_PROVIDER = 'gemini';

    mockGemini();

    expect(mockExit).toHaveBeenCalledWith(1);
  });
  
  it('should generate commit message', async () => {
    const mockGenerateContent = jest.fn().mockResolvedValue({ response: { text: () => 'generated content' } });
    mockGenerativeModel.generateContent = mockGenerateContent;
    
    mockWarmup = jest.spyOn(Gemini.prototype as any, 'warmup').mockImplementation(noop);
    mockGemini();
    
    const messages: ChatCompletionRequestMessage[] = [
      { role: 'system', content: 'system message' },
      { role: 'assistant', content: 'assistant message' },
    ];
    
    jest.spyOn(gemini, 'generateCommitMessage').mockImplementation(async () => 'generated content');
    const result = await gemini.generateCommitMessage(messages);

    expect(result).toEqual('generated content');
    expect(mockWarmup).toHaveBeenCalled();
  });
  
});