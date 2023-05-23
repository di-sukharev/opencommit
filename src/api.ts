import { intro, outro } from '@clack/prompts';
import axios from 'axios';
import chalk from 'chalk';
import {
  ChatCompletionRequestMessage,
  Configuration as OpenAiApiConfiguration,
  OpenAIApi
} from 'openai';

import { CONFIG_MODES, getConfig } from './commands/config';
import { execaCommandSync } from 'execa';

const config = getConfig();

let maxTokens = config?.OCO_OPENAI_MAX_TOKENS;
let basePath = config?.OCO_OPENAI_BASE_PATH;
let apiKey = config?.OCO_OPENAI_API_KEY;

const [command, mode] = process.argv.slice(2);

if (!apiKey && command !== 'config' && mode !== CONFIG_MODES.set) {
  intro('opencommit');

  outro(
    'OCO_OPENAI_API_KEY is not set, please run `oc config set OCO_OPENAI_API_KEY=<your token>. Make sure you add payment details, so API works.`'
  );
  outro(
    'For help look into README https://github.com/di-sukharev/opencommit#setup'
  );

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
    messages: Array<ChatCompletionRequestMessage>
  ): Promise<string | undefined> => {
    const params = {
      model: MODEL,
      messages,
      temperature: 0,
      top_p: 0.1,
      max_tokens: maxTokens || 500
    };
    try {
      const { data } = await this.openAI.createChatCompletion(params);

      const message = data.choices[0].message;

      const prefix = generatePrefix();
      const usePrefix = prefix != undefined && prefix?.trim() != ""

      const finalMessage = (usePrefix ? prefix + ' ' : '') + (message?.content || '')

      return finalMessage;

    } catch (error) {
      outro(`${chalk.red('✖')} ${JSON.stringify(params)}`);

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

export const getOpenCommitLatestVersion = async (): Promise<
  string | undefined
> => {
  try {
    const { data } = await axios.get(
      'https://unpkg.com/opencommit/package.json'
    );
    return data.version;
  } catch (_) {
    outro('Error while getting the latest version of opencommit');
    return undefined;
  }
};

function generatePrefix(): string | undefined {
  const prefix = config?.OCO_PREFIX

  if (prefix === undefined) {
    return undefined;
  }

  const prefixIsRegexString = prefix.startsWith('/') && prefix.endsWith('/');

  if (prefixIsRegexString) {
    try {
      return generatePrefixFromRegex(prefix);
    } catch (error) {
      console.error(`Failed to generate prefix from regex: ${error}`);
      return undefined;
    }
  }

  return prefix;
}

export const api = new OpenAi();


function generatePrefixFromRegex(regex: string): string | undefined {

  // We currently only support regex input from git branch name

  const branch = getCurrentGitBranch();

  if (branch === undefined) {
    return undefined;
  }

  const regexWithoutSlashes = regex.slice(1, -1);
  const regexObject = new RegExp(regexWithoutSlashes);
  const match = branch.match(regexObject);

  if (match === null) {
    return undefined;
  }

  return match.length > 1 ? match[1] : match[0];
}

function getCurrentGitBranch(): string | undefined {
  try {
    const branchName = execaCommandSync('git symbolic-ref --short HEAD').stdout.trim()
    return branchName;
  } catch (error) {
    console.error(`Failed to get current git branch: ${error}`);
    return undefined;
  }
}