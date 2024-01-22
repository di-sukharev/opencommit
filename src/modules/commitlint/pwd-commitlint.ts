import path from 'node:path';
import { createRequire } from 'node:module';

const processPwd = process.env['PWD'] ?? process.cwd();
const nodeModulesPath = path.join(processPwd, 'node_modules', '@commitlint', 'load');

// Require from the context of the current project
const require = createRequire(processPwd);

/**
 *  This code is loading the configuration for the `@commitlint` package from the current working
 * directory (`process.env.PWD`) by requiring the `load` module from the `@commitlint` package.
 *
 * @returns
 */
export async function getCommitLintPWDConfig() {
  const load = require(nodeModulesPath).default;

  if (load && typeof load === 'function') {
    return await load();
  }

  // @commitlint/load is not a function
  return null;
}
