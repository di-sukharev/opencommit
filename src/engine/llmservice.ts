import axios, { AxiosError } from 'axios';
import { ChatCompletionRequestMessage } from 'openai';
import { AiEngine } from './Engine';
import {
  getConfig
} from '../commands/config';

const config = getConfig();


export class LlmService implements AiEngine {

  async generateCommitMessage(
    messages: Array<ChatCompletionRequestMessage>
  ): Promise<string | undefined> {

    const gitDiff = messages[ messages.length - 1 ]?.content;
    const url = `http://${config?.OCO_BACKEND_ENDPOINT}/${config?.OCO_BACKEND_PATH}`; // this key is specific to flowise
    const payload = {
        user_prompt: gitDiff
    }

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const message = response.data;
      // have to check the returned message from flowise, it's not documented in their api page

      return message;
    } catch (err: any) {
      const message = err.response?.data?.error ?? err.message;
      throw new Error('local model issues. details: ' + message);
    }
  }
}