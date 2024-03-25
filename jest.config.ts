/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

import type {Config} from 'jest';

const config: Config = {
  coverageProvider: "v8",
  moduleDirectories: [
    "node_modules",
    "src",
  ],
  preset: 'ts-jest',
  setupFilesAfterEnv: ['<rootDir>/test/jest-setup.ts'],
  testEnvironment: "node",
  testRegex: [
    '.*\\.test\\.ts$',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      diagnostics: false,
    }],
  }
};

export default config;
