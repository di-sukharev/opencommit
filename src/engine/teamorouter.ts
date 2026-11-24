import { OpenAiConfig, OpenAiEngine } from './openAi';

export interface TeamoRouterConfig extends OpenAiConfig {}

const DEFAULT_TEAMOROUTER_BASE_URL = 'https://api.teamorouter.com/v1';

export class TeamoRouterEngine extends OpenAiEngine {
  protected useSamplingParameters = false;

  constructor(config: TeamoRouterConfig) {
    super(
      { ...config, baseURL: config.baseURL || DEFAULT_TEAMOROUTER_BASE_URL },
      'teamorouter'
    );
  }
}
