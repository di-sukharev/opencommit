import { intro, outro } from '@clack/prompts';
import chalk from 'chalk';
import { command } from 'cleye';
import * as dotenv from 'dotenv';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { parse as iniParse, stringify as iniStringify } from 'ini';
import { homedir } from 'os';
import { join as pathJoin, resolve as pathResolve } from 'path';
import { COMMANDS } from './ENUMS';
import { TEST_MOCK_TYPES } from '../engine/testAi';
import { getI18nLocal, i18n } from '../i18n';

export enum CONFIG_KEYS {
  OCO_API_KEY = 'OCO_API_KEY',
  OCO_TOKENS_MAX_INPUT = 'OCO_TOKENS_MAX_INPUT',
  OCO_TOKENS_MAX_OUTPUT = 'OCO_TOKENS_MAX_OUTPUT',
  OCO_DESCRIPTION = 'OCO_DESCRIPTION',
  OCO_EMOJI = 'OCO_EMOJI',
  OCO_MODEL = 'OCO_MODEL',
  OCO_LANGUAGE = 'OCO_LANGUAGE',
  OCO_WHY = 'OCO_WHY',
  OCO_MESSAGE_TEMPLATE_PLACEHOLDER = 'OCO_MESSAGE_TEMPLATE_PLACEHOLDER',
  OCO_PROMPT_MODULE = 'OCO_PROMPT_MODULE',
  OCO_AI_PROVIDER = 'OCO_AI_PROVIDER',
  OCO_ONE_LINE_COMMIT = 'OCO_ONE_LINE_COMMIT',
  OCO_TEST_MOCK_TYPE = 'OCO_TEST_MOCK_TYPE',
  OCO_API_URL = 'OCO_API_URL',
  OCO_OMIT_SCOPE = 'OCO_OMIT_SCOPE',
  OCO_GITPUSH = 'OCO_GITPUSH' // todo: deprecate
}

export enum CONFIG_MODES {
  get = 'get',
  set = 'set'
}

