import { encoding_for_model } from '@dqbd/tiktoken';

export function tokenCount(content: string): number {
  const encoding = encoding_for_model('gpt-4-turbo-preview');
  const tokens = encoding.encode(content);
  encoding.free();
  return tokens.length;
}
