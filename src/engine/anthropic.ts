import axios from 'axios';
import chalk from 'chalk';

import Anthropic from '@anthropic-ai/sdk';
import {ChatCompletionRequestMessage} from 'openai'
import { MessageCreateParamsNonStreaming, MessageParam } from '@anthropic-ai/sdk/resources';

import { intro, outro } from '@clack/prompts';

import {
  CONFIG_MODES,
  DEFAULT_TOKEN_LIMITS,
  getConfig
} from '../commands/config';
import { GenerateCommitMessageErrorEnum } from '../generateCommitMessageFromGitDiff';
import { tokenCount } from '../utils/tokenCount';
import { AiEngine } from './Engine';
import { MODEL_LIST } from '../commands/config';

const config = getConfig();

const MAX_TOKENS_OUTPUT =
  config?.OCO_TOKENS_MAX_OUTPUT ||
  DEFAULT_TOKEN_LIMITS.DEFAULT_MAX_TOKENS_OUTPUT;
const MAX_TOKENS_INPUT =
  config?.OCO_TOKENS_MAX_INPUT || DEFAULT_TOKEN_LIMITS.DEFAULT_MAX_TOKENS_INPUT;

let provider = config?.OCO_AI_PROVIDER;
let apiKey = config?.OCO_ANTHROPIC_API_KEY;
const [command, mode] = process.argv.slice(2);
if (
  provider === 'anthropic' &&
  !apiKey &&
  command !== 'config' &&
  mode !== CONFIG_MODES.set
) {
  intro('opencommit');

  outro(
    'OCO_ANTHROPIC_API_KEY is not set, please run `oco config set OCO_ANTHROPIC_API_KEY=<your token> . If you are using Claude, make sure you add payment details, so API works.`'
  );
  outro(
    'For help look into README https://github.com/di-sukharev/opencommit#setup'
  );

  process.exit(1);
}

const MODEL = config?.OCO_MODEL;
if (provider === 'anthropic' &&
    !MODEL_LIST.anthropic.includes(MODEL) &&
    command !== 'config' &&
    mode !== CONFIG_MODES.set) {
  outro(
    `${chalk.red('✖')} Unsupported model ${MODEL} for Anthropic. Supported models are: ${MODEL_LIST.anthropic.join(
      ', '
    )}`
  );
  process.exit(1);
}

export class AnthropicAi implements AiEngine {
  private anthropicAiApiConfiguration = {
    apiKey: apiKey
  };
  private anthropicAI!: Anthropic;

  constructor() {
    this.anthropicAI = new Anthropic(this.anthropicAiApiConfiguration);
  }

  public generateCommitMessage = async (
    messages: Array<ChatCompletionRequestMessage>
  ): Promise<string | undefined> => {

    const systemMessage = messages.find(msg => msg.role === 'system')?.content as string;
    const restMessages = messages.filter((msg) => msg.role !== 'system') as MessageParam[];

    const params: MessageCreateParamsNonStreaming = {
      model: MODEL,
      system: systemMessage,
      messages: restMessages,
      temperature: 0,
      top_p: 0.1,
      max_tokens: MAX_TOKENS_OUTPUT
    };
    try {
      const REQUEST_TOKENS = messages
        .map((msg) => tokenCount(msg.content as string) + 4)
        .reduce((a, b) => a + b, 0);

      if (REQUEST_TOKENS > MAX_TOKENS_INPUT - MAX_TOKENS_OUTPUT) {
        throw new Error(GenerateCommitMessageErrorEnum.tooMuchTokens);
      }

      const data  = await this.anthropicAI.messages.create(params);

      const message = data?.content[0].text;

      return message;
    } catch (error) {
      outro(`${chalk.red('✖')} ${JSON.stringify(params)}`);

      const err = error as Error;
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

      throw err;
    }
  };
}
