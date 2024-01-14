/** @type {import("prettier").Options} */
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
  plugins: ['prettier-plugin-packagejson'],
  singleQuote: true,
  trailingComma: 'none'
};

export default config;
