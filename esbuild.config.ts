import { build } from 'esbuild';
import { copyFile } from 'node:fs/promises';
import path from 'node:path';

await build({
  bundle: true,
  entryPoints: ['./src/cli.ts'],
  format: 'cjs',
  outfile: './dist/cli.cjs',
  platform: 'node'
});

await build({
  bundle: true,
  entryPoints: ['./src/github-action.ts'],
  format: 'cjs',
  outfile: './dist/github-action.cjs',
  platform: 'node'
});

const tokenInputPath = path.resolve('node_modules/@dqbd/tiktoken/lite/tiktoken_bg.wasm');
const tokenOutputPath = path.resolve('dist/tiktoken_bg.wasm');
await copyFile(tokenInputPath, tokenOutputPath);
