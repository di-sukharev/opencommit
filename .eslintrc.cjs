/* eslint-env node */

/** @type {import('eslint').ESLint.ConfigData} */
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/stylistic',
    // type checking is disabled
    // 'plugin:@typescript-eslint/recommended-type-checked',
    // 'plugin:@typescript-eslint/stylistic-type-checked',
    'plugin:unicorn/recommended',
    'plugin:prettier/recommended'
  ],
  overrides: [
    {
      extends: ['plugin:@typescript-eslint/disable-type-checked'],
      files: ['*.js', '*.cjs', '*.mjs']
    }
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: true,
    tsconfigRootDir: __dirname
  },
  plugins: ['@typescript-eslint', 'perfectionist'],
  root: true,
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    // Note: you must disable the base rule as it can report incorrect errors
    'no-unused-vars': 'off',
    'perfectionist/sort-objects': [
      'error',
      {
        order: 'asc',
        type: 'natural'
      }
    ],
    'unicorn/no-process-exit': 'off'
  }
};
