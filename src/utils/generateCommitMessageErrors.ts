import { DEFAULT_TOKEN_LIMITS } from '../commands/config';

export enum GenerateCommitMessageErrorEnum {
  tooMuchTokens = 'TOO_MUCH_TOKENS',
  internalError = 'INTERNAL_ERROR',
  emptyMessage = 'EMPTY_MESSAGE',
  outputTokensTooHigh = `Token limit exceeded, OCO_TOKENS_MAX_OUTPUT must not be much higher than the default ${DEFAULT_TOKEN_LIMITS.DEFAULT_MAX_TOKENS_OUTPUT} tokens.`
}
