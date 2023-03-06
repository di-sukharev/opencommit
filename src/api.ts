import { intro, outro, text } from '@clack/prompts';
import {
  ChatCompletionRequestMessage,
  ChatCompletionResponseMessage,
  Configuration as OpenAiApiConfiguration,
  OpenAIApi
} from 'openai';

import { CONFIG_KEYS, getConfig, setConfig } from './commands/config';

const config = getConfig();

let apiKey = config?.OPENAI_API_KEY;

if (!apiKey) {
  intro('opencommit');
  const apiKey = await text({
    message: 'input your OPENAI_API_KEY'
  });

  setConfig([[CONFIG_KEYS.OPENAI_API_KEY as string, apiKey as any]]);

  outro('OPENAI_API_KEY is set');
}

class OpenAi {
  private openAiApiConfiguration = new OpenAiApiConfiguration({
    apiKey: apiKey
  });

  private openAI = new OpenAIApi(this.openAiApiConfiguration);

  public generateCommitMessage = async (
    messages: Array<ChatCompletionRequestMessage>
  ): Promise<ChatCompletionResponseMessage | undefined> => {
    try {
      const { data } = await this.openAI.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages,
        temperature: 0,
        top_p: 0.1,
        max_tokens: 196
      });

      const message = data.choices[0].message;

      return message;
    } catch (error) {
      console.error('openAI api error', { error });
      throw error;
    }
  };
}

export const api = new OpenAi();
