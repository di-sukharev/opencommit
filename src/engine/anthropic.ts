import AnthropicClient from '@anthropic-ai/sdk';
import { HttpsProxyAgent } from 'https-proxy-agent';
import {
  MessageCreateParamsNonStreaming,
  MessageParam
} from '@anthropic-ai/sdk/resources/messages.mjs';
import { OpenAI } from 'openai';
import { normalizeEngineError } from '../utils/engineErrorHandler';
import { GenerateCommitMessageErrorEnum } from '../utils/generateCommitMessageErrors';
import { removeContentTags } from '../utils/removeContentTags';
import { tokenCount } from '../utils/tokenCount';
import { AiEngine, AiEngineConfig } from './Engine';

interface AnthropicConfig extends AiEngineConfig {}

// The API supports thinking, but the field is absent from SDK 0.19 types.
type AnthropicMessageParams = MessageCreateParamsNonStreaming & {
  thinking?: { type: 'disabled' };
};

function validateHaiku55StopReason(stopReason?: string | null): void {
  switch (stopReason) {
    case 'refusal':
      throw new Error('Anthropic refused to generate a commit message.');
    case 'max_tokens':
      throw new Error(
        'Anthropic response was truncated. Increase OCO_TOKENS_MAX_OUTPUT.'
      );
    case 'model_context_window_exceeded':
      throw new Error(
        'Anthropic response reached the context window limit. Reduce the input diff.'
      );
  }
}

export class AnthropicEngine implements AiEngine {
  config: AnthropicConfig;
  client: AnthropicClient;

  constructor(config) {
    this.config = config;
    const clientOptions: any = { apiKey: this.config.apiKey };

    if (this.config.baseURL) {
      clientOptions.baseURL = this.config.baseURL;
    }

    const proxy = config.proxy;
    if (proxy) {
      clientOptions.httpAgent = new HttpsProxyAgent(proxy);
    }

    this.client = new AnthropicClient(clientOptions);
  }

  public generateCommitMessage = async (
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
  ): Promise<string | undefined> => {
    const systemMessage = messages.find((msg) => msg.role === 'system')
      ?.content as string;
    const restMessages = messages.filter(
      (msg) => msg.role !== 'system'
    ) as MessageParam[];

    const isHaiku55 = this.config.model === 'claude-haiku-5-5';
    const params: AnthropicMessageParams = {
      model: this.config.model,
      system: systemMessage,
      messages: restMessages,
      max_tokens: this.config.maxTokensOutput
    };

    if (isHaiku55) {
      // Haiku 5.5 rejects custom sampling and enables thinking by default.
      // Preserve the existing non-thinking behavior and configured output budget.
      // https://platform.claude.com/docs/en/models/haiku-5-5/migration-guide
      params.thinking = { type: 'disabled' };
    } else {
      params.temperature = 0;
      // Preserve the existing sampling settings for older and custom models.
      if (!/claude.*-4-(?:5|[6-9])/.test(params.model)) {
        params.top_p = 0.1;
      }
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

      if (isHaiku55) validateHaiku55StopReason(data?.stop_reason);

      const textBlock = data?.content?.find((b) => b.type === 'text');
      const message =
        textBlock && 'text' in textBlock ? textBlock.text : undefined;
      const content = removeContentTags(message, 'think');

      if (isHaiku55 && !content) {
        throw new Error(GenerateCommitMessageErrorEnum.emptyMessage);
      }

      return content;
    } catch (error) {
      throw normalizeEngineError(error, 'anthropic', this.config.model);
    }
  };
}
