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

const apiUrl = 'https://gateway.example/v1';

it.each([
  {
    configured: 'deepseek',
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
    apiUrl,
    requested: undefined,
    requests: [
      [`${apiUrl}/models`, { headers: { Authorization: `Bearer ${apiKey}` } }]
    ]
  },
  {
    configured: 'openai',
    apiUrl,
    requested: 'Ollama',
    requests: [['http://localhost:11434/api/tags']]
  }
])(
  'refreshes models for $requested with $configured at $apiUrl configured',
  async ({ configured, apiUrl, requested, requests }) => {
    writeFileSync(
      join(testHome, '.opencommit'),
      [
        `OCO_API_KEY=${apiKey}`,
        configured && `OCO_AI_PROVIDER=${configured}`,
        apiUrl && `OCO_API_URL=${apiUrl}`
      ]
        .filter(Boolean)
        .join('\n')
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
