import { getGlobalConfig, setGlobalConfig } from '../commands/config';
import {
  getRemovedProviderApiUrl,
  OCO_AI_PROVIDER_ENUM
} from '../utils/provider';

export default function () {
  const config = getGlobalConfig();
  const apiUrl = getRemovedProviderApiUrl(config.OCO_AI_PROVIDER);
  if (!apiUrl) return;

  const savedApiUrl = config.OCO_API_URL;
  setGlobalConfig({
    ...config,
    OCO_AI_PROVIDER: OCO_AI_PROVIDER_ENUM.OPENAI,
    // The OpenAI SDK adds /chat/completions to the base URL. The former
    // aimlapi provider used the full chat completions URL instead.
    OCO_API_URL:
      typeof savedApiUrl === 'string' && /^https?:\/\//.test(savedApiUrl)
        ? savedApiUrl.replace(/\/chat\/completions\/?$/, '')
        : apiUrl
  });
}
