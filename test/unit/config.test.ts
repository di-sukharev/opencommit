import { getConfig } from '../../src/commands/config';
import { prepareFile } from './utils';

describe('getConfig', () => {
  const originalEnv = { ...process.env };
  let globalConfigFile: { filePath: string; cleanup: () => Promise<void> };
  let localEnvFile: { filePath: string; cleanup: () => Promise<void> };

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
    if (localEnvFile) await localEnvFile.cleanup();
  });

  afterAll(() => {
    resetEnv(originalEnv);
  });

  const generateConfig = async (fileName: string, content: string) => {
    return await prepareFile(fileName, content);
  };

  it('should prioritize local .env over global .opencommit config', async () => {
    globalConfigFile = await generateConfig(
      '.opencommit',
      `
OCO_OPENAI_API_KEY="global-key"
OCO_MODEL="gpt-3.5-turbo"
OCO_LANGUAGE="en"
`
    );

    localEnvFile = await generateConfig(
      '.env',
      `
OCO_OPENAI_API_KEY="local-key"
OCO_ANTHROPIC_API_KEY="local-anthropic-key"
OCO_LANGUAGE="fr"
`
    );

    const config = getConfig({
      configPath: globalConfigFile.filePath,
      envPath: localEnvFile.filePath
    });

    expect(config).not.toEqual(null);
    expect(config!['OCO_OPENAI_API_KEY']).toEqual('local-key');
    expect(config!['OCO_MODEL']).toEqual('gpt-3.5-turbo');
    expect(config!['OCO_LANGUAGE']).toEqual('fr');
    expect(config!['OCO_ANTHROPIC_API_KEY']).toEqual('local-anthropic-key');
  });

  it('should fallback to global config when local config is not set', async () => {
    globalConfigFile = await generateConfig(
      '.opencommit',
      `
OCO_OPENAI_API_KEY="global-key"
OCO_MODEL="gpt-4"
OCO_LANGUAGE="de"
OCO_DESCRIPTION="true"
`
    );

    localEnvFile = await generateConfig(
      '.env',
      `
OCO_ANTHROPIC_API_KEY="local-anthropic-key"
`
    );

    const config = getConfig({
      configPath: globalConfigFile.filePath,
      envPath: localEnvFile.filePath
    });

    expect(config).not.toEqual(null);
    expect(config!['OCO_OPENAI_API_KEY']).toEqual('global-key');
    expect(config!['OCO_ANTHROPIC_API_KEY']).toEqual('local-anthropic-key');
    expect(config!['OCO_MODEL']).toEqual('gpt-4');
    expect(config!['OCO_LANGUAGE']).toEqual('de');
    expect(config!['OCO_DESCRIPTION']).toEqual(true);
  });

  it('should handle boolean and numeric values correctly', async () => {
    globalConfigFile = await generateConfig(
      '.opencommit',
      `
OCO_TOKENS_MAX_INPUT=4096
OCO_TOKENS_MAX_OUTPUT=500
OCO_GITPUSH=true
`
    );

    localEnvFile = await generateConfig(
      '.env',
      `
OCO_TOKENS_MAX_INPUT=8192
OCO_ONE_LINE_COMMIT=false
`
    );

    const config = getConfig({
      configPath: globalConfigFile.filePath,
      envPath: localEnvFile.filePath
    });

    expect(config).not.toEqual(null);
    expect(config!['OCO_TOKENS_MAX_INPUT']).toEqual(8192);
    expect(config!['OCO_TOKENS_MAX_OUTPUT']).toEqual(500);
    expect(config!['OCO_GITPUSH']).toEqual(true);
    expect(config!['OCO_ONE_LINE_COMMIT']).toEqual(false);
  });

  it('should handle empty local config correctly', async () => {
    globalConfigFile = await generateConfig(
      '.opencommit',
      `
OCO_OPENAI_API_KEY="global-key"
OCO_MODEL="gpt-4"
OCO_LANGUAGE="es"
`
    );

    localEnvFile = await generateConfig('.env', '');

    const config = getConfig({
      configPath: globalConfigFile.filePath,
      envPath: localEnvFile.filePath
    });

    expect(config).not.toEqual(null);
    expect(config!['OCO_OPENAI_API_KEY']).toEqual('global-key');
    expect(config!['OCO_MODEL']).toEqual('gpt-4');
    expect(config!['OCO_LANGUAGE']).toEqual('es');
  });

  it('should override global config with null values in local .env', async () => {
    globalConfigFile = await generateConfig(
      '.opencommit',
      `
OCO_OPENAI_API_KEY="global-key"
OCO_MODEL="gpt-4"
OCO_LANGUAGE="es"
`
    );

    localEnvFile = await generateConfig('.env', `OCO_OPENAI_API_KEY=null`);

    const config = getConfig({
      configPath: globalConfigFile.filePath,
      envPath: localEnvFile.filePath
    });

    expect(config).not.toEqual(null);
    expect(config!['OCO_OPENAI_API_KEY']).toEqual(null);
  });
});
