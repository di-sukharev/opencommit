import OpenAI from 'openai';
import { AiEngine, AiEngineConfig } from './Engine';
import axios, { AxiosInstance } from 'axios';
import { removeContentTags } from '../utils/removeContentTags';

interface OpenRouterConfig extends AiEngineConfig {}

export class OpenRouterEngine implements AiEngine {
  client: AxiosInstance;

  constructor(public config: OpenRouterConfig) {
    this.client = axios.create({
      baseURL: 'https://openrouter.ai/api/v1/chat/completions',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'HTTP-Referer': 'https://github.com/di-sukharev/opencommit',
        'X-Title': 'OpenCommit',
        'Content-Type': 'application/json'
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
      let content = message?.content;
      return removeContentTags(content, 'think');
    } catch (error) {
      const err = error as Error;
      if (
        axios.isAxiosError<{ error?: { message: string } }>(error) &&
        error.response?.status === 401
      ) {
        const openRouterError = error.response.data.error;

        if (openRouterError) throw new Error(openRouterError.message);
      }

      throw err;
    }
  };
}