export const MODEL_LIST = {
  openai: [
    'gpt-4o-mini',
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-instruct',
    'gpt-3.5-turbo-0613',
    'gpt-3.5-turbo-0301',
    'gpt-3.5-turbo-1106',
    'gpt-3.5-turbo-0125',
    'gpt-3.5-turbo-16k',
    'gpt-3.5-turbo-16k-0613',
    'gpt-3.5-turbo-16k-0301',
    'gpt-4',
    'gpt-4-0314',
    'gpt-4-0613',
    'gpt-4-1106-preview',
    'gpt-4-0125-preview',
    'gpt-4-turbo-preview',
    'gpt-4-vision-preview',
    'gpt-4-1106-vision-preview',
    'gpt-4-turbo',
    'gpt-4-turbo-2024-04-09',
    'gpt-4-32k',
    'gpt-4-32k-0314',
    'gpt-4-32k-0613',
    'gpt-4o',
    'gpt-4o-2024-05-13',
    'gpt-4o-mini-2024-07-18'
  ],

  anthropic: [
    'claude-3-5-sonnet-20240620',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307'
  ],

  gemini: [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-1.0-pro',
    'gemini-pro-vision',
    'text-embedding-004'
  ],

  groq: [
    'llama3-70b-8192', // Meta Llama 3 70B (default one, no daily token limit and 14 400 reqs/day)
    'llama3-8b-8192', // Meta Llama 3 8B
    'llama-guard-3-8b', // Llama Guard 3 8B
    'llama-3.1-8b-instant', // Llama 3.1 8B (Preview)
    'llama-3.1-70b-versatile', // Llama 3.1 70B (Preview)
    'gemma-7b-it', // Gemma 7B
    'gemma2-9b-it' // Gemma 2 9B
  ],

  mistral: [
    'ministral-3b-2410',
    'ministral-3b-latest',
    'ministral-8b-2410',
    'ministral-8b-latest',
    'open-mistral-7b',
    'mistral-tiny',
    'mistral-tiny-2312',
    'open-mistral-nemo',
    'open-mistral-nemo-2407',
    'mistral-tiny-2407',
    'mistral-tiny-latest',
    'open-mixtral-8x7b',
    'mistral-small',
    'mistral-small-2312',
    'open-mixtral-8x22b',
    'open-mixtral-8x22b-2404',
    'mistral-small-2402',
    'mistral-small-2409',
    'mistral-small-latest',
    'mistral-medium-2312',
    'mistral-medium',
    'mistral-medium-latest',
    'mistral-large-2402',
    'mistral-large-2407',
    'mistral-large-2411',
    'mistral-large-latest',
    'pixtral-large-2411',
    'pixtral-large-latest',
    'codestral-2405',
    'codestral-latest',
    'codestral-mamba-2407',
    'open-codestral-mamba',
    'codestral-mamba-latest',
    'pixtral-12b-2409',
    'pixtral-12b',
    'pixtral-12b-latest',
    'mistral-embed',
    'mistral-moderation-2411',
    'mistral-moderation-latest'
  ],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],

  // AI/ML API available chat-completion models
  // https://api.aimlapi.com/v1/models
  aimlapi: [
    'openai/gpt-4o',
    'gpt-4o-2024-08-06',
    'gpt-4o-2024-05-13',
    'gpt-4o-mini',
    'gpt-4o-mini-2024-07-18',
    'chatgpt-4o-latest',
    'gpt-4-turbo',
    'gpt-4-turbo-2024-04-09',
    'gpt-4',
    'gpt-4-0125-preview',
    'gpt-4-1106-preview',
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-0125',
    'gpt-3.5-turbo-1106',
    'o1-preview',
    'o1-preview-2024-09-12',
    'o1-mini',
    'o1-mini-2024-09-12',
    'o3-mini',
    'gpt-4o-audio-preview',
    'gpt-4o-mini-audio-preview',
    'gpt-4o-search-preview',
    'gpt-4o-mini-search-preview',
    'openai/gpt-4.1-2025-04-14',
    'openai/gpt-4.1-mini-2025-04-14',
    'openai/gpt-4.1-nano-2025-04-14',
    'openai/o4-mini-2025-04-16',
    'openai/o3-2025-04-16',
    'o1',
    'openai/o3-pro',
    'meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo',
    'google/gemma-2-27b-it',
    'meta-llama/Llama-Vision-Free',
    'Qwen/Qwen2-72B-Instruct',
    'mistralai/Mixtral-8x7B-Instruct-v0.1',
    'nvidia/Llama-3.1-Nemotron-70B-Instruct-HF',
    'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO',
    'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    'meta-llama/Llama-3.2-3B-Instruct-Turbo',
    'meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo',
    'meta-llama/Llama-Guard-3-11B-Vision-Turbo',
    'Qwen/Qwen2.5-7B-Instruct-Turbo',
    'Qwen/Qwen2.5-Coder-32B-Instruct',
    'meta-llama/Meta-Llama-3-8B-Instruct-Lite',
    'meta-llama/Llama-3-8b-chat-hf',
    'meta-llama/Llama-3-70b-chat-hf',
    'Qwen/Qwen2.5-72B-Instruct-Turbo',
    'Qwen/QwQ-32B',
    'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo',
    'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    'mistralai/Mistral-7B-Instruct-v0.2',
    'meta-llama/LlamaGuard-2-8b',
    'mistralai/Mistral-7B-Instruct-v0.1',
    'mistralai/Mistral-7B-Instruct-v0.3',
    'meta-llama/Meta-Llama-Guard-3-8B',
    'meta-llama/llama-4-scout',
    'meta-llama/llama-4-maverick',
    'Qwen/Qwen3-235B-A22B-fp8-tput',
    'claude-3-opus-20240229',
    'claude-3-haiku-20240307',
    'claude-3-5-sonnet-20240620',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-7-sonnet-20250219',
    'claude-sonnet-4-20250514',
    'claude-opus-4-20250514',
    'google/gemini-2.0-flash-exp',
    'google/gemini-2.0-flash',
    'google/gemini-2.5-pro',
    'google/gemini-2.5-flash',
    'deepseek-chat',
    'deepseek-reasoner',
    'qwen-max',
    'qwen-plus',
    'qwen-turbo',
    'qwen-max-2025-01-25',
    'mistralai/mistral-tiny',
    'mistralai/mistral-nemo',
    'anthracite-org/magnum-v4-72b',
    'nvidia/llama-3.1-nemotron-70b-instruct',
    'cohere/command-r-plus',
    'mistralai/codestral-2501',
    'google/gemma-3-4b-it',
    'google/gemma-3-12b-it',
    'google/gemma-3-27b-it',
    'google/gemini-2.5-flash-lite-preview',
    'deepseek/deepseek-prover-v2',
    'google/gemma-3n-e4b-it',
    'cohere/command-a',
    'MiniMax-Text-01',
    'abab6.5s-chat',
    'minimax/m1',
    'bagoodex/bagoodex-search-v1',
    'moonshot/kimi-k2-preview',
    'perplexity/sonar',
    'perplexity/sonar-pro',
    'x-ai/grok-4-07-09',
    'x-ai/grok-3-beta',
    'x-ai/grok-3-mini-beta',
  ],
};

