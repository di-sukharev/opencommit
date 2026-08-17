import {
  AuthenticationError,
  formatUserFriendlyError,
  InsufficientCreditsError,
  ModelNotFoundError,
  PROVIDER_BILLING_URLS,
  RateLimitError,
  ServiceUnavailableError
} from '../../src/utils/errors';

const OPENAI_BILLING_URL = PROVIDER_BILLING_URLS.openai;

describe('formatUserFriendlyError', () => {
  it.each([
    ['typed', new InsufficientCreditsError('openai')],
    ['raw', new Error('quota exceeded')]
  ])('formats %s insufficient-credit errors', (_, error) => {
    expect(formatUserFriendlyError(error, 'openai')).toEqual({
      title: 'Insufficient Credits',
      message: 'Your openai account has insufficient credits or quota.',
      helpUrl: OPENAI_BILLING_URL,
      suggestion: 'Add credits to your account to continue using the service.'
    });
  });

  it('keeps insufficient-credit detection ahead of raw rate-limit detection', () => {
    const error = new Error('quota exceeded: too many requests');

    expect(formatUserFriendlyError(error, 'openai').title).toBe(
      'Insufficient Credits'
    );
  });

  it('uses the outer provider when formatting a typed error', () => {
    const error = new AuthenticationError('anthropic');

    expect(formatUserFriendlyError(error, 'openai')).toEqual({
      title: 'Authentication Failed',
      message: 'Your openai API key is invalid or expired.',
      helpUrl: OPENAI_BILLING_URL,
      suggestion: 'Run `oco setup` to configure a valid API key.'
    });
  });

  it('preserves a positive typed rate-limit retry delay', () => {
    expect(
      formatUserFriendlyError(new RateLimitError('openai', 12), 'openai')
    ).toEqual({
      title: 'Rate Limit Exceeded',
      message: "You've made too many requests to openai.",
      helpUrl: OPENAI_BILLING_URL,
      suggestion: 'Please wait 12 seconds before retrying.'
    });
  });

  it.each([undefined, 0])(
    'uses the default typed retry message for retryAfter=%s',
    (retryAfter) => {
      expect(
        formatUserFriendlyError(
          new RateLimitError('openai', retryAfter),
          'openai'
        )
      ).toEqual({
        title: 'Rate Limit Exceeded',
        message: "You've made too many requests to openai.",
        helpUrl: OPENAI_BILLING_URL,
        suggestion: 'Please wait a moment before retrying.'
      });
    }
  );

  it('ignores retryAfter metadata on raw rate-limit errors', () => {
    const error = Object.assign(new Error('too many requests'), {
      retryAfter: 30
    });

    expect(formatUserFriendlyError(error, 'openai')).toEqual({
      title: 'Rate Limit Exceeded',
      message: "You've made too many requests to openai.",
      helpUrl: OPENAI_BILLING_URL,
      suggestion: 'Please wait a moment before retrying.'
    });
  });

  it('keeps provider wording when no custom API URL is configured', () => {
    expect(
      formatUserFriendlyError(new ServiceUnavailableError('openai'), 'openai')
    ).toEqual({
      title: 'Service Unavailable',
      message: 'The openai service is temporarily unavailable.',
      helpUrl: null,
      suggestion: 'Please try again in a few moments.'
    });
  });

  it.each([
    ['typed', new ServiceUnavailableError('openai')],
    ['raw', new Error('service unavailable')]
  ])(
    'uses host-labelled wording for a valid custom API URL on %s errors',
    (_, error) => {
      expect(
        formatUserFriendlyError(error, 'openai', {
          baseURL: 'http://127.0.0.1:1234/v1'
        })
      ).toEqual({
        title: 'Service Unavailable',
        message:
          'The configured API endpoint (127.0.0.1:1234) is temporarily unavailable.',
        helpUrl: null,
        suggestion: 'Please try again in a few moments.'
      });
    }
  );

  it.each([
    ['typed', new ServiceUnavailableError('openai')],
    ['raw', new Error('service unavailable')]
  ])(
    'uses generic endpoint wording for an invalid custom API URL on %s errors',
    (_, error) => {
      expect(
        formatUserFriendlyError(error, 'openai', {
          baseURL: 'not a valid URL'
        })
      ).toEqual({
        title: 'Service Unavailable',
        message: 'The configured API endpoint is temporarily unavailable.',
        helpUrl: null,
        suggestion: 'Please try again in a few moments.'
      });
    }
  );

  it('formats raw service-unavailable errors', () => {
    expect(
      formatUserFriendlyError(new Error('service unavailable'), 'openai')
    ).toEqual({
      title: 'Service Unavailable',
      message: 'The openai service is temporarily unavailable.',
      helpUrl: null,
      suggestion: 'Please try again in a few moments.'
    });
  });

  it.each([
    ['typed', new AuthenticationError('openai')],
    ['raw', new Error('invalid_api_key')]
  ])('formats %s authentication errors', (_, error) => {
    expect(formatUserFriendlyError(error, 'openai')).toEqual({
      title: 'Authentication Failed',
      message: 'Your openai API key is invalid or expired.',
      helpUrl: OPENAI_BILLING_URL,
      suggestion: 'Run `oco setup` to configure a valid API key.'
    });
  });

  it('keeps a null billing URL for providers without billing help', () => {
    expect(
      formatUserFriendlyError(new AuthenticationError('ollama'), 'ollama')
    ).toEqual({
      title: 'Authentication Failed',
      message: 'Your ollama API key is invalid or expired.',
      helpUrl: null,
      suggestion: 'Run `oco setup` to configure a valid API key.'
    });
  });

  it('formats typed model-not-found errors with their model name', () => {
    expect(
      formatUserFriendlyError(
        new ModelNotFoundError('gpt-missing', 'openai'),
        'openai'
      )
    ).toEqual({
      title: 'Model Not Found',
      message: "The model 'gpt-missing' is not available for openai.",
      helpUrl: null,
      suggestion: 'Run `oco setup` to select a valid model.'
    });
  });

  it.each([
    [
      'modelName',
      Object.assign(new Error('model not found'), {
        modelName: 'preferred-model',
        model: 'fallback-model'
      }),
      'preferred-model'
    ],
    [
      'model',
      Object.assign(new Error('model not found'), {
        modelName: '',
        model: 'fallback-model'
      }),
      'fallback-model'
    ],
    ['unknown', new Error('model not found'), 'unknown']
  ])('uses the raw %s model-name fallback', (_, error, expectedModel) => {
    expect(formatUserFriendlyError(error, 'openai')).toEqual({
      title: 'Model Not Found',
      message: `The model '${expectedModel}' is not available for openai.`,
      helpUrl: null,
      suggestion: 'Run `oco setup` to select a valid model.'
    });
  });

  it.each([
    ['Error', new Error('unexpected failure'), 'unexpected failure'],
    ['non-Error', 42, '42']
  ])('preserves the generic %s fallback', (_, error, message) => {
    expect(formatUserFriendlyError(error, 'openai')).toEqual({
      title: 'Error',
      message,
      helpUrl: null,
      suggestion: 'Run `oco setup` to reconfigure or check your settings.'
    });
  });
});
