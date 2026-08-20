import { existsSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join as pathJoin } from 'path';
import { MODEL_LIST, OCO_AI_PROVIDER_ENUM } from '../commands/config';

const MODEL_CACHE_PATH = pathJoin(homedir(), '.opencommit-models.json');
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface ModelCache {
  timestamp: number;
  models: Record<string, string[]>;
}

function readCache(): ModelCache | null {
  try {
    if (!existsSync(MODEL_CACHE_PATH)) {
      return null;
    }
    const data = readFileSync(MODEL_CACHE_PATH, 'utf8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function writeCache(models: Record<string, string[]>): void {
  try {
    const cache: ModelCache = {
      timestamp: Date.now(),
      models
    };
    writeFileSync(MODEL_CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
  } catch {
    // Silently fail if we can't write cache
  }
}

function isCacheValid(cache: ModelCache | null): boolean {
  if (!cache) return false;
  return Date.now() - cache.timestamp < CACHE_TTL_MS;
}

interface ModelListItem {
  id: string;
}

interface ModelListResponse {
  data?: ModelListItem[];
}

interface OllamaModelListResponse {
  models?: Array<{ name: string }>;
}

interface OpenRouterModelListResponse {
  data?: Array<ModelListItem & { context_length?: number }>;
}

interface FetchModelListOptions {
  url: string;
  headers?: Record<string, string>;
  fallback: string[];
  mapModels: (data: unknown) => string[] | undefined;
}

async function fetchModelList({
  url,
  headers,
  fallback,
  mapModels
}: FetchModelListOptions): Promise<string[]> {
  try {
    const response = headers ? await fetch(url, { headers }) : await fetch(url);

    if (!response.ok) {
      return fallback;
    }

    const models = mapModels(await response.json());
    return models && models.length > 0 ? models : fallback;
  } catch {
    return fallback;
  }
}

export async function fetchOpenAIModels(apiKey: string): Promise<string[]> {
  return fetchModelList({
    url: 'https://api.openai.com/v1/models',
    headers: { Authorization: `Bearer ${apiKey}` },
    fallback: MODEL_LIST.openai,
    mapModels: (data) =>
      (data as Required<ModelListResponse>).data
        .map((model) => model.id)
        .filter(
          (id) =>
            id.startsWith('gpt-') ||
            id.startsWith('o1') ||
            id.startsWith('o3') ||
            id.startsWith('o4')
        )
        .sort()
  });
}

export async function fetchOllamaModels(
  baseUrl: string = 'http://localhost:11434'
): Promise<string[]> {
  return fetchModelList({
    url: `${baseUrl}/api/tags`,
    fallback: [],
    mapModels: (data) =>
      (data as OllamaModelListResponse).models?.map((model) => model.name)
  });
}

export async function fetchLlamaCppModels(
  baseUrl: string = 'http://localhost:8080'
): Promise<string[]> {
  return fetchModelList({
    url: `${baseUrl}/v1/models`,
    fallback: [],
    mapModels: (data) =>
      (data as ModelListResponse).data?.map((model) => model.id)
  });
}

export async function fetchAnthropicModels(apiKey: string): Promise<string[]> {
  return fetchModelList({
    url: 'https://api.anthropic.com/v1/models',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    fallback: MODEL_LIST.anthropic,
    mapModels: (data) =>
      (data as ModelListResponse).data
        ?.map((model) => model.id)
        .filter((id) => id.startsWith('claude-'))
        .sort()
  });
}

export async function fetchMistralModels(apiKey: string): Promise<string[]> {
  return fetchModelList({
    url: 'https://api.mistral.ai/v1/models',
    headers: { Authorization: `Bearer ${apiKey}` },
    fallback: MODEL_LIST.mistral,
    mapModels: (data) =>
      (data as ModelListResponse).data?.map((model) => model.id).sort()
  });
}

export async function fetchGroqModels(apiKey: string): Promise<string[]> {
  return fetchModelList({
    url: 'https://api.groq.com/openai/v1/models',
    headers: { Authorization: `Bearer ${apiKey}` },
    fallback: MODEL_LIST.groq,
    mapModels: (data) =>
      (data as ModelListResponse).data?.map((model) => model.id).sort()
  });
}

export async function fetchOpenRouterModels(apiKey: string): Promise<string[]> {
  return fetchModelList({
    url: 'https://openrouter.ai/api/v1/models',
    headers: { Authorization: `Bearer ${apiKey}` },
    fallback: MODEL_LIST.openrouter,
    mapModels: (data) =>
      (data as OpenRouterModelListResponse).data
        // Keep only text-capable models (exclude image/audio models).
        ?.filter((model) => model.context_length && model.context_length > 0)
        .map((model) => model.id)
        .sort()
  });
}

export async function fetchDeepSeekModels(apiKey: string): Promise<string[]> {
  return fetchModelList({
    url: 'https://api.deepseek.com/v1/models',
    headers: { Authorization: `Bearer ${apiKey}` },
    fallback: MODEL_LIST.deepseek,
    mapModels: (data) =>
      (data as ModelListResponse).data?.map((model) => model.id).sort()
  });
}

export async function fetchOrcaRouterModels(apiKey: string): Promise<string[]> {
  return fetchModelList({
    url: 'https://api.orcarouter.ai/v1/models',
    headers: { Authorization: `Bearer ${apiKey}` },
    fallback: MODEL_LIST.orcarouter,
    mapModels: (data) =>
      (data as ModelListResponse).data
        ?.map((model) => model.id)
        .filter((id) => id.startsWith('orcarouter/'))
        .sort()
  });
}

export async function fetchModelsForProvider(
  provider: string,
  apiKey?: string,
  baseUrl?: string,
  forceRefresh: boolean = false
): Promise<string[]> {
  const cache = readCache();

  // Return cached models if valid (unless force refresh)
  if (!forceRefresh && isCacheValid(cache) && cache!.models[provider]) {
    return cache!.models[provider];
  }

  let models: string[] = [];

  switch (provider.toLowerCase()) {
    case OCO_AI_PROVIDER_ENUM.OPENAI:
      if (apiKey) {
        models = await fetchOpenAIModels(apiKey);
      } else {
        models = MODEL_LIST.openai;
      }
      break;

    case OCO_AI_PROVIDER_ENUM.OLLAMA:
      models = await fetchOllamaModels(baseUrl);
      break;

    case OCO_AI_PROVIDER_ENUM.LLAMACPP:
      models = await fetchLlamaCppModels(baseUrl);
      break;

    case OCO_AI_PROVIDER_ENUM.ANTHROPIC:
      if (apiKey) {
        models = await fetchAnthropicModels(apiKey);
      } else {
        models = MODEL_LIST.anthropic;
      }
      break;

    case OCO_AI_PROVIDER_ENUM.GEMINI:
      // Google's API doesn't easily list generative models, use hardcoded list
      models = MODEL_LIST.gemini;
      break;

    case OCO_AI_PROVIDER_ENUM.GROQ:
      if (apiKey) {
        models = await fetchGroqModels(apiKey);
      } else {
        models = MODEL_LIST.groq;
      }
      break;

    case OCO_AI_PROVIDER_ENUM.MISTRAL:
      if (apiKey) {
        models = await fetchMistralModels(apiKey);
      } else {
        models = MODEL_LIST.mistral;
      }
      break;

    case OCO_AI_PROVIDER_ENUM.DEEPSEEK:
      if (apiKey) {
        models = await fetchDeepSeekModels(apiKey);
      } else {
        models = MODEL_LIST.deepseek;
      }
      break;

    case OCO_AI_PROVIDER_ENUM.AIMLAPI:
      models = MODEL_LIST.aimlapi;
      break;

    case OCO_AI_PROVIDER_ENUM.OPENROUTER:
      if (apiKey) {
        models = await fetchOpenRouterModels(apiKey);
      } else {
        models = MODEL_LIST.openrouter;
      }
      break;

    case OCO_AI_PROVIDER_ENUM.ORCAROUTER:
      if (apiKey) {
        models = await fetchOrcaRouterModels(apiKey);
      } else {
        models = MODEL_LIST.orcarouter;
      }
      break;

    default:
      models = MODEL_LIST.openai;
  }

  // Update cache
  const existingCache = cache?.models || {};
  existingCache[provider] = models;
  writeCache(existingCache);

  return models;
}

export function getModelsForProvider(provider: string): string[] {
  const providerKey = provider.toLowerCase() as keyof typeof MODEL_LIST;
  return MODEL_LIST[providerKey] || MODEL_LIST.openai;
}

export function clearModelCache(): void {
  try {
    if (existsSync(MODEL_CACHE_PATH)) {
      writeFileSync(MODEL_CACHE_PATH, '{}', 'utf8');
    }
  } catch {
    // Silently fail
  }
}

export function getCacheInfo(): {
  timestamp: number | null;
  providers: string[];
} {
  const cache = readCache();
  if (!cache) {
    return { timestamp: null, providers: [] };
  }
  return {
    timestamp: cache.timestamp,
    providers: Object.keys(cache.models || {})
  };
}

export function getCachedModels(provider: string): string[] | null {
  const cache = readCache();
  if (!cache || !cache.models[provider]) {
    return null;
  }
  return cache.models[provider];
}
