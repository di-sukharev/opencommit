export enum OCO_AI_PROVIDER_ENUM {
  OLLAMA = 'ollama',
  LLAMACPP = 'llamacpp',
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GEMINI = 'gemini',
  AZURE = 'azure',
  TEST = 'test',
  FLOWISE = 'flowise',
  GROQ = 'groq',
  MISTRAL = 'mistral',
  MLX = 'mlx',
  DEEPSEEK = 'deepseek',
  MINIMAX = 'minimax',
  OPENROUTER = 'openrouter'
}

export type ProviderConfigRequirement = 'apiKey' | 'model' | 'none';

const PROVIDER_CONFIG_REQUIREMENTS: Record<
  OCO_AI_PROVIDER_ENUM,
  ProviderConfigRequirement
> = {
  [OCO_AI_PROVIDER_ENUM.OPENAI]: 'apiKey',
  [OCO_AI_PROVIDER_ENUM.ANTHROPIC]: 'apiKey',
  [OCO_AI_PROVIDER_ENUM.OLLAMA]: 'model',
  [OCO_AI_PROVIDER_ENUM.LLAMACPP]: 'model',
  [OCO_AI_PROVIDER_ENUM.GEMINI]: 'apiKey',
  [OCO_AI_PROVIDER_ENUM.GROQ]: 'apiKey',
  [OCO_AI_PROVIDER_ENUM.MISTRAL]: 'apiKey',
  [OCO_AI_PROVIDER_ENUM.DEEPSEEK]: 'apiKey',
  [OCO_AI_PROVIDER_ENUM.MINIMAX]: 'apiKey',
  [OCO_AI_PROVIDER_ENUM.OPENROUTER]: 'apiKey',
  [OCO_AI_PROVIDER_ENUM.AZURE]: 'apiKey',
  [OCO_AI_PROVIDER_ENUM.MLX]: 'model',
  [OCO_AI_PROVIDER_ENUM.FLOWISE]: 'apiKey',
  [OCO_AI_PROVIDER_ENUM.TEST]: 'none'
};

export const getProviderConfigRequirement = (
  provider: string = OCO_AI_PROVIDER_ENUM.OPENAI
): ProviderConfigRequirement =>
  PROVIDER_CONFIG_REQUIREMENTS[provider as OCO_AI_PROVIDER_ENUM] || 'apiKey';

// Former named providers that were only OpenAI-compatible gateways. The openai
// provider reaches each of them through its base URL in OCO_API_URL.
const REMOVED_PROVIDER_API_URLS = new Map([
  ['aimlapi', 'https://api.aimlapi.com/v1'],
  ['orcarouter', 'https://api.orcarouter.ai/v1'],
  ['cheaperinference', 'https://api.cheaperinference.com/v1'],
  ['requesty', 'https://router.requesty.ai/v1'],
  ['atlascloud', 'https://api.atlascloud.ai/v1'],
  ['uberllm', 'https://api.uberllm.dev/v1'],
  ['trustedrouter', 'https://api.trustedrouter.com/v1'],
  ['aigrow', 'https://aigrow.gg/v1']
]);

/** Returns the OCO_API_URL that replaces a removed provider. */
export const getRemovedProviderApiUrl = (
  provider: string | undefined
): string | undefined => provider && REMOVED_PROVIDER_API_URLS.get(provider);

/** Returns how to replace a removed provider, or undefined for other values. */
export const getRemovedProviderMessage = (
  provider: string | undefined
): string | undefined => {
  const apiUrl = getRemovedProviderApiUrl(provider);
  return (
    apiUrl &&
    `${provider} was removed. Set OCO_AI_PROVIDER=openai and OCO_API_URL=${apiUrl} to use its OpenAI-compatible API`
  );
};
