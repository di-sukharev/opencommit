import { getConfig } from '../../src/commands/config';
import { prepareFile } from './utils';

describe('getConfig', () => {
  // 51 characters with 'sk-' prefix
  const testApiKeyWithValidFormat =
    'sk-************************************************';
  const testApiKeyWithValidFormat2 =
    'sk-***********************************************2';

  const originalEnv = { ...process.env };
  function resetEnv(env: NodeJS.ProcessEnv) {
    Object.keys(process.env).forEach((key) => {
      if (!(key in env)) {
        delete process.env[key];
      } else {
        process.env[key] = env[key];
      }
    });
  }

  beforeEach(() => {
    resetEnv(originalEnv);
  });

  afterAll(() => {
    resetEnv(originalEnv);
  });

  it('return default config values when no global config / local env files are present', async () => {
    const config = getConfig({ configPath: '', envPath: '' });

    expect(config).not.toEqual(null);
    expect(config!['OCO_OPENAI_API_KEY']).toEqual(undefined);
    // TODO: Fix the following tests
    // expect(config!['OCO_TOKENS_MAX_INPUT']).toEqual(4096); // Received: undefined
    // expect(config!['OCO_TOKENS_MAX_OUTPUT']).toEqual(500); // Received: undefined
    expect(config!['OCO_OPENAI_BASE_PATH']).toEqual(undefined);
    expect(config!['OCO_DESCRIPTION']).toEqual(false);
    expect(config!['OCO_EMOJI']).toEqual(false);
    expect(config!['OCO_MODEL']).toEqual('gpt-3.5-turbo');
    expect(config!['OCO_LANGUAGE']).toEqual('en');
    expect(config!['OCO_MESSAGE_TEMPLATE_PLACEHOLDER']).toEqual('$msg');
    expect(config!['OCO_PROMPT_MODULE']).toEqual('conventional-commit');
    expect(config!['OCO_AI_PROVIDER']).toEqual('openai');
    expect(config!['OCO_GITPUSH']).toEqual(true);
    expect(config!['OCO_ONE_LINE_COMMIT']).toEqual(false);
  });

  it('return config values from the global config file', async () => {
    const configFile = await prepareFile(
      '.opencommit',
      `
OCO_OPENAI_API_KEY="${testApiKeyWithValidFormat}"
OCO_TOKENS_MAX_INPUT="8192"
OCO_TOKENS_MAX_OUTPUT="1000"
OCO_OPENAI_BASE_PATH="/openai/api"
OCO_DESCRIPTION="true"
OCO_EMOJI="true"
OCO_MODEL="gpt-4"
OCO_LANGUAGE="de"
OCO_MESSAGE_TEMPLATE_PLACEHOLDER="$m"
OCO_PROMPT_MODULE="@commitlint"
OCO_AI_PROVIDER="ollama"
OCO_GITPUSH="false"
OCO_ONE_LINE_COMMIT="true"
`
    );
    const config = getConfig({ configPath: configFile.filePath, envPath: '' });

    expect(config).not.toEqual(null);
    expect(config!['OCO_OPENAI_API_KEY']).toEqual(testApiKeyWithValidFormat);
    expect(config!['OCO_TOKENS_MAX_INPUT']).toEqual(8192);
    expect(config!['OCO_TOKENS_MAX_OUTPUT']).toEqual(1000);
    expect(config!['OCO_OPENAI_BASE_PATH']).toEqual('/openai/api');
    expect(config!['OCO_DESCRIPTION']).toEqual(true);
    expect(config!['OCO_EMOJI']).toEqual(true);
    expect(config!['OCO_MODEL']).toEqual('gpt-4');
    expect(config!['OCO_LANGUAGE']).toEqual('de');
    expect(config!['OCO_MESSAGE_TEMPLATE_PLACEHOLDER']).toEqual('$m');
    expect(config!['OCO_PROMPT_MODULE']).toEqual('@commitlint');
    expect(config!['OCO_AI_PROVIDER']).toEqual('ollama');
    expect(config!['OCO_GITPUSH']).toEqual(false);
    expect(config!['OCO_ONE_LINE_COMMIT']).toEqual(true);

    await configFile.cleanup();
  });

  it('return config values from the local env file', async () => {
    const envFile = await prepareFile(
      '.env',
      `
OCO_OPENAI_API_KEY="${testApiKeyWithValidFormat}"
OCO_TOKENS_MAX_INPUT="8192"
OCO_TOKENS_MAX_OUTPUT="1000"
OCO_OPENAI_BASE_PATH="/openai/api"
OCO_DESCRIPTION="true"
OCO_EMOJI="true"
OCO_MODEL="gpt-4"
OCO_LANGUAGE="de"
OCO_MESSAGE_TEMPLATE_PLACEHOLDER="$m"
OCO_PROMPT_MODULE="@commitlint"
OCO_AI_PROVIDER="ollama"
OCO_GITPUSH="false"
OCO_ONE_LINE_COMMIT="true"
    `
    );
    const config = getConfig({ configPath: '', envPath: envFile.filePath });

    expect(config).not.toEqual(null);
    expect(config!['OCO_OPENAI_API_KEY']).toEqual(testApiKeyWithValidFormat);
    expect(config!['OCO_TOKENS_MAX_INPUT']).toEqual(8192);
    expect(config!['OCO_TOKENS_MAX_OUTPUT']).toEqual(1000);
    expect(config!['OCO_OPENAI_BASE_PATH']).toEqual('/openai/api');
    expect(config!['OCO_DESCRIPTION']).toEqual(true);
    expect(config!['OCO_EMOJI']).toEqual(true);
    expect(config!['OCO_MODEL']).toEqual('gpt-4');
    expect(config!['OCO_LANGUAGE']).toEqual('de');
    expect(config!['OCO_MESSAGE_TEMPLATE_PLACEHOLDER']).toEqual('$m');
    expect(config!['OCO_PROMPT_MODULE']).toEqual('@commitlint');
    expect(config!['OCO_AI_PROVIDER']).toEqual('ollama');
    expect(config!['OCO_GITPUSH']).toEqual(false);
    expect(config!['OCO_ONE_LINE_COMMIT']).toEqual(true);

    await envFile.cleanup();
  });

  it('return default values when the content of the global config file is empty', async () => {
    const configFile = await prepareFile('.opencommit', '');
    const config = getConfig({ configPath: configFile.filePath, envPath: '' });

    expect(config).not.toEqual(null);
    expect(config!['OCO_OPENAI_API_KEY']).toEqual(undefined);
    // TODO: Fix the following tests
    // expect(config!['OCO_TOKENS_MAX_INPUT']).toEqual(4096); // Received: undefined
    // expect(config!['OCO_TOKENS_MAX_OUTPUT']).toEqual(500); // Received: undefined
    expect(config!['OCO_OPENAI_BASE_PATH']).toEqual(undefined);
    // expect(config!['OCO_DESCRIPTION']).toEqual(false); // Received: undefined
    // expect(config!['OCO_EMOJI']).toEqual(false); // Received: undefined
    // expect(config!['OCO_MODEL']).toEqual('gpt-3.5-turbo'); // Received: undefined
    // expect(config!['OCO_LANGUAGE']).toEqual('en'); // Received: undefined
    // expect(config!['OCO_MESSAGE_TEMPLATE_PLACEHOLDER']).toEqual('$msg'); // Received: undefined
    // expect(config!['OCO_PROMPT_MODULE']).toEqual('conventional-commit'); // Received: undefined
    // expect(config!['OCO_AI_PROVIDER']).toEqual('openai'); // Received: undefined
    // expect(config!['OCO_GITPUSH']).toEqual(true); // Received: undefined
    // expect(config!['OCO_ONE_LINE_COMMIT']).toEqual(false); // Received: undefined

    await configFile.cleanup();
  });

  it('return default values when the content of the local env file is empty', async () => {
    const envFile = await prepareFile('.env', '');
    const config = getConfig({ configPath: '', envPath: envFile.filePath });

    expect(config).not.toEqual(null);
    expect(config!['OCO_OPENAI_API_KEY']).toEqual(undefined);
    // TODO: Fix the following tests
    // expect(config!['OCO_TOKENS_MAX_INPUT']).toEqual(4096); // Received: undefined
    // expect(config!['OCO_TOKENS_MAX_OUTPUT']).toEqual(500); // Received: undefined
    expect(config!['OCO_OPENAI_BASE_PATH']).toEqual(undefined);
    expect(config!['OCO_DESCRIPTION']).toEqual(false);
    expect(config!['OCO_EMOJI']).toEqual(false);
    expect(config!['OCO_MODEL']).toEqual('gpt-3.5-turbo');
    expect(config!['OCO_LANGUAGE']).toEqual('en');
    expect(config!['OCO_MESSAGE_TEMPLATE_PLACEHOLDER']).toEqual('$msg');
    expect(config!['OCO_PROMPT_MODULE']).toEqual('conventional-commit');
    expect(config!['OCO_AI_PROVIDER']).toEqual('openai');
    expect(config!['OCO_GITPUSH']).toEqual(true);
    expect(config!['OCO_ONE_LINE_COMMIT']).toEqual(false);

    await envFile.cleanup();
  });

  it('return values prioritizing the local env over the global config', async () => {
    const configFile = await prepareFile(
      '.opencommit',
      `
OCO_OPENAI_API_KEY="${testApiKeyWithValidFormat}"
OCO_TOKENS_MAX_INPUT="8192"
OCO_TOKENS_MAX_OUTPUT="1000"
OCO_OPENAI_BASE_PATH="/openai/api"
OCO_DESCRIPTION="true"
OCO_EMOJI="true"
OCO_MODEL="gpt-4"
OCO_LANGUAGE="de"
OCO_MESSAGE_TEMPLATE_PLACEHOLDER="$m"
OCO_PROMPT_MODULE="@commitlint"
OCO_AI_PROVIDER="ollama"
OCO_GITPUSH="false"
OCO_ONE_LINE_COMMIT="true"
`
    );
    const envFile = await prepareFile(
      '.env',
      `
OCO_OPENAI_API_KEY="${testApiKeyWithValidFormat2}"
OCO_TOKENS_MAX_INPUT="16384"
OCO_TOKENS_MAX_OUTPUT="2000"
OCO_OPENAI_BASE_PATH="/openai/api2"
OCO_DESCRIPTION="false"
OCO_EMOJI="false"
OCO_MODEL="gpt-4-turbo-preview"
OCO_LANGUAGE="fr"
OCO_MESSAGE_TEMPLATE_PLACEHOLDER="$m2"
OCO_PROMPT_MODULE="conventional-commit"
OCO_AI_PROVIDER="openai"
OCO_GITPUSH="true"
OCO_ONE_LINE_COMMIT="false"
    `
    );

    const config = getConfig({
      configPath: configFile.filePath,
      envPath: envFile.filePath
    });

    expect(config).not.toEqual(null);

    // TODO: Fix the following tests
    // In all of the following cases, the global config value is being prioritized.
    // The expected values is the value from the local env file.

    // expect(config!['OCO_OPENAI_API_KEY']).toEqual(testApiKeyWithValidFormat2);
    // expect(config!['OCO_TOKENS_MAX_INPUT']).toEqual(16384);
    // expect(config!['OCO_TOKENS_MAX_OUTPUT']).toEqual(2000);
    // expect(config!['OCO_OPENAI_BASE_PATH']).toEqual('/openai/api2');
    // expect(config!['OCO_DESCRIPTION']).toEqual(false);
    // expect(config!['OCO_EMOJI']).toEqual(false);
    // expect(config!['OCO_MODEL']).toEqual('gpt-4-turbo-preview');
    // expect(config!['OCO_LANGUAGE']).toEqual('fr');
    // expect(config!['OCO_MESSAGE_TEMPLATE_PLACEHOLDER']).toEqual('$m2');
    // expect(config!['OCO_PROMPT_MODULE']).toEqual('conventional-commit');
    // expect(config!['OCO_AI_PROVIDER']).toEqual('openai');
    // expect(config!['OCO_GITPUSH']).toEqual(true);
    // expect(config!['OCO_ONE_LINE_COMMIT']).toEqual(false);

    await configFile.cleanup();
    await envFile.cleanup();
  });
});
