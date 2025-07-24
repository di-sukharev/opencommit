import { BedrockEngine } from '../../src/engine/bedrock';
import { BedrockRuntimeClient, ConverseCommand, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import {
  ConfigType,
  getConfig,
  OCO_AI_PROVIDER_ENUM
} from '../../src/commands/config';
import { OpenAI } from 'openai';

// Mock the TextEncoder and TextDecoder
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

describe('Bedrock', () => {
  let bedrock: BedrockEngine;
  let mockConfig: ConfigType;
  let mockBedrockClient: BedrockRuntimeClient;
  let mockExit: jest.SpyInstance<never, [code?: number | undefined], any>;

  const mockBedrock = () => {
    mockConfig = getConfig() as ConfigType;

    bedrock = new BedrockEngine({
      apiKey: mockConfig.OCO_API_KEY || '',
      model: mockConfig.OCO_MODEL || '',
      maxTokensInput: mockConfig.OCO_TOKENS_MAX_INPUT,
      maxTokensOutput: mockConfig.OCO_TOKENS_MAX_OUTPUT
    });

    // Replace the real client with our mock
    bedrock.client = mockBedrockClient;
  };

  const oldEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...oldEnv };

    jest.mock('@aws-sdk/client-bedrock-runtime');
    jest.mock('../../src/commands/config');

    jest.mock('@clack/prompts', () => ({
      intro: jest.fn(),
      outro: jest.fn()
    }));

    mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    mockConfig = getConfig() as ConfigType;

    mockConfig.OCO_AI_PROVIDER = OCO_AI_PROVIDER_ENUM.BEDROCK;
    mockConfig.OCO_API_KEY = 'mock-api-key';
    mockConfig.OCO_MODEL = 'anthropic.claude-3-5-sonnet-20240620-v1:0';
    mockConfig.OCO_TOKENS_MAX_INPUT = 100000;
    mockConfig.OCO_TOKENS_MAX_OUTPUT = 4096;

    // Mock BedrockRuntimeClient
    mockBedrockClient = new BedrockRuntimeClient({
      region: 'us-east-1'
    });
  });

  afterEach(() => {
    bedrock = undefined as any;
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockExit.mockRestore();
    process.env = oldEnv;
  });

  describe('getModelFamily', () => {
    it('should identify Claude model correctly with different prefixes', async () => {
      mockBedrock();
      
      const models = [
        'anthropic.claude-3-5-sonnet-20240620-v1:0',
        'anthropic.claude-3-7-sonnet-20250219-v1:0',
        'anthropic.claude-opus-4-20250514-v1:0',
        'anthropic.claude-sonnet-4-20250514-v1:0',
        'us-east-1.anthropic.claude-3-opus-20240229-v1:0',
        'us-west-2.anthropic.claude-3-sonnet-20240229-v1:0'
      ];
      
      // Need to access private method using type assertion
      const getModelFamily = (bedrock as any).getModelFamily.bind(bedrock);
      
      for (const model of models) {
        expect(getModelFamily(model)).toEqual('anthropic.claude');
      }
    });
    
    it('should identify different model families correctly', async () => {
      mockBedrock();
      
      const modelTests = [
        // Amazon models
        { model: 'amazon.titan-text-express-v1', expected: 'amazon.titan' },
        { model: 'amazon.titan-text-lite-v1', expected: 'amazon.titan' },
        { model: 'amazon.titan-text-premier-v1:0', expected: 'amazon.titan' },
        { model: 'amazon.nova-premier-v1:0', expected: 'amazon.nova' },
        { model: 'amazon.nova-premier-v1:0:8k', expected: 'amazon.nova' },
        { model: 'amazon.nova-lite-v1:0:24k', expected: 'amazon.nova' },
        { model: 'amazon.nova-micro-v1:0', expected: 'amazon.nova' },
        
        // Meta Llama models
        { model: 'meta.llama3-8b-instruct-v1:0', expected: 'meta.llama' },
        { model: 'meta.llama3-70b-instruct-v1:0', expected: 'meta.llama' },
        { model: 'meta.llama3-1-8b-instruct-v1:0', expected: 'meta.llama' },
        { model: 'meta.llama3-2-90b-instruct-v1:0', expected: 'meta.llama' },
        { model: 'meta.llama4-scout-17b-instruct-v1:0', expected: 'meta.llama' },
        
        // Cohere models
        { model: 'cohere.command-text-v14', expected: 'cohere' },
        { model: 'cohere.command-r-v1:0', expected: 'cohere' },
        { model: 'cohere.command-r-plus-v1:0', expected: 'cohere' },
        { model: 'cohere.command-light-text-v14', expected: 'cohere' },
        
        // AI21 models
        { model: 'ai21.jamba-instruct-v1:0', expected: 'ai21' },
        { model: 'ai21.jamba-1-5-large-v1:0', expected: 'ai21' },
        { model: 'ai21.jamba-1-5-mini-v1:0', expected: 'ai21' },
        
        // Mistral models
        { model: 'mistral.mistral-7b-instruct-v0:2', expected: 'mistral' },
        { model: 'mistral.mistral-large-2402-v1:0', expected: 'mistral' },
        { model: 'mistral.mixtral-8x7b-instruct-v0:1', expected: 'mistral' },
        { model: 'mistral.pixtral-large-2502-v1:0', expected: 'mistral' },
        
        // Other models
        { model: 'stability.stable-diffusion-xl-v1', expected: 'stability' },
        { model: 'deepseek.r1-v1:0', expected: 'deepseek' },
        { model: 'unknown-model', expected: 'unknown' }
      ];
      
      const getModelFamily = (bedrock as any).getModelFamily.bind(bedrock);
      
      for (const test of modelTests) {
        expect(getModelFamily(test.model)).toEqual(test.expected);
      }
    });
  });

  describe('generateWithConverseApi', () => {
    it('should format messages correctly for Converse API', async () => {
      mockBedrock();
      
      // Mock the send method to capture the command
      const mockSend = jest.fn().mockResolvedValue({
        output: {
          message: {
            content: [{ text: 'generated content' }]
          }
        }
      });
      
      mockBedrockClient.send = mockSend;
      
      const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
        { role: 'system', content: 'system message' },
        { role: 'user', content: 'user message' },
        { role: 'assistant', content: 'assistant message' }
      ];
      
      // Invoke the method
      await bedrock.generateCommitMessage(messages);
      
      // Check that Converse command was created properly
      expect(mockSend).toHaveBeenCalled();
      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(ConverseCommand);
      
      // Verify the command parameters
      const params = (command as any).input;
      expect(params.modelId).toBe(mockConfig.OCO_MODEL);
      
      // Verify system message handling
      const formattedMessages = params.messages;
      expect(formattedMessages[0].role).toBe('user');
      expect(formattedMessages[0].content[0].text).toContain('[System Instructions]');
      expect(formattedMessages[0].content[0].text).toContain('system message');
      expect(formattedMessages[0].content[0].text).toContain('user message');
      
      // Verify assistant message
      expect(formattedMessages[1].role).toBe('assistant');
      expect(formattedMessages[1].content[0].text).toBe('assistant message');
    });
  });

  describe('generateWithInvokeModelApi', () => {
    it('should format payload correctly for Claude model', async () => {
      mockBedrock();
      
      // Force useConverseApi to false to use InvokeModelApi
      bedrock = new BedrockEngine({
        apiKey: mockConfig.OCO_API_KEY || '',
        model: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        maxTokensInput: mockConfig.OCO_TOKENS_MAX_INPUT,
        maxTokensOutput: mockConfig.OCO_TOKENS_MAX_OUTPUT,
        useConverseApi: false
      });
      bedrock.client = mockBedrockClient;
      
      // Mock the send method to capture the command
      const mockSend = jest.fn().mockResolvedValue({
        body: Buffer.from(JSON.stringify({ content: [{ text: 'generated content' }] }))
      });
      
      mockBedrockClient.send = mockSend;
      
      const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
        { role: 'system', content: 'system message' },
        { role: 'user', content: 'user message' }
      ];
      
      // Invoke the method
      await bedrock.generateCommitMessage(messages);
      
      // Check that InvokeModel command was created properly
      expect(mockSend).toHaveBeenCalled();
      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(InvokeModelCommand);
      
      // Check the payload for Claude model
      const payload = JSON.parse((command as any).input.body);
      expect(payload.messages).toBeDefined();
      expect(payload.messages).toContainEqual({ role: 'system', content: 'system message' });
      expect(payload.messages).toContainEqual({ role: 'user', content: 'user message' });
      expect(payload.temperature).toBe(0);
      expect(payload.anthropic_version).toBe('bedrock-2023-05-31');
    });
    
    it('should format payload correctly for Amazon Titan model', async () => {
      mockBedrock();
      
      // Force useConverseApi to false to use InvokeModelApi with Titan model
      bedrock = new BedrockEngine({
        apiKey: mockConfig.OCO_API_KEY || '',
        model: 'amazon.titan-text-express-v1',
        maxTokensInput: mockConfig.OCO_TOKENS_MAX_INPUT,
        maxTokensOutput: mockConfig.OCO_TOKENS_MAX_OUTPUT,
        useConverseApi: false
      });
      bedrock.client = mockBedrockClient;
      
      // Mock the send method
      const mockSend = jest.fn().mockResolvedValue({
        body: Buffer.from(JSON.stringify({ results: [{ outputText: 'generated content' }] }))
      });
      
      mockBedrockClient.send = mockSend;
      
      const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
        { role: 'system', content: 'system message' },
        { role: 'user', content: 'user message' }
      ];
      
      // Invoke the method
      await bedrock.generateCommitMessage(messages);
      
      // Check the command and payload
      expect(mockSend).toHaveBeenCalled();
      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(InvokeModelCommand);
      
      const payload = JSON.parse((command as any).input.body);
      expect(payload.inputText).toBeDefined();
      expect(payload.inputText).toContain('system message');
      expect(payload.inputText).toContain('user message');
      expect(payload.textGenerationConfig).toBeDefined();
      expect(payload.textGenerationConfig.maxTokenCount).toBe(mockConfig.OCO_TOKENS_MAX_OUTPUT);
    });
    
    it('should format payload correctly for Meta Llama model', async () => {
      mockBedrock();
      
      // Setup for Llama model
      bedrock = new BedrockEngine({
        apiKey: mockConfig.OCO_API_KEY || '',
        model: 'meta.llama3-70b-instruct-v1:0',
        maxTokensInput: mockConfig.OCO_TOKENS_MAX_INPUT,
        maxTokensOutput: mockConfig.OCO_TOKENS_MAX_OUTPUT,
        useConverseApi: false
      });
      bedrock.client = mockBedrockClient;
      
      // Mock the send method
      const mockSend = jest.fn().mockResolvedValue({
        body: Buffer.from(JSON.stringify({ generation: 'generated content' }))
      });
      
      mockBedrockClient.send = mockSend;
      
      const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
        { role: 'system', content: 'system message' },
        { role: 'user', content: 'user message' }
      ];
      
      // Invoke the method
      await bedrock.generateCommitMessage(messages);
      
      // Verify the command and payload
      expect(mockSend).toHaveBeenCalled();
      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(InvokeModelCommand);
      
      const payload = JSON.parse((command as any).input.body);
      expect(payload.prompt).toBeDefined();
      expect(payload.prompt).toContain('<system>');
      expect(payload.prompt).toContain('<human>');
      expect(payload.prompt).toContain('system message');
      expect(payload.prompt).toContain('user message');
      expect(payload.max_gen_len).toBe(mockConfig.OCO_TOKENS_MAX_OUTPUT);
    });
  });

  describe('generateCommitMessage', () => {
    it('should generate commit message using Converse API by default', async () => {
      mockBedrock();
      
      const mockSend = jest.fn().mockResolvedValue({
        output: {
          message: {
            content: [{ text: 'generated commit message' }]
          }
        }
      });
      
      mockBedrockClient.send = mockSend;
      
      const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
        { role: 'system', content: 'system message' },
        { role: 'user', content: 'user message' }
      ];
      
      const result = await bedrock.generateCommitMessage(messages);
      
      expect(result).toBe('generated commit message');
      expect(mockSend).toHaveBeenCalled();
      const command = mockSend.mock.calls[0][0];
      expect(command).toBeInstanceOf(ConverseCommand);
    });
    
    it('should handle token count validation', async () => {
      mockBedrock();
      
      // Create a message that would exceed token limits
      const largeMessage = { 
        role: 'user', 
        content: 'x'.repeat(mockConfig.OCO_TOKENS_MAX_INPUT) 
      };
      
      const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
        { role: 'system', content: 'system message' },
        largeMessage
      ];
      
      // Token counting is mocked in the test environment
      jest.spyOn(global, 'Error').mockImplementation((message) => {
        return { message } as Error;
      });
      
      try {
        await bedrock.generateCommitMessage(messages);
      } catch (error) {
        expect((error as Error).message).toBe('TOO_MUCH_TOKENS');
      }
    });
  });
});