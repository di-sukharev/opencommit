/** @type {import("prettier").Config} */
const config = {
  endOfLine: 'auto',
  overrides: [
    {
      files: '.editorconfig',
      options: {
        parser: 'yaml'
      }
    },
    {
      files: 'LICENSE',
      options: {
        parser: 'markdown'
      }
    }
  ],
  singleQuote: true,
  trailingComma: 'none'
};

export default config;
