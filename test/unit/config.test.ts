import { existsSync, readFileSync, rmSync } from 'fs';
import {
  CONFIG_KEYS,
  DEFAULT_CONFIG,
  getConfig,
  setConfig
} from '../../src/commands/config';
import { prepareFile } from './utils';
import { dirname } from 'path';

describe('config', () => {
  const originalEnv = { ...process.env };
  let globalConfigFile: { filePath: string; cleanup: () => Promise<void> };
  let envConfigFile: { filePath: string; cleanup: () => Promise<void> };

  function resetEnv(env: NodeJS.ProcessEnv) {
    Object.keys(process.env).forEach((key) => {
      if (!(key in env)) {
        delete process.env[key];
      } else {
        process.env[key] = env[key];
      }
    });
  }

  beforeEach(async () => {
    resetEnv(originalEnv);
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
        OCO_TOKENS_MAX_OUTPUT: '500',
        OCO_GITPUSH: 'true'
      });

      envConfigFile = await generateConfig('.env', {
        OCO_TOKENS_MAX_INPUT: '8192',
        OCO_ONE_LINE_COMMIT: 'false'
      });

      const config = getConfig({
        globalPath: globalConfigFile.filePath,
        envPath: envConfigFile.filePath
      });

      expect(config).not.toEqual(null);
      expect(config.OCO_TOKENS_MAX_INPUT).toEqual(8192);
      expect(config.OCO_TOKENS_MAX_OUTPUT).toEqual(500);
      expect(config.OCO_GITPUSH).toEqual(true);
      expect(config.OCO_ONE_LINE_COMMIT).toEqual(false);
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
    });
  });

  describe('setConfig', () => {
    beforeEach(async () => {
      // we create and delete the file to have the parent directory, but not the file, to test the creation of the file
      globalConfigFile = await generateConfig('.opencommit', {});
      rmSync(globalConfigFile.filePath);
    });

    it('should create .opencommit file with DEFAULT CONFIG if it does not exist on first setConfig run', async () => {
      const isGlobalConfigFileExist = existsSync(globalConfigFile.filePath);
      expect(isGlobalConfigFileExist).toBe(false);

      await setConfig(
        [[CONFIG_KEYS.OCO_API_KEY, 'persisted-key_1']],
        globalConfigFile.filePath
      );

      const fileContent = readFileSync(globalConfigFile.filePath, 'utf8');
      expect(fileContent).toContain('OCO_API_KEY=persisted-key_1');
      Object.entries(DEFAULT_CONFIG).forEach(([key, value]) => {
        expect(fileContent).toContain(`${key}=${value}`);
      });
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
          [CONFIG_KEYS.OCO_DESCRIPTION, 'true'],
          [CONFIG_KEYS.OCO_ONE_LINE_COMMIT, 'false']
        ],
        globalConfigFile.filePath
      );

      const config = getConfig({
        globalPath: globalConfigFile.filePath
      });
      expect(config.OCO_TOKENS_MAX_INPUT).toEqual(8192);
      expect(config.OCO_DESCRIPTION).toEqual(true);
      expect(config.OCO_ONE_LINE_COMMIT).toEqual(false);
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
  });
});
