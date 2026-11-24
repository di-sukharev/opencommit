import { OpenAiConfig, OpenAiEngine } from './openAi';

export interface OnomeoConfig extends OpenAiConfig {}

const DEFAULT_ONOMEO_BASE_URL = 'https://onomeo.com/v1';

export class OnomeoEngine extends OpenAiEngine {
  protected useSamplingParameters = false;

  constructor(config: OnomeoConfig) {
    super(
      { ...config, baseURL: config.baseURL || DEFAULT_ONOMEO_BASE_URL },
      'onomeo'
    );
  }
}
