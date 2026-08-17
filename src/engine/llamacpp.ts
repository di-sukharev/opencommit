import axios, { AxiosInstance } from 'axios';
import { OpenAI } from 'openai';
import { normalizeEngineError } from '../utils/engineErrorHandler';
import { removeContentTags } from '../utils/removeContentTags';
import { AiEngine, AiEngineConfig } from './Engine';

interface LlamaCppConfig extends AiEngineConfig {}

const DEFAULT_LLAMACPP_URL = 'http://localhost:8080';
const LLAMACPP_CHAT_PATH = '/v1/chat/completions';

export class LlamaCppEngine implements AiEngine {
  config: LlamaCppConfig;
  client: AxiosInstance;
  private chatUrl: string;

  constructor(config: LlamaCppConfig) {
    this.config = config;

    const baseUrl = config.baseURL || DEFAULT_LLAMACPP_URL;
    this.chatUrl = `${baseUrl}${LLAMACPP_CHAT_PATH}`;

    const headers = {
      'Content-Type': 'application/json',
      ...config.customHeaders
    };

    this.client = axios.create({ headers });
  }

  async generateCommitMessage(
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
  ): Promise<string | undefined> {
    const params: Record<string, any> = {
      model: this.config.model ?? '',
      messages,
      temperature: 0,
      top_p: 0.1,
      repeat_penalty: 1.1,
      stream: false
    };
    try {
      const response = await this.client.post(this.chatUrl, params);

      const choices = response.data.choices;
      const message = choices[0].message;
      return removeContentTags(message?.content, 'think');
    } catch (error) {
      throw normalizeEngineError(error, 'llamacpp', this.config.model);
    }
  }
}
