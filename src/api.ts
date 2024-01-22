import axios from 'axios';
import chalk from 'chalk';
import { execa } from 'execa';
import {
  type ChatCompletionRequestMessage,
  Configuration as OpenAiApiConfiguration,
  OpenAIApi
} from 'openai';

import { intro, outro } from '@clack/prompts';

import { CONFIG_MODES, DEFAULT_MODEL_TOKEN_LIMIT, getConfig } from './commands/config';
import { GenerateCommitMessageErrorEnum } from './generate-commit-message-from-git-diff';
import { tokenCount } from './utils/token-count';

const config = getConfig();

const maxTokens = config?.OCO_OPENAI_MAX_TOKENS;
const basePath = config?.OCO_OPENAI_BASE_PATH;
const apiKey = config?.OCO_OPENAI_API_KEY;

const [command, mode] = process.argv.slice(2);

if (!apiKey && command !== 'config' && mode !== CONFIG_MODES.set) {
  intro('opencommit');

  outro(
    'OCO_OPENAI_API_KEY is not set, please run `oco config set OCO_OPENAI_API_KEY=<your token>. Make sure you add payment details, so API works.`'
  );
  outro('For help look into README https://github.com/di-sukharev/opencommit#setup');

  process.exit(1);
}

const MODEL = config?.OCO_MODEL || 'gpt-3.5-turbo';

class OpenAi {
  private openAiApiConfiguration = new OpenAiApiConfiguration({
    apiKey: apiKey
  });
  private openAI!: OpenAIApi;

  constructor() {
    if (basePath) {
      this.openAiApiConfiguration.basePath = basePath;
    }
    this.openAI = new OpenAIApi(this.openAiApiConfiguration);
  }

  public generateCommitMessage = async (
    messages: ChatCompletionRequestMessage[]
  ): Promise<string | undefined> => {
    const chatCompletionParameters = {
      model: MODEL,
      messages,
      temperature: 0,
      top_p: 0.1,
      max_tokens: maxTokens || 500
    };
    try {
      const REQUEST_TOKENS = messages
        .map(
          (chatCompletionRequestMessage) =>
            tokenCount(chatCompletionRequestMessage.content ?? '') + 4
        )
        .reduce((a, b) => a + b, 0);

      if (REQUEST_TOKENS > DEFAULT_MODEL_TOKEN_LIMIT - maxTokens) {
        throw new Error(GenerateCommitMessageErrorEnum.tooMuchTokens);
      }

      const { data } = await this.openAI.createChatCompletion(chatCompletionParameters);

      const message = data.choices[0].message;

      return message?.content;
    } catch (error) {
      outro(`${chalk.red('✖')} ${JSON.stringify(chatCompletionParameters)}`);

      const errorMessage = error instanceof Error ? error.message : '';
      outro(`${chalk.red('✖')} ${errorMessage}`);

      if (
        axios.isAxiosError<{ error?: { message: string } }>(error) &&
        error.response?.status === 401
      ) {
        const openAiError = error.response.data.error;

        if (openAiError?.message) outro(openAiError.message);
        outro('For help look into README https://github.com/di-sukharev/opencommit#setup');
      }

      throw error;
    }
  };
}

export const getOpenCommitLatestVersion = async (): Promise<string | undefined> => {
  try {
    const { stdout } = await execa('npm', ['view', 'opencommit', 'version']);
    return stdout;
  } catch {
    outro('Error while getting the latest version of opencommit');
    return undefined;
  }
};

export const api = new OpenAi();
