import {
  formatUserFriendlyError,
  ServiceUnavailableError
} from '../../src/utils/errors';

describe('formatUserFriendlyError', () => {
  it('should keep provider wording when no custom API URL is configured', () => {
    const formatted = formatUserFriendlyError(
      new ServiceUnavailableError('openai'),
      'openai'
    );

    expect(formatted.message).toEqual(
      'The openai service is temporarily unavailable.'
    );
  });

  it('should use configured endpoint wording when a custom API URL is provided', () => {
    const formatted = formatUserFriendlyError(
      new ServiceUnavailableError('openai'),
      'openai',
      { baseURL: 'http://127.0.0.1:1234/v1' }
    );

    expect(formatted.message).toContain('configured API endpoint');
    expect(formatted.message).toContain('127.0.0.1:1234');
    expect(formatted.message).not.toContain('openai service');
  });
});
