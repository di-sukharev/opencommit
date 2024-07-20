import axios, { AxiosError } from 'axios';
import { ChatCompletionRequestMessage } from 'openai';
import { AiEngine } from './Engine';

import {
  getConfig
} from '../commands/config';

const config = getConfig();

export class OllamaAi implements AiEngine {
  private model = "mistral"; // as default model of Ollama
  private url = "http://localhost:11434/api/chat"; // default URL of Ollama API

  setModel(model: string) {
    this.model = model ?? config?.OCO_MODEL ?? 'mistral';
  }
  
  setUrl(url: string) {
    this.url = url ?? config?.OCO_OLLAMA_API_URL ?? 'http://localhost:11434/api/chat';
  }
  async generateCommitMessage(
    messages: Array<ChatCompletionRequestMessage>
  ): Promise<string | undefined> {
    const model = this.model;

    //console.log(messages);
    //process.exit()

    const url = this.url;
    const p = {
      model,
      messages,
      options: { temperature: 0, top_p: 0.1 },
      stream: false
    };
    try {
      const response = await axios.post(url, p, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const message = response.data.message;

      return message?.content;
    } catch (err: any) {
      const message = err.response?.data?.error ?? err.message;
      throw new Error('local model issues. details: ' + message);
    }
  }
}
