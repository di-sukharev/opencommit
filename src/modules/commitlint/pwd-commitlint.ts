import fs from 'fs/promises';
import path from 'path';

const getCommitLintModuleType = async (): Promise<'cjs' | 'esm'> => {
  const packageFile = 'node_modules/@commitlint/load/package.json';
  const packageJsonPath = path.join(
    process.env.PWD || process.cwd(),
    packageFile,
  );
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
  if (!packageJson) {
    throw new Error(`Failed to parse ${packageFile}`);
  }

  return packageJson.type === 'module' ? 'esm' : 'cjs';
};

/**
 * QualifiedConfig from any version of @commitlint/types
 * @see https://github.com/conventional-changelog/commitlint/blob/master/@commitlint/types/src/load.ts
 */
type QualifiedConfigOnAnyVersion = { [key:string]: unknown };

/**
 *  This code is loading the configuration for the `@commitlint` package from the current working
 * directory (`process.env.PWD`) by requiring the `load` module from the `@commitlint` package.
 *
 * @returns
 */
export const getCommitLintPWDConfig = async (): Promise<QualifiedConfigOnAnyVersion | null> => {
  let load, nodeModulesPath;
  switch (await getCommitLintModuleType()) {
    case 'cjs':
      /**
       * CommonJS (<= commitlint@v18.x.x.)
       */
      nodeModulesPath = path.join(
        process.env.PWD || process.cwd(),
        'node_modules/@commitlint/load',
      );
      load = require(nodeModulesPath).default;
      break;
    case 'esm':
      /**
       * ES Module (commitlint@v19.x.x. <= )
       * Directory import is not supported in ES Module resolution, so import the file directly
       */
      nodeModulesPath = path.join(
        process.env.PWD || process.cwd(),
        'node_modules/@commitlint/load/lib/load.js',
      );
      load = (await import(nodeModulesPath)).default;
      break;
  }

  if (load && typeof load === 'function') {
    return await load();
  }

  // @commitlint/load is not a function
  return null;
};
