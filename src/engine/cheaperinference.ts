import { OpenAiEngine, OpenAiConfig } from './openAi';

export interface CheaperInferenceConfig extends OpenAiConfig {}

const DEFAULT_CHEAPERINFERENCE_BASE_URL = 'https://api.cheaperinference.com/v1';

export class CheaperInferenceEngine extends OpenAiEngine {
  protected providerName = 'cheaperinference';

  constructor(config: CheaperInferenceConfig) {
    super({
      ...config,
      baseURL: config.baseURL ?? DEFAULT_CHEAPERINFERENCE_BASE_URL
    });
  }
}
