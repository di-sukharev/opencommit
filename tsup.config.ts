import { defineConfig } from 'tsup';
import { copyFile } from 'node:fs/promises';
import path from 'node:path';

export default defineConfig((options) => {
  return {
    entry: ['src/cli.ts'],
    shims: true,
    dts: !options.watch,
    format: ['esm', 'cjs'],
    clean: !options.watch,
    async onSuccess() {
      if (options.watch) return;
      const tokenInputPath = path.resolve('node_modules/@dqbd/tiktoken/lite/tiktoken_bg.wasm');
      const tokenOutputPath = path.resolve('dist/tiktoken_bg.wasm');
      await copyFile(tokenInputPath, tokenOutputPath);
    }
  };
});
