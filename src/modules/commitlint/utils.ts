import fs from 'node:fs/promises';

import { COMMITLINT_LLM_CONFIG_PATH } from './constants';
import type { CommitlintLLMConfig } from './types';

/**
 * Removes the "\n" only if occurring twice
 */
export const removeDoubleNewlines = (input: string): string => {
  const pattern = /\\n\\n/g;
  if (pattern.test(input)) {
    const newInput = input.replaceAll(pattern, '');
    return removeDoubleNewlines(newInput);
  }

  return input;
};

export const commitlintLLMConfigExists = async (): Promise<boolean> => {
  try {
    await fs.access(COMMITLINT_LLM_CONFIG_PATH);
    return true;
  } catch {
    return false;
  }
};

export const writeCommitlintLLMConfig = async (
  commitlintLLMConfig: CommitlintLLMConfig
): Promise<void> => {
  await fs.writeFile(COMMITLINT_LLM_CONFIG_PATH, JSON.stringify(commitlintLLMConfig, undefined, 2));
};

export const getCommitlintLLMConfig = async (): Promise<CommitlintLLMConfig> => {
  const content = await fs.readFile(COMMITLINT_LLM_CONFIG_PATH);
  return JSON.parse(content.toString()) as CommitlintLLMConfig;
};
