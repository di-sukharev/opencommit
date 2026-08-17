import { OpenAI } from 'openai';
import { normalizeEngineError } from '../utils/engineErrorHandler';
import { GenerateCommitMessageErrorEnum } from '../utils/generateCommitMessageErrors';
import { removeContentTags } from '../utils/removeContentTags';
import { tokenCount } from '../utils/tokenCount';
import { OpenAiEngine, OpenAiConfig } from './openAi';

export interface DeepseekConfig extends OpenAiConfig {}

export class DeepseekEngine extends OpenAiEngine {
  constructor(config: DeepseekConfig) {
    // Call OpenAIEngine constructor with forced Deepseek baseURL
    // Put baseURL first so user config can override it
    super({
      baseURL: 'https://api.deepseek.com/v1',
      ...config
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
      return removeContentTags(content, 'think');
    } catch (error) {
      throw normalizeEngineError(error, 'deepseek', this.config.model);
    }
  };
}
