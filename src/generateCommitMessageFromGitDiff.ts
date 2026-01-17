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
import { mergeDiffs } from './utils/mergeDiffs';
import { tokenCount } from './utils/tokenCount';

const config = getConfig();
const MAX_TOKENS_INPUT = config.OCO_TOKENS_MAX_INPUT;
const MAX_TOKENS_OUTPUT = config.OCO_TOKENS_MAX_OUTPUT;

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

export enum GenerateCommitMessageErrorEnum {
  tooMuchTokens = 'TOO_MUCH_TOKENS',
  internalError = 'INTERNAL_ERROR',
  emptyMessage = 'EMPTY_MESSAGE',
  outputTokensTooHigh = `Token limit exceeded, OCO_TOKENS_MAX_OUTPUT must not be much higher than the default ${DEFAULT_TOKEN_LIMITS.DEFAULT_MAX_TOKENS_OUTPUT} tokens.`
}

async function handleModelNotFoundError(
  error: Error,
  provider: string,
  currentModel: string
): Promise<string | null> {
  console.log(
    chalk.red(`\n✖ Model '${currentModel}' not found\n`)
  );

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
    console.log(chalk.green('✔') + ' Model saved as default\n');
  }

  return newModel;
}

const ADJUSTMENT_FACTOR = 20;

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

    const MAX_REQUEST_TOKENS =
      MAX_TOKENS_INPUT -
      ADJUSTMENT_FACTOR -
      INIT_MESSAGES_PROMPT_LENGTH -
      MAX_TOKENS_OUTPUT;

    if (tokenCount(diff) >= MAX_REQUEST_TOKENS) {
      const commitMessagePromises = await getCommitMsgsPromisesFromFileDiffs(
        diff,
        MAX_REQUEST_TOKENS,
        fullGitMojiSpec
      );

      const commitMessages = [] as string[];
      for (const promise of commitMessagePromises) {
        commitMessages.push((await promise) as string);
        await delay(2000);
      }

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

function getMessagesPromisesByChangesInFile(
  fileDiff: string,
  separator: string,
  maxChangeLength: number,
  fullGitMojiSpec: boolean
) {
  const hunkHeaderSeparator = '@@ ';
  const [fileHeader, ...fileDiffByLines] = fileDiff.split(hunkHeaderSeparator);

  // merge multiple line-diffs into 1 to save tokens
  const mergedChanges = mergeDiffs(
    fileDiffByLines.map((line) => hunkHeaderSeparator + line),
    maxChangeLength
  );

  const lineDiffsWithHeader = [] as string[];
  for (const change of mergedChanges) {
    const totalChange = fileHeader + change;
    if (tokenCount(totalChange) > maxChangeLength) {
      // If the totalChange is too large, split it into smaller pieces
      const splitChanges = splitDiff(totalChange, maxChangeLength);
      lineDiffsWithHeader.push(...splitChanges);
    } else {
      lineDiffsWithHeader.push(totalChange);
    }
  }

  const engine = getEngine();
  const commitMsgsFromFileLineDiffs = lineDiffsWithHeader.map(
    async (lineDiff) => {
      const messages = await generateCommitMessageChatCompletionPrompt(
        separator + lineDiff,
        fullGitMojiSpec
      );

      return engine.generateCommitMessage(messages);
    }
  );

  return commitMsgsFromFileLineDiffs;
}

function splitDiff(diff: string, maxChangeLength: number) {
  const lines = diff.split('\n');
  const splitDiffs = [] as string[];
  let currentDiff = '';

  if (maxChangeLength <= 0) {
    throw new Error(GenerateCommitMessageErrorEnum.outputTokensTooHigh);
  }

  for (let line of lines) {
    // If a single line exceeds maxChangeLength, split it into multiple lines
    while (tokenCount(line) > maxChangeLength) {
      const subLine = line.substring(0, maxChangeLength);
      line = line.substring(maxChangeLength);
      splitDiffs.push(subLine);
    }

    // Check the tokenCount of the currentDiff and the line separately
    if (tokenCount(currentDiff) + tokenCount('\n' + line) > maxChangeLength) {
      // If adding the next line would exceed the maxChangeLength, start a new diff
      splitDiffs.push(currentDiff);
      currentDiff = line;
    } else {
      // Otherwise, add the line to the current diff
      currentDiff += '\n' + line;
    }
  }

  // Add the last diff
  if (currentDiff) {
    splitDiffs.push(currentDiff);
  }

  return splitDiffs;
}

export const getCommitMsgsPromisesFromFileDiffs = async (
  diff: string,
  maxDiffLength: number,
  fullGitMojiSpec: boolean
) => {
  const separator = 'diff --git ';

  const diffByFiles = diff.split(separator).slice(1);

  // merge multiple files-diffs into 1 prompt to save tokens
  const mergedFilesDiffs = mergeDiffs(diffByFiles, maxDiffLength);

  const commitMessagePromises = [] as Promise<string | null | undefined>[];

  for (const fileDiff of mergedFilesDiffs) {
    if (tokenCount(fileDiff) >= maxDiffLength) {
      // if file-diff is bigger than gpt context — split fileDiff into lineDiff
      const messagesPromises = getMessagesPromisesByChangesInFile(
        fileDiff,
        separator,
        maxDiffLength,
        fullGitMojiSpec
      );

      commitMessagePromises.push(...messagesPromises);
    } else {
      const messages = await generateCommitMessageChatCompletionPrompt(
        separator + fileDiff,
        fullGitMojiSpec
      );

      const engine = getEngine();
      commitMessagePromises.push(engine.generateCommitMessage(messages));
    }
  }

  return commitMessagePromises;
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
