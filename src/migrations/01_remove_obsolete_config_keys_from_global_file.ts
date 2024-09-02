export default function () {
  const obsoleteKeys = [
    'OCO_OLLAMA_API_KEY',
    'OCO_OLLAMA_API_URL',
    'OCO_ANTHROPIC_API_KEY',
    'OCO_ANTHROPIC_BASE_PATH',
    'OCO_OPENAI_API_KEY',
    'OCO_OPENAI_BASE_PATH',
    'OCO_AZURE_API_KEY',
    'OCO_AZURE_ENDPOINT',
    'OCO_GEMINI_API_KEY',
    'OCO_GEMINI_BASE_PATH',
    'OCO_FLOWISE_API_KEY',
    'OCO_FLOWISE_ENDPOINT'
  ];

  obsoleteKeys.forEach((key) => {
    // if (config[key]) {
    //   setConfig([[key, undefined]]);
    // }
  });
}
