import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageRoleEnum
} from 'openai';

import { note } from '@clack/prompts';

import { getConfig } from './commands/config';
import { i18n, I18nLocals } from './i18n';
import { configureCommitlintIntegration } from './modules/commitlint/config';
import { commitlintPrompts } from './modules/commitlint/prompts';
import { ConsistencyPrompt } from './modules/commitlint/types';
import * as utils from './modules/commitlint/utils';
import { removeConventionalCommitWord } from './utils/removeConventionalCommitWord';

const config = getConfig();
const translation = i18n[(config?.OCO_LANGUAGE as I18nLocals) || 'en'];

export const IDENTITY =
  'You are to act as the author of a commit message in git.';

const INIT_MAIN_PROMPT = (language: string): ChatCompletionRequestMessage => ({
  role: ChatCompletionRequestMessageRoleEnum.System,
  content: `${IDENTITY} Your mission is to create clean and comprehensive commit messages as per the conventional commit convention and explain WHAT were the changes and mainly WHY the changes were done. I'll send you an output of 'git diff --staged' command, and you are to convert it into a commit message.
  ${
    config?.OCO_EMOJI
      ? 'Use GitMoji convention to preface the commit. Here are some help to choose the right emoji (emoji, description): ' +
        '🎨, Improve structure / format of the code; ' +
        '⚡️, Improve performance; ' +
        '🔥, Remove code or files; ' +
        '🐛, Fix a bug; ' +
        '🚑️, Critical hotfix; ' +
        '✨, Introduce new features; ' +
        '📝, Add or update documentation; ' +
        '🚀, Deploy stuff; ' +
        '💄, Add or update the UI and style files; ' +
        '🎉, Begin a project; ' +
        '✅, Add, update, or pass tests; ' +
        '🔒️, Fix security issues; ' +
        '🔐, Add or update secrets; ' +
        '🔖, Release / Version tags; ' +
        '🚨, Fix compiler / linter warnings; ' +
        '🚧, Work in progress; ' +
        '💚, Fix CI Build; ' +
        '⬇️, Downgrade dependencies; ' +
        '⬆️, Upgrade dependencies; ' +
        '📌, Pin dependencies to specific versions; ' +
        '👷, Add or update CI build system; ' +
        '📈, Add or update analytics or track code; ' +
        '♻️, Refactor code; ' +
        '➕, Add a dependency; ' +
        '➖, Remove a dependency; ' +
        '🔧, Add or update configuration files; ' +
        '🔨, Add or update development scripts; ' +
        '🌐, Internationalization and localization; ' +
        '✏️, Fix typos; ' +
        '💩, Write bad code that needs to be improved; ' +
        '⏪️, Revert changes; ' +
        '🔀, Merge branches; ' +
        '📦️, Add or update compiled files or packages; ' +
        '👽️, Update code due to external API changes; ' +
        '🚚, Move or rename resources (e.g.: files, paths, routes); ' +
        '📄, Add or update license; ' +
        '💥, Introduce breaking changes; ' +
        '🍱, Add or update assets; ' +
        '♿️, Improve accessibility; ' +
        '💡, Add or update comments in source code; ' +
        '🍻, Write code drunkenly; ' +
        '💬, Add or update text and literals; ' +
        '🗃️, Perform database related changes; ' +
        '🔊, Add or update logs; ' +
        '🔇, Remove logs; ' +
        '👥, Add or update contributor(s); ' +
        '🚸, Improve user experience / usability; ' +
        '🏗️, Make architectural changes; ' +
        '📱, Work on responsive design; ' +
        '🤡, Mock things; ' +
        '🥚, Add or update an easter egg; ' +
        '🙈, Add or update a .gitignore file; ' +
        '📸, Add or update snapshots; ' +
        '⚗️, Perform experiments; ' +
        '🔍️, Improve SEO; ' +
        '🏷️, Add or update types; ' +
        '🌱, Add or update seed files; ' +
        '🚩, Add, update, or remove feature flags; ' +
        '🥅, Catch errors; ' +
        '💫, Add or update animations and transitions; ' +
        '🗑️, Deprecate code that needs to be cleaned up; ' +
        '🛂, Work on code related to authorization, roles and permissions; ' +
        '🩹, Simple fix for a non-critical issue; ' +
        '🧐, Data exploration/inspection; ' +
        '⚰️, Remove dead code; ' +
        '🧪, Add a failing test; ' +
        '👔, Add or update business logic; ' +
        '🩺, Add or update healthcheck; ' +
        '🧱, Infrastructure related changes; ' +
        '🧑‍💻, Improve developer experience; ' +
        '💸, Add sponsorships or money related infrastructure; ' +
        '🧵, Add or update code related to multithreading or concurrency; ' +
        '🦺, Add or update code related to validation.'
      : 'Do not preface the commit with anything.'
  }  
    ${
      config?.OCO_DESCRIPTION
        ? 'Add a short description of WHY the changes are done after the commit message. Don\'t start it with "This commit", just describe the changes.'
        : "Don't add any descriptions to the commit, only commit message."
    }
    Use the present tense. Lines must not be longer than 74 characters. Use ${language} for the commit message.`
});

export const INIT_DIFF_PROMPT: ChatCompletionRequestMessage = {
  role: ChatCompletionRequestMessageRoleEnum.User,
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

const INIT_CONSISTENCY_PROMPT = (
  translation: ConsistencyPrompt
): ChatCompletionRequestMessage => ({
  role: ChatCompletionRequestMessageRoleEnum.Assistant,
  content: `${config?.OCO_EMOJI ? `🐛 ${removeConventionalCommitWord(translation.commitFix)}` : translation.commitFix}
${config?.OCO_EMOJI ? `✨ ${removeConventionalCommitWord(translation.commitFeat)}` : translation.commitFeat}
${config?.OCO_DESCRIPTION ? translation.commitDescription : ''}`
});

export const getMainCommitPrompt = async (): Promise<
  ChatCompletionRequestMessage[]
> => {
  switch (config?.OCO_PROMPT_MODULE) {
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
      // conventional-commit
      return [
        INIT_MAIN_PROMPT(translation.localLanguage),
        INIT_DIFF_PROMPT,
        INIT_CONSISTENCY_PROMPT(translation)
      ];
  }
};
