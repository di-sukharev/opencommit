import { select, confirm, isCancel } from '@clack/prompts';
import chalk from 'chalk';
import { OpenAI } from 'openai';
import {
  DEFAULT_TOKEN_LIMITS,
  getConfig,
  setGlobalConfig,
  getGlobalConfig,
  MODEL_LIST,
  RECOMMENDED_MODELS
} from './commands/config';
import { getMainCommitPrompt } from './prompts';
import { getEngine } from './utils/engine';
import {
  isModelNotFoundError,
  getSuggestedModels,
  ModelNotFoundError
} from './utils/errors';
import { GenerateCommitMessageErrorEnum } from './utils/generateCommitMessageErrors';
import { mergeDiffs } from './utils/mergeDiffs';
import {
  AsyncTask,
  runTasksWithConcurrency
} from './utils/runTasksWithConcurrency';
import {
  splitByTokenLimit,
  TOKEN_BOUNDARY_RESERVE,
  tokenCount,
  tokenCountAsync
} from './utils/tokenCount';

const generateCommitMessageChatCompletionPrompt = async (
  diff: string,
  fullGitMojiSpec: boolean,
  context: string
): Promise<Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>> => {
  const INIT_MESSAGES_PROMPT = await getMainCommitPrompt(
    fullGitMojiSpec,
    context
  );

  const chatContextAsCompletionRequest = [...INIT_MESSAGES_PROMPT];

  chatContextAsCompletionRequest.push({
    role: 'user',
    content: diff
  });

  return chatContextAsCompletionRequest;
};

async function handleModelNotFoundError(
  error: Error,
  provider: string,
  currentModel: string
): Promise<string | null> {
  console.log(chalk.red(`\n✖ Model '${currentModel}' not found\n`));

  const suggestedModels = getSuggestedModels(provider, currentModel);
  const recommended =
    RECOMMENDED_MODELS[provider as keyof typeof RECOMMENDED_MODELS];

  if (suggestedModels.length === 0) {
    console.log(
      chalk.yellow(
        `No alternative models available. Run 'oco setup' to configure a different model.`
      )
    );
    return null;
  }

  const options: Array<{ value: string; label: string }> = [];

  // Add recommended first if available
  if (recommended && suggestedModels.includes(recommended)) {
    options.push({
      value: recommended,
      label: `${recommended} (Recommended)`
    });
  }

  // Add other suggestions
  suggestedModels
    .filter((m) => m !== recommended)
    .forEach((model) => {
      options.push({ value: model, label: model });
    });

  options.push({ value: '__custom__', label: 'Enter custom model...' });

  const selection = await select({
    message: 'Select an alternative model:',
    options
  });

  if (isCancel(selection)) {
    return null;
  }

  let newModel: string;
  if (selection === '__custom__') {
    const { text } = await import('@clack/prompts');
    const customModel = await text({
      message: 'Enter model name:',
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Model name is required';
        }
        return undefined;
      }
    });

    if (isCancel(customModel)) {
      return null;
    }
    newModel = customModel as string;
  } else {
    newModel = selection as string;
  }

  // Ask if user wants to save as default
  const saveAsDefault = await confirm({
    message: 'Save as default model?'
  });

  if (!isCancel(saveAsDefault) && saveAsDefault) {
    const existingConfig = getGlobalConfig();
    setGlobalConfig({
      ...existingConfig,
      OCO_MODEL: newModel
    } as any);
    console.log(chalk.green('√') + ' Model saved as default\n');
  }

  return newModel;
}

const ADJUSTMENT_FACTOR = 20;
const MAX_CONCURRENT_GENERATIONS = 3;
type CommitMessage = string | null | undefined;

export const generateCommitMessageByDiff = async (
  diff: string,
  fullGitMojiSpec: boolean = false,
  context: string = '',
  retryWithModel?: string
): Promise<string> => {
  const currentConfig = getConfig();
  const provider = currentConfig.OCO_AI_PROVIDER || 'openai';
  const currentModel = retryWithModel || currentConfig.OCO_MODEL;

  try {
    const INIT_MESSAGES_PROMPT = await getMainCommitPrompt(
      fullGitMojiSpec,
      context
    );

    const INIT_MESSAGES_PROMPT_LENGTH = INIT_MESSAGES_PROMPT.map(
      (msg) => tokenCount(msg.content as string) + 4
    ).reduce((a, b) => a + b, 0);

    const isReasoningModel =
      typeof currentConfig.OCO_REASONING === 'boolean'
        ? currentConfig.OCO_REASONING
        : /^(o[1-9]|gpt-5)/.test(currentModel);

    const maxInputTokens =
      currentConfig.OCO_TOKENS_MAX_INPUT ??
      DEFAULT_TOKEN_LIMITS.DEFAULT_MAX_TOKENS_INPUT;

    const maxOutputTokens = isReasoningModel
      ? currentConfig.OCO_REASONING_MAX_TOKENS ??
        DEFAULT_TOKEN_LIMITS.DEFAULT_MAX_REASONING
      : currentConfig.OCO_TOKENS_MAX_OUTPUT ??
        DEFAULT_TOKEN_LIMITS.DEFAULT_MAX_TOKENS_OUTPUT;

    const MAX_REQUEST_TOKENS =
      maxInputTokens -
      ADJUSTMENT_FACTOR -
      INIT_MESSAGES_PROMPT_LENGTH -
      maxOutputTokens;

    if ((await tokenCountAsync(diff)) >= MAX_REQUEST_TOKENS) {
      const commitMessageTasks = await getCommitMessageTasksFromFileDiffs(
        diff,
        MAX_REQUEST_TOKENS,
        fullGitMojiSpec,
        context
      );

      const commitMessages = await runTasksWithConcurrency(
        commitMessageTasks,
        MAX_CONCURRENT_GENERATIONS
      );

      return commitMessages.join('\n\n');
    }

    const messages = await generateCommitMessageChatCompletionPrompt(
      diff,
      fullGitMojiSpec,
      context
    );

    const engine = getEngine();
    const commitMessage = await engine.generateCommitMessage(messages);

    if (!commitMessage)
      throw new Error(GenerateCommitMessageErrorEnum.emptyMessage);

    return commitMessage;
  } catch (error) {
    // Handle model-not-found errors with interactive recovery
    if (isModelNotFoundError(error)) {
      const newModel = await handleModelNotFoundError(
        error as Error,
        provider,
        currentModel
      );

      if (newModel) {
        console.log(chalk.cyan(`Retrying with ${newModel}...\n`));
        // Retry with the new model by updating config temporarily
        const existingConfig = getGlobalConfig();
        setGlobalConfig({
          ...existingConfig,
          OCO_MODEL: newModel
        } as any);

        return generateCommitMessageByDiff(
          diff,
          fullGitMojiSpec,
          context,
          newModel
        );
      }
    }

    throw error;
  }
};

