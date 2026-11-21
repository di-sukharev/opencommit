import { OpenAiConfig, OpenAiEngine } from './openAi';

export interface AIGROWConfig extends OpenAiConfig {}

const DEFAULT_AIGROW_BASE_URL = 'https://aigrow.gg/v1';

export class AIGROWEngine extends OpenAiEngine {
  protected useSamplingParameters = false;

  constructor(config: AIGROWConfig) {
    super(
      { ...config, baseURL: config.baseURL || DEFAULT_AIGROW_BASE_URL },
      'aigrow'
    );
  }
}