const getDefaultModel = (provider: string | undefined): string => {
  switch (provider) {
    case 'ollama':
      return '';
    case 'mlx':
      return '';
    case 'anthropic':
      return MODEL_LIST.anthropic[0];
    case 'gemini':
      return MODEL_LIST.gemini[0];
    case 'groq':
      return MODEL_LIST.groq[0];
    case 'mistral':
      return MODEL_LIST.mistral[0];
    case 'deepseek':
      return MODEL_LIST.deepseek[0];
    case 'aimlapi':
      return MODEL_LIST.aimlapi[0];
    default:
      return MODEL_LIST.openai[0];
  }
};

export enum DEFAULT_TOKEN_LIMITS {
  DEFAULT_MAX_TOKENS_INPUT = 40960,
  DEFAULT_MAX_TOKENS_OUTPUT = 4096
}

const validateConfig = (
  key: string,
  condition: any,
  validationMessage: string
) => {
  if (!condition) {
    outro(`${chalk.red('✖')} wrong value for ${key}: ${validationMessage}.`);

    outro(
      'For more help refer to docs https://github.com/di-sukharev/opencommit'
    );

    process.exit(1);
  }
};

export const configValidators = {
  [CONFIG_KEYS.OCO_API_KEY](value: any, config: any = {}) {
    if (config.OCO_AI_PROVIDER !== 'openai') return value;

    validateConfig(
      'OCO_API_KEY',
      typeof value === 'string' && value.length > 0,
      'Empty value is not allowed'
    );

    validateConfig(
      'OCO_API_KEY',
      value,
      'You need to provide the OCO_API_KEY when OCO_AI_PROVIDER set to "openai" (default) or "ollama" or "mlx" or "azure" or "gemini" or "flowise" or "anthropic" or "deepseek". Run `oco config set OCO_API_KEY=your_key OCO_AI_PROVIDER=openai`'
    );

    return value;
  },

  [CONFIG_KEYS.OCO_DESCRIPTION](value: any) {
    validateConfig(
      CONFIG_KEYS.OCO_DESCRIPTION,
      typeof value === 'boolean',
      'Must be boolean: true or false'
    );

    return value;
  },

  [CONFIG_KEYS.OCO_TOKENS_MAX_INPUT](value: any) {
    value = parseInt(value);
    validateConfig(
      CONFIG_KEYS.OCO_TOKENS_MAX_INPUT,
      !isNaN(value),
      'Must be a number'
    );

    return value;
  },

  [CONFIG_KEYS.OCO_TOKENS_MAX_OUTPUT](value: any) {
    value = parseInt(value);
    validateConfig(
      CONFIG_KEYS.OCO_TOKENS_MAX_OUTPUT,
      !isNaN(value),
      'Must be a number'
    );

    return value;
  },

  [CONFIG_KEYS.OCO_EMOJI](value: any) {
    validateConfig(
      CONFIG_KEYS.OCO_EMOJI,
      typeof value === 'boolean',
      'Must be boolean: true or false'
    );

    return value;
  },

  [CONFIG_KEYS.OCO_OMIT_SCOPE](value: any) {
    validateConfig(
      CONFIG_KEYS.OCO_OMIT_SCOPE,
      typeof value === 'boolean',
      'Must be boolean: true or false'
    );

    return value;
  },

  [CONFIG_KEYS.OCO_LANGUAGE](value: any) {
    const supportedLanguages = Object.keys(i18n);

    validateConfig(
      CONFIG_KEYS.OCO_LANGUAGE,
      getI18nLocal(value),
      `${value} is not supported yet. Supported languages: ${supportedLanguages}`
    );

    return getI18nLocal(value);
  },

  [CONFIG_KEYS.OCO_API_URL](value: any) {
    validateConfig(
      CONFIG_KEYS.OCO_API_URL,
      typeof value === 'string',
      `${value} is not a valid URL. It should start with 'http://' or 'https://'.`
    );
    return value;
  },

  [CONFIG_KEYS.OCO_MODEL](value: any, config: any = {}) {
    validateConfig(
      CONFIG_KEYS.OCO_MODEL,
      typeof value === 'string',
      `${value} is not supported yet, use:\n\n ${[
        ...MODEL_LIST.openai,
        ...MODEL_LIST.anthropic,
        ...MODEL_LIST.gemini
      ].join('\n')}`
    );
    return value;
  },

  [CONFIG_KEYS.OCO_MESSAGE_TEMPLATE_PLACEHOLDER](value: any) {
    validateConfig(
      CONFIG_KEYS.OCO_MESSAGE_TEMPLATE_PLACEHOLDER,
      value.startsWith('$'),
      `${value} must start with $, for example: '$msg'`
    );
    return value;
  },

  [CONFIG_KEYS.OCO_PROMPT_MODULE](value: any) {
    validateConfig(
      CONFIG_KEYS.OCO_PROMPT_MODULE,
      ['conventional-commit', '@commitlint'].includes(value),
      `${value} is not supported yet, use '@commitlint' or 'conventional-commit' (default)`
    );
    return value;
  },

  // todo: deprecate
  [CONFIG_KEYS.OCO_GITPUSH](value: any) {
    validateConfig(
      CONFIG_KEYS.OCO_GITPUSH,
      typeof value === 'boolean',
      'Must be true or false'
    );
    return value;
  },

  [CONFIG_KEYS.OCO_AI_PROVIDER](value: any) {
    if (!value) value = 'openai';

    validateConfig(
      CONFIG_KEYS.OCO_AI_PROVIDER,
      [
        'openai',
        'mistral',
        'anthropic',
        'gemini',
        'azure',
        'test',
        'flowise',
        'groq',
        'deepseek',
        'aimlapi',
      ].includes(value) || value.startsWith('ollama'),
      `${value} is not supported yet, use 'ollama', 'mlx', 'anthropic', 'azure', 'gemini', 'flowise', 'mistral', 'deepseek', 'aimlapi' or 'openai' (default)`
    );

    return value;
  },

  [CONFIG_KEYS.OCO_ONE_LINE_COMMIT](value: any) {
    validateConfig(
      CONFIG_KEYS.OCO_ONE_LINE_COMMIT,
      typeof value === 'boolean',
      'Must be true or false'
    );

    return value;
  },

  [CONFIG_KEYS.OCO_TEST_MOCK_TYPE](value: any) {
    validateConfig(
      CONFIG_KEYS.OCO_TEST_MOCK_TYPE,
      TEST_MOCK_TYPES.includes(value),
      `${value} is not supported yet, use ${TEST_MOCK_TYPES.map(
        (t) => `'${t}'`
      ).join(', ')}`
    );
    return value;
  },

  [CONFIG_KEYS.OCO_WHY](value: any) {
    validateConfig(
      CONFIG_KEYS.OCO_WHY,
      typeof value === 'boolean',
      'Must be true or false'
    );
    return value;
  }
};

