import { normalizeEngineError } from '../../src/utils/engineErrorHandler';
import { ModelNotFoundError } from '../../src/utils/errors';

describe('normalizeEngineError', () => {
  it('does not classify Anthropic temperature/top_p 400 as model not found', () => {
    const error = Object.assign(
      new Error(
        '`temperature` and `top_p` cannot both be specified for this model. Please use only one.'
      ),
      { status: 400 }
    );

    const normalized = normalizeEngineError(error, 'anthropic', 'claude-sonnet-4-6');

    expect(normalized).not.toBeInstanceOf(ModelNotFoundError);
    expect(normalized.message).toContain('temperature');
  });

  it('classifies genuine model-not-found errors', () => {
    const error = Object.assign(
      new Error('model: claude-sonnet-4-20250514 not found'),
      { status: 404 }
    );

    const normalized = normalizeEngineError(
      error,
      'anthropic',
      'claude-sonnet-4-20250514'
    );

    expect(normalized).toBeInstanceOf(ModelNotFoundError);
  });
});
