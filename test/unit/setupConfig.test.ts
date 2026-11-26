import { jest } from '@jest/globals';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import * as os from 'os';
import { join } from 'path';

const testHome = mkdtempSync(join(os.tmpdir(), 'opencommit-setup-'));
const select = jest.fn();
const text = jest.fn();
const password = jest.fn();

jest.unstable_mockModule('os', () => ({
  ...os,
  default: { ...os.default, homedir: () => testHome },
  homedir: () => testHome
}));
jest.unstable_mockModule('@clack/prompts', () => ({
  intro: jest.fn(),
  outro: jest.fn(),
  select,
  text,
  password,
  isCancel: (value: unknown) => typeof value === 'symbol',
  spinner: () => ({ start: jest.fn(), stop: jest.fn() })
}));

const { getConfig, getGlobalConfig } =
  await import('../../src/commands/config');
const { runSetup } = await import('../../src/commands/setup');

const configPath = join(testHome, '.opencommit');
const envPath = join(testHome, '.env');

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  rmSync(testHome, { force: true, recursive: true });
});

it.each(['ollama', 'openrouter'])(
  'sets up OpenRouter with existing settings from %s',
  async (previousProvider) => {
    const model = 'openai/gpt-4o-mini';
    writeFileSync(
      configPath,
      [
        `OCO_AI_PROVIDER=${previousProvider}`,
        'OCO_API_URL=https://configured.example/v1',
        'OCO_API_CUSTOM_HEADERS={"X-Provider":"configured"}'
      ].join('\n')
    );
    writeFileSync(
      join(testHome, '.opencommit-models.json'),
      JSON.stringify({
        timestamp: Date.now(),
        models: { openrouter: [model] }
      })
    );
    const env = jest.replaceProperty(process, 'env', {
      ...process.env,
      OCO_API_KEY: '',
      OCO_API_URL: 'https://temporary.example/v1'
    });
    select
      .mockResolvedValueOnce('other')
      .mockResolvedValueOnce('openrouter')
      .mockResolvedValueOnce(model);
    password.mockResolvedValueOnce('openrouter-test-key');

    try {
      await expect(runSetup()).resolves.toBe(true);
      expect(getConfig({ envPath })).toMatchObject({
        OCO_API_KEY: 'openrouter-test-key',
        OCO_API_URL: 'https://temporary.example/v1'
      });
    } finally {
      env.restore();
    }

    const savedConfig = getGlobalConfig();
    expect(savedConfig).toMatchObject({
      OCO_AI_PROVIDER: 'openrouter',
      OCO_API_KEY: 'openrouter-test-key',
      OCO_MODEL: model
    });

    if (previousProvider === 'openrouter') {
      expect(savedConfig.OCO_API_URL).toBe('https://configured.example/v1');
      expect(savedConfig.OCO_API_CUSTOM_HEADERS).toBe(
        '{"X-Provider":"configured"}'
      );
    } else {
      expect(savedConfig.OCO_API_URL).toBeUndefined();
      expect(savedConfig.OCO_API_CUSTOM_HEADERS).toBeUndefined();
    }
  }
);

it('keeps the new endpoint selected in the llama.cpp setup wizard', async () => {
  writeFileSync(
    configPath,
    [
      'OCO_AI_PROVIDER=openrouter',
      'OCO_API_URL=https://configured.example/v1',
      'OCO_API_CUSTOM_HEADERS={"X-Provider":"configured"}'
    ].join('\n')
  );
  select.mockResolvedValueOnce('llamacpp');
  const apiUrl = 'http://127.0.0.1:8888';
  text.mockResolvedValueOnce(apiUrl);

  await expect(runSetup()).resolves.toBe(true);

  expect(getGlobalConfig()).toMatchObject({
    OCO_AI_PROVIDER: 'llamacpp',
    OCO_API_URL: apiUrl,
    OCO_MODEL: ''
  });
  expect(getGlobalConfig().OCO_API_CUSTOM_HEADERS).toBeUndefined();
});
