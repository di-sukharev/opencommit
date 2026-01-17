import chalk from 'chalk';
import { MODEL_LIST, OCO_AI_PROVIDER_ENUM } from '../commands/config';

// Provider billing/help URLs for common errors
export const PROVIDER_BILLING_URLS: Record<string, string | null> = {
  [OCO_AI_PROVIDER_ENUM.ANTHROPIC]: 'https://console.anthropic.com/settings/plans',
  [OCO_AI_PROVIDER_ENUM.OPENAI]: 'https://platform.openai.com/settings/organization/billing',
  [OCO_AI_PROVIDER_ENUM.GEMINI]: 'https://aistudio.google.com/app/plan',
  [OCO_AI_PROVIDER_ENUM.GROQ]: 'https://console.groq.com/settings/billing',
  [OCO_AI_PROVIDER_ENUM.MISTRAL]: 'https://console.mistral.ai/billing/',
  [OCO_AI_PROVIDER_ENUM.DEEPSEEK]: 'https://platform.deepseek.com/usage',
  [OCO_AI_PROVIDER_ENUM.OPENROUTER]: 'https://openrouter.ai/credits',
  [OCO_AI_PROVIDER_ENUM.AIMLAPI]: 'https://aimlapi.com/app/billing',
  [OCO_AI_PROVIDER_ENUM.AZURE]: 'https://portal.azure.com/#view/Microsoft_Azure_CostManagement',
  [OCO_AI_PROVIDER_ENUM.OLLAMA]: null,
  [OCO_AI_PROVIDER_ENUM.MLX]: null,
  [OCO_AI_PROVIDER_ENUM.FLOWISE]: null,
  [OCO_AI_PROVIDER_ENUM.TEST]: null
};

// Error type for insufficient credits/quota
export class InsufficientCreditsError extends Error {
  public readonly provider: string;

  constructor(provider: string, message?: string) {
    super(message || `Insufficient credits or quota for provider '${provider}'`);
    this.name = 'InsufficientCreditsError';
    this.provider = provider;
  }
}

// Error type for rate limiting (429 errors)
export class RateLimitError extends Error {
  public readonly provider: string;
  public readonly retryAfter?: number;

  constructor(provider: string, retryAfter?: number, message?: string) {
    super(message || `Rate limit exceeded for provider '${provider}'`);
    this.name = 'RateLimitError';
    this.provider = provider;
    this.retryAfter = retryAfter;
  }
}

// Error type for service unavailable (5xx errors)
export class ServiceUnavailableError extends Error {
  public readonly provider: string;
  public readonly statusCode: number;

  constructor(provider: string, statusCode: number = 503, message?: string) {
    super(message || `Service unavailable for provider '${provider}'`);
    this.name = 'ServiceUnavailableError';
    this.provider = provider;
    this.statusCode = statusCode;
  }
}

// Error type for authentication failures
export class AuthenticationError extends Error {
  public readonly provider: string;

  constructor(provider: string, message?: string) {
    super(message || `Authentication failed for provider '${provider}'`);
    this.name = 'AuthenticationError';
    this.provider = provider;
  }
}

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

// Detect insufficient credits/quota errors from various providers
export function isInsufficientCreditsError(error: unknown): boolean {
  if (error instanceof InsufficientCreditsError) {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Common patterns for insufficient credits/quota
    if (
      message.includes('insufficient') ||
      message.includes('credit') ||
      message.includes('quota') ||
      message.includes('balance') ||
      message.includes('billing') ||
      message.includes('payment') ||
      message.includes('exceeded') ||
      message.includes('limit reached') ||
      message.includes('no remaining')
    ) {
      return true;
    }

    // Check for 402 Payment Required status
    if ('status' in (error as any) && (error as any).status === 402) {
      return true;
    }

    if ('response' in (error as any)) {
      const response = (error as any).response;
      if (response?.status === 402) {
        return true;
      }
    }
  }

  return false;
}

// Detect rate limit errors (429)
export function isRateLimitError(error: unknown): boolean {
  if (error instanceof RateLimitError) {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Common patterns for rate limiting
    if (
      message.includes('rate limit') ||
      message.includes('rate_limit') ||
      message.includes('too many requests') ||
      message.includes('throttle')
    ) {
      return true;
    }

    // Check for 429 status
    if ('status' in (error as any) && (error as any).status === 429) {
      return true;
    }

    if ('response' in (error as any)) {
      const response = (error as any).response;
      if (response?.status === 429) {
        return true;
      }
    }
  }

  return false;
}

