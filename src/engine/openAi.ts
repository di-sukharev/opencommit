import axios from 'axios';
import { OpenAI } from 'openai';
import { GenerateCommitMessageErrorEnum } from '../generateCommitMessageFromGitDiff';
import { parseCustomHeaders } from '../utils/engine';
import { ModelNotFoundError } from '../utils/errors';
import { removeContentTags } from '../utils/removeContentTags';
import { tokenCount } from '../utils/tokenCount';
import { AiEngine, AiEngineConfig } from './Engine';

export interface OpenAiConfig extends AiEngineConfig {}

export class OpenAiEngine implements AiEngine {
  config: OpenAiConfig;
  client: OpenAI;

  constructor(config: OpenAiConfig) {
    this.config = config;

    const clientOptions: OpenAI.ClientOptions = {
      apiKey: config.apiKey
    };

    if (config.baseURL) {
      clientOptions.baseURL = config.baseURL;
    }

    if (config.customHeaders) {
      const headers = parseCustomHeaders(config.customHeaders);
      if (Object.keys(headers).length > 0) {
        clientOptions.defaultHeaders = headers;
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

      // Check for model not found errors
      if (err.message?.toLowerCase().includes('model') &&
          (err.message?.toLowerCase().includes('not found') ||
           err.message?.toLowerCase().includes('does not exist') ||
           err.message?.toLowerCase().includes('invalid'))) {
        throw new ModelNotFoundError(this.config.model, 'openai', 404);
      }

      // Check for 404 errors from API
      if ('status' in (error as any) && (error as any).status === 404) {
        throw new ModelNotFoundError(this.config.model, 'openai', 404);
      }

      if (
        axios.isAxiosError<{ error?: { message: string } }>(error) &&
        error.response?.status === 401
      ) {
        const openAiError = error.response.data.error;

        if (openAiError) throw new Error(openAiError.message);
      }

      // Check axios 404 errors
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new ModelNotFoundError(this.config.model, 'openai', 404);
      }

      throw err;
    }
  };
}
