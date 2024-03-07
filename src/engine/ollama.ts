import axios, { AxiosError } from 'axios';
import { ChatCompletionRequestMessage } from 'openai';
import { AiEngine } from './Engine';

export class OllamaAi implements AiEngine {
  async generateCommitMessage(
    messages: Array<ChatCompletionRequestMessage>
  ): Promise<string | undefined> {
    const model = 'mistral'; // todo: allow other models

    //console.log(messages);
    //process.exit()

    const url = 'http://localhost:11434/api/chat';
    const p = {
      model,
      messages,
      options: {temperature: 0, top_p: 0.1},
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

export const ollamaAi = new OllamaAi();
