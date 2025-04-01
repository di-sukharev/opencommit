import chalk from 'chalk';
import { OpenAI } from 'openai';
import { outro } from '@clack/prompts';
import {
  PromptConfig,
  QualifiedConfig,
  RuleConfigSeverity,
  RuleConfigTuple
} from '@commitlint/types';

import { getConfig } from '../../commands/config';
import { i18n, I18nLocals } from '../../i18n';
import {
  INIT_DIFF_PROMPT,
  getConsistencyContent,
  getSharedGuidelines,
  SharedGuidelines
} from '../../prompts';

const config = getConfig();
const translation = i18n[(config.OCO_LANGUAGE as I18nLocals) || 'en'];

// Types
type DeepPartial<T> = {
  [P in keyof T]?: {
    [K in keyof T[P]]?: T[P][K];
  };
};

interface PromptTemplateVars {
  rules: string;
  requirements: string;
  referenceStyle: string;
  gitDiff: string;
}

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

// Rule description helpers
const getTypeRuleExtraDescription = (
  type: string,
  prompt?: DeepPartial<PromptConfig>
) => prompt?.questions?.type?.enum?.[type]?.description;

// Rule formatters
const llmReadableRules: Record<string, PromptResolverFunction> = {
  blankline: (key, applicable) =>
    `There should ${applicable} be a blank line at the beginning of the ${key}.`,
  caseRule: (key, applicable, value: string | Array<string>) =>
    `The ${key} should ${applicable} be in ${Array.isArray(value)
      ? `one of the following case:\n  - ${value.join('\n  - ')}.`
      : `${value} case.`}`,
  emptyRule: (key, applicable) =>
    `The ${key} should ${applicable} be empty.`,
  enumRule: (key, applicable, value: string | Array<string>) =>
    `The ${key} should ${applicable} be one of the following values:\n  - ${Array.isArray(value) ? value.join('\n  - ') : value}.`,
  enumTypeRule: (key, applicable, value: string | Array<string>, prompt) =>
    `The ${key} should ${applicable} be one of the following values:\n  - ${Array.isArray(value)
      ? value
        .map(v => {
          const description = getTypeRuleExtraDescription(v, prompt);
          return description ? `${v} (${description})` : v;
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

// Commitlint rule handlers
const rulesPrompts: Record<string, PromptFunction> = {
  // Body rules
  'body-case': (applicable, value) => llmReadableRules.caseRule('body', applicable, value),
  'body-empty': (applicable) => llmReadableRules.emptyRule('body', applicable, undefined),
  'body-full-stop': (applicable, value) => llmReadableRules.fullStopRule('body', applicable, value),
  'body-leading-blank': (applicable) => llmReadableRules.blankline('body', applicable, undefined),
  'body-max-length': (applicable, value) => llmReadableRules.maxLengthRule('body', applicable, value),
  'body-max-line-length': (applicable, value) => `Each line of the body should ${applicable} have ${value} characters or less.`,
  'body-min-length': (applicable, value) => llmReadableRules.minLengthRule('body', applicable, value),

  // Footer rules
  'footer-case': (applicable, value) => llmReadableRules.caseRule('footer', applicable, value),
  'footer-empty': (applicable) => llmReadableRules.emptyRule('footer', applicable, undefined),
  'footer-leading-blank': (applicable) => llmReadableRules.blankline('footer', applicable, undefined),
  'footer-max-length': (applicable, value) => llmReadableRules.maxLengthRule('footer', applicable, value),
  'footer-max-line-length': (applicable, value) => `Each line of the footer should ${applicable} have ${value} characters or less.`,
  'footer-min-length': (applicable, value) => llmReadableRules.minLengthRule('footer', applicable, value),

  // Header rules
  'header-case': (applicable, value) => llmReadableRules.caseRule('header', applicable, value),
  'header-full-stop': (applicable, value) => llmReadableRules.fullStopRule('header', applicable, value),
  'header-max-length': (applicable, value) => llmReadableRules.maxLengthRule('header', applicable, value),
  'header-min-length': (applicable, value) => llmReadableRules.minLengthRule('header', applicable, value),

  // Scope rules
  'scope-case': (applicable, value) => llmReadableRules.caseRule('scope', applicable, value),
  'scope-empty': (applicable) => llmReadableRules.emptyRule('scope', applicable, undefined),
  'scope-enum': (applicable, value) => llmReadableRules.enumRule('type', applicable, value),
  'scope-max-length': (applicable, value) => llmReadableRules.maxLengthRule('scope', applicable, value),
  'scope-min-length': (applicable, value) => llmReadableRules.minLengthRule('scope', applicable, value),

  // Subject rules
  'subject-case': (applicable, value) => llmReadableRules.caseRule('subject', applicable, value),
  'subject-empty': (applicable) => llmReadableRules.emptyRule('subject', applicable, undefined),
  'subject-full-stop': (applicable, value) => llmReadableRules.fullStopRule('subject', applicable, value),
  'subject-max-length': (applicable, value) => llmReadableRules.maxLengthRule('subject', applicable, value),
  'subject-min-length': (applicable, value) => llmReadableRules.minLengthRule('subject', applicable, value),

  // Type rules
  'type-case': (applicable, value) => llmReadableRules.caseRule('type', applicable, value),
  'type-empty': (applicable) => llmReadableRules.emptyRule('type', applicable, undefined),
  'type-enum': (applicable, value, prompt) => llmReadableRules.enumTypeRule('type', applicable, value, prompt),
  'type-max-length': (applicable, value) => llmReadableRules.maxLengthRule('type', applicable, value),
  'type-min-length': (applicable, value) => llmReadableRules.minLengthRule('type', applicable, value),

  // Other rules
  'references-empty': (applicable) => llmReadableRules.emptyRule('references section', applicable, undefined),
  'signed-off-by': (applicable, value) => `The commit message should ${applicable} have a "Signed-off-by" line with the value "${value}".`
};

// Rule processing
const getPrompt = (
  ruleName: string,
  ruleConfig: RuleConfigTuple<unknown>,
  prompt: DeepPartial<PromptConfig>
) => {
  const [severity, applicable, value] = ruleConfig;
  if (severity === RuleConfigSeverity.Disabled) return null;

  const promptFn = rulesPrompts[ruleName];
  if (promptFn) {
    return promptFn(applicable, value, prompt);
  }

  outro(`${chalk.red('✖')} No prompt handler for rule "${ruleName}".`);
  return `Please manualy set the prompt for rule "${ruleName}".`;
};

// Template generation
const replaceTemplateVars = (template: string, vars: PromptTemplateVars): string => {
  return template
    .replace(/\${rules}/g, vars.rules)
    .replace(/\${requirements}/g, vars.requirements)
    .replace(/\${referenceStyle}/g, vars.referenceStyle)
    .replace(/\${gitDiff}/g, vars.gitDiff);
};

const SYSTEM_REFINE_COMMIT_TEMPLATE = (language: string) => {
  const guidelines: SharedGuidelines = getSharedGuidelines(language, true, false);

  return `${guidelines.missionBase} and maintains the style of the reference message.

Here are the specific requirements and conventions that should be strictly followed:

Message Structure:
${guidelines.structure}

${guidelines.guidelinesSection}

Commit Rules:
\${rules}

Additional Requirements:
\${requirements}

Output Format:
- Generate a single commit message that:
  1. Follows all commitlint rules above
  2. Maintains the style and features of the reference message
  3. Follows the specific requirements above
- The message should be a complete, valid commit message that would pass commitlint validation
- Do not include any JSON formatting or additional text
- The message should be ready to use as a git commit message`;
};

const INIT_MAIN_SYSTEM_TEMPLATE = (language: string) => {
  const guidelines: SharedGuidelines = getSharedGuidelines(language, true, true);

  return `${guidelines.missionBase}

Message Structure:
${guidelines.structure}

${guidelines.guidelinesSection}

Commit Rules:
\${rules}`;
};

const USER_COMMIT_EXAMPLE_TEMPLATE = `Example Git Diff is to follow:
\`\`\`
\${gitDiff}
\`\`\`

Reference Message Style:
\${referenceStyle}`;

// Public exports
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

export const commitlintPrompts = {
  INIT_MAIN_PROMPT: (
    language: string,
    prompts: string[]
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam => {
    const rules = prompts.map(p => `- ${p}`).join('\n');
    const templateVars: PromptTemplateVars = {
      rules,
      requirements: '',
      referenceStyle: '',
      gitDiff: ''
    };

    return {
      role: 'system',
      content: replaceTemplateVars(INIT_MAIN_SYSTEM_TEMPLATE(language), templateVars)
    };
  },

  GEN_COMMITLINT_CONSISTENCY_PROMPT: (
    prompts: string[]
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] => {
    const defaultContent = getConsistencyContent(translation);
    const dynamicRequirements = [
      config.OCO_OMIT_SCOPE
        ? '- Do not include scope in the commit message'
        : '- Include appropriate scope in the commit message',
      config.OCO_DESCRIPTION
        ? '- Include a description explaining the changes'
        : '- Do not include a description',
      config.OCO_EMOJI
        ? '- Use appropriate emoji at the start of the message'
        : '- Do not use emoji'
    ].join('\n');

    const rules = prompts.map(p => `- ${p}`).join('\n');
    const templateVars: PromptTemplateVars = {
      rules,
      requirements: dynamicRequirements,
      referenceStyle: defaultContent,
      gitDiff: String(INIT_DIFF_PROMPT.content || '')
    };

    return [
      {
        role: 'system',
        content: replaceTemplateVars(SYSTEM_REFINE_COMMIT_TEMPLATE(translation.localLanguage), templateVars)
      },
      {
        role: 'user',
        content: replaceTemplateVars(USER_COMMIT_EXAMPLE_TEMPLATE, templateVars)
      }
    ];
  }
};