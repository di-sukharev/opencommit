import {
  AzureKeyCredential,
  OpenAIClient as AzureOpenAIClient
} from '@azure/openai';
import { outro } from '@clack/prompts';
import axios from 'axios';
import chalk from 'chalk';
import { OpenAI } from 'openai';
import { GenerateCommitMessageErrorEnum } from '../generateCommitMessageFromGitDiff';
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
      
      if (content && content.includes('<think>')) {
        return content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      }
      
      return content;
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
