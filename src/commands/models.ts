import { intro, outro, spinner } from '@clack/prompts';
import chalk from 'chalk';
import { command } from 'cleye';
import { COMMANDS } from './ENUMS';
import {
  MODEL_LIST,
  OCO_AI_PROVIDER_ENUM,
  getConfig
} from './config';
import {
  fetchModelsForProvider,
  clearModelCache,
  getCacheInfo,
  getCachedModels
} from '../utils/modelCache';

function formatCacheAge(timestamp: number | null): string {
  if (!timestamp) return 'never';
  const ageMs = Date.now() - timestamp;
  const days = Math.floor(ageMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor(ageMs / (1000 * 60 * 60));
  const minutes = Math.floor(ageMs / (1000 * 60));

  if (days > 0) {
    return `${days} day${days === 1 ? '' : 's'} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  return 'just now';
}

async function listModels(provider: string, useCache: boolean = true): Promise<void> {
  const config = getConfig();
  const apiKey = config.OCO_API_KEY;
  const currentModel = config.OCO_MODEL;

  // Get cached models or fetch new ones
  let models: string[] = [];

  if (useCache) {
    const cached = getCachedModels(provider);
    if (cached) {
      models = cached;
    }
  }

  if (models.length === 0) {
    // Fallback to hardcoded list
    const providerKey = provider.toLowerCase() as keyof typeof MODEL_LIST;
    models = MODEL_LIST[providerKey] || [];
  }

  console.log(`\n${chalk.bold('Available models for')} ${chalk.cyan(provider)}:\n`);

  if (models.length === 0) {
    console.log(chalk.dim('  No models found'));
  } else {
    models.forEach((model) => {
      const isCurrent = model === currentModel;
      const prefix = isCurrent ? chalk.green('* ') : '  ';
      const label = isCurrent ? chalk.green(model) : model;
      console.log(`${prefix}${label}`);
    });
  }

  console.log('');
}

async function refreshModels(provider: string): Promise<void> {
  const config = getConfig();
  const apiKey = config.OCO_API_KEY;

  const loadingSpinner = spinner();
  loadingSpinner.start(`Fetching models from ${provider}...`);

  // Clear cache first
  clearModelCache();

  try {
    const models = await fetchModelsForProvider(provider, apiKey, undefined, true);
    loadingSpinner.stop(`${chalk.green('+')} Fetched ${models.length} models`);

    // List the models
    await listModels(provider, true);
  } catch (error) {
    loadingSpinner.stop(chalk.red('Failed to fetch models'));
    console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
  }
}

export const modelsCommand = command(
  {
    name: COMMANDS.models,
    help: {
      description: 'List and manage cached models for your AI provider'
    },
    flags: {
      refresh: {
        type: Boolean,
        alias: 'r',
        description: 'Clear cache and re-fetch models from the provider',
        default: false
      },
      provider: {
        type: String,
        alias: 'p',
        description: 'Specify provider (defaults to current OCO_AI_PROVIDER)'
      }
    }
  },
  async ({ flags }) => {
    const config = getConfig();
    const provider = flags.provider || config.OCO_AI_PROVIDER || OCO_AI_PROVIDER_ENUM.OPENAI;

    intro(chalk.bgCyan(' OpenCommit Models '));

    // Show cache info
    const cacheInfo = getCacheInfo();
    if (cacheInfo.timestamp) {
      console.log(
        chalk.dim(`  Cache last updated: ${formatCacheAge(cacheInfo.timestamp)}`)
      );
      if (cacheInfo.providers.length > 0) {
        console.log(
          chalk.dim(`  Cached providers: ${cacheInfo.providers.join(', ')}`)
        );
      }
    } else {
      console.log(chalk.dim('  No cached models'));
    }

    if (flags.refresh) {
      await refreshModels(provider);
    } else {
      await listModels(provider);
    }

    outro(
      `Run ${chalk.cyan('oco models --refresh')} to update the model list`
    );
  }
);
