import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  ConverseCommand
} from '@aws-sdk/client-bedrock-runtime';
import { outro } from '@clack/prompts';
import axios from 'axios';
import chalk from 'chalk';
import { OpenAI } from 'openai';
import { GenerateCommitMessageErrorEnum } from '../generateCommitMessageFromGitDiff';
import { removeContentTags } from '../utils/removeContentTags';
import { tokenCount } from '../utils/tokenCount';
import { AiEngine, AiEngineConfig } from './Engine';

interface BedrockConfig extends AiEngineConfig {
  region?: string;
  guardrailId?: string;
  guardrailVersion?: string;
  useConverseApi?: boolean;
}

export class BedrockEngine implements AiEngine {
  config: BedrockConfig;
  client: BedrockRuntimeClient;

  constructor(config: BedrockConfig) {
    this.config = config;
    
    const clientOptions: { region?: string; credentials?: any } = {
      region: config.region || 'us-east-1' // Default to us-east-1 if not specified
    };

    // Handle authentication - support both API key and IAM credentials
    if (config.apiKey) {
      if (config.apiKey.startsWith('Bedrock-API-Key-')) {
        // Using API key auth - the AWS SDK automatically picks up the x-api-key header
        // from the custom headers
        if (!config.customHeaders) {
          config.customHeaders = {};
        }
        config.customHeaders['x-api-key'] = config.apiKey;
      } else {
        // Fallback to IAM credentials if provided in format "accessKey:secretKey"
        const [accessKeyId, secretAccessKey] = config.apiKey.split(':');
        if (accessKeyId && secretAccessKey) {
          clientOptions.credentials = { accessKeyId, secretAccessKey };
        }
      }
    }

    this.client = new BedrockRuntimeClient(clientOptions);
  }

  // Helper to identify model family by looking for relevant substrings in the model ID
  private getModelFamily(modelId: string): string {
    // Check for model families by looking for relevant substrings
    if (modelId.includes('claude')) return 'anthropic.claude';
    if (modelId.includes('titan')) return 'amazon.titan';
    if (modelId.includes('nova')) return 'amazon.nova';
    if (modelId.includes('llama')) return 'meta.llama';
    if (modelId.includes('ai21') || modelId.includes('jamba') || modelId.includes('jurassic')) return 'ai21';
    if (modelId.includes('cohere') || modelId.includes('command')) return 'cohere';
    if (modelId.includes('mistral')) return 'mistral';
    if (modelId.includes('stability')) return 'stability';
    if (modelId.includes('deepseek')) return 'deepseek';
    
    // Default
    return 'unknown';
  }

  public generateCommitMessage = async (
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
  ): Promise<string | null> => {
    try {
      const REQUEST_TOKENS = messages
        .map((msg) => tokenCount(msg.content as string) + 4)
        .reduce((a, b) => a + b, 0);

      if (
        REQUEST_TOKENS >
        this.config.maxTokensInput - this.config.maxTokensOutput
      ) {
        throw new Error(GenerateCommitMessageErrorEnum.tooMuchTokens);
      }

      // Extract system message and remaining messages
      const systemMessage = messages.find((msg) => msg.role === 'system')?.content as string || '';
      const restMessages = messages.filter((msg) => msg.role !== 'system');
      
      // If useConverseApi is enabled (or not specified), use the Converse API
      if (this.config.useConverseApi !== false) {
        return this.generateWithConverseApi(systemMessage, restMessages);
      } else {
        // Otherwise use the older InvokeModel API
        return this.generateWithInvokeModelApi(systemMessage, restMessages);
      }
    } catch (error) {
      const err = error as Error;
      if (
        axios.isAxiosError<{ error?: { message: string } }>(error) &&
        error.response?.status === 401
      ) {
        const bedrockError = error.response.data.error;
        if (bedrockError) throw new Error(bedrockError.message);
      }

      outro(`${chalk.red('✖')} ${err?.message || err}`);
      throw err;
    }
  };

