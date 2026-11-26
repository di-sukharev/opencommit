import { OpenAI } from 'openai';
import { parseCustomHeaders } from '../utils/customHeaders';
import { normalizeEngineError } from '../utils/engineErrorHandler';
import { ApiKeyMissingError } from '../utils/errors';
import { GenerateCommitMessageErrorEnum } from '../utils/generateCommitMessageErrors';
import { createProxyFetch } from '../utils/proxy';
import { removeContentTags } from '../utils/removeContentTags';
import { tokenCount } from '../utils/tokenCount';
import { AiEngine, AiEngineConfig } from './Engine';

export interface OpenAiConfig extends AiEngineConfig {}

export class OpenAiEngine implements AiEngine {
  config: OpenAiConfig;
  client: OpenAI;

  /**
   * Provider name used for error normalization. Subclasses for other
   * OpenAI-compatible APIs pass their name to the constructor so errors are
   * attributed to the right provider without re-implementing the request path.
   */
  protected providerName = 'openai';
  protected useSamplingParameters = true;

  constructor(config: OpenAiConfig, compatibleProvider?: string) {
    this.config = config;

    const clientOptions: OpenAI.ClientOptions = {
      apiKey: config.apiKey
    };

    if (compatibleProvider) {
      if (typeof config.apiKey !== 'string' || !config.apiKey.trim()) {
        throw new ApiKeyMissingError(compatibleProvider);
      }
      this.providerName = compatibleProvider;
      // Avoid the SDK's OpenAI environment defaults for this provider.
      clientOptions.organization = null;
      clientOptions.project = null;
    }

    if (config.baseURL) {
      clientOptions.baseURL = config.baseURL;
    }

    if (config.customHeaders) {
      const headers = parseCustomHeaders(config.customHeaders);
      if (Object.keys(headers).length > 0) {
        clientOptions.defaultHeaders = headers;
      }
    }

    // Use the native fetch, resolved at call time, instead of the SDK's
    // bundled fetch, which can fail early in some Node.js versions. The native
    // fetch ignores `httpAgent`, so the proxy goes through its dispatcher.
    clientOptions.fetch = createProxyFetch(config.proxy);

    this.client = new OpenAI(clientOptions);
  }

  public generateCommitMessage = async (
    messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>
  ): Promise<string | null> => {
    const isReasoningModel =
      typeof this.config.isReasoning === 'boolean'
        ? this.config.isReasoning
        : /^(o[1-9]|gpt-5)/.test(this.config.model);

    const reasoningTokens = this.config.tokensMaxReasoning || 1000;

    const params = {
      model: this.config.model,
      messages,
      ...(isReasoningModel
        ? { max_completion_tokens: reasoningTokens }
        : {
            max_tokens: this.config.maxTokensOutput,
            ...(this.useSamplingParameters
              ? { temperature: 0, top_p: 0.1 }
              : {})
          })
    };

    try {
      const REQUEST_TOKENS = messages
        .map((msg) => tokenCount(msg.content as string) + 4)
        .reduce((a, b) => a + b, 0);

      const maxInputLimit = this.config.maxTokensInput;

      const maxOutPutLimit = isReasoningModel
        ? reasoningTokens
        : this.config.maxTokensOutput;

      if (REQUEST_TOKENS > maxInputLimit - maxOutPutLimit)
        throw new Error(GenerateCommitMessageErrorEnum.tooMuchTokens);

      const completion = await this.client.chat.completions.create(
        params as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
      );

      const message = completion.choices[0].message;
      let content = message?.content;
      return removeContentTags(content, 'think');
    } catch (error) {
      throw normalizeEngineError(error, this.providerName, this.config.model);
    }
  };
}
