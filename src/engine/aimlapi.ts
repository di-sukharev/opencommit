import OpenAI from 'openai';
import axios, { AxiosInstance } from 'axios';
import { normalizeEngineError } from '../utils/engineErrorHandler';
import { AiEngine, AiEngineConfig } from './Engine';

interface AimlApiConfig extends AiEngineConfig {}

export class AimlApiEngine implements AiEngine {
  client: AxiosInstance;

  constructor(public config: AimlApiConfig) {
    this.client = axios.create({
      baseURL: config.baseURL || 'https://api.aimlapi.com/v1/chat/completions',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'HTTP-Referer': 'https://github.com/di-sukharev/opencommit',
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

      const message = response.data.choices?.[0]?.message;
      return message?.content ?? null;
    } catch (error) {
      throw normalizeEngineError(error, 'aimlapi', this.config.model);
    }
  };
}
