import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  clean: !options.watch,
  // dts: !options.watch,
  entry: ['src/cli.ts', 'src/github-action.ts'],
  format: ['esm']
}));
