import {
  splitByTokenLimit,
  tokenCount,
  tokenCountAsync
} from '../../src/utils/tokenCount';

describe('tokenCount', () => {
  it('counts short text exactly', () => {
    expect(tokenCount('hello world')).toBe(2);
  });

  it('yields to the event loop while counting a long minified line', async () => {
    let timerRan = false;
    const timer = setTimeout(() => {
      timerRan = true;
    }, 0);

    const count = await tokenCountAsync('a'.repeat(24_000));
    clearTimeout(timer);

    expect(count).toBe(3_000);
    expect(timerRan).toBe(true);
  });
});

describe('splitByTokenLimit', () => {
  it('preserves long single-line content in bounded chunks', async () => {
    const content = `${'a'.repeat(20_000)}${'🙂'.repeat(500)}`;
    const chunks = await splitByTokenLimit(content, 500);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe(content);
    expect(chunks.every((chunk) => tokenCount(chunk) <= 500)).toBe(true);
  });

  it('rejects non-positive token limits', async () => {
    await expect(splitByTokenLimit('content', 0)).rejects.toThrow(
      'maxTokens must be greater than zero'
    );
  });
});
