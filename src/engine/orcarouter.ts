import { OpenAI } from 'openai';
import { normalizeEngineError } from '../utils/engineErrorHandler';
import { GenerateCommitMessageErrorEnum } from '../utils/generateCommitMessageErrors';
import { removeContentTags } from '../utils/removeContentTags';
import { tokenCount } from '../utils/tokenCount';
import { OpenAiEngine, OpenAiConfig } from './openAi';

export interface OrcaRouterConfig extends OpenAiConfig {}

export class OrcaRouterEngine extends OpenAiEngine {
  constructor(config: OrcaRouterConfig) {
    // Call OpenAIEngine constructor with forced OrcaRouter baseURL
    // Put baseURL first so user config can override it
    super({
      baseURL: 'https://api.orcarouter.ai/v1',
      ...config
    });
  }

  // Identical method from OpenAiEngine, re-implemented here
  public generateCommitMessage = async (
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
  ): Promise<string | null> => {
    const isReasoningModel = /^(o[1-9]|gpt-5)/.test(this.config.model);

    const params = {
      model: this.config.model,
      messages,
      ...(isReasoningModel
        ? { max_completion_tokens: this.config.maxTokensOutput }
        : {
            temperature: 0,
            top_p: 0.1,
            max_tokens: this.config.maxTokensOutput
          })
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

      const completion = await this.client.chat.completions.create(
        params as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
      );

      const message = completion.choices[0].message;
      let content = message?.content;
      return removeContentTags(content, 'think');
    } catch (error) {
      throw normalizeEngineError(error, 'orcarouter', this.config.model);
    }
  };
}
