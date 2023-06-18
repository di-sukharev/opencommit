import path from 'path';

const nodeModulesPath = path.join(
  process.env.PWD as string,
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
  let commitLintConfig = null;
  const load = require(nodeModulesPath).default;

  if (load && typeof load === 'function') {
    commitLintConfig = await load();
  } else {
    // @commitlint/load is not a function
  }

  return commitLintConfig;
};
