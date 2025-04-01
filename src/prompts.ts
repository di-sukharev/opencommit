import { note } from '@clack/prompts';
import { OpenAI } from 'openai';
import { getConfig } from './commands/config';
import { i18n, I18nLocals } from './i18n';
import { configureCommitlintIntegration } from './modules/commitlint/config';
import { commitlintPrompts } from './modules/commitlint/prompts';
import { ConsistencyPrompt } from './modules/commitlint/types';
import * as utils from './modules/commitlint/utils';
import { removeConventionalCommitWord } from './utils/removeConventionalCommitWord';
import chalk from 'chalk';

const config = getConfig();
const translation = i18n[(config.OCO_LANGUAGE as I18nLocals) || 'en'];

export interface SharedGuidelines {
  missionBase: string;
  guidelinesSection: string;
  headerFormat: string;
  structure: string;
}

// Internal constants
const GITMOJI_HELP = `Use GitMoji convention to preface the commit. Here are some help to choose the right emoji (emoji, description): 
🐛, Fix a bug; 
✨, Introduce new features; 
📝, Add or update documentation; 
🚀, Deploy stuff; 
✅, Add, update, or pass tests; 
♻️, Refactor code; 
⬆️, Upgrade dependencies; 
🔧, Add or update configuration files; 
🌐, Internationalization and localization; 
💡, Add or update comments in source code;`;

const FULL_GITMOJI_SPEC = `${GITMOJI_HELP}
🎨, Improve structure / format of the code; 
⚡️, Improve performance; 
🔥, Remove code or files; 
🚑️, Critical hotfix; 
💄, Add or update the UI and style files; 
🎉, Begin a project; 
🔒️, Fix security issues; 
🔐, Add or update secrets; 
🔖, Release / Version tags; 
🚨, Fix compiler / linter warnings; 
🚧, Work in progress; 
💚, Fix CI Build; 
⬇️, Downgrade dependencies; 
📌, Pin dependencies to specific versions; 
👷, Add or update CI build system; 
📈, Add or update analytics or track code; 
➕, Add a dependency; 
➖, Remove a dependency; 
🔨, Add or update development scripts; 
✏️, Fix typos; 
💩, Write bad code that needs to be improved; 
⏪️, Revert changes; 
🔀, Merge branches; 
📦️, Add or update compiled files or packages; 
👽️, Update code due to external API changes; 
🚚, Move or rename resources (e.g.: files, paths, routes); 
📄, Add or update license; 
💥, Introduce breaking changes; 
🍱, Add or update assets; 
♿️, Improve accessibility; 
🍻, Write code drunkenly; 
💬, Add or update text and literals; 
🗃️, Perform database related changes; 
🔊, Add or update logs; 
🔇, Remove logs; 
👥, Add or update contributor(s); 
🚸, Improve user experience / usability; 
🏗️, Make architectural changes; 
📱, Work on responsive design; 
🤡, Mock things; 
🥚, Add or update an easter egg; 
🙈, Add or update a .gitignore file; 
📸, Add or update snapshots; 
⚗️, Perform experiments; 
🔍️, Improve SEO; 
🏷️, Add or update types; 
🌱, Add or update seed files; 
🚩, Add, update, or remove feature flags; 
🥅, Catch errors; 
💫, Add or update animations and transitions; 
🗑️, Deprecate code that needs to be cleaned up; 
🛂, Work on code related to authorization, roles and permissions; 
🩹, Simple fix for a non-critical issue; 
🧐, Data exploration/inspection; 
⚰️, Remove dead code; 
🧪, Add a failing test; 
👔, Add or update business logic; 
🩺, Add or update healthcheck; 
🧱, Infrastructure related changes; 
🧑‍💻, Improve developer experience; 
💸, Add sponsorships or money related infrastructure; 
🧵, Add or update code related to multithreading or concurrency; 
🦺, Add or update code related to validation.`;

const CONVENTIONAL_COMMIT_KEYWORDS =
  'Do not preface the commit with anything, except for the conventional commit keywords: fix, feat, build, chore, ci, docs, style, refactor, perf, test.';

const userInputCodeContext = (context: string) => {
  if (context !== '' && context !== ' ') {
    return `Additional context provided by the user: <context>${context}</context>\nConsider this context when generating the commit message, incorporating relevant information when appropriate.`;
  }
  return '';
};

// Commit message formatting
const getCommitFormat = () => {
  const format = config.OCO_OMIT_SCOPE ? '<type>: <subject>' : '<type>(<scope>): <subject>';
  const parts = config.OCO_OMIT_SCOPE ? ['type', 'subject'] : ['type', 'scope', 'subject'];

  return {
    headerFormat: `\`${format}\``,
    structure: `
- Header of commit is composed of ${parts.join(', ')}: \`${format}\`
- Description of commit is composed of body and footer (optional): <body-of-commit>\n<footer(s)-of-commit>`
  };
};

