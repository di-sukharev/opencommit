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
  testEnvironment: 'node',
  testRegex: ['.*\\.test\\.ts$'],
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
  // Fix Haste module naming collision
  modulePathIgnorePatterns: [
    '<rootDir>/test/e2e/prompt-module/data/'
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  }
};

export default config;
