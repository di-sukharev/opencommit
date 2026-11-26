import { OpenAiConfig, OpenAiEngine } from './openAi';

export interface MiniMaxConfig extends OpenAiConfig {}

const DEFAULT_MINIMAX_BASE_URL = 'https://api.minimax.io/v1';

export class MiniMaxEngine extends OpenAiEngine {
  // MiniMax rejects temperature 0, so keep the API defaults.
  protected useSamplingParameters = false;

  constructor(config: MiniMaxConfig) {
    super(
      { ...config, baseURL: config.baseURL || DEFAULT_MINIMAX_BASE_URL },
      'minimax'
    );
  }
}