// Public function that encapsulates all the guidelines
export const getSharedGuidelines = (
  language: string,
  useFullGitMojiSpec = false,
  includeWhy = true
): SharedGuidelines => {
  // Get commit format
  const { headerFormat, structure } = getCommitFormat();

  // Build guidelines content
  const convention = useFullGitMojiSpec ? 'GitMoji specification' : 'Conventional Commit Convention';
  const conventionGuide = config.OCO_EMOJI
    ? useFullGitMojiSpec ? FULL_GITMOJI_SPEC : GITMOJI_HELP
    : CONVENTIONAL_COMMIT_KEYWORDS;

  const guidelinesContent = [
    conventionGuide,
    config.OCO_DESCRIPTION
      ? 'Add a short description of WHY the changes are done after the commit message. Don\'t start it with "This commit", just describe the changes.'
      : "Don't add any descriptions to the commit, only commit message.",
    config.OCO_ONE_LINE_COMMIT
      ? 'Craft a concise commit message that encapsulates all changes made, with an emphasis on the primary updates. If the modifications share a common theme or scope, mention it succinctly; otherwise, leave the scope out to maintain focus. The goal is to provide a clear and unified overview of the changes in a one single message, without diverging into a list of commit per file change.'
      : '',
    config.OCO_OMIT_SCOPE
      ? 'Do not include a scope in the commit message format. Use the format: <type>: <subject>'
      : '',
    `Use the present tense. Lines must not be longer than 74 characters. Use ${language} for the commit message.`
  ].filter(Boolean).join('\n');

  // Build mission statement
  const missionBase = `You are to act as an author of a commit message in git. Your mission is to create clean and comprehensive commit messages as per the ${convention}${includeWhy ? ' and explain WHAT were the changes and mainly WHY the changes were done' : ''}.`;

  return {
    missionBase,
    headerFormat,
    structure,
    guidelinesSection: `Commit Message Guidelines:\n${guidelinesContent}`
  };
};

const DIFF_INSTRUCTION = "I'll send you an output of 'git diff --staged' command, and you are to convert it into a commit message.";

const INIT_MAIN_PROMPT = (
  language: string,
  fullGitMojiSpec: boolean,
  context: string
): OpenAI.Chat.Completions.ChatCompletionMessageParam => ({
  role: 'system',
  content: (() => {
    const guidelines = getSharedGuidelines(language, fullGitMojiSpec, true);
    const userInputContext = userInputCodeContext(context);

    return `${guidelines.missionBase}\n${DIFF_INSTRUCTION}\n${guidelines.guidelinesSection}\n${userInputContext}`;
  })()
});

export const INIT_DIFF_PROMPT: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
  role: 'user',
  content: `diff --git a/src/server.ts b/src/server.ts
    index ad4db42..f3b18a9 100644
    --- a/src/server.ts
    +++ b/src/server.ts
    @@ -10,7 +10,7 @@
    import {
        initWinstonLogger();
        
        const app = express();
        -const port = 7799;
        +const PORT = 7799;
        
        app.use(express.json());
        
        @@ -34,6 +34,6 @@
        app.use((_, res, next) => {
            // ROUTES
            app.use(PROTECTED_ROUTER_URL, protectedRouter);
            
            -app.listen(port, () => {
                -  console.log(\`Server listening on port \${port}\`);
                +app.listen(process.env.PORT || PORT, () => {
                    +  console.log(\`Server listening on port \${PORT}\`);
                });`
};

const COMMIT_TYPES = {
  fix: '🐛',
  feat: '✨'
} as const;

const generateCommitString = (
  type: keyof typeof COMMIT_TYPES,
  message: string
): string => {
  const cleanMessage = removeConventionalCommitWord(message);
  return config.OCO_EMOJI
    ? `${COMMIT_TYPES[type]} ${cleanMessage}`
    : message;
};

export const getConsistencyContent = (translation: ConsistencyPrompt) => {
  // Check if we're using the new commitlint format
  if ('commitMessage' in translation) {
    const message = translation.commitMessage;
    // Only add emoji if it was enabled when the message was generated
    if (translation.config.OCO_EMOJI && !message.match(/^[^\s]*\s/)) {
      const type = message.split(':')[0].toLowerCase();
      const emoji = COMMIT_TYPES[type as keyof typeof COMMIT_TYPES] || '✨';
      return `${emoji} ${message}`;
    }
    return message;
  }

  // Handle the old default format (JSON-based)
  const fixMessage = config.OCO_OMIT_SCOPE && translation.commitFixOmitScope
    ? translation.commitFixOmitScope
    : translation.commitFix;

  const featMessage = config.OCO_OMIT_SCOPE && translation.commitFeatOmitScope
    ? translation.commitFeatOmitScope
    : translation.commitFeat;

  const fix = generateCommitString('fix', fixMessage);
  const feat = generateCommitString('feat', featMessage);

  const description = config.OCO_DESCRIPTION
    ? translation.commitDescription
    : '';

  return [fix, feat, description].filter(Boolean).join('\n');
};

const INIT_CONSISTENCY_PROMPT = (
  translation: ConsistencyPrompt
): OpenAI.Chat.Completions.ChatCompletionMessageParam => ({
  role: 'assistant',
  content: getConsistencyContent(translation)
});

export const getMainCommitPrompt = async (
  fullGitMojiSpec: boolean,
  context: string
): Promise<Array<OpenAI.Chat.Completions.ChatCompletionMessageParam>> => {
  switch (config.OCO_PROMPT_MODULE) {
    case '@commitlint':
      if (!(await utils.commitlintLLMConfigExists())) {
        note(
          `OCO_PROMPT_MODULE is @commitlint but you haven't generated consistency for this project yet.`
        );
        await configureCommitlintIntegration();
      }

      // Replace example prompt with a prompt that's generated by OpenAI for the commitlint config.
      const commitLintConfig = await utils.getCommitlintLLMConfig();
      return [
        commitlintPrompts.INIT_MAIN_PROMPT(
          translation.localLanguage,
          commitLintConfig.prompts
        ),
        INIT_DIFF_PROMPT,
        INIT_CONSISTENCY_PROMPT(
          commitLintConfig.consistency[
          translation.localLanguage
          ] as ConsistencyPrompt
        )
      ];

    default:
      return [
        INIT_MAIN_PROMPT(translation.localLanguage, fullGitMojiSpec, context),
        INIT_DIFF_PROMPT,
        INIT_CONSISTENCY_PROMPT(translation)
      ];
  }
};
