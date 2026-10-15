import { OpenAiConfig, OpenAiEngine } from './openAi';

export interface AtlasCloudConfig extends OpenAiConfig {}

const DEFAULT_ATLAS_CLOUD_BASE_URL = 'https://api.atlascloud.ai/v1';

export class AtlasCloudEngine extends OpenAiEngine {
  protected providerName = 'atlascloud';

  constructor(config: AtlasCloudConfig) {
    super({
      ...config,
      baseURL: config.baseURL ?? DEFAULT_ATLAS_CLOUD_BASE_URL,
      maxRetries: 0
    });
  }
}
