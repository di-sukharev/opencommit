import { build } from 'esbuild';
import fs from 'fs';
import ts from 'typescript';

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

await build({
  entryPoints: ['./src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: './out/index.cjs'
});

// src/index.ts keeps its public types self-contained, so its declarations
// can be emitted without type-checking the whole project. The `.d.cts`
// extension declares a CommonJS module like out/index.cjs, because a `.d.ts`
// file in this "type": "module" package declares an ES module.
const { outputText: libraryTypes } = ts.transpileDeclaration(
  fs.readFileSync('./src/index.ts', 'utf8'),
  { fileName: 'index.ts' }
);

fs.writeFileSync('./out/index.d.cts', libraryTypes);

const wasmFile = fs.readFileSync(
  './node_modules/@dqbd/tiktoken/lite/tiktoken_bg.wasm'
);

fs.writeFileSync('./out/tiktoken_bg.wasm', wasmFile);
