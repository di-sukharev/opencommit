import { OpenAiEngine, OpenAiConfig } from './openAi';

export interface OrcaRouterConfig extends OpenAiConfig {}

const DEFAULT_ORCAROUTER_BASE_URL = 'https://api.orcarouter.ai/v1';

export class OrcaRouterEngine extends OpenAiEngine {
  protected providerName = 'orcarouter';

  constructor(config: OrcaRouterConfig) {
    super({
      ...config,
      baseURL: config.baseURL ?? DEFAULT_ORCAROUTER_BASE_URL
    });
  }
}
