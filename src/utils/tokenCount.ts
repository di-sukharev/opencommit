import cl100k_base from '@dqbd/tiktoken/encoders/cl100k_base.json';
import { Tiktoken } from '@dqbd/tiktoken/lite';

const TOKENIZER_CHUNK_LENGTH = 8_000;

// An artificial split can change the cl100k regex/BPE result at the join. The
// longest token in this encoding is 128 bytes, so reserve that many tokens at
// every join instead of assuming independently encoded chunks are additive.
export const TOKEN_BOUNDARY_RESERVE = 128;

interface CountedTextChunk {
  content: string;
  tokens: number;
}

let encoding: Tiktoken | undefined;

const getEncoding = (): Tiktoken => {
  // OpenCommit is a short-lived CLI. Reusing the WASM encoder avoids paying its
  // initialization cost for every file, line, and growing merged diff.
  encoding ??= new Tiktoken(
    cl100k_base.bpe_ranks,
    cl100k_base.special_tokens,
    cl100k_base.pat_str
  );

  return encoding;
};

const getSafeSliceEnd = (content: string, start: number, length: number) => {
  let end = Math.min(start + length, content.length);

  // Do not split a UTF-16 surrogate pair between tokenizer chunks.
  if (
    end < content.length &&
    end > start &&
    /[\uD800-\uDBFF]/.test(content[end - 1]) &&
    /[\uDC00-\uDFFF]/.test(content[end])
  ) {
    end = end - 1 === start ? end + 1 : end - 1;
  }

  return end;
};

const getTextChunks = (content: string): string[] => {
  const chunks: string[] = [];

  for (let start = 0; start < content.length; ) {
    const end = getSafeSliceEnd(content, start, TOKENIZER_CHUNK_LENGTH);
    chunks.push(content.slice(start, end));
    start = end;
  }

  return chunks;
};

const countTextChunk = (content: string): number =>
  getEncoding().encode(content).length;

const yieldToEventLoop = () =>
  new Promise<void>((resolve) => setImmediate(resolve));

export function tokenCount(content: string): number {
  return getTextChunks(content).reduce((total, chunk, index) => {
    const boundaryReserve = index === 0 ? 0 : TOKEN_BOUNDARY_RESERVE;
    return total + boundaryReserve + countTextChunk(chunk);
  }, 0);
}

export async function tokenCountAsync(content: string): Promise<number> {
  let total = 0;

  for (const [index, chunk] of getTextChunks(content).entries()) {
    const boundaryReserve = index === 0 ? 0 : TOKEN_BOUNDARY_RESERVE;
    total += boundaryReserve + countTextChunk(chunk);
    await yieldToEventLoop();
  }

  return total;
}

const getBoundedTokenChunks = async (
  content: string,
  maxTokens: number
): Promise<CountedTextChunk[]> => {
  const tokens = countTextChunk(content);
  await yieldToEventLoop();

  if (tokens <= maxTokens) return [{ content, tokens }];

  const middle = getSafeSliceEnd(content, 0, Math.floor(content.length / 2));

  // A single Unicode code point cannot be divided without corrupting it. This
  // is only reachable with impractically tiny token limits.
  if (middle === 0 || middle === content.length) return [{ content, tokens }];

  return [
    ...(await getBoundedTokenChunks(content.slice(0, middle), maxTokens)),
    ...(await getBoundedTokenChunks(content.slice(middle), maxTokens))
  ];
};

export async function splitByTokenLimit(
  content: string,
  maxTokens: number
): Promise<string[]> {
  if (maxTokens <= 0) throw new Error('maxTokens must be greater than zero');
  if (!content) return [];

  const countedChunks: CountedTextChunk[] = [];

  for (const chunk of getTextChunks(content)) {
    countedChunks.push(...(await getBoundedTokenChunks(chunk, maxTokens)));
  }

  const mergedChunks: string[] = [];
  let currentContent = '';
  let currentTokens = 0;

  for (const chunk of countedChunks) {
    const boundaryReserve = currentContent ? TOKEN_BOUNDARY_RESERVE : 0;

    if (
      currentContent &&
      currentTokens + boundaryReserve + chunk.tokens > maxTokens
    ) {
      mergedChunks.push(currentContent);
      currentContent = '';
      currentTokens = 0;
    }

    const appliedBoundaryReserve = currentContent ? TOKEN_BOUNDARY_RESERVE : 0;
    currentContent += chunk.content;
    currentTokens += appliedBoundaryReserve + chunk.tokens;
  }

  if (currentContent) mergedChunks.push(currentContent);

  return mergedChunks;
}
