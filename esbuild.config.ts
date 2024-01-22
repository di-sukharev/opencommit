import { build } from 'esbuild';
import { copyFile } from 'node:fs/promises';
import path from 'node:path';

await build({
  entryPoints: ['./src/cli.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: './dist/cli.cjs'
});

await build({
  entryPoints: ['./src/github-action.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: './dist/github-action.cjs'
});

const tokenInputPath = path.resolve('node_modules/@dqbd/tiktoken/lite/tiktoken_bg.wasm');
const tokenOutputPath = path.resolve('dist/tiktoken_bg.wasm');
await copyFile(tokenInputPath, tokenOutputPath);
