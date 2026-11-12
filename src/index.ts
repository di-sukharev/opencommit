import {
  ConfigType,
  DEFAULT_CONFIG,
  getDefaultModel,
  OCO_AI_PROVIDER_ENUM
} from './commands/config';
import { generateCommitMessageWithConfig } from './generateCommitMessageFromGitDiff';
import { getI18nLocal } from './i18n';

// The build emits `out/index.d.ts` from this file alone. Keep the public types
// in this file and give exported functions explicit types.

/**
 * Settings for the library. The keys and values are the same as the `OCO_*`
 * settings of the CLI. Keys that you omit get the CLI default values.
 */
export interface OpenCommitConfig {
  OCO_AI_PROVIDER?: string;
  OCO_API_KEY?: string;
  OCO_API_URL?: string;
  OCO_API_CUSTOM_HEADERS?: string;
  OCO_PROXY?: string | null;
  OCO_MODEL?: string;
  OCO_TOKENS_MAX_INPUT?: number;
  OCO_TOKENS_MAX_OUTPUT?: number;
  OCO_LANGUAGE?: string;
  OCO_DESCRIPTION?: boolean;
  OCO_EMOJI?: boolean;
  OCO_EMOJI_POSITION_BEFORE_DESCRIPTION?: boolean;
  OCO_ONE_LINE_COMMIT?: boolean;
  OCO_OMIT_SCOPE?: boolean;
  OCO_REASONING?: boolean;
  OCO_REASONING_MAX_TOKENS?: number;
  OCO_OLLAMA_THINK?: boolean;
}

export interface GenerateCommitMessageOptions {
  /**
   * Settings for this call. The library does not read `~/.opencommit`,
   * `.env` or `OCO_*` environment variables.
   */
  config?: OpenCommitConfig;
  /** Additional context for the model, like `oco --context`. */
  context?: string;
  /** Use the full GitMoji specification, like `oco --fgm`. */
  fullGitMojiSpec?: boolean;
}

const PROVIDERS: string[] = Object.values(OCO_AI_PROVIDER_ENUM);

const resolveConfig = (config: OpenCommitConfig): ConfigType => {
  const provider = config.OCO_AI_PROVIDER ?? DEFAULT_CONFIG.OCO_AI_PROVIDER;
  if (!PROVIDERS.includes(provider)) {
    throw new Error(
      `OCO_AI_PROVIDER "${provider}" is not supported. Supported providers: ${PROVIDERS.join(', ')}.`
    );
  }

  const language = getI18nLocal(
    config.OCO_LANGUAGE ?? DEFAULT_CONFIG.OCO_LANGUAGE
  );
  if (typeof language !== 'string') {
    throw new Error(`OCO_LANGUAGE "${config.OCO_LANGUAGE}" is not supported.`);
  }

  return {
    ...DEFAULT_CONFIG,
    ...config,
    OCO_AI_PROVIDER: provider as OCO_AI_PROVIDER_ENUM,
    OCO_MODEL: config.OCO_MODEL ?? getDefaultModel(provider),
    OCO_LANGUAGE: language,
    // The @commitlint prompt module needs the interactive CLI setup.
    OCO_PROMPT_MODULE: DEFAULT_CONFIG.OCO_PROMPT_MODULE
  };
};

/**
 * Generates a commit message for the output of `git diff`.
 *
 * @example
 * const message = await generateCommitMessage(diff, {
 *   config: { OCO_AI_PROVIDER: 'openai', OCO_API_KEY: process.env.OPENAI_API_KEY }
 * });
 */
export const generateCommitMessage = async (
  diff: string,
  options: GenerateCommitMessageOptions = {}
): Promise<string> => {
  if (typeof diff !== 'string' || diff.trim() === '') {
    throw new Error('The diff is empty.');
  }

  return generateCommitMessageWithConfig(
    diff,
    resolveConfig(options.config ?? {}),
    options.fullGitMojiSpec ?? false,
    options.context ?? ''
  );
};
