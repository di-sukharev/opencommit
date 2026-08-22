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
  AIMLAPI = 'aimlapi',
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
  [OCO_AI_PROVIDER_ENUM.OPENROUTER]: 'apiKey',
  [OCO_AI_PROVIDER_ENUM.AIMLAPI]: 'apiKey',
  [OCO_AI_PROVIDER_ENUM.AZURE]: 'apiKey',
  [OCO_AI_PROVIDER_ENUM.MLX]: 'model',
  [OCO_AI_PROVIDER_ENUM.FLOWISE]: 'apiKey',
  [OCO_AI_PROVIDER_ENUM.TEST]: 'none'
};

export const getProviderConfigRequirement = (
  provider: string = OCO_AI_PROVIDER_ENUM.OPENAI
): ProviderConfigRequirement =>
  PROVIDER_CONFIG_REQUIREMENTS[provider as OCO_AI_PROVIDER_ENUM] || 'apiKey';
