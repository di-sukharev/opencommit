import { jest } from '@jest/globals';

const CANCEL = Symbol('cancel');

const introMock = jest.fn();
const outroMock = jest.fn();
const selectMock = jest.fn();
const textMock = jest.fn();
const isCancelMock = jest.fn((value: unknown) => value === CANCEL);
const spinnerMock = jest.fn(() => ({
  start: jest.fn(),
  stop: jest.fn()
}));

const getConfigMock = jest.fn();
const setGlobalConfigMock = jest.fn();
const getGlobalConfigMock = jest.fn(() => ({}));
const getIsGlobalConfigFileExistMock = jest.fn();
const consoleLogMock = jest.spyOn(console, 'log').mockImplementation(() => {});

let currentConfig: Record<string, unknown> = {};
let globalConfigExists = false;

const OCO_AI_PROVIDER_ENUM = {
  OLLAMA: 'ollama',
  LLAMACPP: 'llamacpp',
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GEMINI: 'gemini',
  AZURE: 'azure',
  TEST: 'test',
  FLOWISE: 'flowise',
  GROQ: 'groq',
  MISTRAL: 'mistral',
  MLX: 'mlx',
  DEEPSEEK: 'deepseek',
  AIMLAPI: 'aimlapi',
  OPENROUTER: 'openrouter',
  ORCAROUTER: 'orcarouter'
} as const;

jest.unstable_mockModule('@clack/prompts', () => ({
  intro: introMock,
  outro: outroMock,
  select: selectMock,
  text: textMock,
  isCancel: isCancelMock,
  spinner: spinnerMock
}));

jest.unstable_mockModule('cleye', () => ({
  command: jest.fn(() => ({}))
}));

jest.unstable_mockModule('commands/config', () => ({
  CONFIG_KEYS: {},
  MODEL_LIST: {},
  OCO_AI_PROVIDER_ENUM,
  getConfig: getConfigMock,
  setGlobalConfig: setGlobalConfigMock,
  getGlobalConfig: getGlobalConfigMock,
  getIsGlobalConfigFileExist: getIsGlobalConfigFileExistMock,
  DEFAULT_CONFIG: {},
  PROVIDER_API_KEY_URLS: {},
  RECOMMENDED_MODELS: {}
}));

jest.unstable_mockModule('utils/modelCache', () => ({
  fetchModelsForProvider: jest.fn(),
  fetchOllamaModels: jest.fn(),
  getCacheInfo: jest.fn(() => ({ timestamp: null, providers: [] }))
}));

const { isFirstRun, promptForMissingApiKey, runSetup } = await import(
  'commands/setup'
);

const PRIMARY_OPTIONS = [
  { value: 'openai', label: 'OpenAI (GPT)' },
  { value: 'anthropic', label: 'Anthropic (Claude Sonnet, Opus)' },
  { value: 'ollama', label: 'Ollama (Free, runs locally)' },
  { value: 'llamacpp', label: 'llama.cpp (Free, runs locally)' },
  { value: 'other', label: 'Other providers...' }
];

const OTHER_OPTIONS = [
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'groq', label: 'Groq (Fast inference, free tier)' },
  { value: 'mistral', label: 'Mistral AI' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'openrouter', label: 'OpenRouter (Multiple providers)' },
  { value: 'orcarouter', label: 'OrcaRouter (Smart routing gateway)' },
  { value: 'aimlapi', label: 'AI/ML API' },
  { value: 'azure', label: 'Azure OpenAI' },
  { value: 'mlx', label: 'MLX (Apple Silicon, local)' }
];

describe('setup provider behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentConfig = {};
    globalConfigExists = false;
    getConfigMock.mockImplementation(() => currentConfig);
    getIsGlobalConfigFileExistMock.mockImplementation(() => globalConfigExists);
  });

  afterAll(() => {
    consoleLogMock.mockRestore();
  });

  it('preserves primary provider order and labels', async () => {
    selectMock.mockResolvedValueOnce(CANCEL);

    await expect(runSetup()).resolves.toBe(false);
    expect(selectMock).toHaveBeenCalledWith({
      message: 'Select your AI provider:',
      options: PRIMARY_OPTIONS
    });
  });

  it('preserves secondary provider order and labels', async () => {
    selectMock.mockResolvedValueOnce('other').mockResolvedValueOnce(CANCEL);

    await expect(runSetup()).resolves.toBe(false);
    expect(selectMock).toHaveBeenNthCalledWith(2, {
      message: 'Select provider:',
      options: OTHER_OPTIONS
    });
  });

  it.each(['ollama', 'mlx', 'llamacpp'])(
    'requires a model on first run for %s',
    (provider) => {
      currentConfig = { OCO_AI_PROVIDER: provider, OCO_MODEL: '' };
      expect(isFirstRun()).toBe(true);

      currentConfig = { OCO_AI_PROVIDER: provider, OCO_MODEL: 'local-model' };
      expect(isFirstRun()).toBe(false);
    }
  );

  it.each([
    'openai',
    'anthropic',
    'gemini',
    'azure',
    'flowise',
    'groq',
    'mistral',
    'deepseek',
    'aimlapi',
    'openrouter'
  ])('requires an API key on first run for %s', (provider) => {
    currentConfig = { OCO_AI_PROVIDER: provider, OCO_API_KEY: '' };
    expect(isFirstRun()).toBe(true);

    currentConfig = { OCO_AI_PROVIDER: provider, OCO_API_KEY: 'provider-key' };
    expect(isFirstRun()).toBe(false);
  });

  it('does not trigger first-run setup for the test provider', () => {
    currentConfig = { OCO_AI_PROVIDER: 'test' };

    expect(isFirstRun()).toBe(false);
  });

  it('defaults a missing provider to OpenAI API-key behavior', () => {
    currentConfig = { OCO_API_KEY: '' };
    expect(isFirstRun()).toBe(true);

    currentConfig = { OCO_API_KEY: 'openai-key' };
    expect(isFirstRun()).toBe(false);
  });

  it('defaults an unknown provider to API-key behavior', () => {
    currentConfig = { OCO_AI_PROVIDER: 'future-provider', OCO_API_KEY: '' };
    expect(isFirstRun()).toBe(true);

    currentConfig = {
      OCO_AI_PROVIDER: 'future-provider',
      OCO_API_KEY: 'future-key'
    };
    expect(isFirstRun()).toBe(false);
  });

  it('does not trigger setup when a global config file already exists', () => {
    globalConfigExists = true;
    currentConfig = { OCO_AI_PROVIDER: 'openai', OCO_API_KEY: '' };

    expect(isFirstRun()).toBe(false);
  });

  it.each(['ollama', 'llamacpp', 'mlx', 'test'])(
    'does not prompt %s for an API key',
    async (provider) => {
      currentConfig = { OCO_AI_PROVIDER: provider, OCO_API_KEY: '' };

      await expect(promptForMissingApiKey()).resolves.toBe(true);
      expect(textMock).not.toHaveBeenCalled();
      expect(setGlobalConfigMock).not.toHaveBeenCalled();
    }
  );

  it.each(['flowise', 'future-provider'])(
    'keeps %s on the API-key prompt path',
    async (provider) => {
      currentConfig = { OCO_AI_PROVIDER: provider, OCO_API_KEY: '' };
      textMock.mockResolvedValueOnce(CANCEL);

      await expect(promptForMissingApiKey()).resolves.toBe(false);
      expect(textMock).toHaveBeenCalledTimes(1);
      expect(setGlobalConfigMock).not.toHaveBeenCalled();
    }
  );
});
