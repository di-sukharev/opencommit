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
  OCO_OPENAI_API_KEY = 'OCO_OPENAI_API_KEY',
  OCO_ANTHROPIC_API_KEY = 'OCO_ANTHROPIC_API_KEY',
  OCO_AZURE_API_KEY = 'OCO_AZURE_API_KEY',
  OCO_GEMINI_API_KEY = 'OCO_GEMINI_API_KEY',
  OCO_GEMINI_BASE_PATH = 'OCO_GEMINI_BASE_PATH',
  OCO_TOKENS_MAX_INPUT = 'OCO_TOKENS_MAX_INPUT',
  OCO_TOKENS_MAX_OUTPUT = 'OCO_TOKENS_MAX_OUTPUT',
  OCO_OPENAI_BASE_PATH = 'OCO_OPENAI_BASE_PATH',
  OCO_DESCRIPTION = 'OCO_DESCRIPTION',
  OCO_EMOJI = 'OCO_EMOJI',
  OCO_MODEL = 'OCO_MODEL',
  OCO_LANGUAGE = 'OCO_LANGUAGE',
  OCO_WHY = 'OCO_WHY',
  OCO_MESSAGE_TEMPLATE_PLACEHOLDER = 'OCO_MESSAGE_TEMPLATE_PLACEHOLDER',
  OCO_PROMPT_MODULE = 'OCO_PROMPT_MODULE',
  OCO_AI_PROVIDER = 'OCO_AI_PROVIDER',
  OCO_GITPUSH = 'OCO_GITPUSH', // todo: deprecate
  OCO_ONE_LINE_COMMIT = 'OCO_ONE_LINE_COMMIT',
  OCO_AZURE_ENDPOINT = 'OCO_AZURE_ENDPOINT',
  OCO_TEST_MOCK_TYPE = 'OCO_TEST_MOCK_TYPE',
  OCO_API_URL = 'OCO_API_URL',
  OCO_OLLAMA_API_URL = 'OCO_OLLAMA_API_URL',
  OCO_FLOWISE_ENDPOINT = 'OCO_FLOWISE_ENDPOINT',
  OCO_FLOWISE_API_KEY = 'OCO_FLOWISE_API_KEY'
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
  ]
};

