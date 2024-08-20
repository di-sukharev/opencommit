import axios, { AxiosInstance } from 'axios';
import { OpenAI } from 'openai';
import { AiEngine, AiEngineConfig } from './Engine';

interface OllamaConfig extends AiEngineConfig {}

export class OllamaAi implements AiEngine {
  config: OllamaConfig;
  client: AxiosInstance;

  constructor(config) {
    this.config = config;
    this.client = axios.create({
      url: config.baseURL
        ? `api/v1/prediction/${config.apiKey}`
        : 'http://localhost:11434/api/chat', // full URL overrides the baseURL
      baseURL: config.baseURL,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async generateCommitMessage(
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
  ): Promise<string | undefined> {
    const params = {
      model: this.config.model ?? 'mistral',
      messages,
      options: { temperature: 0, top_p: 0.1 },
      stream: false
    };
    try {
      const response = await this.client.post('', params);

      const message = response.data.message;

      return message?.content;
    } catch (err: any) {
      const message = err.response?.data?.error ?? err.message;
      throw new Error(`Ollama provider error: ${message}`);
    }
  }
}
