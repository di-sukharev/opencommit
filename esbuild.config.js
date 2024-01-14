import { build } from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const readStream = fs.createReadStream(path.join(__dirname, './node_modules/@dqbd/tiktoken/lite/tiktoken_bg.wasm'));
const writeStream = fs.createWriteStream(path.join(__dirname, './out/tiktoken_bg.wasm'));

readStream.pipe(writeStream);
