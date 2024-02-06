import { defineConfig } from 'tsup';
import { copyFile } from 'node:fs/promises';
import path from 'node:path';

export default defineConfig((options) => {
  return {
    clean: !options.watch,
    dts: !options.watch,
    entry: ['src/cli.ts'],
    format: ['esm', 'cjs'],
    async onSuccess() {
      if (options.watch) return;
      const tokenInputPath = path.resolve('node_modules/@dqbd/tiktoken/lite/tiktoken_bg.wasm');
      const tokenOutputPath = path.resolve('dist/tiktoken_bg.wasm');
      await copyFile(tokenInputPath, tokenOutputPath);
    },
    shims: true
  };
});