export enum OCO_AI_PROVIDER_ENUM {
  OLLAMA = 'ollama',
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GEMINI = 'gemini',
  AZURE = 'azure',
  TEST = 'test',
  FLOWISE = 'flowise',
  GROQ = 'groq',
  MISTRAL = 'mistral',
  MLX = 'mlx',
  DEEPSEEK = 'deepseek',
  AIMLAPI = 'aimlapi',
}

export type ConfigType = {
  [CONFIG_KEYS.OCO_API_KEY]?: string;
  [CONFIG_KEYS.OCO_TOKENS_MAX_INPUT]: number;
  [CONFIG_KEYS.OCO_TOKENS_MAX_OUTPUT]: number;
  [CONFIG_KEYS.OCO_API_URL]?: string;
  [CONFIG_KEYS.OCO_DESCRIPTION]: boolean;
  [CONFIG_KEYS.OCO_EMOJI]: boolean;
  [CONFIG_KEYS.OCO_WHY]: boolean;
  [CONFIG_KEYS.OCO_MODEL]: string;
  [CONFIG_KEYS.OCO_LANGUAGE]: string;
  [CONFIG_KEYS.OCO_MESSAGE_TEMPLATE_PLACEHOLDER]: string;
  [CONFIG_KEYS.OCO_PROMPT_MODULE]: OCO_PROMPT_MODULE_ENUM;
  [CONFIG_KEYS.OCO_AI_PROVIDER]: OCO_AI_PROVIDER_ENUM;
  [CONFIG_KEYS.OCO_GITPUSH]: boolean;
  [CONFIG_KEYS.OCO_ONE_LINE_COMMIT]: boolean;
  [CONFIG_KEYS.OCO_OMIT_SCOPE]: boolean;
  [CONFIG_KEYS.OCO_TEST_MOCK_TYPE]: string;
};

