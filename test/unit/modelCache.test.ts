import { MODEL_LIST } from '../../src/commands/config';
import {
  fetchAnthropicModels,
  fetchDeepSeekModels,
  fetchGroqModels,
  fetchLlamaCppModels,
  fetchMistralModels,
  fetchOllamaModels,
  fetchOpenAIModels,
  fetchOpenRouterModels,
  fetchOrcaRouterModels
} from '../../src/utils/modelCache';

const originalFetch = global.fetch;
const fetchMock = jest.fn();

function mockJsonResponse(data: unknown, ok = true) {
  fetchMock.mockResolvedValue({
    ok,
    json: jest.fn().mockResolvedValue(data)
  });
}

describe('provider model fetchers', () => {
  beforeEach(() => {
    global.fetch = fetchMock as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    fetchMock.mockReset();
  });

  it.each([
    {
      provider: 'OpenAI',
      fetchModels: () => fetchOpenAIModels('openai-key'),
      request: [
        'https://api.openai.com/v1/models',
        { headers: { Authorization: 'Bearer openai-key' } }
      ],
      payload: {
        data: [
          { id: 'whisper-1' },
          { id: 'o4-mini' },
          { id: 'gpt-z' },
          { id: 'o1-preview' },
          { id: 'o3-mini' }
        ]
      },
      expected: ['gpt-z', 'o1-preview', 'o3-mini', 'o4-mini']
    },
    {
      provider: 'Ollama',
      fetchModels: () => fetchOllamaModels('http://ollama.test'),
      request: ['http://ollama.test/api/tags'],
      payload: { models: [{ name: 'llama3:8b' }, { name: 'mistral' }] },
      expected: ['llama3:8b', 'mistral']
    },
    {
      provider: 'llama.cpp',
      fetchModels: () => fetchLlamaCppModels('http://llamacpp.test'),
      request: ['http://llamacpp.test/v1/models'],
      payload: { data: [{ id: 'model-b' }, { id: 'model-a' }] },
      expected: ['model-b', 'model-a']
    },
    {
      provider: 'Anthropic',
      fetchModels: () => fetchAnthropicModels('anthropic-key'),
      request: [
        'https://api.anthropic.com/v1/models',
        {
          headers: {
            'x-api-key': 'anthropic-key',
            'anthropic-version': '2023-06-01'
          }
        }
      ],
      payload: {
        data: [{ id: 'other-model' }, { id: 'claude-z' }, { id: 'claude-a' }]
      },
      expected: ['claude-a', 'claude-z']
    },
    {
      provider: 'Mistral',
      fetchModels: () => fetchMistralModels('mistral-key'),
      request: [
        'https://api.mistral.ai/v1/models',
        { headers: { Authorization: 'Bearer mistral-key' } }
      ],
      payload: { data: [{ id: 'mistral-z' }, { id: 'mistral-a' }] },
      expected: ['mistral-a', 'mistral-z']
    },
    {
      provider: 'Groq',
      fetchModels: () => fetchGroqModels('groq-key'),
      request: [
        'https://api.groq.com/openai/v1/models',
        { headers: { Authorization: 'Bearer groq-key' } }
      ],
      payload: { data: [{ id: 'groq-z' }, { id: 'groq-a' }] },
      expected: ['groq-a', 'groq-z']
    },
    {
      provider: 'OpenRouter',
      fetchModels: () => fetchOpenRouterModels('openrouter-key'),
      request: [
        'https://openrouter.ai/api/v1/models',
        { headers: { Authorization: 'Bearer openrouter-key' } }
      ],
      payload: {
        data: [
          { id: 'text-z', context_length: 128 },
          { id: 'no-context' },
          { id: 'zero-context', context_length: 0 },
          { id: 'text-a', context_length: 1 }
        ]
      },
      expected: ['text-a', 'text-z']
    },
    {
      provider: 'DeepSeek',
      fetchModels: () => fetchDeepSeekModels('deepseek-key'),
      request: [
        'https://api.deepseek.com/v1/models',
        { headers: { Authorization: 'Bearer deepseek-key' } }
      ],
      payload: { data: [{ id: 'deepseek-z' }, { id: 'deepseek-a' }] },
      expected: ['deepseek-a', 'deepseek-z']
    },
    {
      provider: 'OrcaRouter',
      fetchModels: () => fetchOrcaRouterModels('orcarouter-key'),
      request: [
        'https://api.orcarouter.ai/v1/models',
        { headers: { Authorization: 'Bearer orcarouter-key' } }
      ],
      payload: {
        data: [
          { id: 'orcarouter/auto' },
          { id: 'other-route' },
          { id: 'orcarouter/fusion' }
        ]
      },
      expected: ['orcarouter/auto', 'orcarouter/fusion']
    }
  ])(
    'preserves the $provider request and response mapping',
    async ({ fetchModels, request, payload, expected }) => {
      mockJsonResponse(payload);

      await expect(fetchModels()).resolves.toEqual(expected);
      expect(fetchMock.mock.calls[0]).toEqual(request);
    }
  );

  it.each([
    ['OpenAI', () => fetchOpenAIModels('key'), MODEL_LIST.openai],
    ['Ollama', () => fetchOllamaModels(), []],
    ['llama.cpp', () => fetchLlamaCppModels(), []],
    ['Anthropic', () => fetchAnthropicModels('key'), MODEL_LIST.anthropic],
    ['Mistral', () => fetchMistralModels('key'), MODEL_LIST.mistral],
    ['Groq', () => fetchGroqModels('key'), MODEL_LIST.groq],
    ['OpenRouter', () => fetchOpenRouterModels('key'), MODEL_LIST.openrouter],
    ['DeepSeek', () => fetchDeepSeekModels('key'), MODEL_LIST.deepseek],
    ['OrcaRouter', () => fetchOrcaRouterModels('key'), MODEL_LIST.orcarouter]
  ])(
    'returns the existing %s fallback for a non-OK response',
    async (_, fetchModels, fallback) => {
      mockJsonResponse({ data: [] }, false);

      await expect(fetchModels()).resolves.toEqual(fallback);
    }
  );

  it('returns the remote fallback when mapping produces no models', async () => {
    mockJsonResponse({ data: [{ id: 'whisper-1' }] });

    await expect(fetchOpenAIModels('key')).resolves.toEqual(MODEL_LIST.openai);
  });

  it('returns an empty local fallback when mapping produces no models', async () => {
    mockJsonResponse({ models: [] });

    await expect(fetchOllamaModels()).resolves.toEqual([]);
  });

  it('returns the remote fallback for a malformed payload', async () => {
    mockJsonResponse({});

    await expect(fetchOpenAIModels('key')).resolves.toEqual(MODEL_LIST.openai);
  });

  it('returns the remote fallback when parsing JSON rejects', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockRejectedValue(new Error('invalid JSON'))
    });

    await expect(fetchOpenRouterModels('key')).resolves.toEqual(
      MODEL_LIST.openrouter
    );
  });

  it('returns an empty local fallback for a malformed payload', async () => {
    mockJsonResponse({});

    await expect(fetchLlamaCppModels()).resolves.toEqual([]);
  });

  it('returns the remote fallback when fetching rejects', async () => {
    fetchMock.mockRejectedValue(new Error('network unavailable'));

    await expect(fetchMistralModels('key')).resolves.toEqual(
      MODEL_LIST.mistral
    );
  });

  it('returns an empty local fallback when fetching rejects', async () => {
    fetchMock.mockRejectedValue(new Error('network unavailable'));

    await expect(fetchLlamaCppModels()).resolves.toEqual([]);
  });
});
