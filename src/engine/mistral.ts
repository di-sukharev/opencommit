import axios from 'axios';
import { OpenAI } from 'openai';
import { GenerateCommitMessageErrorEnum } from '../generateCommitMessageFromGitDiff';
import { removeContentTags } from '../utils/removeContentTags';
import { tokenCount } from '../utils/tokenCount';
import { AiEngine, AiEngineConfig } from './Engine';

// Using any for Mistral types to avoid type declaration issues
export interface MistralAiConfig extends AiEngineConfig {}
export type MistralCompletionMessageParam = Array<any>;

// Import Mistral dynamically to avoid TS errors
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Mistral = require('@mistralai/mistralai').Mistral;

export class MistralAiEngine implements AiEngine {
  config: MistralAiConfig;
  client: any; // Using any type for Mistral client to avoid TS errors

  constructor(config: MistralAiConfig) {
    this.config = config;

    if (!config.baseURL) {
      this.client = new Mistral({ apiKey: config.apiKey });
    } else {
      this.client = new Mistral({ apiKey: config.apiKey, serverURL: config.baseURL });
    }
  }

  public generateCommitMessage = async (
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
  ): Promise<string | null> => {
    const params = {
      model: this.config.model,
      messages: messages as MistralCompletionMessageParam,
      topP: 0.1,
      maxTokens: this.config.maxTokensOutput
    };

    try {
      const REQUEST_TOKENS = messages
        .map((msg) => tokenCount(msg.content as string) + 4)
        .reduce((a, b) => a + b, 0);

      if (
        REQUEST_TOKENS >
        this.config.maxTokensInput - this.config.maxTokensOutput
      )
        throw new Error(GenerateCommitMessageErrorEnum.tooMuchTokens);

      const completion = await this.client.chat.complete(params);

      if (!completion.choices)
        throw Error('No completion choice available.')
      
      const message = completion.choices[0].message;

      if (!message || !message.content)
        throw Error('No completion choice available.')

      let content = message.content as string;
      return removeContentTags(content, 'think');
    } catch (error) {
      const err = error as Error;
      if (
        axios.isAxiosError<{ error?: { message: string } }>(error) &&
        error.response?.status === 401
      ) {
        const mistralError = error.response.data.error;

        if (mistralError) throw new Error(mistralError.message);
      }

      throw err;
    }
  };
}
