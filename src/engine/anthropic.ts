import AnthropicClient from '@anthropic-ai/sdk';
import {
  MessageCreateParamsNonStreaming,
  MessageParam
} from '@anthropic-ai/sdk/resources/messages.mjs';
import { outro } from '@clack/prompts';
import axios from 'axios';
import chalk from 'chalk';
import { OpenAI } from 'openai';
import { GenerateCommitMessageErrorEnum } from '../generateCommitMessageFromGitDiff';
import { ModelNotFoundError } from '../utils/errors';
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
      top_p: 0.1,
      max_tokens: this.config.maxTokensOutput
    };
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
      const err = error as Error;

      // Check for model not found errors
      if (err.message?.toLowerCase().includes('model') &&
          (err.message?.toLowerCase().includes('not found') ||
           err.message?.toLowerCase().includes('does not exist') ||
           err.message?.toLowerCase().includes('invalid'))) {
        throw new ModelNotFoundError(this.config.model, 'anthropic', 404);
      }

      // Check for 404 errors
      if ('status' in (error as any) && (error as any).status === 404) {
        throw new ModelNotFoundError(this.config.model, 'anthropic', 404);
      }

      outro(`${chalk.red('✖')} ${err?.message || err}`);

      if (
        axios.isAxiosError<{ error?: { message: string } }>(error) &&
        error.response?.status === 401
      ) {
        const anthropicAiError = error.response.data.error;

        if (anthropicAiError?.message) outro(anthropicAiError.message);
        outro(
          'For help look into README https://github.com/di-sukharev/opencommit#setup'
        );
      }

      // Check axios 404 errors
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new ModelNotFoundError(this.config.model, 'anthropic', 404);
      }

      throw err;
    }
  };
}
