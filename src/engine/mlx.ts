import axios, { AxiosInstance } from 'axios';
import { OpenAI } from 'openai';
import { normalizeEngineError } from '../utils/engineErrorHandler';
import { removeContentTags } from '../utils/removeContentTags';
import { AiEngine, AiEngineConfig } from './Engine';

interface MLXConfig extends AiEngineConfig {}

const DEFAULT_MLX_URL = 'http://localhost:8080';
const MLX_CHAT_PATH = '/v1/chat/completions';

export class MLXEngine implements AiEngine {
  config: MLXConfig;
  client: AxiosInstance;
  private chatUrl: string;

  constructor(config) {
    this.config = config;

    const baseUrl = config.baseURL || DEFAULT_MLX_URL;
    this.chatUrl = `${baseUrl}${MLX_CHAT_PATH}`;

    this.client = axios.create({
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async generateCommitMessage(
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
  ): Promise<string | undefined> {
    const params = {
      messages,
      temperature: 0,
      top_p: 0.1,
      repetition_penalty: 1.5,
      stream: false
    };
    try {
      const response = await this.client.post(this.chatUrl, params);

      const choices = response.data.choices;
      const message = choices[0].message;
      let content = message?.content;
      return removeContentTags(content, 'think');
    } catch (error) {
      throw normalizeEngineError(error, 'mlx', this.config.model);
    }
  }
}
