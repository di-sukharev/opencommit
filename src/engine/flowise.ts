import axios, { AxiosError } from 'axios';
import { ChatCompletionRequestMessage } from 'openai';
import { AiEngine } from './Engine';

import {
  getConfig
} from '../commands/config';

const config = getConfig();

export class FlowiseAi implements AiEngine {

  async generateCommitMessage(
    messages: Array<ChatCompletionRequestMessage>
  ): Promise<string | undefined> {

    const gitDiff = messages[ messages.length - 1 ]?.content?.replace(/\\/g, '\\\\')  
                                                            .replace(/"/g, '\\"')    
                                                            .replace(/\n/g, '\\n')   
                                                            .replace(/\r/g, '\\r')   
                                                            .replace(/\t/g, '\\t');  
    const url = `http://${config?.OCO_FLOWISE_ENDPOINT}/api/v1/prediction/${config?.OCO_FLOWISE_API_KEY}`; 
    const payload = {
        question : gitDiff,
        overrideConfig : {
          systemMessagePrompt: messages[0]?.content,
        },
        history : messages.slice( 1, -1 ) 
    }
    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const message = response.data;
      return message?.text;
    } catch (err: any) {
      const message = err.response?.data?.error ?? err.message;
      throw new Error('local model issues. details: ' + message);
    }
  }
}
