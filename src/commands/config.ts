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
    case 'groq':
      return MODEL_LIST.groq[0];
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
      'You need to provide the OCO_API_KEY when OCO_AI_PROVIDER set to "openai" (default) or "ollama" or "azure" or "gemini" or "flowise" or "anthropic". Run `oco config set OCO_API_KEY=your_key OCO_AI_PROVIDER=openai`'
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
        'anthropic',
        'gemini',
        'azure',
        'test',
        'flowise',
        'groq'
      ].includes(value) || value.startsWith('ollama'),
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
  GROQ = 'groq'
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
