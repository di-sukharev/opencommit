import { i18n } from '../../i18n';

export type DefaultConsistencyPrompt = {
  commitFix: string;
  commitFeat: string;
  commitFixOmitScope: string;
  commitFeatOmitScope: string;
  commitDescription: string;
};

export type CommitlintConsistencyPrompt = {
  commitMessage: string;
  config: {
    OCO_OMIT_SCOPE: boolean;
    OCO_DESCRIPTION: boolean;
    OCO_EMOJI: boolean;
  };
};

export type ConsistencyPrompt = DefaultConsistencyPrompt | CommitlintConsistencyPrompt;

export type CommitlintLLMConfig = {
  hash: string;
  prompts: string[];
  consistency: {
    [key: string]: ConsistencyPrompt;
  };
};
