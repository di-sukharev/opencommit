import { intro, outro } from '@clack/prompts';
import chalk from 'chalk';
import { command } from 'cleye';
import * as dotenv from 'dotenv';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { parse as iniParse, stringify as iniStringify } from 'ini';
import { homedir } from 'os';
import { join as pathJoin, resolve as pathResolve } from 'path';
import { COMMANDS } from '../ENUMS';
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
  OCO_MESSAGE_TEMPLATE_PLACEHOLDER = 'OCO_MESSAGE_TEMPLATE_PLACEHOLDER',
  OCO_PROMPT_MODULE = 'OCO_PROMPT_MODULE',
  OCO_AI_PROVIDER = 'OCO_AI_PROVIDER',
  OCO_GITPUSH = 'OCO_GITPUSH',
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
  DEFAULT_MAX_TOKENS_INPUT = 4096,
  DEFAULT_MAX_TOKENS_OUTPUT = 500
}

const validateConfig = (
  key: string,
  condition: any,
  validationMessage: string
) => {
  if (!condition) {
    outro(
      `${chalk.red(
        '✖'
      )} Unsupported config key ${key}: ${validationMessage}. For more help refer to docs https://github.com/di-sukharev/opencommit`
    );

    process.exit(1);
  }
};

export const configValidators = {
  [CONFIG_KEYS.OCO_OPENAI_API_KEY](value: any, config: any = {}) {
    if (config.OCO_AI_PROVIDER !== 'openai') return value;

    validateConfig(
      'OCO_OPENAI_API_KEY',
      !!value,
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

export type ConfigType = {
  [key in CONFIG_KEYS]?: any;
};

const defaultConfigPath = pathJoin(homedir(), '.opencommit');
const defaultEnvPath = pathResolve(process.cwd(), '.env');

export const getConfig = ({
  configPath = defaultConfigPath,
  envPath = defaultEnvPath
}: {
  configPath?: string;
  envPath?: string;
} = {}) => {
  dotenv.config({ path: envPath });

  const configFromEnv = {
    OCO_OPENAI_API_KEY: process.env.OCO_OPENAI_API_KEY,
    OCO_ANTHROPIC_API_KEY: process.env.OCO_ANTHROPIC_API_KEY,
    OCO_AZURE_API_KEY: process.env.OCO_AZURE_API_KEY,
    OCO_GEMINI_API_KEY: process.env.OCO_GEMINI_API_KEY,
    OCO_TOKENS_MAX_INPUT: process.env.OCO_TOKENS_MAX_INPUT
      ? Number(process.env.OCO_TOKENS_MAX_INPUT)
      : undefined,
    OCO_TOKENS_MAX_OUTPUT: process.env.OCO_TOKENS_MAX_OUTPUT
      ? Number(process.env.OCO_TOKENS_MAX_OUTPUT)
      : undefined,
    OCO_OPENAI_BASE_PATH: process.env.OCO_OPENAI_BASE_PATH,
    OCO_GEMINI_BASE_PATH: process.env.OCO_GEMINI_BASE_PATH,
    OCO_DESCRIPTION: process.env.OCO_DESCRIPTION === 'true' ? true : false,
    OCO_EMOJI: process.env.OCO_EMOJI === 'true' ? true : false,
    OCO_MODEL:
      process.env.OCO_MODEL || getDefaultModel(process.env.OCO_AI_PROVIDER),
    OCO_LANGUAGE: process.env.OCO_LANGUAGE || 'en',
    OCO_MESSAGE_TEMPLATE_PLACEHOLDER:
      process.env.OCO_MESSAGE_TEMPLATE_PLACEHOLDER || '$msg',
    OCO_PROMPT_MODULE: process.env.OCO_PROMPT_MODULE || 'conventional-commit',
    OCO_AI_PROVIDER: process.env.OCO_AI_PROVIDER || 'openai',
    OCO_GITPUSH: process.env.OCO_GITPUSH === 'false' ? false : true,
    OCO_ONE_LINE_COMMIT:
      process.env.OCO_ONE_LINE_COMMIT === 'true' ? true : false,
    OCO_AZURE_ENDPOINT: process.env.OCO_AZURE_ENDPOINT || undefined,
    OCO_TEST_MOCK_TYPE: process.env.OCO_TEST_MOCK_TYPE || 'commit-message',
    OCO_FLOWISE_ENDPOINT: process.env.OCO_FLOWISE_ENDPOINT || ':',
    OCO_FLOWISE_API_KEY: process.env.OCO_FLOWISE_API_KEY || undefined,
    OCO_OLLAMA_API_URL: process.env.OCO_OLLAMA_API_URL || undefined
  };

  const configExists = existsSync(configPath);

  if (!configExists) return configFromEnv;

  const configFile = readFileSync(configPath, 'utf8');
  const config = iniParse(configFile);

  for (const configKey of Object.keys(config)) {
    if (['null', 'undefined'].includes(config[configKey])) {
      config[configKey] = undefined;
      continue;
    }
    try {
      const validator = configValidators[configKey as CONFIG_KEYS];
      const validValue = validator(
        config[configKey] ?? configFromEnv[configKey as CONFIG_KEYS],
        config
      );

      config[configKey] = validValue;
    } catch (error) {
      outro(`Unknown '${configKey}' config option or missing validator.`);
      outro(
        `Manually fix the '.env' file or global '~/.opencommit' config file.`
      );

      process.exit(1);
    }
  }

  return config;
};

export const setConfig = (
  keyValues: [key: string, value: string][],
  configPath: string = defaultConfigPath
) => {
  const config = getConfig() || {};

  for (const [configKey, configValue] of keyValues) {
    if (!configValidators.hasOwnProperty(configKey)) {
      throw new Error(`Unsupported config key: ${configKey}`);
    }

    let parsedConfigValue;

    try {
      parsedConfigValue = JSON.parse(configValue);
    } catch (error) {
      parsedConfigValue = configValue;
    }

    const validValue =
      configValidators[configKey as CONFIG_KEYS](parsedConfigValue);
    config[configKey as CONFIG_KEYS] = validValue;
  }

  writeFileSync(configPath, iniStringify(config), 'utf8');

  outro(`${chalk.green('✔')} Config successfully set`);
};

export const configCommand = command(
  {
    name: COMMANDS.config,
    parameters: ['<mode>', '<key=values...>']
  },
  async (argv) => {
    intro('opencommit — config');
    try {
      const { mode, keyValues } = argv._;

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