// Detect service unavailable errors (5xx)
export function isServiceUnavailableError(error: unknown): boolean {
  if (error instanceof ServiceUnavailableError) {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Common patterns for service unavailable
    if (
      message.includes('service unavailable') ||
      message.includes('server error') ||
      message.includes('internal error') ||
      message.includes('temporarily unavailable') ||
      message.includes('overloaded')
    ) {
      return true;
    }

    // Check for 5xx status
    const status = (error as any).status || (error as any).response?.status;
    if (status && status >= 500 && status < 600) {
      return true;
    }
  }

  return false;
}

// User-friendly formatted error structure
export interface FormattedError {
  title: string;
  message: string;
  helpUrl: string | null;
  suggestion: string | null;
}

// Format an error into a user-friendly structure
export function formatUserFriendlyError(error: unknown, provider: string): FormattedError {
  const billingUrl = PROVIDER_BILLING_URLS[provider] || null;

  // Handle our custom error types first
  if (error instanceof InsufficientCreditsError) {
    return {
      title: 'Insufficient Credits',
      message: `Your ${provider} account has insufficient credits or quota.`,
      helpUrl: billingUrl,
      suggestion: 'Add credits to your account to continue using the service.'
    };
  }

  if (error instanceof RateLimitError) {
    const retryMsg = error.retryAfter
      ? `Please wait ${error.retryAfter} seconds before retrying.`
      : 'Please wait a moment before retrying.';
    return {
      title: 'Rate Limit Exceeded',
      message: `You've made too many requests to ${provider}.`,
      helpUrl: billingUrl,
      suggestion: retryMsg
    };
  }

  if (error instanceof ServiceUnavailableError) {
    return {
      title: 'Service Unavailable',
      message: `The ${provider} service is temporarily unavailable.`,
      helpUrl: null,
      suggestion: 'Please try again in a few moments.'
    };
  }

  if (error instanceof AuthenticationError) {
    return {
      title: 'Authentication Failed',
      message: `Your ${provider} API key is invalid or expired.`,
      helpUrl: billingUrl,
      suggestion: 'Run `oco setup` to configure a valid API key.'
    };
  }

  if (error instanceof ModelNotFoundError) {
    return {
      title: 'Model Not Found',
      message: `The model '${error.modelName}' is not available for ${provider}.`,
      helpUrl: null,
      suggestion: 'Run `oco setup` to select a valid model.'
    };
  }

  // Detect error type from raw errors
  if (isInsufficientCreditsError(error)) {
    return {
      title: 'Insufficient Credits',
      message: `Your ${provider} account has insufficient credits or quota.`,
      helpUrl: billingUrl,
      suggestion: 'Add credits to your account to continue using the service.'
    };
  }

  if (isRateLimitError(error)) {
    return {
      title: 'Rate Limit Exceeded',
      message: `You've made too many requests to ${provider}.`,
      helpUrl: billingUrl,
      suggestion: 'Please wait a moment before retrying.'
    };
  }

  if (isServiceUnavailableError(error)) {
    return {
      title: 'Service Unavailable',
      message: `The ${provider} service is temporarily unavailable.`,
      helpUrl: null,
      suggestion: 'Please try again in a few moments.'
    };
  }

  if (isApiKeyError(error)) {
    return {
      title: 'Authentication Failed',
      message: `Your ${provider} API key is invalid or expired.`,
      helpUrl: billingUrl,
      suggestion: 'Run `oco setup` to configure a valid API key.'
    };
  }

  if (isModelNotFoundError(error)) {
    const model = (error as any).modelName || (error as any).model || 'unknown';
    return {
      title: 'Model Not Found',
      message: `The model '${model}' is not available for ${provider}.`,
      helpUrl: null,
      suggestion: 'Run `oco setup` to select a valid model.'
    };
  }

  // Default: generic error
  const errorMessage = error instanceof Error ? error.message : String(error);
  return {
    title: 'Error',
    message: errorMessage,
    helpUrl: null,
    suggestion: 'Run `oco setup` to reconfigure or check your settings.'
  };
}

// Print a formatted error as a chalk-styled string
export function printFormattedError(formatted: FormattedError): string {
  let output = `\n${chalk.red('✖')} ${chalk.bold.red(formatted.title)}\n`;
  output += `  ${formatted.message}\n`;

  if (formatted.helpUrl) {
    output += `\n  ${chalk.cyan('Help:')} ${chalk.underline(formatted.helpUrl)}\n`;
  }

  if (formatted.suggestion) {
    output += `\n  ${chalk.yellow('Suggestion:')} ${formatted.suggestion}\n`;
  }

  return output;
}
