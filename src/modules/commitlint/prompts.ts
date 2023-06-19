import chalk from 'chalk';
import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageRoleEnum
} from 'openai';

import { outro } from '@clack/prompts';
import {
  PromptConfig,
  QualifiedConfig,
  RuleConfigSeverity,
  RuleConfigTuple
} from '@commitlint/types';

import { getConfig } from '../../commands/config';
import { i18n, I18nLocals } from '../../i18n';
import { IDENTITY, INIT_DIFF_PROMPT } from '../../prompts';

const config = getConfig();
const translation = i18n[(config?.OCO_LANGUAGE as I18nLocals) || 'en'];

type DeepPartial<T> = {
  [P in keyof T]?: {
    [K in keyof T[P]]?: T[P][K];
  };
};

type PromptFunction = (
  applicable: string,
  value: any,
  prompt: DeepPartial<PromptConfig>
) => string;

type PromptResolverFunction = (
  key: string,
  applicable: string,
  value: any,
  prompt?: DeepPartial<PromptConfig>
) => string;

/**
 * Extracts more contexte for each type-enum.
 * IDEA: replicate the concept for scopes and refactor to a generic feature.
 */
const getTypeRuleExtraDescription = (
  type: string,
  prompt?: DeepPartial<PromptConfig>
) => prompt?.questions?.type?.enum?.[type]?.description;

/*
IDEA: Compress llm readable prompt for each section of commit message: one line for header, one line for scope, etc.
  - The type must be in lowercase and should be one of the following values: featuring, fixing, documenting, styling, refactoring, testing, chores, perf, build, ci, revert.
  - The scope should not be empty and provide context for the change (e.g., module or file changed).
  - The subject should not be empty, should not end with a period, and should provide a concise description of the change. It should not be in sentence-case, start-case, pascal-case, or upper-case.
*/
const llmReadableRules: {
  [ruleName: string]: PromptResolverFunction;
} = {
  blankline: (key, applicable) =>
    `There should ${applicable} be a blank line at the beginning of the ${key}.`,
  caseRule: (key, applicable, value: string | Array<string>) =>
    `The ${key} should ${applicable} be in ${
      Array.isArray(value)
        ? `one of the following case: 
  - ${value.join('\n  - ')}.`
        : `${value} case.`
    }`,
  emptyRule: (key, applicable) => `The ${key} should ${applicable} be empty.`,
  enumRule: (key, applicable, value: string | Array<string>) =>
    `The ${key} should ${applicable} be one of the following values: 
  - ${Array.isArray(value) ? value.join('\n  - ') : value}.`,
  enumTypeRule: (key, applicable, value: string | Array<string>, prompt) =>
    `The ${key} should ${applicable} be one of the following values: 
  - ${
    Array.isArray(value)
      ? value
          .map((v) => {
            const description = getTypeRuleExtraDescription(v, prompt);
            if (description) {
              return `${v} (${description})`;
            } else return v;
          })
          .join('\n  - ')
      : value
  }.`,
  fullStopRule: (key, applicable, value: string) =>
    `The ${key} should ${applicable} end with '${value}'.`,
  maxLengthRule: (key, applicable, value: string) =>
    `The ${key} should ${applicable} have ${value} characters or less.`,
  minLengthRule: (key, applicable, value: string) =>
    `The ${key} should ${applicable} have ${value} characters or more.`
};

/**
 * TODO: Validate rules to every rule in the @commitlint configuration.
 * IDEA: Plugins can extend the list of rule. Provide user with a way to infer or extend when "No prompt handler for rule".
 */