  // Uses the newer Converse API which supports guardrails
  private async generateWithConverseApi(
    systemMessage: string,
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
  ): Promise<string | null> {
    const modelId = this.config.model;
    
    // Prepare messages for the Converse API format
    const converseMessages = [];
    
    // Add system message if present
    if (systemMessage) {
      converseMessages.push({
        role: 'system',
        content: [{ text: systemMessage }]
      });
    }
    
    // Convert other messages
    for (const message of messages) {
      converseMessages.push({
        role: message.role,
        content: [{ text: message.content as string }]
      });
    }
    
    // Prepare converse command parameters
    const params = {
      modelId: modelId,
      messages: converseMessages,
      inferenceConfig: {
        maxTokens: this.config.maxTokensOutput,
        temperature: 0,
        topP: 0.1
      }
    };
    
    // Add guardrails if configured
    if (this.config.guardrailId) {
      params['guardrailConfig'] = {
        guardrailId: this.config.guardrailId,
        guardrailVersion: this.config.guardrailVersion || 'DRAFT' // Use configured version or default to DRAFT
      };
    }
    
    // Create and send the command
    const command = new ConverseCommand(params);
    const response = await this.client.send(command);
    
    // Extract the response content
    if (response.output?.message?.content?.[0]?.text) {
      const content = response.output.message.content[0].text;
      return removeContentTags(content, 'think');
    }
    
    return null;
  }

  // Uses the older InvokeModel API for backwards compatibility
  private async generateWithInvokeModelApi(
    systemMessage: string,
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
  ): Promise<string | null> {
    let payload;
    const modelId = this.config.model;
    const modelFamily = this.getModelFamily(modelId);

    // Format messages according to model provider/family
    switch(modelFamily) {
      case 'anthropic.claude':
        // Anthropic Claude models on Bedrock
        payload = {
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: this.config.maxTokensOutput,
          messages: [
            ...(systemMessage ? [{ role: 'system', content: systemMessage }] : []),
            ...messages.map(msg => ({
              role: msg.role,
              content: msg.content
            }))
          ],
          temperature: 0,
          top_p: 0.1
        };
        break;

      case 'amazon.titan':
        // Amazon Titan models
        payload = {
          inputText: this.formatMessagesAsTitanPrompt(systemMessage, messages),
          textGenerationConfig: {
            maxTokenCount: this.config.maxTokensOutput,
            temperature: 0,
            topP: 0.1
          }
        };
        break;

      case 'amazon.nova':
        // Amazon Nova models
        payload = {
          prompt: this.formatMessagesAsNovaPrompt(systemMessage, messages),
          temperature: 0,
          top_p: 0.1,
          max_tokens: this.config.maxTokensOutput
        };
        break;

      case 'meta.llama':
        // Meta Llama models
        payload = {
          prompt: this.formatMessagesAsLlamaPrompt(systemMessage, messages),
          max_gen_len: this.config.maxTokensOutput,
          temperature: 0,
          top_p: 0.1
        };
        break;

      case 'ai21':
        // AI21 Jurassic/Jamba models
        payload = {
          prompt: this.formatMessagesAsAI21Prompt(systemMessage, messages),
          maxTokens: this.config.maxTokensOutput,
          temperature: 0,
          topP: 0.1
        };
        break;

      case 'cohere':
        // Cohere Command models
        payload = {
          prompt: this.formatMessagesAsGenericPrompt(systemMessage, messages),
          max_tokens: this.config.maxTokensOutput,
          temperature: 0,
          p: 0.1
        };
        break;

      case 'mistral':
        // Mistral models
        payload = {
          messages: [
            ...(systemMessage ? [{ role: 'system', content: systemMessage }] : []),
            ...messages.map(msg => ({
              role: msg.role === 'assistant' ? 'assistant' : 'user',
              content: msg.content
            }))
          ],
          max_tokens: this.config.maxTokensOutput,
          temperature: 0,
          top_p: 0.1
        };
        break;

      case 'stability':
        // Stability AI models
        payload = {
          text_prompts: [
            {
              text: this.formatMessagesAsGenericPrompt(systemMessage, messages)
            }
          ],
          cfg_scale: 7,
          steps: 30
        };
        break;

      case 'deepseek':
        // Deepseek models
        payload = {
          messages: [
            ...(systemMessage ? [{ role: 'system', content: systemMessage }] : []),
            ...messages.map(msg => ({
              role: msg.role,
              content: msg.content
            }))
          ],
          max_tokens: this.config.maxTokensOutput,
          temperature: 0,
          top_p: 0.1
        };
        break;

      default:
        // Default to Claude-like format for other models
        payload = {
          max_tokens: this.config.maxTokensOutput,
          messages: [
            ...(systemMessage ? [{ role: 'system', content: systemMessage }] : []),
            ...messages.map(msg => ({
              role: msg.role,
              content: msg.content
            }))
          ],
          temperature: 0,
          top_p: 0.1
        };
        break;
    }

    const command = new InvokeModelCommand({
      modelId,
      body: JSON.stringify(payload),
      contentType: 'application/json',
      accept: 'application/json'
    });

    const response = await this.client.send(command);
    
    // Parse the response body
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    // Extract content based on model provider
    let content;
    
    switch(modelFamily) {
      case 'anthropic.claude':
        content = responseBody.content?.[0]?.text;
        break;
      case 'amazon.titan':
        content = responseBody.results?.[0]?.outputText;
        break;
      case 'amazon.nova':
        content = responseBody.completion;
        break;
      case 'meta.llama':
        content = responseBody.generation;
        break;
      case 'ai21':
        content = responseBody.completions?.[0]?.data?.text;
        break;
      case 'cohere':
        content = responseBody.generations?.[0]?.text;
        break;
      case 'mistral':
        content = responseBody.outputs?.[0]?.text || responseBody.completion;
        break;
      case 'stability':
        content = responseBody.artifacts?.[0]?.text;
        break;
      case 'deepseek':
        content = responseBody.content?.[0]?.text || responseBody.generated_text;
        break;
      default:
        // Try common response formats
        content = responseBody.content?.[0]?.text || 
                 responseBody.generation ||
                 responseBody.text ||
                 responseBody.completion ||
                 responseBody.answer ||
                 responseBody.response;
        break;
    }

    return removeContentTags(content, 'think');
  }

