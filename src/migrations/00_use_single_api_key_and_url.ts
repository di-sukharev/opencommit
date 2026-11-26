import {
  CONFIG_KEYS,
  getConfig,
  getGlobalConfig,
  getLegacyProviderTransport,
  OCO_AI_PROVIDER_ENUM,
  setConfig
} from '../commands/config';

export default function () {
  const config = getConfig({ setDefaultValues: false });
  const legacy = getLegacyProviderTransport(config, config.OCO_AI_PROVIDER);
  if (!legacy) {
    throw new Error(
      `Migration failed, set AI provider first. Run "oco config set OCO_AI_PROVIDER=<provider>", where <provider> is one of: ${Object.values(
        OCO_AI_PROVIDER_ENUM
      ).join(', ')}`
    );
  }

  const saved = getGlobalConfig();
  if (saved.OCO_API_KEY === undefined && legacy.OCO_API_KEY)
    setConfig([[CONFIG_KEYS.OCO_API_KEY, legacy.OCO_API_KEY]]);
  if (saved.OCO_API_URL === undefined && legacy.OCO_API_URL)
    setConfig([[CONFIG_KEYS.OCO_API_URL, legacy.OCO_API_URL]]);
}
