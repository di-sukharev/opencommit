import { jest } from '@jest/globals';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import * as os from 'os';
import { join } from 'path';

const testHome = mkdtempSync(join(os.tmpdir(), 'opencommit-models-'));

jest.unstable_mockModule('os', () => ({
  ...os,
  default: { ...os.default, homedir: () => testHome },
  homedir: () => testHome
}));
jest.unstable_mockModule('@clack/prompts', () => ({
  intro: jest.fn(),
  outro: jest.fn(),
  spinner: () => ({ start: jest.fn(), stop: jest.fn() })
}));

const { modelsCommand } = await import('../../src/commands/models');
const apiKey = 'test-provider-key';

afterAll(() => {
  rmSync(testHome, { force: true, recursive: true });
});

it.each([
  {
    configured: 'trustedrouter',
    requested: 'openai',
    requests: []
  },
  {
    configured: 'openai',
    requested: 'OpenAI',
    requests: [
      [
        'https://api.openai.com/v1/models',
        { headers: { Authorization: `Bearer ${apiKey}` } }
      ]
    ]
  },
  {
    configured: undefined,
    requested: undefined,
    requests: [
      [
        'https://api.openai.com/v1/models',
        { headers: { Authorization: `Bearer ${apiKey}` } }
      ]
    ]
  },
  {
    configured: 'openai',
    requested: 'TrustedRouter',
    requests: [['https://api.trustedrouter.com/v1/models']]
  }
])(
  'refreshes models for $requested with $configured configured',
  async ({ configured, requested, requests }) => {
    writeFileSync(
      join(testHome, '.opencommit'),
      `OCO_API_KEY=${apiKey}\n${configured ? `OCO_AI_PROVIDER=${configured}\n` : ''}`
    );
    const env = jest.replaceProperty(process, 'env', {});
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => Response.json({ data: [] }));
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await modelsCommand.callback!({
        flags: { refresh: true, provider: requested }
      });
      expect(fetch.mock.calls).toEqual(requests);
    } finally {
      log.mockRestore();
      fetch.mockRestore();
      env.restore();
    }
  }
);
