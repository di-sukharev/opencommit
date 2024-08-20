import axios, { AxiosInstance } from 'axios';
import { ChatCompletionRequestMessage } from 'openai';
import { AiEngine, AiEngineConfig } from './Engine';

interface OllamaConfig extends AiEngineConfig {}

export class OllamaAi implements AiEngine {
  config: OllamaConfig;
  client: AxiosInstance;

  constructor(config) {
    this.config = config;
    this.client = axios.create({
      // TODO: verify. basePath should be equal to OCO_FLOWISE_ENDPOINT
      url: '/api/chat',
      baseURL: config.basePath ?? 'http://localhost:11434',
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async generateCommitMessage(
    messages: Array<ChatCompletionRequestMessage>
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
