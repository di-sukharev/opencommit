import { getEncoding } from 'js-tiktoken';
import cl100k_base from 'tiktoken/encoders/cl100k_base.json';
import { Tiktoken } from 'tiktoken/lite';

function tokenCount__js(content: string): number {
  const encoding = getEncoding('cl100k_base');
  const tokens = encoding.encode(content);
  return tokens.length;
}

function tokenCount__native(content: string): number {
  const encoding = new Tiktoken(
    cl100k_base.bpe_ranks,
    cl100k_base.special_tokens,
    cl100k_base.pat_str
  );
  const tokens = encoding.encode(content);
  encoding.free();
  return tokens.length;
}

export const tokenCount =
  process.env.USE_NATIVE_TIKTOKEN === 'TRUE'
    ? tokenCount__native
    : tokenCount__js;

export const tokenCountEstimate = (content:string): number => {
  return 4 + content.length / 3
}
