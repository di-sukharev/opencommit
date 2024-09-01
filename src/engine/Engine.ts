import AnthropicClient from '@anthropic-ai/sdk';
import { OpenAIClient as AzureOpenAIClient } from '@azure/openai';
import { GoogleGenerativeAI as GeminiClient } from '@google/generative-ai';
import { AxiosInstance as RawAxiosClient } from 'axios';
import { OpenAI as OpenAIClient } from 'openai';

export interface AiEngineConfig {
  apiKey: string;
  model: string;
  maxTokensOutput: number;
  maxTokensInput: number;
  baseURL?: string;
}

type Client =
  | OpenAIClient
  | AzureOpenAIClient
  | AnthropicClient
  | RawAxiosClient
  | GeminiClient;

export interface AiEngine {
  config: AiEngineConfig;
  client: Client;
  generateCommitMessage(
    messages: Array<OpenAIClient.Chat.Completions.ChatCompletionMessageParam>
  ): Promise<string | null | undefined>;
}
