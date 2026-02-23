/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

import type { Config } from 'jest';

const config: Config = {
  testTimeout: 100_000,
  coverageProvider: 'v8',
  moduleDirectories: ['node_modules', 'src'],
  preset: 'ts-jest/presets/default-esm',
  setupFilesAfterEnv: ['<rootDir>/test/jest-setup.ts'],
  globalSetup: '<rootDir>/test/jest-global-setup.ts',
  globalTeardown: '<rootDir>/test/jest-global-teardown.ts',
  testEnvironment: 'node',
  testRegex: ['.*\\.test\\.ts$'],
  // Tell Jest to ignore the specific duplicate package.json files
  // that are causing Haste module naming collisions
  modulePathIgnorePatterns: [
    '<rootDir>/test/e2e/prompt-module/data/'
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(cli-testing-library|@clack|cleye)/.*)'
  ],
  transform: {
    '^.+\\.(ts|tsx|js|jsx|mjs)$': [
      'ts-jest',
      {
        diagnostics: false,
        useESM: true,
        tsconfig: {
          module: 'ESNext',
          target: 'ES2022'
        }
      }
    ]
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  }
};

export default config;
