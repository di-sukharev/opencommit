import cl100k_base from '@dqbd/tiktoken/encoders/cl100k_base.json';
import { Tiktoken } from '@dqbd/tiktoken/lite';
import {
  splitByTokenLimit,
  tokenCount,
  tokenCountAsync
} from '../../src/utils/tokenCount';

const exactEncoding = new Tiktoken(
  cl100k_base.bpe_ranks,
  cl100k_base.special_tokens,
  cl100k_base.pat_str
);

const exactTokenCount = (content: string) =>
  exactEncoding.encode(content).length;

afterAll(() => exactEncoding.free());

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

    expect(count).toBeGreaterThanOrEqual(exactTokenCount('a'.repeat(24_000)));
    expect(timerRan).toBe(true);
  });

  it('does not underestimate tokens across artificial chunk boundaries', async () => {
    const blocks = Array.from(
      { length: 32 },
      () => `.a🙂${'b'.repeat(7_994)}🙂`
    );
    const content = blocks.join('');
    const independentlyCounted = blocks.reduce(
      (total, block) => total + exactTokenCount(block),
      0
    );
    const exactCount = exactTokenCount(content);

    expect(exactCount).toBeGreaterThan(independentlyCounted);
    expect(tokenCount(content)).toBeGreaterThanOrEqual(exactCount);

    const chunks = await splitByTokenLimit(content, 8_016);
    expect(chunks.every((chunk) => exactTokenCount(chunk) <= 8_016)).toBe(true);
  });
});

describe('splitByTokenLimit', () => {
  it('preserves long single-line content in bounded chunks', async () => {
    const content = `${'a'.repeat(20_000)}${'🙂'.repeat(500)}`;
    const chunks = await splitByTokenLimit(content, 500);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join('')).toBe(content);
    expect(chunks.every((chunk) => exactTokenCount(chunk) <= 500)).toBe(true);
  });

  it('rejects non-positive token limits', async () => {
    await expect(splitByTokenLimit('content', 0)).rejects.toThrow(
      'maxTokens must be greater than zero'
    );
  });

  it('splits after a leading surrogate pair when that satisfies the limit', async () => {
    const chunks = await splitByTokenLimit('🙂a', 2);

    expect(chunks).toEqual(['🙂', 'a']);
    expect(chunks.every((chunk) => exactTokenCount(chunk) <= 2)).toBe(true);
  });
});
