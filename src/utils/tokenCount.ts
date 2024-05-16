import { getEncoding } from 'js-tiktoken';

export function tokenCount(content: string): number {
  const encoding = getEncoding('cl100k_base');
  const tokens = encoding.encode(content);
  return tokens.length;
}
