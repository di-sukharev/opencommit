import { getEncoding } from 'js-tiktoken';
import cl100k_base from 'tiktoken/encoders/cl100k_base.json';
import { Tiktoken } from 'tiktoken/lite';

const encoding = getEncoding('cl100k_base');
function tokenCount__js(content: string): number {
  console.log("encoding")
  const tokens = encoding.encode(content);
  console.log("done encoding")
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

export const tokenCount = process.env.USE_NATIVE_TIKTOKEN === "TRUE" ? tokenCount__native : tokenCount__js
