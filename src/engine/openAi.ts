import axios from 'axios';
import { OpenAI } from 'openai';
import { GenerateCommitMessageErrorEnum } from '../generateCommitMessageFromGitDiff';
import { removeContentTags } from '../utils/removeContentTags';
import { tokenCount } from '../utils/tokenCount';
import { AiEngine, AiEngineConfig } from './Engine';

export interface OpenAiConfig extends AiEngineConfig {}

export class OpenAiEngine implements AiEngine {
  config: OpenAiConfig;
  client: OpenAI;

  constructor(config: OpenAiConfig) {
    this.config = config;

    // Configuration options for the OpenAI client
    const clientOptions: any = {
      apiKey: config.apiKey
    };
    
    // Add baseURL if present
    if (config.baseURL) {
      clientOptions.baseURL = config.baseURL;
    }
    
    // Add custom headers if present
    if (config.customHeaders) {
      try {
        let headers = config.customHeaders;
        // If the headers are a string, try to parse them as JSON
        if (typeof config.customHeaders === 'string') {
          headers = JSON.parse(config.customHeaders);
        }
        
        if (headers && typeof headers === 'object' && Object.keys(headers).length > 0) {
          clientOptions.defaultHeaders = headers;
        }
      } catch (error) {
        // Silently ignore parsing errors
      }
    }
    
    this.client = new OpenAI(clientOptions);
  }

  public generateCommitMessage = async (
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
  ): Promise<string | null> => {
    const params = {
      model: this.config.model,
      messages,
      temperature: 0,
      top_p: 0.1,
      max_tokens: this.config.maxTokensOutput
    };

    try {
      const REQUEST_TOKENS = messages
        .map((msg) => tokenCount(msg.content as string) + 4)
        .reduce((a, b) => a + b, 0);

      if (
        REQUEST_TOKENS >
        this.config.maxTokensInput - this.config.maxTokensOutput
      )
        throw new Error(GenerateCommitMessageErrorEnum.tooMuchTokens);
      
      const completion = await this.client.chat.completions.create(params);

      const message = completion.choices[0].message;
      let content = message?.content;
      return removeContentTags(content, 'think');
    } catch (error) {
      const err = error as Error;
      if (
        axios.isAxiosError<{ error?: { message: string } }>(error) &&
        error.response?.status === 401
      ) {
        const openAiError = error.response.data.error;

        if (openAiError) throw new Error(openAiError.message);
      }

      throw err;
    }
  };
}