const getDefaultModel = (provider: string | undefined): string => {
  switch (provider) {
    case 'ollama':
      return '';
    case 'anthropic':
      return MODEL_LIST.anthropic[0];
    case 'gemini':
      return MODEL_LIST.gemini[0];
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
  [CONFIG_KEYS.OCO_OPENAI_API_KEY](value: any, config: any = {}) {
    if (config.OCO_AI_PROVIDER !== 'openai') return value;

    validateConfig(
      'OCO_OPENAI_API_KEY',
      typeof value === 'string' && value.length > 0,
      'Empty value is not allowed'
    );

    validateConfig(
      'OCO_OPENAI_API_KEY',
      value,
      'You need to provide the OCO_OPENAI_API_KEY when OCO_AI_PROVIDER is set to "openai" (default). Run `oco config set OCO_OPENAI_API_KEY=your_key`'
    );

    return value;
  },

  [CONFIG_KEYS.OCO_AZURE_API_KEY](value: any, config: any = {}) {
    if (config.OCO_AI_PROVIDER !== 'azure') return value;

    validateConfig(
      'OCO_AZURE_API_KEY',
      !!value,
      'You need to provide the OCO_AZURE_API_KEY when OCO_AI_PROVIDER is set to "azure". Run: `oco config set OCO_AZURE_API_KEY=your_key`'
    );

    return value;
  },

  [CONFIG_KEYS.OCO_GEMINI_API_KEY](value: any, config: any = {}) {
    if (config.OCO_AI_PROVIDER !== 'gemini') return value;

    validateConfig(
      'OCO_GEMINI_API_KEY',
      value || config.OCO_GEMINI_API_KEY || config.OCO_AI_PROVIDER === 'test',
      'You need to provide the OCO_GEMINI_API_KEY when OCO_AI_PROVIDER is set to "gemini". Run: `oco config set OCO_GEMINI_API_KEY=your_key`'
    );

    return value;
  },

  [CONFIG_KEYS.OCO_ANTHROPIC_API_KEY](value: any, config: any = {}) {
    if (config.OCO_AI_PROVIDER !== 'anthropic') return value;

    validateConfig(
      'ANTHROPIC_API_KEY',
      !!value,
      'You need to provide the OCO_ANTHROPIC_API_KEY key when OCO_AI_PROVIDER is set to "anthropic". Run: `oco config set OCO_ANTHROPIC_API_KEY=your_key`'
    );

    return value;
  },

  [CONFIG_KEYS.OCO_FLOWISE_API_KEY](value: any, config: any = {}) {
    validateConfig(
      CONFIG_KEYS.OCO_FLOWISE_API_KEY,
      value || config.OCO_AI_PROVIDER !== 'flowise',
      'You need to provide the OCO_FLOWISE_API_KEY when OCO_AI_PROVIDER is set to "flowise". Run: `oco config set OCO_FLOWISE_API_KEY=your_key`'
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

  [CONFIG_KEYS.OCO_LANGUAGE](value: any) {
    const supportedLanguages = Object.keys(i18n);

    validateConfig(
      CONFIG_KEYS.OCO_LANGUAGE,
      getI18nLocal(value),
      `${value} is not supported yet. Supported languages: ${supportedLanguages}`
    );

    return getI18nLocal(value);
  },

  [CONFIG_KEYS.OCO_OPENAI_BASE_PATH](value: any) {
    validateConfig(
      CONFIG_KEYS.OCO_OPENAI_BASE_PATH,
      typeof value === 'string',
      'Must be string'
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
      ['openai', 'anthropic', 'gemini', 'azure', 'test', 'flowise'].includes(
        value
      ) || value.startsWith('ollama'),
      `${value} is not supported yet, use 'ollama', 'anthropic', 'azure', 'gemini', 'flowise' or 'openai' (default)`
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

  [CONFIG_KEYS.OCO_AZURE_ENDPOINT](value: any) {
    validateConfig(
      CONFIG_KEYS.OCO_AZURE_ENDPOINT,
      value.includes('openai.azure.com'),
      'Must be in format "https://<resource name>.openai.azure.com/"'
    );

    return value;
  },

  [CONFIG_KEYS.OCO_FLOWISE_ENDPOINT](value: any) {
    validateConfig(
      CONFIG_KEYS.OCO_FLOWISE_ENDPOINT,
      typeof value === 'string' && value.includes(':'),
      'Value must be string and should include both I.P. and port number' // Considering the possibility of DNS lookup or feeding the I.P. explicitly, there is no pattern to verify, except a column for the port number
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

  [CONFIG_KEYS.OCO_OLLAMA_API_URL](value: any) {
    validateConfig(
      CONFIG_KEYS.OCO_OLLAMA_API_URL,
      typeof value === 'string' && value.startsWith('http'),
      `${value} is not a valid URL. It should start with 'http://' or 'https://'.`
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
  FLOWISE = 'flowise'
}

export type ConfigType = {
  [CONFIG_KEYS.OCO_OPENAI_API_KEY]?: string;
  [CONFIG_KEYS.OCO_ANTHROPIC_API_KEY]?: string;
  [CONFIG_KEYS.OCO_AZURE_API_KEY]?: string;
  [CONFIG_KEYS.OCO_GEMINI_API_KEY]?: string;
  [CONFIG_KEYS.OCO_GEMINI_BASE_PATH]?: string;
  [CONFIG_KEYS.OCO_TOKENS_MAX_INPUT]: number;
  [CONFIG_KEYS.OCO_TOKENS_MAX_OUTPUT]: number;
  [CONFIG_KEYS.OCO_OPENAI_BASE_PATH]?: string;
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
  [CONFIG_KEYS.OCO_AZURE_ENDPOINT]?: string;
  [CONFIG_KEYS.OCO_TEST_MOCK_TYPE]: string;
  [CONFIG_KEYS.OCO_API_URL]?: string;
  [CONFIG_KEYS.OCO_OLLAMA_API_URL]?: string;
  [CONFIG_KEYS.OCO_FLOWISE_ENDPOINT]: string;
  [CONFIG_KEYS.OCO_FLOWISE_API_KEY]?: string;
};

const defaultConfigPath = pathJoin(homedir(), '.opencommit');
const defaultEnvPath = pathResolve(process.cwd(), '.env');

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
  OCO_FLOWISE_ENDPOINT: ':',
  OCO_WHY: false,
  OCO_GITPUSH: true // todo: deprecate
};

const initGlobalConfig = (configPath: string = defaultConfigPath) => {
  writeFileSync(configPath, iniStringify(DEFAULT_CONFIG), 'utf8');
  return DEFAULT_CONFIG;
};

const parseEnvVarValue = (value?: any) => {
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

    OCO_OPENAI_API_KEY: process.env.OCO_OPENAI_API_KEY,
    OCO_ANTHROPIC_API_KEY: process.env.OCO_ANTHROPIC_API_KEY,
    OCO_AZURE_API_KEY: process.env.OCO_AZURE_API_KEY,
    OCO_GEMINI_API_KEY: process.env.OCO_GEMINI_API_KEY,
    OCO_FLOWISE_API_KEY: process.env.OCO_FLOWISE_API_KEY,

    OCO_TOKENS_MAX_INPUT: parseEnvVarValue(process.env.OCO_TOKENS_MAX_INPUT),
    OCO_TOKENS_MAX_OUTPUT: parseEnvVarValue(process.env.OCO_TOKENS_MAX_OUTPUT),

    OCO_OPENAI_BASE_PATH: process.env.OCO_OPENAI_BASE_PATH,
    OCO_GEMINI_BASE_PATH: process.env.OCO_GEMINI_BASE_PATH,

    OCO_AZURE_ENDPOINT: process.env.OCO_AZURE_ENDPOINT,
    OCO_FLOWISE_ENDPOINT: process.env.OCO_FLOWISE_ENDPOINT,
    OCO_OLLAMA_API_URL: process.env.OCO_OLLAMA_API_URL,

    OCO_DESCRIPTION: parseEnvVarValue(process.env.OCO_DESCRIPTION),
    OCO_EMOJI: parseEnvVarValue(process.env.OCO_EMOJI),
    OCO_LANGUAGE: process.env.OCO_LANGUAGE,
    OCO_MESSAGE_TEMPLATE_PLACEHOLDER:
      process.env.OCO_MESSAGE_TEMPLATE_PLACEHOLDER,
    OCO_PROMPT_MODULE: process.env.OCO_PROMPT_MODULE as OCO_PROMPT_MODULE_ENUM,
    OCO_AI_PROVIDER: process.env.OCO_AI_PROVIDER as OCO_AI_PROVIDER_ENUM,
    OCO_ONE_LINE_COMMIT: parseEnvVarValue(process.env.OCO_ONE_LINE_COMMIT),
    OCO_TEST_MOCK_TYPE: process.env.OCO_TEST_MOCK_TYPE,

    OCO_GITPUSH: parseEnvVarValue(process.env.OCO_GITPUSH) // todo: deprecate
  };
};

const getGlobalConfig = (configPath: string) => {
  let globalConfig: ConfigType;

  const isGlobalConfigFileExist = existsSync(configPath);
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
const mergeConfigs = (main: Partial<ConfigType>, fallback: ConfigType) =>
  Object.keys(CONFIG_KEYS).reduce((acc, key) => {
    acc[key] = parseEnvVarValue(main[key] ?? fallback[key]);

    return acc;
  }, {} as ConfigType);

interface GetConfigOptions {
  globalPath?: string;
  envPath?: string;
}

export const getConfig = ({
  envPath = defaultEnvPath,
  globalPath = defaultConfigPath
}: GetConfigOptions = {}): ConfigType => {
  const envConfig = getEnvConfig(envPath);
  const globalConfig = getGlobalConfig(globalPath);

  const config = mergeConfigs(envConfig, globalConfig);

  return config;
};

export const setConfig = (
  keyValues: [key: string, value: string][],
  globalConfigPath: string = defaultConfigPath
) => {
  const config = getConfig({
    globalPath: globalConfigPath
  });

  for (let [key, value] of keyValues) {
    if (!configValidators.hasOwnProperty(key)) {
      const supportedKeys = Object.keys(configValidators).join('\n');
      throw new Error(
        `Unsupported config key: ${key}. Expected keys are:\n\n${supportedKeys}.\n\nFor more help refer to our docs: https://github.com/di-sukharev/opencommit`
      );
    }

    let parsedConfigValue;

    try {
      parsedConfigValue = JSON.parse(value);
    } catch (error) {
      parsedConfigValue = value;
    }

    const validValue = configValidators[key as CONFIG_KEYS](
      parsedConfigValue,
      config
    );

    config[key] = validValue;
  }

  writeFileSync(globalConfigPath, iniStringify(config), 'utf8');

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
