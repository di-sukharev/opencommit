import { build } from 'tsup';
import { Command } from '@commander-js/extra-typings';
import { deleteAsync } from 'del';
import { copyFile } from 'node:fs/promises';
import path from 'node:path';

const program = new Command()
  .option('--watch', 'watch')
  .option('--copy-tiktoken', 'copy tiktoken wasm');

const options = program.opts();

await deleteAsync(['dist']);

await build({
  clean: false,
  watch: options.watch,
  entry: ['src/github-action.ts'],
  sourcemap: true,
  format: ['esm'],
  skipNodeModulesBundle: true
});

await build({
  clean: false,
  watch: options.watch,
  entry: ['src/cli.ts'],
  sourcemap: true,
  format: ['esm'],
  skipNodeModulesBundle: true
});

if (options.copyTiktoken) {
  const tokenInputPath = path.resolve('node_modules/@dqbd/tiktoken/lite/tiktoken_bg.wasm');
  const tokenOutputPath = path.resolve('dist/tiktoken_bg.wasm');
  await copyFile(tokenInputPath, tokenOutputPath);
}
