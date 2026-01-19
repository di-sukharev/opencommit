import AnthropicClient from '@anthropic-ai/sdk';
import {
  MessageCreateParamsNonStreaming,
  MessageParam
} from '@anthropic-ai/sdk/resources/messages.mjs';
import { OpenAI } from 'openai';
import { GenerateCommitMessageErrorEnum } from '../generateCommitMessageFromGitDiff';
import { normalizeEngineError } from '../utils/engineErrorHandler';
import { removeContentTags } from '../utils/removeContentTags';
import { tokenCount } from '../utils/tokenCount';
import { AiEngine, AiEngineConfig } from './Engine';

interface AnthropicConfig extends AiEngineConfig {}

export class AnthropicEngine implements AiEngine {
  config: AnthropicConfig;
  client: AnthropicClient;

  constructor(config) {
    this.config = config;
    this.client = new AnthropicClient({ apiKey: this.config.apiKey });
  }

  public generateCommitMessage = async (
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
  ): Promise<string | undefined> => {
    const systemMessage = messages.find((msg) => msg.role === 'system')
      ?.content as string;
    const restMessages = messages.filter(
      (msg) => msg.role !== 'system'
    ) as MessageParam[];

    const params: MessageCreateParamsNonStreaming = {
      model: this.config.model,
      system: systemMessage,
      messages: restMessages,
      temperature: 0,
      max_tokens: this.config.maxTokensOutput
    };

    // add top_p for non-4.5 models
    if (!/claude.*-4-5/.test(params.model)) {
      params.top_p = 0.1;
    }

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

      const data = await this.client.messages.create(params);

      const message = data?.content[0].text;
      let content = message;
      return removeContentTags(content, 'think');
    } catch (error) {
      throw normalizeEngineError(error, 'anthropic', this.config.model);
    }
  };
}