const rulesPrompts: {
  [ruleName: string]: PromptFunction;
} = {
  'body-case': (applicable: string, value: string | Array<string>) =>
    llmReadableRules.caseRule('body', applicable, value),
  'body-empty': (applicable: string) =>
    llmReadableRules.emptyRule('body', applicable, undefined),
  'body-full-stop': (applicable: string, value: string) =>
    llmReadableRules.fullStopRule('body', applicable, value),
  'body-leading-blank': (applicable: string) =>
    llmReadableRules.blankline('body', applicable, undefined),
  'body-max-length': (applicable: string, value: string) =>
    llmReadableRules.maxLengthRule('body', applicable, value),
  'body-max-line-length': (applicable: string, value: string) =>
    `Each line of the body should ${applicable} have ${value} characters or less.`,
  'body-min-length': (applicable: string, value: string) =>
    llmReadableRules.minLengthRule('body', applicable, value),
  'footer-case': (applicable: string, value: string | Array<string>) =>
    llmReadableRules.caseRule('footer', applicable, value),
  'footer-empty': (applicable: string) =>
    llmReadableRules.emptyRule('footer', applicable, undefined),
  'footer-leading-blank': (applicable: string) =>
    llmReadableRules.blankline('footer', applicable, undefined),
  'footer-max-length': (applicable: string, value: string) =>
    llmReadableRules.maxLengthRule('footer', applicable, value),
  'footer-max-line-length': (applicable: string, value: string) =>
    `Each line of the footer should ${applicable} have ${value} characters or less.`,
  'footer-min-length': (applicable: string, value: string) =>
    llmReadableRules.minLengthRule('footer', applicable, value),
  'header-case': (applicable: string, value: string | Array<string>) =>
    llmReadableRules.caseRule('header', applicable, value),
  'header-full-stop': (applicable: string, value: string) =>
    llmReadableRules.fullStopRule('header', applicable, value),
  'header-max-length': (applicable: string, value: string) =>
    llmReadableRules.maxLengthRule('header', applicable, value),
  'header-min-length': (applicable: string, value: string) =>
    llmReadableRules.minLengthRule('header', applicable, value),
  'references-empty': (applicable: string) =>
    llmReadableRules.emptyRule('references section', applicable, undefined),
  'scope-case': (applicable: string, value: string | Array<string>) =>
    llmReadableRules.caseRule('scope', applicable, value),
  'scope-empty': (applicable: string) =>
    llmReadableRules.emptyRule('scope', applicable, undefined),
  'scope-enum': (applicable: string, value: string | Array<string>) =>
    llmReadableRules.enumRule('type', applicable, value),
  'scope-max-length': (applicable: string, value: string) =>
    llmReadableRules.maxLengthRule('scope', applicable, value),
  'scope-min-length': (applicable: string, value: string) =>
    llmReadableRules.minLengthRule('scope', applicable, value),
  'signed-off-by': (applicable: string, value: string) =>
    `The commit message should ${applicable} have a "Signed-off-by" line with the value "${value}".`,
  'subject-case': (applicable: string, value: string | Array<string>) =>
    llmReadableRules.caseRule('subject', applicable, value),
  'subject-empty': (applicable: string) =>
    llmReadableRules.emptyRule('subject', applicable, undefined),
  'subject-full-stop': (applicable: string, value: string) =>
    llmReadableRules.fullStopRule('subject', applicable, value),
  'subject-max-length': (applicable: string, value: string) =>
    llmReadableRules.maxLengthRule('subject', applicable, value),
  'subject-min-length': (applicable: string, value: string) =>
    llmReadableRules.minLengthRule('subject', applicable, value),
  'type-case': (applicable: string, value: string | Array<string>) =>
    llmReadableRules.caseRule('type', applicable, value),
  'type-empty': (applicable: string) =>
    llmReadableRules.emptyRule('type', applicable, undefined),
  'type-enum': (applicable: string, value: string | Array<string>, prompt) =>
    llmReadableRules.enumTypeRule('type', applicable, value, prompt),
  'type-max-length': (applicable: string, value: string) =>
    llmReadableRules.maxLengthRule('type', applicable, value),
  'type-min-length': (applicable: string, value: string) =>
    llmReadableRules.minLengthRule('type', applicable, value)
};

const getPrompt = (
  ruleName: string,
  ruleConfig: RuleConfigTuple<unknown>,
  prompt: DeepPartial<PromptConfig>
) => {
  const [severity, applicable, value] = ruleConfig;

  // Should we exclude "Disabled" properties?
  // Is this used to disable a subjacent rule when extending presets?
  if (severity === RuleConfigSeverity.Disabled) return null;

  const promptFn = rulesPrompts[ruleName];
  if (promptFn) {
    return promptFn(applicable, value, prompt);
  }

  // Plugins may add their custom rules.
  // We might want to call OpenAI to build this rule's llm-readable prompt.
  outro(`${chalk.red('✖')} No prompt handler for rule "${ruleName}".`);
  return `Please manualy set the prompt for rule "${ruleName}".`;
};

