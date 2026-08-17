import axios, { AxiosInstance } from 'axios';
import { OpenAI } from 'openai';
import { normalizeEngineError } from '../utils/engineErrorHandler';
import { removeContentTags } from '../utils/removeContentTags';
import { AiEngine, AiEngineConfig } from './Engine';

interface OllamaConfig extends AiEngineConfig {
  ollamaThink?: boolean;
}

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const OLLAMA_CHAT_PATH = '/api/chat';

export class OllamaEngine implements AiEngine {
  config: OllamaConfig;
  client: AxiosInstance;
  private chatUrl: string;

  constructor(config) {
    this.config = config;

    const baseUrl = config.baseURL || DEFAULT_OLLAMA_URL;
    this.chatUrl = `${baseUrl}${OLLAMA_CHAT_PATH}`;

    // Combine base headers with custom headers
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
      model: this.config.model ?? 'mistral',
      messages,
      options: { temperature: 0, top_p: 0.1 },
      stream: false
    };
    if (typeof this.config.ollamaThink === 'boolean') {
      params.think = this.config.ollamaThink;
    }
    try {
      const response = await this.client.post(this.chatUrl, params);

      const { message } = response.data;
      let content = message?.content;
      return removeContentTags(content, 'think');
    } catch (error) {
      throw normalizeEngineError(error, 'ollama', this.config.model);
    }
  }
}
