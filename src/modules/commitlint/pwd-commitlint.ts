import fs from 'fs/promises';
import path from 'path';

const findModulePath = (moduleName: string) => {
  const searchPaths = [
    path.join('node_modules', moduleName),
    path.join('node_modules', '.pnpm')
  ];

  for (const basePath of searchPaths) {
    try {
      const resolvedPath = require.resolve(moduleName, { paths: [basePath] });
      return resolvedPath;
    } catch {
      // Continue to the next search path if the module is not found
    }
  }

  throw new Error(`Cannot find module ${moduleName}`);
};

const getCommitLintModuleType = async (): Promise<'cjs' | 'esm'> => {
  const packageFile = '@commitlint/load/package.json';
  const packageJsonPath = findModulePath(packageFile);
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
type QualifiedConfigOnAnyVersion = { [key: string]: unknown };

/**
 *  This code is loading the configuration for the `@commitlint` package from the current working
 * directory (`process.env.PWD`) by requiring the `load` module from the `@commitlint` package.
 *
 * @returns
 */
export const getCommitLintPWDConfig =
  async (): Promise<QualifiedConfigOnAnyVersion | null> => {
    let load: Function, modulePath: string;
    switch (await getCommitLintModuleType()) {
      case 'cjs':
        /**
         * CommonJS (<= commitlint@v18.x.x.)
         */
        modulePath = findModulePath('@commitlint/load');
        load = require(modulePath).default;
        break;
      case 'esm':
        /**
         * ES Module (commitlint@v19.x.x. <= )
         * Directory import is not supported in ES Module resolution, so import the file directly
         */
        modulePath = await findModulePath('@commitlint/load/lib/load.js');
        load = (await import(modulePath)).default;
        break;
    }

    if (load && typeof load === 'function') {
      return await load();
    }

    // @commitlint/load is not a function
    return null;
  };
