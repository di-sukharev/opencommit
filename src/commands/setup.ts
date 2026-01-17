import { intro, outro, select, text, isCancel, spinner } from '@clack/prompts';
import chalk from 'chalk';
import { command } from 'cleye';
import { COMMANDS } from './ENUMS';
import {
  CONFIG_KEYS,
  MODEL_LIST,
  OCO_AI_PROVIDER_ENUM,
  getConfig,
  setGlobalConfig,
  getGlobalConfig,
  getIsGlobalConfigFileExist,
  DEFAULT_CONFIG,
  PROVIDER_API_KEY_URLS,
  RECOMMENDED_MODELS
} from './config';
import {
  fetchModelsForProvider,
  fetchOllamaModels,
  getCacheInfo
} from '../utils/modelCache';

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  [OCO_AI_PROVIDER_ENUM.OPENAI]: 'OpenAI (GPT-4o, GPT-4)',
  [OCO_AI_PROVIDER_ENUM.ANTHROPIC]: 'Anthropic (Claude Sonnet, Opus)',
  [OCO_AI_PROVIDER_ENUM.OLLAMA]: 'Ollama (Free, runs locally)',
  [OCO_AI_PROVIDER_ENUM.GEMINI]: 'Google Gemini',
  [OCO_AI_PROVIDER_ENUM.GROQ]: 'Groq (Fast inference, free tier)',
  [OCO_AI_PROVIDER_ENUM.MISTRAL]: 'Mistral AI',
  [OCO_AI_PROVIDER_ENUM.DEEPSEEK]: 'DeepSeek',
  [OCO_AI_PROVIDER_ENUM.OPENROUTER]: 'OpenRouter (Multiple providers)',
  [OCO_AI_PROVIDER_ENUM.AIMLAPI]: 'AI/ML API',
  [OCO_AI_PROVIDER_ENUM.AZURE]: 'Azure OpenAI',
  [OCO_AI_PROVIDER_ENUM.MLX]: 'MLX (Apple Silicon, local)'
};

const PRIMARY_PROVIDERS = [
  OCO_AI_PROVIDER_ENUM.OPENAI,
  OCO_AI_PROVIDER_ENUM.ANTHROPIC,
  OCO_AI_PROVIDER_ENUM.OLLAMA
];

const OTHER_PROVIDERS = [
  OCO_AI_PROVIDER_ENUM.GEMINI,
  OCO_AI_PROVIDER_ENUM.GROQ,
  OCO_AI_PROVIDER_ENUM.MISTRAL,
  OCO_AI_PROVIDER_ENUM.DEEPSEEK,
  OCO_AI_PROVIDER_ENUM.OPENROUTER,
  OCO_AI_PROVIDER_ENUM.AIMLAPI,
  OCO_AI_PROVIDER_ENUM.AZURE,
  OCO_AI_PROVIDER_ENUM.MLX
];

const NO_API_KEY_PROVIDERS = [
  OCO_AI_PROVIDER_ENUM.OLLAMA,
  OCO_AI_PROVIDER_ENUM.MLX
];

async function selectProvider(): Promise<string | symbol> {
  const primaryOptions = PRIMARY_PROVIDERS.map((provider) => ({
    value: provider,
    label: PROVIDER_DISPLAY_NAMES[provider] || provider
  }));

  primaryOptions.push({
    value: 'other',
    label: 'Other providers...'
  });

  const selection = await select({
    message: 'Select your AI provider:',
    options: primaryOptions
  });

  if (isCancel(selection)) return selection;

  if (selection === 'other') {
    const otherOptions = OTHER_PROVIDERS.map((provider) => ({
      value: provider,
      label: PROVIDER_DISPLAY_NAMES[provider] || provider
    }));

    return await select({
      message: 'Select provider:',
      options: otherOptions
    });
  }

  return selection;
}

async function getApiKey(provider: string): Promise<string | symbol> {
  const url = PROVIDER_API_KEY_URLS[provider as keyof typeof PROVIDER_API_KEY_URLS];

  let message = `Enter your ${provider} API key:`;
  if (url) {
    message = `Enter your API key:\n${chalk.dim(`  Get your key at: ${url}`)}`;
  }

  return await text({
    message,
    placeholder: 'sk-...',
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return 'API key is required';
      }
      return undefined;
    }
  });
}

