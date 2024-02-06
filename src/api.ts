import axios from 'axios';
import chalk from 'chalk';
import { execa } from 'execa';

import OpenAI from 'openai';

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
  outro('For help look into README https://github.com/bodrick/opencommit#setup');

  process.exit(1);
}

const MODEL = config?.OCO_MODEL || 'gpt-3.5-turbo';

export function getTokenCount(messages: OpenAI.Chat.ChatCompletionMessageParam[]) {
  let sum = 0;
  for (const message of messages) {
    if (typeof message.content === 'string') {
      sum += tokenCount(message.content) + 4;
    } else if (Array.isArray(message.content)) {
      for (const content of message.content) {
        if (content.type === 'text') {
          sum += tokenCount(content.text) + 4;
        }
      }
    }
  }

  return sum;
}

class OpenAi {
  private openAI!: OpenAI;

  constructor() {
    this.openAI = new OpenAI({
      apiKey,
      baseURL: basePath
    });
  }

  public generateCommitMessage = async (
    messages: OpenAI.Chat.ChatCompletionMessageParam[]
  ): Promise<string | null> => {
    const chatCompletionParameters = {
      max_tokens: maxTokens || 500,
      messages,
      model: MODEL,
      temperature: 0,
      top_p: 0.1
    };
    try {
      const REQUEST_TOKENS = getTokenCount(messages);

      if (REQUEST_TOKENS > DEFAULT_MODEL_TOKEN_LIMIT - maxTokens) {
        throw new Error(GenerateCommitMessageErrorEnum.tooMuchTokens);
      }

      const completion = await this.openAI.chat.completions.create(chatCompletionParameters);

      const message = completion.choices[0].message;

      return message.content;
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
        outro('For help look into README https://github.com/bodrick/opencommit#setup');
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
