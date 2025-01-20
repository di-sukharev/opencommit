import { AzureOpenAI } from 'openai';
import { outro } from '@clack/prompts';
import axios from 'axios';
import chalk from 'chalk';
import { OpenAI } from 'openai';
import { GenerateCommitMessageErrorEnum } from '../generateCommitMessageFromGitDiff';
import { tokenCount } from '../utils/tokenCount';
import { AiEngine, AiEngineConfig } from './Engine';
import { getHttpAgent } from '../utils/httpAgent';

interface AzureAiEngineConfig extends AiEngineConfig {
  baseURL: string;
  apiKey: string;
  apiVersion: string;
}

export class AzureEngine implements AiEngine {
  config: AzureAiEngineConfig;
  client: OpenAI;

  constructor(config: AzureAiEngineConfig) {
    this.config = config;
    const options = {
      endpoint: this.config.baseURL,
      apiKey: this.config.apiKey,
      apiVersion: this.config.apiVersion,
      httpAgent: getHttpAgent(this.config.baseURL)
    };
    this.client = new AzureOpenAI(options);
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
      const data = await this.client.chat.completions.create({
        messages,
        model: this.config.model
      });

      const message = data.choices[0].message;

      if (message?.content === null) {
        return undefined;
      }
      return message?.content;
    } catch (error) {
      outro(`${chalk.red('✖')} ${this.config.model}`);

      const err = error as Error;
      outro(`${chalk.red('✖')} ${JSON.stringify(error)}`);

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