export const defaultConfigPath = pathJoin(homedir(), '.opencommit');
export const defaultEnvPath = pathResolve(process.cwd(), '.env');

const assertConfigsAreValid = (config: Record<string, any>) => {
  for (const [key, value] of Object.entries(config)) {
    if (!value) continue;

    if (typeof value === 'string' && ['null', 'undefined'].includes(value)) {
      config[key] = undefined;
      continue;
    }

    try {
      const validate = configValidators[key as CONFIG_KEYS];
      validate(value, config);
    } catch (error) {
      outro(`Unknown '${key}' config option or missing validator.`);
      outro(
        `Manually fix the '.env' file or global '~/.opencommit' config file.`
      );

      process.exit(1);
    }
  }
};

enum OCO_PROMPT_MODULE_ENUM {
  CONVENTIONAL_COMMIT = 'conventional-commit',
  COMMITLINT = '@commitlint'
}

export const DEFAULT_CONFIG = {
  OCO_TOKENS_MAX_INPUT: DEFAULT_TOKEN_LIMITS.DEFAULT_MAX_TOKENS_INPUT,
  OCO_TOKENS_MAX_OUTPUT: DEFAULT_TOKEN_LIMITS.DEFAULT_MAX_TOKENS_OUTPUT,
  OCO_DESCRIPTION: false,
  OCO_EMOJI: false,
  OCO_MODEL: getDefaultModel('openai'),
  OCO_LANGUAGE: 'en',
  OCO_MESSAGE_TEMPLATE_PLACEHOLDER: '$msg',
  OCO_PROMPT_MODULE: OCO_PROMPT_MODULE_ENUM.CONVENTIONAL_COMMIT,
  OCO_AI_PROVIDER: OCO_AI_PROVIDER_ENUM.OPENAI,
  OCO_ONE_LINE_COMMIT: false,
  OCO_TEST_MOCK_TYPE: 'commit-message',
  OCO_WHY: false,
  OCO_OMIT_SCOPE: false,
  OCO_GITPUSH: true // todo: deprecate
};

const initGlobalConfig = (configPath: string = defaultConfigPath) => {
  writeFileSync(configPath, iniStringify(DEFAULT_CONFIG), 'utf8');
  return DEFAULT_CONFIG;
};

const parseConfigVarValue = (value?: any) => {
  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
};

const getEnvConfig = (envPath: string) => {
  dotenv.config({ path: envPath });

  return {
    OCO_MODEL: process.env.OCO_MODEL,
    OCO_API_URL: process.env.OCO_API_URL,
    OCO_API_KEY: process.env.OCO_API_KEY,
    OCO_AI_PROVIDER: process.env.OCO_AI_PROVIDER as OCO_AI_PROVIDER_ENUM,

    OCO_TOKENS_MAX_INPUT: parseConfigVarValue(process.env.OCO_TOKENS_MAX_INPUT),
    OCO_TOKENS_MAX_OUTPUT: parseConfigVarValue(
      process.env.OCO_TOKENS_MAX_OUTPUT
    ),

    OCO_DESCRIPTION: parseConfigVarValue(process.env.OCO_DESCRIPTION),
    OCO_EMOJI: parseConfigVarValue(process.env.OCO_EMOJI),
    OCO_LANGUAGE: process.env.OCO_LANGUAGE,
    OCO_MESSAGE_TEMPLATE_PLACEHOLDER:
      process.env.OCO_MESSAGE_TEMPLATE_PLACEHOLDER,
    OCO_PROMPT_MODULE: process.env.OCO_PROMPT_MODULE as OCO_PROMPT_MODULE_ENUM,
    OCO_ONE_LINE_COMMIT: parseConfigVarValue(process.env.OCO_ONE_LINE_COMMIT),
    OCO_TEST_MOCK_TYPE: process.env.OCO_TEST_MOCK_TYPE,
    OCO_OMIT_SCOPE: parseConfigVarValue(process.env.OCO_OMIT_SCOPE),

    OCO_GITPUSH: parseConfigVarValue(process.env.OCO_GITPUSH) // todo: deprecate
  };
};

