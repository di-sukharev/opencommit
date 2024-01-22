import { i18n } from '../../i18n';

export type ConsistencyPrompt = (typeof i18n)[keyof typeof i18n];

export interface CommitlintLLMConfig {
  hash: string;
  prompts: string[];
  consistency: Record<string, ConsistencyPrompt>;
}
