import {
  CONFIG_KEYS,
  getConfig,
  OCO_AI_PROVIDER_ENUM,
  setConfig
} from '../commands/config';

export default function () {
  const config = getConfig({ setDefaultValues: false });

  const aiProvider = config.OCO_AI_PROVIDER;

  let apiKey: string | undefined;
  let apiUrl: string | undefined;

  if (aiProvider === OCO_AI_PROVIDER_ENUM.OLLAMA) {
    apiKey = config['OCO_OLLAMA_API_KEY'];
    apiUrl = config['OCO_OLLAMA_API_URL'];
  } else if (aiProvider === OCO_AI_PROVIDER_ENUM.ANTHROPIC) {
    apiKey = config['OCO_ANTHROPIC_API_KEY'];
    apiUrl = config['OCO_ANTHROPIC_BASE_PATH'];
  } else if (aiProvider === OCO_AI_PROVIDER_ENUM.OPENAI) {
    apiKey = config['OCO_OPENAI_API_KEY'];
    apiUrl = config['OCO_OPENAI_BASE_PATH'];
  } else if (aiProvider === OCO_AI_PROVIDER_ENUM.AZURE) {
    apiKey = config['OCO_AZURE_API_KEY'];
    apiUrl = config['OCO_AZURE_ENDPOINT'];
  } else if (aiProvider === OCO_AI_PROVIDER_ENUM.GEMINI) {
    apiKey = config['OCO_GEMINI_API_KEY'];
    apiUrl = config['OCO_GEMINI_BASE_PATH'];
  } else if (aiProvider === OCO_AI_PROVIDER_ENUM.FLOWISE) {
    apiKey = config['OCO_FLOWISE_API_KEY'];
    apiUrl = config['OCO_FLOWISE_ENDPOINT'];
  } else {
    throw new Error(
      `Migration failed, set AI provider first. Run "oco config set OCO_AI_PROVIDER=<provider>", where <provider> is one of: ${Object.values(
        OCO_AI_PROVIDER_ENUM
      ).join(', ')}`
    );
  }

  if (apiKey) setConfig([[CONFIG_KEYS.OCO_API_KEY, apiKey]]);

  if (apiUrl) setConfig([[CONFIG_KEYS.OCO_API_URL, apiUrl]]);
}