async function getMessageTasksByChangesInFile(
  fileDiff: string,
  separator: string,
  maxChangeLength: number,
  fullGitMojiSpec: boolean,
  context: string
): Promise<Array<AsyncTask<CommitMessage>>> {
  const hunkHeaderSeparator = '@@ ';
  const [fileHeader, ...fileDiffByLines] = fileDiff.split(hunkHeaderSeparator);

  // merge multiple line-diffs into 1 to save tokens
  const mergedChanges = await mergeDiffs(
    fileDiffByLines.map((line) => hunkHeaderSeparator + line),
    maxChangeLength
  );

  const lineDiffsWithHeader = [] as string[];
  for (const change of mergedChanges) {
    const diffPrefix = separator + fileHeader;
    const totalChange = diffPrefix + change;
    if ((await tokenCountAsync(totalChange)) > maxChangeLength) {
      // If the totalChange is too large, split it into smaller pieces
      const splitChanges = await splitDiff(change, diffPrefix, maxChangeLength);
      lineDiffsWithHeader.push(...splitChanges);
    } else {
      lineDiffsWithHeader.push(totalChange);
    }
  }

  return lineDiffsWithHeader.map(
    (lineDiff) => async (): Promise<CommitMessage> => {
      const messages = await generateCommitMessageChatCompletionPrompt(
        lineDiff,
        fullGitMojiSpec,
        context
      );

      const engine = getEngine();
      return engine.generateCommitMessage(messages);
    }
  );
}

const getLinesWithEndings = (content: string): string[] =>
  content.match(/[^\n]*\n|[^\n]+$/g) ?? [];

async function splitDiff(
  diff: string,
  prefix: string,
  maxChangeLength: number
) {
  if (maxChangeLength <= 0) {
    throw new Error(GenerateCommitMessageErrorEnum.outputTokensTooHigh);
  }

  const prefixTokens = await tokenCountAsync(prefix);
  const maxDiffTokens = maxChangeLength - prefixTokens - TOKEN_BOUNDARY_RESERVE;

  if (maxDiffTokens <= 0) {
    throw new Error(GenerateCommitMessageErrorEnum.outputTokensTooHigh);
  }

  const lineChunks = await mergeDiffs(getLinesWithEndings(diff), maxDiffTokens);
  const splitDiffs: string[] = [];

  for (const lineChunk of lineChunks) {
    if ((await tokenCountAsync(lineChunk)) <= maxDiffTokens) {
      splitDiffs.push(prefix + lineChunk);
      continue;
    }

    const oversizedLineChunks = await splitByTokenLimit(
      lineChunk,
      maxDiffTokens
    );
    splitDiffs.push(...oversizedLineChunks.map((chunk) => prefix + chunk));
  }

  return splitDiffs;
}

export const getCommitMessageTasksFromFileDiffs = async (
  diff: string,
  maxDiffLength: number,
  fullGitMojiSpec: boolean,
  context: string
) => {
  const separator = 'diff --git ';

  const diffByFiles = diff
    .split(separator)
    .slice(1)
    .map((fileDiff) => separator + fileDiff);

  // merge multiple files-diffs into 1 prompt to save tokens
  const mergedFilesDiffs = await mergeDiffs(diffByFiles, maxDiffLength);

  const commitMessageTasks: Array<AsyncTask<CommitMessage>> = [];

  for (const fileDiff of mergedFilesDiffs) {
    if ((await tokenCountAsync(fileDiff)) > maxDiffLength) {
      // if file-diff is bigger than gpt context — split fileDiff into lineDiff
      const messageTasks = await getMessageTasksByChangesInFile(
        fileDiff.slice(separator.length),
        separator,
        maxDiffLength,
        fullGitMojiSpec,
        context
      );

      commitMessageTasks.push(...messageTasks);
    } else {
      commitMessageTasks.push(async (): Promise<CommitMessage> => {
        const messages = await generateCommitMessageChatCompletionPrompt(
          fileDiff,
          fullGitMojiSpec,
          context
        );

        const engine = getEngine();
        return engine.generateCommitMessage(messages);
      });
    }
  }

  return commitMessageTasks;
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
