/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

import type { Config } from 'jest';

const config: Config = {
  testTimeout: 100_000,
  coverageProvider: 'v8',
  moduleDirectories: ['node_modules', 'src'],
  preset: 'ts-jest/presets/js-with-ts-esm',
  setupFilesAfterEnv: ['<rootDir>/test/jest-setup.ts'],
  testEnvironment: 'node',
  testRegex: ['.*\\.test\\.ts$'],
  transformIgnorePatterns: ['node_modules/(?!cli-testing-library)'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        diagnostics: false,
        useESM: true
      }
    ]
  }
};

export default config;
