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

export async function fetchOpenAIModels(apiKey: string): Promise<string[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      return MODEL_LIST.openai;
    }

    const data = await response.json();
    const models = data.data
      .map((m: { id: string }) => m.id)
      .filter(
        (id: string) =>
          id.startsWith('gpt-') ||
          id.startsWith('o1') ||
          id.startsWith('o3') ||
          id.startsWith('o4')
      )
      .sort();

    return models.length > 0 ? models : MODEL_LIST.openai;
  } catch {
    return MODEL_LIST.openai;
  }
}

export async function fetchOllamaModels(
  baseUrl: string = 'http://localhost:11434'
): Promise<string[]> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.models?.map((m: { name: string }) => m.name) || [];
  } catch {
    return [];
  }
}

export async function fetchAnthropicModels(apiKey: string): Promise<string[]> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    });

    if (!response.ok) {
      return MODEL_LIST.anthropic;
    }

    const data = await response.json();
    const models = data.data
      ?.map((m: { id: string }) => m.id)
      .filter((id: string) => id.startsWith('claude-'))
      .sort();

    return models && models.length > 0 ? models : MODEL_LIST.anthropic;
  } catch {
    return MODEL_LIST.anthropic;
  }
}

export async function fetchMistralModels(apiKey: string): Promise<string[]> {
  try {
    const response = await fetch('https://api.mistral.ai/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      return MODEL_LIST.mistral;
    }

    const data = await response.json();
    const models = data.data
      ?.map((m: { id: string }) => m.id)
      .sort();

    return models && models.length > 0 ? models : MODEL_LIST.mistral;
  } catch {
    return MODEL_LIST.mistral;
  }
}

export async function fetchGroqModels(apiKey: string): Promise<string[]> {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      return MODEL_LIST.groq;
    }

    const data = await response.json();
    const models = data.data
      ?.map((m: { id: string }) => m.id)
      .sort();

    return models && models.length > 0 ? models : MODEL_LIST.groq;
  } catch {
    return MODEL_LIST.groq;
  }
}

export async function fetchOpenRouterModels(apiKey: string): Promise<string[]> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      return MODEL_LIST.openrouter;
    }

    const data = await response.json();
    // Filter to text-capable models only (exclude image/audio models)
    const models = data.data
      ?.filter((m: { id: string; context_length?: number }) =>
        m.context_length && m.context_length > 0
      )
      .map((m: { id: string }) => m.id)
      .sort();

    return models && models.length > 0 ? models : MODEL_LIST.openrouter;
  } catch {
    return MODEL_LIST.openrouter;
  }
}

export async function fetchDeepSeekModels(apiKey: string): Promise<string[]> {
  try {
    const response = await fetch('https://api.deepseek.com/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      return MODEL_LIST.deepseek;
    }

    const data = await response.json();
    const models = data.data
      ?.map((m: { id: string }) => m.id)
      .sort();

    return models && models.length > 0 ? models : MODEL_LIST.deepseek;
  } catch {
    return MODEL_LIST.deepseek;
  }
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

export function getCacheInfo(): { timestamp: number | null; providers: string[] } {
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
