import OpenAI from 'openai';
import axios, { AxiosInstance } from 'axios';
import { AiEngine, AiEngineConfig } from './Engine';
import { removeContentTags } from '../utils/removeContentTags';

interface AimlApiConfig extends AiEngineConfig {}

export class AimlApiEngine implements AiEngine {
  client: AxiosInstance;

  constructor(public config: AimlApiConfig) {
    this.client = axios.create({
      baseURL: config.baseURL || 'https://api.aimlapi.com/v1/chat/completions',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'HTTP-Referer' : 'https://github.com/di-sukharev/opencommit',
        'X-Title': 'opencommit',
        'Content-Type': 'application/json',
        ...config.customHeaders
      }
    });
  }

  public generateCommitMessage = async (
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
  ): Promise<string | null> => {
    try {
      const response = await this.client.post('', {
        model: this.config.model,
        messages
      });

      const message = response.data.choices[0].message;
      const content = message?.content;
      return removeContentTags(content, 'think');
    } catch (error) {
      const err = error as Error;
      if (
        axios.isAxiosError<{ error?: { message: string } }>(error) &&
        error.response?.status === 401
      ) {
        const apiError = error.response.data.error;

        if (apiError) throw new Error(apiError.message);
      }

      throw err;
    }
  };
}
