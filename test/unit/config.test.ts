import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { jest } from '@jest/globals';
import { prepareFile } from './utils';
import { dirname } from 'path';

const defaultEnvFile = await prepareFile('.env', '');
afterAll(() => defaultEnvFile.cleanup());

const {
  CONFIG_KEYS,
  DEFAULT_CONFIG,
  OCO_AI_PROVIDER_ENUM,
  configValidators,
  getConfig,
  setConfig
} = await (async () => {
  // The config module captures its default .env path on import, including the
  // path used internally by setConfig. Point it at a fixture for this suite.
  const originalCwd = process.cwd();
  try {
    process.chdir(dirname(defaultEnvFile.filePath));
    return await import('../../src/commands/config');
  } finally {
    process.chdir(originalCwd);
  }
})();

describe('config', () => {
  const originalEnv = { ...process.env };
  const testEnv = Object.fromEntries(
    Object.entries(originalEnv).filter(([key]) => !key.startsWith('OCO_'))
  );
  let globalConfigFile: { filePath: string; cleanup: () => Promise<void> };
  let envConfigFile: { filePath: string; cleanup: () => Promise<void> };

  function resetEnv(env: NodeJS.ProcessEnv) {
    Object.keys(process.env).forEach((key) => delete process.env[key]);
    Object.assign(process.env, env);
  }

  beforeEach(async () => {
    resetEnv(testEnv);
    if (globalConfigFile) await globalConfigFile.cleanup();
    if (envConfigFile) await envConfigFile.cleanup();
  });

  afterEach(async () => {
    if (globalConfigFile) await globalConfigFile.cleanup();
    if (envConfigFile) await envConfigFile.cleanup();
  });

  afterAll(() => {
    resetEnv(originalEnv);
  });

  const generateConfig = async (
    fileName: string,
    content: Record<string, string>
  ) => {
    const fileContent = Object.entries(content)
      .map(([key, value]) => `${key}="${value}"`)
      .join('\n');
    return await prepareFile(fileName, fileContent);
  };

  describe('getConfig', () => {
    it('should prioritize local .env over global .opencommit config', async () => {
      globalConfigFile = await generateConfig('.opencommit', {
        OCO_API_KEY: 'global-key',
        OCO_MODEL: 'gpt-3.5-turbo',
        OCO_LANGUAGE: 'en'
      });

      envConfigFile = await generateConfig('.env', {
        OCO_API_KEY: 'local-key',
        OCO_LANGUAGE: 'fr'
      });

      const config = getConfig({
        globalPath: globalConfigFile.filePath,
        envPath: envConfigFile.filePath
      });

      expect(config).not.toEqual(null);
      expect(config.OCO_API_KEY).toEqual('local-key');
      expect(config.OCO_MODEL).toEqual('gpt-3.5-turbo');
      expect(config.OCO_LANGUAGE).toEqual('fr');
    });

    it('should fallback to global config when local config is not set', async () => {
      globalConfigFile = await generateConfig('.opencommit', {
        OCO_API_KEY: 'global-key',
        OCO_MODEL: 'gpt-4',
        OCO_LANGUAGE: 'de',
        OCO_DESCRIPTION: 'true'
      });

      envConfigFile = await generateConfig('.env', {
        OCO_API_URL: 'local-api-url'
      });

      const config = getConfig({
        globalPath: globalConfigFile.filePath,
        envPath: envConfigFile.filePath
      });

      expect(config).not.toEqual(null);
      expect(config.OCO_API_KEY).toEqual('global-key');
      expect(config.OCO_API_URL).toEqual('local-api-url');
      expect(config.OCO_MODEL).toEqual('gpt-4');
      expect(config.OCO_LANGUAGE).toEqual('de');
      expect(config.OCO_DESCRIPTION).toEqual(true);
    });

    it('should handle boolean and numeric values correctly', async () => {
      globalConfigFile = await generateConfig('.opencommit', {
        OCO_TOKENS_MAX_INPUT: '4096',
        OCO_HOOK_AUTO_UNCOMMENT: 'true',
        OCO_TOKENS_MAX_OUTPUT: '500',
        OCO_GITPUSH: 'true',
        OCO_REASONING: 'false'
      });

      envConfigFile = await generateConfig('.env', {
        OCO_TOKENS_MAX_INPUT: '8192',
        OCO_HOOK_AUTO_UNCOMMENT: 'false',
        OCO_ONE_LINE_COMMIT: 'false',
        OCO_EMOJI_POSITION_BEFORE_DESCRIPTION: 'true',
        OCO_EMOJI_FULL_SPEC: 'true',
        OCO_TICKET_FROM_BRANCH: 'true',
        OCO_OMIT_SCOPE: 'true',
        OCO_REASONING: 'true',
        OCO_REASONING_MAX_TOKENS: '2048'
      });

      const config = getConfig({
        globalPath: globalConfigFile.filePath,
        envPath: envConfigFile.filePath
      });

      expect(config).not.toEqual(null);
      expect(config.OCO_TOKENS_MAX_INPUT).toEqual(8192);
      expect(config.OCO_HOOK_AUTO_UNCOMMENT).toBe(false);
      expect(config.OCO_TOKENS_MAX_OUTPUT).toEqual(500);
      expect(config.OCO_GITPUSH).toEqual(true);
      expect(config.OCO_ONE_LINE_COMMIT).toEqual(false);
      expect(config.OCO_EMOJI_POSITION_BEFORE_DESCRIPTION).toEqual(true);
      expect(config.OCO_EMOJI_FULL_SPEC).toEqual(true);
      expect(config.OCO_TICKET_FROM_BRANCH).toEqual(true);
      expect(config.OCO_OMIT_SCOPE).toEqual(true);
      expect(config.OCO_REASONING).toEqual(true);
      expect(config.OCO_REASONING_MAX_TOKENS).toEqual(2048);
    });

    it.each([
      ['FALSE', 'true', false],
      ['off', 'false', false],
      ['off', 'true', true]
    ])(
      'should resolve hook auto-uncomment from local %s and global %s',
      async (localValue, globalValue, expected) => {
        globalConfigFile = await generateConfig('.opencommit', {
          OCO_HOOK_AUTO_UNCOMMENT: globalValue
        });
        envConfigFile = await generateConfig('.env', {
          OCO_HOOK_AUTO_UNCOMMENT: localValue
        });

        const config = getConfig({
          globalPath: globalConfigFile.filePath,
          envPath: envConfigFile.filePath
        });

        expect(config.OCO_HOOK_AUTO_UNCOMMENT).toBe(expected);
      }
    );

    it('should handle custom HTTP headers correctly', async () => {
      globalConfigFile = await generateConfig('.opencommit', {
        OCO_API_CUSTOM_HEADERS: '{"X-Global-Header": "global-value"}'
      });

      envConfigFile = await generateConfig('.env', {
        OCO_API_CUSTOM_HEADERS:
          '{"Authorization": "Bearer token123", "X-Custom-Header": "test-value"}'
      });

      const config = getConfig({
        globalPath: globalConfigFile.filePath,
        envPath: envConfigFile.filePath
      });

      expect(config).not.toEqual(null);
      expect(config.OCO_API_CUSTOM_HEADERS).toEqual({
        Authorization: 'Bearer token123',
        'X-Custom-Header': 'test-value'
      });

      // No need to parse JSON again since it's already an object
      const parsedHeaders = config.OCO_API_CUSTOM_HEADERS;
      expect(parsedHeaders).toHaveProperty('Authorization', 'Bearer token123');
      expect(parsedHeaders).toHaveProperty('X-Custom-Header', 'test-value');
      expect(parsedHeaders).not.toHaveProperty('X-Global-Header');
    });

    it('should handle empty local config correctly', async () => {
      globalConfigFile = await generateConfig('.opencommit', {
        OCO_API_KEY: 'global-key',
        OCO_MODEL: 'gpt-4',
        OCO_LANGUAGE: 'es'
      });

      envConfigFile = await generateConfig('.env', {});

      const config = getConfig({
        globalPath: globalConfigFile.filePath,
        envPath: envConfigFile.filePath
      });

      expect(config).not.toEqual(null);
      expect(config.OCO_API_KEY).toEqual('global-key');
      expect(config.OCO_MODEL).toEqual('gpt-4');
      expect(config.OCO_LANGUAGE).toEqual('es');
    });

    it('should override global config with null values in local .env', async () => {
      globalConfigFile = await generateConfig('.opencommit', {
        OCO_API_KEY: 'global-key',
        OCO_MODEL: 'gpt-4',
        OCO_LANGUAGE: 'es'
      });

      envConfigFile = await generateConfig('.env', {
        OCO_API_KEY: 'null'
      });

      const config = getConfig({
        globalPath: globalConfigFile.filePath,
        envPath: envConfigFile.filePath
      });

      expect(config).not.toEqual(null);
      expect(config.OCO_API_KEY).toEqual(null);
    });

    it('should handle empty global config', async () => {
      globalConfigFile = await generateConfig('.opencommit', {});
      envConfigFile = await generateConfig('.env', {});

      const config = getConfig({
        globalPath: globalConfigFile.filePath,
        envPath: envConfigFile.filePath
      });

      expect(config).not.toEqual(null);
      expect(config.OCO_API_KEY).toEqual(undefined);
      // Ensure OCO_REASONING is undefined by default (auto-detect mode)
      expect(config.OCO_REASONING).toEqual(undefined);
    });

    it('should not create a global config file when only reading defaults', async () => {
      globalConfigFile = await generateConfig('.opencommit', {});
      rmSync(globalConfigFile.filePath);

      const config = getConfig({
        globalPath: globalConfigFile.filePath
      });

      expect(config.OCO_MODEL).toEqual(DEFAULT_CONFIG.OCO_MODEL);
      expect(existsSync(globalConfigFile.filePath)).toBe(false);
    });

    it.each([
      ['trustedrouter', 'deepseek/deepseek-v4-flash'],
      ['anthropic', 'claude-sonnet-4-6'],
      ['llamacpp', '']
    ])(
      'uses the %s default model on a fresh installation',
      async (provider, model) => {
        globalConfigFile = await generateConfig('.opencommit', {});
        rmSync(globalConfigFile.filePath);
        envConfigFile = await generateConfig('.env', {
          OCO_AI_PROVIDER: provider
        });

        expect(
          getConfig({
            globalPath: globalConfigFile.filePath,
            envPath: envConfigFile.filePath
          }).OCO_MODEL
        ).toBe(model);
      }
    );

    it('uses the saved provider default when an existing config omits its model', async () => {
      globalConfigFile = await generateConfig('.opencommit', {
        OCO_AI_PROVIDER: 'trustedrouter'
      });

      expect(
        getConfig({ globalPath: globalConfigFile.filePath }).OCO_MODEL
      ).toBe('deepseek/deepseek-v4-flash');
    });

    it.each(['', '   ', 'null', 'undefined'])(
      'keeps the saved provider when the repository provider is %j',
      async (provider) => {
        globalConfigFile = await generateConfig('.opencommit', {
          OCO_AI_PROVIDER: 'trustedrouter',
          OCO_API_KEY: 'test-gateway-key'
        });
        envConfigFile = await generateConfig('.env', {
          OCO_AI_PROVIDER: provider
        });

        expect(
          getConfig({
            globalPath: globalConfigFile.filePath,
            envPath: envConfigFile.filePath
          })
        ).toMatchObject({
          OCO_AI_PROVIDER: 'trustedrouter',
          OCO_API_KEY: 'test-gateway-key',
          OCO_MODEL: 'deepseek/deepseek-v4-flash'
        });
      }
    );

    it('uses the gateway default when the saved local provider has no model', async () => {
      globalConfigFile = await generateConfig('.opencommit', {
        OCO_AI_PROVIDER: 'llamacpp',
        OCO_MODEL: ''
      });
      envConfigFile = await generateConfig('.env', {
        OCO_AI_PROVIDER: 'trustedrouter'
      });

      expect(
        getConfig({
          globalPath: globalConfigFile.filePath,
          envPath: envConfigFile.filePath
        }).OCO_MODEL
      ).toBe('deepseek/deepseek-v4-flash');
    });

    it.each(['openai', 'trustedrouter'])(
      'applies a repository provider of %s without changing the global config',
      async (provider) => {
        globalConfigFile = await generateConfig('.opencommit', {});
        const savedConfig = [
          'OCO_AI_PROVIDER=openai',
          'OCO_API_KEY=global-key',
          'OCO_API_URL=https://global.example/v1',
          'OCO_API_CUSTOM_HEADERS={"X-Provider":"global"}',
          'OCO_MODEL=saved-model',
          'OCO_LANGUAGE=fr'
        ].join('\n');
        writeFileSync(globalConfigFile.filePath, savedConfig);
        envConfigFile = await generateConfig('.env', {
          OCO_AI_PROVIDER: provider,
          OCO_API_KEY: 'local-key'
        });

        const config = getConfig({
          globalPath: globalConfigFile.filePath,
          envPath: envConfigFile.filePath
        });

        expect(config).toMatchObject({
          OCO_AI_PROVIDER: provider,
          OCO_API_KEY: 'local-key',
          OCO_MODEL: 'saved-model',
          OCO_LANGUAGE: 'fr'
        });
        if (provider === 'openai') {
          expect(config.OCO_API_URL).toBe('https://global.example/v1');
          expect(config.OCO_API_CUSTOM_HEADERS).toEqual({
            'X-Provider': 'global'
          });
        } else {
          expect(config.OCO_API_URL).toBeUndefined();
          expect(config.OCO_API_CUSTOM_HEADERS).toBeUndefined();
        }
        expect(readFileSync(globalConfigFile.filePath, 'utf8')).toBe(
          savedConfig
        );
      }
    );

    it('uses repository transport when an unlabeled shell config belongs to a different provider', async () => {
      globalConfigFile = await generateConfig('.opencommit', {
        OCO_AI_PROVIDER: 'openai'
      });
      envConfigFile = await generateConfig('.env', {
        OCO_AI_PROVIDER: 'trustedrouter',
        OCO_API_URL: 'https://repo.example/v1',
        OCO_LANGUAGE: 'fr'
      });
      Object.assign(process.env, {
        OCO_API_KEY: 'test-shell-openai-key',
        OCO_API_URL: 'https://shell.example/v1',
        OCO_API_CUSTOM_HEADERS: '{"X-Provider":"shell"}',
        OCO_LANGUAGE: 'en'
      });

      const config = getConfig({
        globalPath: globalConfigFile.filePath,
        envPath: envConfigFile.filePath
      });

      expect(config).toMatchObject({
        OCO_AI_PROVIDER: 'trustedrouter',
        OCO_API_URL: 'https://repo.example/v1',
        OCO_LANGUAGE: 'en'
      });
      expect(config.OCO_API_KEY).toBeUndefined();
      expect(config.OCO_API_CUSTOM_HEADERS).toBeUndefined();
    });

    it.each([undefined, 'openai'])(
      'keeps repository transport scoped to its provider (%s) when the shell selects a different provider',
      async (provider) => {
        globalConfigFile = await generateConfig('.opencommit', {
          OCO_AI_PROVIDER: 'openai',
          OCO_API_KEY: 'test-global-openai-key'
        });
        envConfigFile = await prepareFile(
          '.env',
          [
            provider && `OCO_AI_PROVIDER=${provider}`,
            'OCO_API_KEY=test-repo-openai-key',
            'OCO_API_URL=https://repo.example/v1',
            'OCO_API_CUSTOM_HEADERS={"X-Provider":"repo"}',
            'OCO_LANGUAGE=fr'
          ]
            .filter(Boolean)
            .join('\n')
        );
        process.env.OCO_AI_PROVIDER = 'trustedrouter';

        const config = getConfig({
          globalPath: globalConfigFile.filePath,
          envPath: envConfigFile.filePath
        });

        expect(config).toMatchObject({
          OCO_AI_PROVIDER: 'trustedrouter',
          OCO_LANGUAGE: 'fr'
        });
        expect(config.OCO_API_KEY).toBeUndefined();
        expect(config.OCO_API_URL).toBeUndefined();
        expect(config.OCO_API_CUSTOM_HEADERS).toBeUndefined();
      }
    );

    it.each([
      {
        name: 'uses only the selected provider legacy values',
        overrides: {},
        apiKey: 'test-legacy-anthropic-key',
        apiUrl: 'https://legacy-anthropic.example'
      },
      {
        name: 'prefers modern values',
        overrides: {
          OCO_API_KEY: 'test-modern-anthropic-key',
          OCO_API_URL: 'https://modern-anthropic.example'
        },
        apiKey: 'test-modern-anthropic-key',
        apiUrl: 'https://modern-anthropic.example'
      },
      {
        name: 'preserves explicit blank values',
        overrides: { OCO_API_KEY: '', OCO_API_URL: '' },
        apiKey: '',
        apiUrl: ''
      }
    ])(
      '$name for a shell provider override',
      async ({ overrides, apiKey, apiUrl }) => {
        globalConfigFile = await generateConfig('.opencommit', {
          OCO_AI_PROVIDER: 'openai',
          OCO_API_KEY: 'test-global-openai-key',
          OCO_API_URL: 'https://global-openai.example',
          OCO_OPENAI_API_KEY: 'test-legacy-openai-key',
          OCO_OPENAI_BASE_PATH: 'https://legacy-openai.example',
          OCO_ANTHROPIC_API_KEY: 'test-legacy-anthropic-key',
          OCO_ANTHROPIC_BASE_PATH: 'https://legacy-anthropic.example'
        });
        const savedConfig = readFileSync(globalConfigFile.filePath, 'utf8');
        Object.assign(process.env, {
          OCO_AI_PROVIDER: 'anthropic',
          ...overrides
        });

        const config = getConfig({ globalPath: globalConfigFile.filePath });

        expect(config.OCO_API_KEY).toBe(apiKey);
        expect(config.OCO_API_URL).toBe(apiUrl);
        expect(process.env.OCO_ANTHROPIC_API_KEY).toBeUndefined();
        expect(process.env.OCO_OPENAI_API_KEY).toBeUndefined();
        expect(readFileSync(globalConfigFile.filePath, 'utf8')).toBe(
          savedConfig
        );
      }
    );

    it('combines matching provider settings in priority order', async () => {
      globalConfigFile = await prepareFile(
        '.opencommit',
        [
          'OCO_AI_PROVIDER=trustedrouter',
          'OCO_API_KEY=test-global-gateway-key',
          'OCO_API_CUSTOM_HEADERS={"X-Provider":"global"}'
        ].join('\n')
      );
      envConfigFile = await generateConfig('.env', {
        OCO_AI_PROVIDER: 'trustedrouter',
        OCO_API_KEY: 'test-repo-gateway-key',
        OCO_API_URL: 'https://repo.example/v1',
        OPENCOMMIT_TEST_AMBIENT: 'present'
      });
      process.env.OCO_API_KEY = 'test-shell-gateway-key';

      expect(
        getConfig({
          globalPath: globalConfigFile.filePath,
          envPath: envConfigFile.filePath
        })
      ).toMatchObject({
        OCO_AI_PROVIDER: 'trustedrouter',
        OCO_API_KEY: 'test-shell-gateway-key',
        OCO_API_URL: 'https://repo.example/v1',
        OCO_API_CUSTOM_HEADERS: { 'X-Provider': 'global' }
      });
      expect(process.env.OPENCOMMIT_TEST_AMBIENT).toBe('present');
    });

    it('keeps an explicitly empty local model', async () => {
      globalConfigFile = await generateConfig('.opencommit', {
        OCO_AI_PROVIDER: 'llamacpp',
        OCO_MODEL: ''
      });

      expect(
        getConfig({ globalPath: globalConfigFile.filePath }).OCO_MODEL
      ).toBe('');
    });

    it('should not materialize ambient proxy env vars into OCO_PROXY', async () => {
      process.env.HTTPS_PROXY = 'http://127.0.0.1:7890';

      globalConfigFile = await generateConfig('.opencommit', {});
      envConfigFile = await generateConfig('.env', {});

      const config = getConfig({
        globalPath: globalConfigFile.filePath,
        envPath: envConfigFile.filePath
      });

      expect(config.OCO_PROXY).toEqual(undefined);
    });

    it('should parse OCO_PROXY=null from local .env as explicit disable', async () => {
      globalConfigFile = await generateConfig('.opencommit', {
        OCO_PROXY: 'http://global-proxy:8080'
      });
      envConfigFile = await generateConfig('.env', {
        OCO_PROXY: 'null'
      });

      const config = getConfig({
        globalPath: globalConfigFile.filePath,
        envPath: envConfigFile.filePath
      });

      expect(config.OCO_PROXY).toEqual(null);
    });
  });

  describe('setConfig', () => {
    beforeEach(async () => {
      // we create and delete the file to have the parent directory, but not the file, to test the creation of the file
      globalConfigFile = await generateConfig('.opencommit', {});
      rmSync(globalConfigFile.filePath);
    });

    it('creates the global file and applies defaults on the first setConfig call', async () => {
      const isGlobalConfigFileExist = existsSync(globalConfigFile.filePath);
      expect(isGlobalConfigFileExist).toBe(false);

      await setConfig(
        [[CONFIG_KEYS.OCO_API_KEY, 'persisted-key_1']],
        globalConfigFile.filePath
      );

      const fileContent = readFileSync(globalConfigFile.filePath, 'utf8');
      expect(fileContent).toContain('OCO_API_KEY=persisted-key_1');
      expect(
        getConfig({ globalPath: globalConfigFile.filePath })
      ).toMatchObject(DEFAULT_CONFIG);
    });

    it('uses the provider default after setting a provider and key on a fresh installation', async () => {
      setConfig(
        [
          [CONFIG_KEYS.OCO_AI_PROVIDER, 'trustedrouter'],
          [CONFIG_KEYS.OCO_API_KEY, 'test-key']
        ],
        globalConfigFile.filePath
      );

      expect(
        getConfig({ globalPath: globalConfigFile.filePath }).OCO_MODEL
      ).toBe('deepseek/deepseek-v4-flash');
    });

    it('drops the old provider transport and preserves the saved model and unrelated settings', async () => {
      globalConfigFile = await generateConfig('.opencommit', {
        OCO_AI_PROVIDER: 'ollama',
        OCO_API_URL: 'http://127.0.0.1:11434',
        OCO_API_CUSTOM_HEADERS: '{"Authorization":"Bearer old-key"}',
        OCO_MODEL: 'saved-model',
        OCO_LANGUAGE: 'fr'
      });
      process.env.OCO_API_URL = 'https://temporary.example/v1';
      process.env.OCO_API_CUSTOM_HEADERS = '{"X-Temporary":"yes"}';
      process.env.OCO_MODEL = 'temporary-model';
      process.env.OCO_LANGUAGE = 'en';

      setConfig(
        [
          [CONFIG_KEYS.OCO_AI_PROVIDER, 'trustedrouter'],
          [CONFIG_KEYS.OCO_API_KEY, 'test-key']
        ],
        globalConfigFile.filePath
      );

      expect(
        getConfig({ globalPath: globalConfigFile.filePath })
      ).toMatchObject({
        OCO_API_URL: 'https://temporary.example/v1',
        OCO_API_CUSTOM_HEADERS: { 'X-Temporary': 'yes' },
        OCO_MODEL: 'temporary-model',
        OCO_LANGUAGE: 'en'
      });

      delete process.env.OCO_API_URL;
      delete process.env.OCO_API_CUSTOM_HEADERS;
      delete process.env.OCO_MODEL;
      delete process.env.OCO_LANGUAGE;

      expect(
        getConfig({ globalPath: globalConfigFile.filePath })
      ).toMatchObject({
        OCO_AI_PROVIDER: 'trustedrouter',
        OCO_API_KEY: 'test-key',
        OCO_API_URL: undefined,
        OCO_API_CUSTOM_HEADERS: undefined,
        OCO_MODEL: 'saved-model',
        OCO_LANGUAGE: 'fr'
      });
    });

    it('keeps an explicit new endpoint, headers, and model when changing providers', async () => {
      globalConfigFile = await generateConfig('.opencommit', {
        OCO_AI_PROVIDER: 'ollama',
        OCO_API_URL: 'http://127.0.0.1:11434'
      });

      setConfig(
        [
          [CONFIG_KEYS.OCO_API_URL, 'https://new.example/v1'],
          [CONFIG_KEYS.OCO_API_CUSTOM_HEADERS, '{"X-Provider":"new"}'],
          [CONFIG_KEYS.OCO_MODEL, 'new-model'],
          [CONFIG_KEYS.OCO_AI_PROVIDER, 'trustedrouter']
        ],
        globalConfigFile.filePath
      );

      expect(
        getConfig({ globalPath: globalConfigFile.filePath })
      ).toMatchObject({
        OCO_AI_PROVIDER: 'trustedrouter',
        OCO_API_URL: 'https://new.example/v1',
        OCO_API_CUSTOM_HEADERS: { 'X-Provider': 'new' },
        OCO_MODEL: 'new-model'
      });
    });

    it.each([
      [CONFIG_KEYS.OCO_API_KEY, 'test-repository-key', 'test-repository-key'],
      [
        CONFIG_KEYS.OCO_API_URL,
        'https://new.example/v1',
        'https://new.example/v1'
      ],
      [
        CONFIG_KEYS.OCO_API_CUSTOM_HEADERS,
        '{"X-Provider":"new"}',
        { 'X-Provider': 'new' }
      ]
    ])(
      'requires a target provider for a global %s write from a repository with a different provider',
      async (key, value, expected) => {
        globalConfigFile = await generateConfig('.opencommit', {
          OCO_AI_PROVIDER: 'openai',
          OCO_API_KEY: 'test-global-key',
          OCO_API_URL: 'https://global.example/v1',
          OCO_API_CUSTOM_HEADERS: '{"X-Provider":"global"}'
        });
        process.env.OCO_AI_PROVIDER = 'trustedrouter';
        const path = globalConfigFile.filePath;
        const original = readFileSync(path, 'utf8');

        expect(() => setConfig([[key, value]], path)).toThrow(
          'OCO_AI_PROVIDER'
        );
        expect(readFileSync(path, 'utf8')).toBe(original);

        setConfig(
          [
            [CONFIG_KEYS.OCO_AI_PROVIDER, 'openai'],
            [key, value]
          ],
          path
        );
        delete process.env.OCO_AI_PROVIDER;
        expect(getConfig({ globalPath: path })[key]).toEqual(expected);
      }
    );

    it('requires a new key when switching the saved provider', async () => {
      globalConfigFile = await generateConfig('.opencommit', {
        OCO_AI_PROVIDER: 'openai',
        OCO_API_KEY: 'old-provider-key'
      });
      process.env.OCO_API_KEY = 'temporary-key';

      setConfig(
        [[CONFIG_KEYS.OCO_AI_PROVIDER, 'trustedrouter']],
        globalConfigFile.filePath
      );

      expect(
        getConfig({ globalPath: globalConfigFile.filePath }).OCO_API_KEY
      ).toBe('temporary-key');
      delete process.env.OCO_API_KEY;
      expect(
        getConfig({ globalPath: globalConfigFile.filePath }).OCO_API_KEY
      ).toBeUndefined();
      expect(readFileSync(globalConfigFile.filePath, 'utf8')).not.toContain(
        'old-provider-key'
      );
    });

    it('should set new config values', async () => {
      globalConfigFile = await generateConfig('.opencommit', {});
      await setConfig(
        [
          [CONFIG_KEYS.OCO_API_KEY, 'new-key'],
          [CONFIG_KEYS.OCO_MODEL, 'gpt-4']
        ],
        globalConfigFile.filePath
      );

      const config = getConfig({
        globalPath: globalConfigFile.filePath
      });
      expect(config.OCO_API_KEY).toEqual('new-key');
      expect(config.OCO_MODEL).toEqual('gpt-4');
    });

    it('should update existing config values', async () => {
      globalConfigFile = await generateConfig('.opencommit', {
        OCO_API_KEY: 'initial-key'
      });
      await setConfig(
        [[CONFIG_KEYS.OCO_API_KEY, 'updated-key']],
        globalConfigFile.filePath
      );

      const config = getConfig({
        globalPath: globalConfigFile.filePath
      });
      expect(config.OCO_API_KEY).toEqual('updated-key');
    });

    it('should handle boolean and numeric values correctly', async () => {
      globalConfigFile = await generateConfig('.opencommit', {});
      await setConfig(
        [
          [CONFIG_KEYS.OCO_TOKENS_MAX_INPUT, '8192'],
          [CONFIG_KEYS.OCO_HOOK_AUTO_UNCOMMENT, 'true'],
          [CONFIG_KEYS.OCO_DESCRIPTION, 'true'],
          [CONFIG_KEYS.OCO_EMOJI_POSITION_BEFORE_DESCRIPTION, 'true'],
          [CONFIG_KEYS.OCO_EMOJI_FULL_SPEC, 'true'],
          [CONFIG_KEYS.OCO_TICKET_FROM_BRANCH, 'true'],
          [CONFIG_KEYS.OCO_ONE_LINE_COMMIT, 'false'],
          [CONFIG_KEYS.OCO_REASONING, 'true'],
          [CONFIG_KEYS.OCO_REASONING_MAX_TOKENS, '1024']
        ],
        globalConfigFile.filePath
      );

      const config = getConfig({
        globalPath: globalConfigFile.filePath
      });
      expect(config.OCO_TOKENS_MAX_INPUT).toEqual(8192);
      expect(config.OCO_HOOK_AUTO_UNCOMMENT).toBe(true);
      expect(config.OCO_DESCRIPTION).toEqual(true);
      expect(config.OCO_EMOJI_POSITION_BEFORE_DESCRIPTION).toEqual(true);
      expect(config.OCO_EMOJI_FULL_SPEC).toEqual(true);
      expect(config.OCO_TICKET_FROM_BRANCH).toEqual(true);
      expect(config.OCO_ONE_LINE_COMMIT).toEqual(false);
      expect(config.OCO_REASONING).toEqual(true);
      expect(config.OCO_REASONING_MAX_TOKENS).toEqual(1024);
    });

    it('should throw an error for unsupported config keys', async () => {
      globalConfigFile = await generateConfig('.opencommit', {});

      try {
        await setConfig(
          [['UNSUPPORTED_KEY', 'value']],
          globalConfigFile.filePath
        );
        throw new Error('NEVER_REACHED');
      } catch (error) {
        expect(error.message).toContain(
          'Unsupported config key: UNSUPPORTED_KEY'
        );
        expect(error.message).not.toContain('NEVER_REACHED');
      }
    });

    it('should persist changes to the config file', async () => {
      const isGlobalConfigFileExist = existsSync(globalConfigFile.filePath);
      expect(isGlobalConfigFileExist).toBe(false);

      await setConfig(
        [[CONFIG_KEYS.OCO_API_KEY, 'persisted-key']],
        globalConfigFile.filePath
      );

      const fileContent = readFileSync(globalConfigFile.filePath, 'utf8');
      expect(fileContent).toContain('OCO_API_KEY=persisted-key');
    });

    it('should set multiple configs in a row and keep the changes', async () => {
      const isGlobalConfigFileExist = existsSync(globalConfigFile.filePath);
      expect(isGlobalConfigFileExist).toBe(false);

      await setConfig(
        [[CONFIG_KEYS.OCO_API_KEY, 'persisted-key']],
        globalConfigFile.filePath
      );

      const fileContent1 = readFileSync(globalConfigFile.filePath, 'utf8');
      expect(fileContent1).toContain('OCO_API_KEY=persisted-key');

      await setConfig(
        [[CONFIG_KEYS.OCO_MODEL, 'gpt-4']],
        globalConfigFile.filePath
      );

      const fileContent2 = readFileSync(globalConfigFile.filePath, 'utf8');
      expect(fileContent2).toContain('OCO_MODEL=gpt-4');
    });

    it('should persist OCO_PROXY=null as an explicit disable', async () => {
      await setConfig(
        [[CONFIG_KEYS.OCO_PROXY, null]],
        globalConfigFile.filePath
      );

      const config = getConfig({
        globalPath: globalConfigFile.filePath
      });
      const fileContent = readFileSync(globalConfigFile.filePath, 'utf8');

      expect(config.OCO_PROXY).toEqual(null);
      expect(fileContent).toContain('OCO_PROXY=null');
    });

    it('should validate OCO_REASONING_MAX_TOKENS as a positive integer', async () => {
      globalConfigFile = await generateConfig('.opencommit', {});

      await setConfig(
        [[CONFIG_KEYS.OCO_REASONING_MAX_TOKENS, '1024']],
        globalConfigFile.filePath
      );
      let config = getConfig({ globalPath: globalConfigFile.filePath });
      expect(config.OCO_REASONING_MAX_TOKENS).toEqual(1024);

      const invalidValues = [
        '0',
        0,
        '-10',
        -10,
        '10.5',
        10.5,
        '100abc',
        'invalid',
        '0x10',
        '1e3',
        ' 1000 ',
        true,
        Number.MAX_SAFE_INTEGER + 1
      ];
      const exit = jest.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`process.exit(${code})`);
      });
      try {
        for (const val of invalidValues) {
          exit.mockClear();
          expect(() =>
            configValidators[CONFIG_KEYS.OCO_REASONING_MAX_TOKENS](val)
          ).toThrow('process.exit(1)');
          expect(exit).toHaveBeenCalledWith(1);
        }
      } finally {
        exit.mockRestore();
      }
    });
  });
  describe('OCO_AI_PROVIDER validator', () => {
    it('accepts atlascloud', () => {
      const exit = jest.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`process.exit(${code})`);
      });
      try {
        expect(
          configValidators[CONFIG_KEYS.OCO_AI_PROVIDER]('atlascloud')
        ).toBe('atlascloud');
        expect(exit).not.toHaveBeenCalled();
      } finally {
        exit.mockRestore();
      }
    });

    it('accepts trustedrouter', () => {
      const exit = jest.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`process.exit(${code})`);
      });
      try {
        expect(
          configValidators[CONFIG_KEYS.OCO_AI_PROVIDER]('trustedrouter')
        ).toBe('trustedrouter');
        expect(exit).not.toHaveBeenCalled();
      } finally {
        exit.mockRestore();
      }
    });

    it('accepts every provider in OCO_AI_PROVIDER_ENUM', () => {
      const exit = jest.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`process.exit(${code})`);
      });
      try {
        for (const provider of Object.values(OCO_AI_PROVIDER_ENUM)) {
          expect(configValidators[CONFIG_KEYS.OCO_AI_PROVIDER](provider)).toBe(
            provider
          );
        }
      } finally {
        exit.mockRestore();
      }
    });
  });
});
