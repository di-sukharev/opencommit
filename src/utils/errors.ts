import { MODEL_LIST, OCO_AI_PROVIDER_ENUM } from '../commands/config';

export class ModelNotFoundError extends Error {
  public readonly modelName: string;
  public readonly provider: string;
  public readonly statusCode: number;

  constructor(modelName: string, provider: string, statusCode: number = 404) {
    super(`Model '${modelName}' not found for provider '${provider}'`);
    this.name = 'ModelNotFoundError';
    this.modelName = modelName;
    this.provider = provider;
    this.statusCode = statusCode;
  }
}

export class ApiKeyMissingError extends Error {
  public readonly provider: string;

  constructor(provider: string) {
    super(`API key is missing for provider '${provider}'`);
    this.name = 'ApiKeyMissingError';
    this.provider = provider;
  }
}

export function isModelNotFoundError(error: unknown): boolean {
  if (error instanceof ModelNotFoundError) {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // OpenAI error patterns
    if (
      message.includes('model') &&
      (message.includes('not found') ||
        message.includes('does not exist') ||
        message.includes('invalid model'))
    ) {
      return true;
    }

    // Anthropic error patterns
    if (
      message.includes('model') &&
      (message.includes('not found') || message.includes('invalid'))
    ) {
      return true;
    }

    // Check for 404 status in axios/fetch errors
    if (
      'status' in (error as any) &&
      (error as any).status === 404 &&
      message.includes('model')
    ) {
      return true;
    }

    // Check for response status
    if ('response' in (error as any)) {
      const response = (error as any).response;
      if (response?.status === 404) {
        return true;
      }
    }
  }

  return false;
}

export function isApiKeyError(error: unknown): boolean {
  if (error instanceof ApiKeyMissingError) {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Common API key error patterns
    if (
      message.includes('api key') ||
      message.includes('apikey') ||
      message.includes('authentication') ||
      message.includes('unauthorized') ||
      message.includes('invalid_api_key') ||
      message.includes('incorrect api key')
    ) {
      return true;
    }

    // Check for 401 status
    if ('response' in (error as any)) {
      const response = (error as any).response;
      if (response?.status === 401) {
        return true;
      }
    }
  }

  return false;
}

export function getSuggestedModels(
  provider: string,
  failedModel: string
): string[] {
  const providerKey = provider.toLowerCase() as keyof typeof MODEL_LIST;
  const models = MODEL_LIST[providerKey];

  if (!models || !Array.isArray(models)) {
    return [];
  }

  // Return first 5 models as suggestions, excluding the failed one
  return models.filter((m) => m !== failedModel).slice(0, 5);
}

export function getRecommendedModel(provider: string): string | null {
  switch (provider.toLowerCase()) {
    case OCO_AI_PROVIDER_ENUM.OPENAI:
      return 'gpt-4o-mini';
    case OCO_AI_PROVIDER_ENUM.ANTHROPIC:
      return 'claude-sonnet-4-20250514';
    case OCO_AI_PROVIDER_ENUM.GEMINI:
      return 'gemini-1.5-flash';
    case OCO_AI_PROVIDER_ENUM.GROQ:
      return 'llama3-70b-8192';
    case OCO_AI_PROVIDER_ENUM.MISTRAL:
      return 'mistral-small-latest';
    case OCO_AI_PROVIDER_ENUM.DEEPSEEK:
      return 'deepseek-chat';
    case OCO_AI_PROVIDER_ENUM.OPENROUTER:
      return 'openai/gpt-4o-mini';
    case OCO_AI_PROVIDER_ENUM.AIMLAPI:
      return 'gpt-4o-mini';
    default:
      return null;
  }
}

export function formatErrorWithRecovery(
  error: Error,
  provider: string,
  model: string
): string {
  const suggestions = getSuggestedModels(provider, model);
  const recommended = getRecommendedModel(provider);

  let message = `\n${error.message}\n`;

  if (suggestions.length > 0) {
    message += '\nSuggested alternatives:\n';
    suggestions.forEach((m, i) => {
      const isRecommended = m === recommended;
      message += `  ${i + 1}. ${m}${isRecommended ? ' (Recommended)' : ''}\n`;
    });
  }

  message += '\nTo fix this, run: oco config set OCO_MODEL=<model-name>\n';
  message += 'Or run: oco setup\n';

  return message;
}