export const inferPromptsFromCommitlintConfig = (
  config: QualifiedConfig
): string[] => {
  const { rules, prompt } = config;
  if (!rules) return [];
  return Object.keys(rules)
    .map((ruleName) =>
      getPrompt(ruleName, rules[ruleName] as RuleConfigTuple<unknown>, prompt)
    )
    .filter((prompt) => prompt !== null) as string[];
};

/**
 * Breaking down commit message structure for conventional commit, and mapping bits with
 * ubiquitous language from @commitlint.
 * While gpt-4 does this on it self, gpt-3.5 can't map this on his own atm.
 */
const STRUCTURE_OF_COMMIT = `
- Header of commit is composed of type, scope, subject: <type-of-commit>(<scope-of-commit>): <subject-of-commit>
- Description of commit is composed of body and footer (optional): <body-of-commit>\n<footer(s)-of-commit>`;

// Prompt to generate LLM-readable rules based on @commitlint rules.
const GEN_COMMITLINT_CONSISTENCY_PROMPT = (
  prompts: string[]
): ChatCompletionRequestMessage[] => [
  {
    role: ChatCompletionRequestMessageRoleEnum.Assistant,
    // prettier-ignore
    content: `${IDENTITY} Your mission is to create clean and comprehensive commit messages for two different changes in a single codebase and output them in the provided JSON format: one for a bug fix and another for a new feature. 

Here are the specific requirements and conventions that should be strictly followed:

Commit Message Conventions:
- The commit message consists of three parts: Header, Body, and Footer.
- Header: 
  - Format: \`<type>(<scope>): <subject>\`
- ${prompts.join('\n- ')}

JSON Output Format:
- The JSON output should contain the commit messages for a bug fix and a new feature in the following format:
\`\`\`json
{
  "localLanguage": "${translation.localLanguage}",
  "commitFix": "<Header of commit for bug fix>",
  "commitFeat": "<Header of commit for feature>",
  "commitDescription": "<Description of commit for both the bug fix and the feature>"
}
\`\`\`
- The "commitDescription" should not include the commit message’s header, only the description.
- Description should not be more than 74 characters.

Additional Details:
- Changing the variable 'port' to uppercase 'PORT' is considered a bug fix. 
- Allowing the server to listen on a port specified through the environment variable is considered a new feature. 

Example Git Diff is to follow:`
  },
  INIT_DIFF_PROMPT
];

/**
 * Prompt to have LLM generate a message using @commitlint rules.
 *
 * @param language
 * @param prompts
 * @returns
 */
const INIT_MAIN_PROMPT = (
  language: string,
  prompts: string[]
): ChatCompletionRequestMessage => ({
  role: ChatCompletionRequestMessageRoleEnum.System,
  // prettier-ignore
  content: `${IDENTITY} Your mission is to create clean and comprehensive commit messages in the given @commitlint convention and explain WHAT were the changes and WHY the changes were done. I'll send you an output of 'git diff --staged' command, and you convert it into a commit message.
${config?.OCO_EMOJI ? 'Use GitMoji convention to preface the commit.' : 'Do not preface the commit with anything.'}
${config?.OCO_DESCRIPTION ? 'Add a short description of WHY the changes are done after the commit message. Don\'t start it with "This commit", just describe the changes.' : "Don't add any descriptions to the commit, only commit message."}
Use the present tense. Use ${language} to answer.
    
You will strictly follow the following conventions to generate the content of the commit message:
- ${prompts.join('\n- ')}

The conventions refers to the following structure of commit message:
${STRUCTURE_OF_COMMIT}
    
    `
});

export const commitlintPrompts = {
  INIT_MAIN_PROMPT,
  GEN_COMMITLINT_CONSISTENCY_PROMPT
};
