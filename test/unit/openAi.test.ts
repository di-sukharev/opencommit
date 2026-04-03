// Test the reasoning model detection regex used in OpenAiEngine.
// Integration test with the engine is not possible because mistral.ts
// uses require() which is unavailable in the ESM test environment.
const REASONING_MODEL_RE = /^(o[1-9]|gpt-5)/;

describe('OpenAiEngine reasoning model detection', () => {
  it.each([
    ['o1', true],
    ['o1-preview', true],
    ['o1-mini', true],
    ['o3', true],
    ['o3-mini', true],
    ['o4-mini', true],
    ['gpt-5', true],
    ['gpt-5-nano', true],
    ['gpt-4o', false],
    ['gpt-4o-mini', false],
    ['gpt-4', false],
    ['gpt-3.5-turbo', false]
  ])(
    'model "%s" isReasoning=%s',
    (model, expected) => {
      expect(REASONING_MODEL_RE.test(model)).toBe(expected);
    }
  );
});
