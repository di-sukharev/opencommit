import { build } from 'esbuild';
import fs from 'fs';

await build({
  entryPoints: ['./src/cli.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: './out/cli.cjs'
});

await build({
  entryPoints: ['./src/github-action.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: './out/github-action.cjs'
});

const wasmFile = fs.readFileSync(
  './node_modules/@dqbd/tiktoken/lite/tiktoken_bg.wasm'
);

fs.writeFileSync('./out/tiktoken_bg.wasm', wasmFile);
