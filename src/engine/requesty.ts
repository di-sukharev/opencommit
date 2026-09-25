import { OpenAiEngine, OpenAiConfig } from './openAi';

export interface RequestyConfig extends OpenAiConfig {}

const DEFAULT_REQUESTY_BASE_URL = 'https://router.requesty.ai/v1';

export class RequestyEngine extends OpenAiEngine {
  protected providerName = 'requesty';

  constructor(config: RequestyConfig) {
    super({
      ...config,
      baseURL: config.baseURL || DEFAULT_REQUESTY_BASE_URL
    });
  }
}
