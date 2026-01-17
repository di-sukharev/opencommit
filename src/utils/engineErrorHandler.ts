import axios from 'axios';
import {
  AuthenticationError,
  InsufficientCreditsError,
  ModelNotFoundError,
  RateLimitError,
  ServiceUnavailableError
} from './errors';

/**
 * Extracts HTTP status code from various error types
 */
function getStatusCode(error: unknown): number | null {
  // Direct status property (common in API SDKs)
  if (typeof (error as any)?.status === 'number') {
    return (error as any).status;
  }

  // Axios-style errors
  if (axios.isAxiosError(error)) {
    return error.response?.status ?? null;
  }

  // Response object with status
  if (typeof (error as any)?.response?.status === 'number') {
    return (error as any).response.status;
  }

  return null;
}

/**
 * Extracts retry-after value from error headers (for rate limiting)
 */
function getRetryAfter(error: unknown): number | undefined {
  const headers = (error as any)?.response?.headers;
  if (headers) {
    const retryAfter = headers['retry-after'] || headers['Retry-After'];
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        return seconds;
      }
    }
  }
  return undefined;
}

/**
 * Extracts the error message from various error structures
 */
function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  // API error response structures
  const apiError = (error as any)?.response?.data?.error;
  if (apiError) {
    if (typeof apiError === 'string') {
      return apiError;
    }
    if (apiError.message) {
      return apiError.message;
    }
  }

  // Direct error data
  const errorData = (error as any)?.error;
  if (errorData) {
    if (typeof errorData === 'string') {
      return errorData;
    }
    if (errorData.message) {
      return errorData.message;
    }
  }

  // Fallback
  if (typeof error === 'string') {
    return error;
  }

  return 'An unknown error occurred';
}

/**
 * Checks if the error message indicates a model not found error
 */
function isModelNotFoundMessage(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return (
    (lowerMessage.includes('model') &&
      (lowerMessage.includes('not found') ||
        lowerMessage.includes('does not exist') ||
        lowerMessage.includes('invalid') ||
        lowerMessage.includes('pull'))) ||
    lowerMessage.includes('does_not_exist')
  );
}

/**
 * Checks if the error message indicates insufficient credits
 */
function isInsufficientCreditsMessage(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return (
    lowerMessage.includes('insufficient') ||
    lowerMessage.includes('credit') ||
    lowerMessage.includes('quota') ||
    lowerMessage.includes('balance too low') ||
    lowerMessage.includes('billing') ||
    lowerMessage.includes('payment required') ||
    lowerMessage.includes('exceeded')
  );
}

/**
 * Normalizes raw API errors into typed error classes.
 * This provides consistent error handling across all engine implementations.
 *
 * @param error - The raw error from the API call
 * @param provider - The AI provider name (e.g., 'openai', 'anthropic')
 * @param model - The model being used
 * @returns A typed Error instance
 */
export function normalizeEngineError(
  error: unknown,
  provider: string,
  model: string
): Error {
  // If it's already one of our custom errors, return as-is
  if (
    error instanceof ModelNotFoundError ||
    error instanceof AuthenticationError ||
    error instanceof InsufficientCreditsError ||
    error instanceof RateLimitError ||
    error instanceof ServiceUnavailableError
  ) {
    return error;
  }

  const statusCode = getStatusCode(error);
  const message = extractErrorMessage(error);

  // Handle based on HTTP status codes
  switch (statusCode) {
    case 401:
      return new AuthenticationError(provider, message);

    case 402:
      return new InsufficientCreditsError(provider, message);

    case 404:
      // Could be model not found or endpoint not found
      if (isModelNotFoundMessage(message)) {
        return new ModelNotFoundError(model, provider, 404);
      }
      // Return generic error for other 404s
      return error instanceof Error ? error : new Error(message);

    case 429:
      const retryAfter = getRetryAfter(error);
      return new RateLimitError(provider, retryAfter, message);

    case 500:
    case 502:
    case 503:
    case 504:
      return new ServiceUnavailableError(provider, statusCode, message);
  }

  // Handle based on error message content
  if (isModelNotFoundMessage(message)) {
    return new ModelNotFoundError(model, provider, 404);
  }

  if (isInsufficientCreditsMessage(message)) {
    return new InsufficientCreditsError(provider, message);
  }

  // Check for rate limit patterns in message
  const lowerMessage = message.toLowerCase();
  if (
    lowerMessage.includes('rate limit') ||
    lowerMessage.includes('rate_limit') ||
    lowerMessage.includes('too many requests')
  ) {
    return new RateLimitError(provider, undefined, message);
  }

  // Check for auth patterns in message
  if (
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('api key') ||
    lowerMessage.includes('apikey') ||
    lowerMessage.includes('authentication') ||
    lowerMessage.includes('invalid_api_key')
  ) {
    return new AuthenticationError(provider, message);
  }

  // Return original error or wrap in Error if needed
  return error instanceof Error ? error : new Error(message);
}