export const setGlobalConfig = (
  config: ConfigType,
  configPath: string = defaultConfigPath
) => {
  writeFileSync(configPath, iniStringify(config), 'utf8');
};

export const getIsGlobalConfigFileExist = (
  configPath: string = defaultConfigPath
) => {
  return existsSync(configPath);
};

export const getGlobalConfig = (configPath: string = defaultConfigPath) => {
  let globalConfig: ConfigType;

  const isGlobalConfigFileExist = getIsGlobalConfigFileExist(configPath);
  if (!isGlobalConfigFileExist) globalConfig = initGlobalConfig(configPath);
  else {
    const configFile = readFileSync(configPath, 'utf8');
    globalConfig = iniParse(configFile) as ConfigType;
  }

  return globalConfig;
};

/**
 * Merges two configs.
 * Env config takes precedence over global ~/.opencommit config file
 * @param main - env config
 * @param fallback - global ~/.opencommit config file
 * @returns merged config
 */
const mergeConfigs = (main: Partial<ConfigType>, fallback: ConfigType) => {
  const allKeys = new Set([...Object.keys(main), ...Object.keys(fallback)]);
  return Array.from(allKeys).reduce((acc, key) => {
    acc[key] = parseConfigVarValue(main[key] ?? fallback[key]);
    return acc;
  }, {} as ConfigType);
};

interface GetConfigOptions {
  globalPath?: string;
  envPath?: string;
  setDefaultValues?: boolean;
}

const cleanUndefinedValues = (config: ConfigType) => {
  return Object.fromEntries(
    Object.entries(config).map(([_, v]) => {
      try {
        if (typeof v === 'string') {
          if (v === 'undefined') return [_, undefined];
          if (v === 'null') return [_, null];

          const parsedValue = JSON.parse(v);
          return [_, parsedValue];
        }
        return [_, v];
      } catch (error) {
        return [_, v];
      }
    })
  );
};

export const getConfig = ({
  envPath = defaultEnvPath,
  globalPath = defaultConfigPath
}: GetConfigOptions = {}): ConfigType => {
  const envConfig = getEnvConfig(envPath);
  const globalConfig = getGlobalConfig(globalPath);

  const config = mergeConfigs(envConfig, globalConfig);

  const cleanConfig = cleanUndefinedValues(config);

  return cleanConfig as ConfigType;
};

export const setConfig = (
  keyValues: [key: string, value: string | boolean | number | null][],
  globalConfigPath: string = defaultConfigPath
) => {
  const config = getConfig({
    globalPath: globalConfigPath
  });

  const configToSet = {};

  for (let [key, value] of keyValues) {
    if (!configValidators.hasOwnProperty(key)) {
      const supportedKeys = Object.keys(configValidators).join('\n');
      throw new Error(
        `Unsupported config key: ${key}. Expected keys are:\n\n${supportedKeys}.\n\nFor more help refer to our docs: https://github.com/di-sukharev/opencommit`
      );
    }

    let parsedConfigValue;

    try {
      if (typeof value === 'string') parsedConfigValue = JSON.parse(value);
      else parsedConfigValue = value;
    } catch (error) {
      parsedConfigValue = value;
    }

    const validValue = configValidators[key as CONFIG_KEYS](
      parsedConfigValue,
      config
    );

    configToSet[key] = validValue;
  }

  setGlobalConfig(mergeConfigs(configToSet, config), globalConfigPath);

  outro(`${chalk.green('✔')} config successfully set`);
};

export const configCommand = command(
  {
    name: COMMANDS.config,
    parameters: ['<mode>', '<key=values...>']
  },
  async (argv) => {
    try {
      const { mode, keyValues } = argv._;
      intro(`COMMAND: config ${mode} ${keyValues}`);

      if (mode === CONFIG_MODES.get) {
        const config = getConfig() || {};
        for (const key of keyValues) {
          outro(`${key}=${config[key as keyof typeof config]}`);
        }
      } else if (mode === CONFIG_MODES.set) {
        await setConfig(
          keyValues.map((keyValue) => keyValue.split('=') as [string, string])
        );
      } else {
        throw new Error(
          `Unsupported mode: ${mode}. Valid modes are: "set" and "get"`
        );
      }
    } catch (error) {
      outro(`${chalk.red('✖')} ${error}`);
      process.exit(1);
    }
  }
);
