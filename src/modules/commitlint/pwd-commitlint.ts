import path from 'path';

const nodeModulesPath = path.join(
  process.env.PWD || process.cwd(),
  'node_modules',
  '@commitlint',
  'load'
);

/**
 *  This code is loading the configuration for the `@commitlint` package from the current working
 * directory (`process.env.PWD`) by requiring the `load` module from the `@commitlint` package.
 *
 * @returns
 */
export const getCommitLintPWDConfig = async () => {
  const load = require(nodeModulesPath).default;

  if (load && typeof load === 'function') {
    return await load();
  }

  // @commitlint/load is not a function
  return null;
};
