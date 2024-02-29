import axios, { AxiosError } from 'axios';
import { ChatCompletionRequestMessage } from 'openai';
import { AiEngine } from './Engine';

export class OllamaAi implements AiEngine {
  async generateCommitMessage(
    messages: Array<ChatCompletionRequestMessage>
  ): Promise<string | undefined> {
    const model = 'mistral'; // todo: allow other models

    let prompt = messages.map((x) => x.content).join('\n');
    //hoftix: local models are not so clever so im changing the prompt a bit...
    prompt += 'Summarize above git diff in 10 words or less';

    const url = 'http://localhost:11434/api/generate';
    const p = {
      model,
      prompt,
      stream: false
    };
    try {
      const response = await axios.post(url, p, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const answer = response.data?.response;
      return answer;
    } catch (err: any) {
      const message = err.response?.data?.error ?? err.message;
      throw new Error('local model issues. details: ' + message);
    }
  }
}

export const ollamaAi = new OllamaAi();