function formatCacheAge(timestamp: number | null): string {
  if (!timestamp) return '';
  const ageMs = Date.now() - timestamp;
  const days = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor(ageMs / (1000 * 60 * 60));

  if (days > 0) {
    return `${days} day${days === 1 ? '' : 's'} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  return 'just now';
}

async function selectModel(
  provider: string,
  apiKey?: string
): Promise<string | symbol> {
  const providerDisplayName = PROVIDER_DISPLAY_NAMES[provider]?.split(' (')[0] || provider;
  const loadingSpinner = spinner();
  loadingSpinner.start(`Fetching models from ${providerDisplayName}...`);

  let models: string[] = [];
  let usedFallback = false;

  try {
    models = await fetchModelsForProvider(provider, apiKey);
  } catch {
    // Fall back to hardcoded list
    usedFallback = true;
    const providerKey = provider.toLowerCase() as keyof typeof MODEL_LIST;
    models = MODEL_LIST[providerKey] || [];
  }

  // Check cache info for display
  const cacheInfo = getCacheInfo();
  const cacheAge = formatCacheAge(cacheInfo.timestamp);

  if (usedFallback) {
    loadingSpinner.stop(
      chalk.yellow('Could not fetch models from API. Using default list.')
    );
  } else if (cacheAge) {
    loadingSpinner.stop(`Models loaded ${chalk.dim(`(cached ${cacheAge})`)}`);
  } else {
    loadingSpinner.stop('Models loaded');
  }

  if (models.length === 0) {
    // For Ollama/MLX, prompt for manual entry
    if (NO_API_KEY_PROVIDERS.includes(provider as OCO_AI_PROVIDER_ENUM)) {
      return await text({
        message: 'Enter model name (e.g., llama3:8b, mistral):',
        placeholder: 'llama3:8b',
        validate: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Model name is required';
          }
          return undefined;
        }
      });
    }

    // Use default from config
    const providerKey = provider.toLowerCase() as keyof typeof MODEL_LIST;
    return MODEL_LIST[providerKey]?.[0] || 'gpt-4o-mini';
  }

  // Get recommended model for this provider
  const recommended = RECOMMENDED_MODELS[provider as keyof typeof RECOMMENDED_MODELS];

  // Build options with recommended first
  const options: Array<{ value: string; label: string }> = [];

  if (recommended && models.includes(recommended)) {
    options.push({
      value: recommended,
      label: `${recommended} (Recommended)`
    });
  }

  // Add other models (first 10, excluding recommended)
  const otherModels = models
    .filter((m) => m !== recommended)
    .slice(0, 10);

  otherModels.forEach((model) => {
    options.push({ value: model, label: model });
  });

  // Add option to see all or enter custom
  if (models.length > 11) {
    options.push({ value: '__show_all__', label: 'Show all models...' });
  }
  options.push({ value: '__custom__', label: 'Enter custom model...' });

  const selection = await select({
    message: 'Select a model:',
    options
  });

  if (isCancel(selection)) return selection;

  if (selection === '__show_all__') {
    const allOptions = models.map((model) => ({
      value: model,
      label: model === recommended ? `${model} (Recommended)` : model
    }));

    return await select({
      message: 'Select a model:',
      options: allOptions
    });
  }

  if (selection === '__custom__') {
    return await text({
      message: 'Enter model name:',
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Model name is required';
        }
        return undefined;
      }
    });
  }

  return selection;
}

async function setupOllama(): Promise<{
  provider: string;
  model: string;
  apiUrl: string;
} | null> {
  console.log(chalk.cyan('\n  Ollama - Free Local AI\n'));
  console.log(chalk.dim('  Setup steps:'));
  console.log(chalk.dim('  1. Install: https://ollama.ai/download'));
  console.log(chalk.dim('  2. Pull a model: ollama pull llama3:8b'));
  console.log(chalk.dim('  3. Start server: ollama serve\n'));

  // Try to fetch available models
  const loadingSpinner = spinner();
  loadingSpinner.start('Checking for local Ollama installation...');

  const defaultUrl = 'http://localhost:11434';
  let ollamaModels: string[] = [];

  try {
    ollamaModels = await fetchOllamaModels(defaultUrl);
    if (ollamaModels.length > 0) {
      loadingSpinner.stop(
        `${chalk.green('✔')} Found ${ollamaModels.length} local model(s)`
      );
    } else {
      loadingSpinner.stop(
        chalk.yellow(
          'Ollama is running but no models found. Pull a model first: ollama pull llama3:8b'
        )
      );
    }
  } catch {
    loadingSpinner.stop(
      chalk.yellow(
        'Could not connect to Ollama. Make sure it is running: ollama serve'
      )
    );
  }

  // Model selection
  let model: string | symbol;
  if (ollamaModels.length > 0) {
    model = await select({
      message: 'Select a model:',
      options: [
        ...ollamaModels.map((m) => ({ value: m, label: m })),
        { value: '__custom__', label: 'Enter custom model name...' }
      ]
    });

    if (isCancel(model)) return null;

    if (model === '__custom__') {
      model = await text({
        message: 'Enter model name (e.g., llama3:8b, mistral):',
        placeholder: 'llama3:8b'
      });
    }
  } else {
    model = await text({
      message: 'Enter model name (e.g., llama3:8b, mistral):',
      placeholder: 'llama3:8b',
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Model name is required';
        }
        return undefined;
      }
    });
  }

  if (isCancel(model)) return null;

  // API URL (optional)
  const apiUrl = await text({
    message: 'Ollama URL (press Enter for default):',
    placeholder: defaultUrl,
    defaultValue: defaultUrl
  });

  if (isCancel(apiUrl)) return null;

  return {
    provider: OCO_AI_PROVIDER_ENUM.OLLAMA,
    model: model as string,
    apiUrl: (apiUrl as string) || defaultUrl
  };
}

export async function runSetup(): Promise<boolean> {
  intro(chalk.bgCyan(' Welcome to OpenCommit! '));

  // Select provider
  const provider = await selectProvider();
  if (isCancel(provider)) {
    outro('Setup cancelled');
    return false;
  }

  let config: Partial<Record<string, any>> = {};

  // Handle Ollama specially
  if (provider === OCO_AI_PROVIDER_ENUM.OLLAMA) {
    const ollamaConfig = await setupOllama();
    if (!ollamaConfig) {
      outro('Setup cancelled');
      return false;
    }

    config = {
      OCO_AI_PROVIDER: ollamaConfig.provider,
      OCO_MODEL: ollamaConfig.model,
      OCO_API_URL: ollamaConfig.apiUrl,
      OCO_API_KEY: 'ollama' // Placeholder
    };
  } else if (provider === OCO_AI_PROVIDER_ENUM.MLX) {
    // MLX setup
    console.log(chalk.cyan('\n  MLX - Apple Silicon Local AI\n'));
    console.log(chalk.dim('  MLX runs locally on Apple Silicon Macs.'));
    console.log(chalk.dim('  No API key required.\n'));

    const model = await text({
      message: 'Enter model name:',
      placeholder: 'mlx-community/Llama-3-8B-Instruct-4bit'
    });

    if (isCancel(model)) {
      outro('Setup cancelled');
      return false;
    }

    config = {
      OCO_AI_PROVIDER: OCO_AI_PROVIDER_ENUM.MLX,
      OCO_MODEL: model,
      OCO_API_KEY: 'mlx' // Placeholder
    };
  } else {
    // Standard provider flow: API key then model
    const apiKey = await getApiKey(provider as string);
    if (isCancel(apiKey)) {
      outro('Setup cancelled');
      return false;
    }

    const model = await selectModel(provider as string, apiKey as string);
    if (isCancel(model)) {
      outro('Setup cancelled');
      return false;
    }

    config = {
      OCO_AI_PROVIDER: provider,
      OCO_API_KEY: apiKey,
      OCO_MODEL: model
    };
  }

  // Save configuration
  const existingConfig = getIsGlobalConfigFileExist()
    ? getGlobalConfig()
    : DEFAULT_CONFIG;

  const newConfig = {
    ...existingConfig,
    ...config
  };

  setGlobalConfig(newConfig as any);

  outro(
    `${chalk.green('✔')} Configuration saved to ~/.opencommit\n\n  Run ${chalk.cyan('oco')} to generate commit messages!`
  );

  return true;
}

export function isFirstRun(): boolean {
  if (!getIsGlobalConfigFileExist()) {
    return true;
  }

  const config = getConfig();

  // Check if API key is missing for providers that need it
  const provider = config.OCO_AI_PROVIDER || OCO_AI_PROVIDER_ENUM.OPENAI;

  if (NO_API_KEY_PROVIDERS.includes(provider as OCO_AI_PROVIDER_ENUM)) {
    // For Ollama/MLX, check if model is set
    return !config.OCO_MODEL;
  }

  // For other providers, check if API key is set
  return !config.OCO_API_KEY;
}

export async function promptForMissingApiKey(): Promise<boolean> {
  const config = getConfig();
  const provider = config.OCO_AI_PROVIDER || OCO_AI_PROVIDER_ENUM.OPENAI;

  if (NO_API_KEY_PROVIDERS.includes(provider as OCO_AI_PROVIDER_ENUM)) {
    return true; // No API key needed
  }

  if (config.OCO_API_KEY) {
    return true; // Already has key
  }

  console.log(
    chalk.yellow(
      `\nAPI key missing for ${provider}. Let's set it up.\n`
    )
  );

  const apiKey = await getApiKey(provider);
  if (isCancel(apiKey)) {
    return false;
  }

  const existingConfig = getGlobalConfig();
  setGlobalConfig({
    ...existingConfig,
    OCO_API_KEY: apiKey as string
  } as any);

  console.log(chalk.green('✔') + ' API key saved\n');
  return true;
}

export const setupCommand = command(
  {
    name: COMMANDS.setup,
    help: {
      description: 'Interactive setup wizard for OpenCommit'
    }
  },
  async () => {
    await runSetup();
  }
);
