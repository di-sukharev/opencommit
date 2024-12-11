import axios from 'axios';
import { Mistral } from '@mistralai/mistralai';
import { OpenAI } from 'openai';
import { GenerateCommitMessageErrorEnum } from '../generateCommitMessageFromGitDiff';
import { tokenCount } from '../utils/tokenCount';
import { AiEngine, AiEngineConfig } from './Engine';
import {
  AssistantMessage as MistralAssistantMessage,
  SystemMessage as MistralSystemMessage,
  ToolMessage as MistralToolMessage,
  UserMessage as MistralUserMessage
} from '@mistralai/mistralai/models/components';

export interface MistralAiConfig extends AiEngineConfig {}
export type MistralCompletionMessageParam = Array<
| (MistralSystemMessage & { role: "system" })
| (MistralUserMessage & { role: "user" })
| (MistralAssistantMessage & { role: "assistant" })
| (MistralToolMessage & { role: "tool" })
>

export class MistralAiEngine implements AiEngine {
  config: MistralAiConfig;
  client: Mistral;

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

      return message.content as string;
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
