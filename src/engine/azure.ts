import {
  AzureKeyCredential,
  OpenAIClient as AzureOpenAIClient
} from '@azure/openai';
import { OpenAI } from 'openai';
import { GenerateCommitMessageErrorEnum } from '../generateCommitMessageFromGitDiff';
import { normalizeEngineError } from '../utils/engineErrorHandler';
import { removeContentTags } from '../utils/removeContentTags';
import { tokenCount } from '../utils/tokenCount';
import { AiEngine, AiEngineConfig } from './Engine';

interface AzureAiEngineConfig extends AiEngineConfig {
  baseURL: string;
  apiKey: string;
}

export class AzureEngine implements AiEngine {
  config: AzureAiEngineConfig;
  client: AzureOpenAIClient;

  constructor(config: AzureAiEngineConfig) {
    this.config = config;
    this.client = new AzureOpenAIClient(
      this.config.baseURL,
      new AzureKeyCredential(this.config.apiKey)
    );
  }

  generateCommitMessage = async (
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
  ): Promise<string | undefined> => {
    try {
      const REQUEST_TOKENS = messages
        .map((msg) => tokenCount(msg.content as string) + 4)
        .reduce((a, b) => a + b, 0);

      if (
        REQUEST_TOKENS >
        this.config.maxTokensInput - this.config.maxTokensOutput
      ) {
        throw new Error(GenerateCommitMessageErrorEnum.tooMuchTokens);
      }

      const data = await this.client.getChatCompletions(
        this.config.model,
        messages
      );

      const message = data.choices[0].message;

      if (message?.content === null) {
        return undefined;
      }

      let content = message?.content;
      return removeContentTags(content, 'think');
    } catch (error) {
      throw normalizeEngineError(error, 'azure', this.config.model);
    }
  };
}
