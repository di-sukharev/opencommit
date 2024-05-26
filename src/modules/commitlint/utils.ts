import fs from 'fs/promises';

import { COMMITLINT_LLM_CONFIG_PATH } from './constants';
import { CommitlintLLMConfig } from './types';

/**
 * Removes the "\n" only if occurring twice
 */
export const removeDoubleNewlines = (input: string): string => {
  const pattern = /\\n\\n/g;
  if (pattern.test(input)) {
    const newInput = input.replace(pattern, '');
    return removeDoubleNewlines(newInput);
  }

  return input;
};

export const getJSONBlock = (input: string): string => {
  const jsonIndex = input.search('```json');
  if (jsonIndex > -1) {
    input = input.slice(jsonIndex + 8);
    const endJsonIndex = input.search('```');
    input = input.slice(0, endJsonIndex); 
  }
  return input;
};

export const commitlintLLMConfigExists = async (): Promise<boolean> => {
  let exists;
  try {
    await fs.access(COMMITLINT_LLM_CONFIG_PATH);
    exists = true;
  } catch (e) {
    exists = false;
  }

  return exists;
};

export const writeCommitlintLLMConfig = async (
  commitlintLLMConfig: CommitlintLLMConfig
): Promise<void> => {
  await fs.writeFile(
    COMMITLINT_LLM_CONFIG_PATH,
    JSON.stringify(commitlintLLMConfig, null, 2)
  );
};

export const getCommitlintLLMConfig =
  async (): Promise<CommitlintLLMConfig> => {
    const content = await fs.readFile(COMMITLINT_LLM_CONFIG_PATH);
    const commitLintLLMConfig = JSON.parse(
      content.toString()
    ) as CommitlintLLMConfig;
    return commitLintLLMConfig;
  };
