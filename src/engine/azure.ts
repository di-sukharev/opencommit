import axios from 'axios';
import chalk from 'chalk';
import { execa } from 'execa';
import {
  ChatCompletionRequestMessage,
} from 'openai';

import { OpenAIClient, AzureKeyCredential } from '@azure/openai';

import { intro, outro } from '@clack/prompts';

import {
  CONFIG_MODES,
  DEFAULT_TOKEN_LIMITS,
  getConfig
} from '../commands/config';
import { GenerateCommitMessageErrorEnum } from '../generateCommitMessageFromGitDiff';
import { tokenCount } from '../utils/tokenCount';
import { AiEngine } from './Engine';

const config = getConfig();

const MAX_TOKENS_OUTPUT =
  config?.OCO_TOKENS_MAX_OUTPUT ||
  DEFAULT_TOKEN_LIMITS.DEFAULT_MAX_TOKENS_OUTPUT;
const MAX_TOKENS_INPUT =
  config?.OCO_TOKENS_MAX_INPUT || DEFAULT_TOKEN_LIMITS.DEFAULT_MAX_TOKENS_INPUT;
let basePath = config?.OCO_OPENAI_BASE_PATH;
let apiKey = config?.OCO_AZURE_API_KEY;
let apiEndpoint = config?.OCO_AZURE_ENDPOINT;

const [command, mode] = process.argv.slice(2);

const provider = config?.OCO_AI_PROVIDER;

if (
  provider === 'azure' &&
  !apiKey &&
  !apiEndpoint &&
  command !== 'config' &&
  mode !== CONFIG_MODES.set
) {
  intro('opencommit');

  outro(
    'OCO_AZURE_API_KEY or OCO_AZURE_ENDPOINT are not set, please run `oco config set OCO_AZURE_API_KEY=<your token> . If you are using GPT, make sure you add payment details, so API works.`'
  );
  outro(
    'For help look into README https://github.com/di-sukharev/opencommit#setup'
  );

  process.exit(1);
}

const MODEL = config?.OCO_MODEL || 'gpt-3.5-turbo';

export class Azure implements AiEngine {
  private openAI!: OpenAIClient;

  constructor() {
    if (provider === 'azure') {
      this.openAI = new OpenAIClient(apiEndpoint, new AzureKeyCredential(apiKey));
    }
  }

  public generateCommitMessage = async (
    messages: Array<ChatCompletionRequestMessage>
  ): Promise<string | undefined> => {
    try {
      const REQUEST_TOKENS = messages
        .map((msg) => tokenCount(msg.content) + 4)
        .reduce((a, b) => a + b, 0);

      if (REQUEST_TOKENS > MAX_TOKENS_INPUT - MAX_TOKENS_OUTPUT) {
        throw new Error(GenerateCommitMessageErrorEnum.tooMuchTokens);
      }

      const data = await this.openAI.getChatCompletions(MODEL, messages);

      const message = data.choices[0].message;

      if (message?.content === null) {
        return undefined;
      }
      return message?.content;
    } catch (error) {
      outro(`${chalk.red('✖')} ${MODEL}`);

      const err = error as Error;
      outro(`${chalk.red('✖')} ${err?.message || err}`);

      if (
        axios.isAxiosError<{ error?: { message: string } }>(error) &&
        error.response?.status === 401
      ) {
        const openAiError = error.response.data.error;

        if (openAiError?.message) outro(openAiError.message);
        outro(
          'For help look into README https://github.com/di-sukharev/opencommit#setup'
        );
      }

      throw err;
    }
  };
}

export const azure = new Azure();
