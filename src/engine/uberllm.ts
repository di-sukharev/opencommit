import { OpenAiEngine, OpenAiConfig } from './openAi';

export interface UberLLMConfig extends OpenAiConfig {}

const DEFAULT_UBERLLM_BASE_URL = 'https://api.uberllm.dev/v1';

export class UberLLMEngine extends OpenAiEngine {
  protected providerName = 'uberllm';

  constructor(config: UberLLMConfig) {
    super({
      ...config,
      baseURL: config.baseURL ?? DEFAULT_UBERLLM_BASE_URL
    });
  }
}