  private formatMessagesAsTitanPrompt(
    systemMessage: string,
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
  ): string {
    let prompt = '';
    
    if (systemMessage) {
      prompt += `System: ${systemMessage}\n\n`;
    }
    
    for (const message of messages) {
      if (message.role === 'user') {
        prompt += `Human: ${message.content}\n\n`;
      } else if (message.role === 'assistant') {
        prompt += `Assistant: ${message.content}\n\n`;
      }
    }
    
    prompt += 'Assistant: ';
    return prompt;
  }

  private formatMessagesAsNovaPrompt(
    systemMessage: string,
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
  ): string {
    let prompt = '';
    
    if (systemMessage) {
      prompt += `<instructions>${systemMessage}</instructions>\n\n`;
    }
    
    for (const message of messages) {
      if (message.role === 'user') {
        prompt += `USER: ${message.content}\n\n`;
      } else if (message.role === 'assistant') {
        prompt += `ASSISTANT: ${message.content}\n\n`;
      }
    }
    
    prompt += 'ASSISTANT: ';
    return prompt;
  }

  private formatMessagesAsLlamaPrompt(
    systemMessage: string,
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
  ): string {
    let prompt = '';
    
    if (systemMessage) {
      prompt += `<system>\n${systemMessage}\n</system>\n\n`;
    }
    
    for (const message of messages) {
      if (message.role === 'user') {
        prompt += `<human>\n${message.content}\n</human>\n\n`;
      } else if (message.role === 'assistant') {
        prompt += `<assistant>\n${message.content}\n</assistant>\n\n`;
      }
    }
    
    prompt += '<assistant>\n';
    return prompt;
  }

  private formatMessagesAsAI21Prompt(
    systemMessage: string,
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
  ): string {
    let prompt = '';
    
    if (systemMessage) {
      prompt += `${systemMessage}\n\n`;
    }
    
    for (const message of messages) {
      if (message.role === 'user') {
        prompt += `User: ${message.content}\n\n`;
      } else if (message.role === 'assistant') {
        prompt += `Assistant: ${message.content}\n\n`;
      }
    }
    
    prompt += 'Assistant: ';
    return prompt;
  }

  private formatMessagesAsGenericPrompt(
    systemMessage: string,
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
  ): string {
    let prompt = '';
    
    if (systemMessage) {
      prompt += `${systemMessage}\n\n`;
    }
    
    for (const message of messages) {
      const role = message.role === 'user' ? 'User' : 'Assistant';
      prompt += `${role}: ${message.content}\n\n`;
    }
    
    prompt += 'Assistant: ';
    return prompt;
  }
}