import axios, { AxiosInstance } from 'axios';
import { OpenAI } from 'openai';
import { AiEngine, AiEngineConfig } from './Engine';

interface OllamaConfig extends AiEngineConfig {}

export class OllamaEngine implements AiEngine {
  config: OllamaConfig;
  client: AxiosInstance;

  constructor(config) {
    this.config = config;
    this.client = axios.create({
      url: config.baseURL
        ? `${config.baseURL}/${config.apiKey}`
        : 'http://localhost:11434/api/chat',
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
      const response = await this.client.post(
        this.client.getUri(this.config),
        params
      );

      const { message } = response.data;
      let content = message?.content;

      if (content && content.includes('<think>')) {
        return content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      }

      return content;
    } catch (err: any) {
      const message = err.response?.data?.error ?? err.message;
      throw new Error(`Ollama provider error: ${message}`);
    }
  }
}
