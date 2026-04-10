import { OpenAI } from 'openai';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { parseCustomHeaders } from '../utils/customHeaders';
import { normalizeEngineError } from '../utils/engineErrorHandler';
import { GenerateCommitMessageErrorEnum } from '../utils/generateCommitMessageErrors';
import { removeContentTags } from '../utils/removeContentTags';
import { tokenCount } from '../utils/tokenCount';
import { AiEngine, AiEngineConfig } from './Engine';

export interface OpenAiConfig extends AiEngineConfig {}

export class OpenAiEngine implements AiEngine {
  config: OpenAiConfig;
  client: OpenAI;

  constructor(config: OpenAiConfig) {
    this.config = config;

    const clientOptions: OpenAI.ClientOptions = {
      apiKey: config.apiKey
    };

    if (config.baseURL) {
      clientOptions.baseURL = config.baseURL;
    }

    const proxy = config.proxy;
    if (proxy) {
      clientOptions.httpAgent = new HttpsProxyAgent(proxy);
    }

    if (config.customHeaders) {
      const headers = parseCustomHeaders(config.customHeaders);
      if (Object.keys(headers).length > 0) {
        clientOptions.defaultHeaders = headers;
      }
    }

    this.client = new OpenAI(clientOptions);
  }

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
      throw normalizeEngineError(error, 'openai', this.config.model);
    }
  };
}
