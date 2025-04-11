import axios from 'axios';
import { OpenAI } from 'openai';
import { GenerateCommitMessageErrorEnum } from '../generateCommitMessageFromGitDiff';
import { tokenCount } from '../utils/tokenCount';
import { OpenAiEngine, OpenAiConfig } from './openAi';

export interface DeepseekConfig extends OpenAiConfig {}

export class DeepseekEngine extends OpenAiEngine {
  constructor(config: DeepseekConfig) {
    // Call OpenAIEngine constructor with forced Deepseek baseURL
    super({
      ...config,
      baseURL: 'https://api.deepseek.com/v1'
    });
  }

  // Identical method from OpenAiEngine, re-implemented here
  public generateCommitMessage = async (
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
  ): Promise<string | null> => {
    const params = {
      model: this.config.model,
      messages,
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
      )
        throw new Error(GenerateCommitMessageErrorEnum.tooMuchTokens);

      const completion = await this.client.chat.completions.create(params);

      const message = completion.choices[0].message;
      let content = message?.content;

      if (content && content.includes('<think>')) {
        return content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      }

      return content;
    } catch (error) {
      const err = error as Error;
      if (
        axios.isAxiosError<{ error?: { message: string } }>(error) &&
        error.response?.status === 401
      ) {
        const openAiError = error.response.data.error;

        if (openAiError) throw new Error(openAiError.message);
      }

      throw err;
    }
  };
}
