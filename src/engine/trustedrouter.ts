import { OpenAiConfig, OpenAiEngine } from './openAi';

export interface TrustedRouterConfig extends OpenAiConfig {}

const DEFAULT_TRUSTEDROUTER_BASE_URL = 'https://api.trustedrouter.com/v1';

export class TrustedRouterEngine extends OpenAiEngine {
  protected useSamplingParameters = false;

  constructor(config: TrustedRouterConfig) {
    super(
      {
        ...config,
        baseURL: config.baseURL || DEFAULT_TRUSTEDROUTER_BASE_URL
      },
      'trustedrouter'
    );
  }
}
