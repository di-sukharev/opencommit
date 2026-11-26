import { jest } from '@jest/globals';
import { dirname } from 'path';
import englishConsistency from '../../src/i18n/en.json' with { type: 'json' };
import { prepareFile } from './utils';

type PromptOptions = {
  description: boolean;
  emoji: boolean;
  fullGitMojiSpec?: boolean;
  fullGitMojiSpecSetting?: boolean;
  omitScope?: boolean;
  positionBeforeDescription: boolean;
  promptModule?: 'conventional-commit' | '@commitlint';
};

const originalEnv = { ...process.env };

const resetEnv = () => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
};

const loadPrompt = async ({
  description,
  emoji,
  fullGitMojiSpec = false,
  fullGitMojiSpecSetting = false,
  omitScope = false,
  positionBeforeDescription,
  promptModule = 'conventional-commit'
}: PromptOptions) => {
  resetEnv();
  const commitlintConfig =
    promptModule === '@commitlint'
      ? await prepareFile(
          '.opencommit-commitlint',
          JSON.stringify({
            consistency: { english: englishConsistency },
            hash: 'test-hash',
            prompts: ['The type should be one of: fix, feat.']
          })
        )
      : undefined;

  Object.assign(process.env, {
    OCO_DESCRIPTION: String(description),
    OCO_EMOJI: String(emoji),
    OCO_EMOJI_POSITION_BEFORE_DESCRIPTION: String(positionBeforeDescription),
    OCO_EMOJI_FULL_SPEC: String(fullGitMojiSpecSetting),
    OCO_LANGUAGE: 'en',
    OCO_OMIT_SCOPE: String(omitScope),
    OCO_ONE_LINE_COMMIT: 'false',
    OCO_PROMPT_MODULE: promptModule,
    ...(commitlintConfig ? { PWD: dirname(commitlintConfig.filePath) } : {})
  });

  try {
    jest.resetModules();
    const { getMainCommitPrompt } = await import('../../src/prompts');
    const prompt = await getMainCommitPrompt(fullGitMojiSpec, '');

    return {
      assistant: prompt[2].content as string,
      system: prompt[0].content as string
    };
  } finally {
    await commitlintConfig?.cleanup();
  }
};

afterAll(() => {
  resetEnv();
});

describe.each([
  { description: false, emoji: false },
  { description: false, emoji: true },
  { description: true, emoji: false },
  { description: true, emoji: true }
])(
  'GitMoji prompt with OCO_EMOJI=$emoji and OCO_DESCRIPTION=$description',
  ({ description, emoji }) => {
    it.each([false, true])(
      'uses positionBeforeDescription=%s consistently',
      async (positionBeforeDescription) => {
        const prompt = await loadPrompt({
          description,
          emoji,
          positionBeforeDescription
        });

        if (!emoji) {
          expect(prompt.system).not.toContain('Place the GitMoji');
          expect(prompt.assistant).toContain(
            'fix(server.ts): change port variable case'
          );
          expect(prompt.assistant).not.toContain('🐛');
        } else if (positionBeforeDescription) {
          expect(prompt.system).toContain(
            'Place the GitMoji immediately before the commit subject'
          );
          expect(prompt.assistant).toContain(
            'fix(server.ts): 🐛 change port variable case'
          );
          expect(prompt.assistant).toContain(
            'feat(server.ts): ✨ add support for process.env.PORT'
          );
        } else {
          expect(prompt.system).toContain(
            'Place the GitMoji at the start of the commit header'
          );
          expect(prompt.assistant).toContain(
            '🐛 (server.ts): change port variable case'
          );
          expect(prompt.assistant).toContain(
            '✨ (server.ts): add support for process.env.PORT'
          );
        }

        if (description) {
          expect(prompt.assistant).toContain('The port variable is now named');
        } else {
          expect(prompt.assistant).not.toContain(
            'The port variable is now named'
          );
        }
      }
    );
  }
);

it('applies the configured position when --fgm enables GitMoji', async () => {
  const prompt = await loadPrompt({
    description: false,
    emoji: false,
    fullGitMojiSpec: true,
    positionBeforeDescription: true
  });

  expect(prompt.system).toContain('GitMoji specification');
  expect(prompt.system).toContain(
    'Place the GitMoji immediately before the commit subject'
  );
  expect(prompt.assistant).toContain(
    'fix(server.ts): 🐛 change port variable case'
  );
});

it('uses the full GitMoji specification when OCO_EMOJI_FULL_SPEC is set', async () => {
  const prompt = await loadPrompt({
    description: false,
    emoji: false,
    fullGitMojiSpecSetting: true,
    positionBeforeDescription: false
  });

  expect(prompt.system).toContain('GitMoji specification');
  // 🎨 is only part of the full specification, not the short OCO_EMOJI list
  expect(prompt.system).toContain('🎨, Improve structure / format of the code');
  expect(prompt.system).toContain(
    'Place the GitMoji at the start of the commit header'
  );
  expect(prompt.assistant).toContain(
    '🐛 (server.ts): change port variable case'
  );
});

it('enables GitMoji on the commitlint prompt path when OCO_EMOJI_FULL_SPEC is set', async () => {
  const prompt = await loadPrompt({
    description: false,
    emoji: false,
    fullGitMojiSpecSetting: true,
    positionBeforeDescription: false,
    promptModule: '@commitlint'
  });

  expect(prompt.system).toContain('given @commitlint convention');
  expect(prompt.assistant).toContain(
    '🐛 (server.ts): change port variable case'
  );
});

it('applies the configured position to the commitlint prompt path', async () => {
  const prompt = await loadPrompt({
    description: true,
    emoji: true,
    positionBeforeDescription: true,
    promptModule: '@commitlint'
  });

  expect(prompt.system).toContain('given @commitlint convention');
  expect(prompt.system).toContain(
    'Place the GitMoji immediately before the commit subject'
  );
  expect(prompt.assistant).toContain(
    'fix(server.ts): 🐛 change port variable case'
  );
  expect(prompt.assistant).toContain('The port variable is now named');
});

it('places GitMoji after an unscoped Conventional Commit type', async () => {
  const prompt = await loadPrompt({
    description: false,
    emoji: true,
    omitScope: true,
    positionBeforeDescription: true
  });

  expect(prompt.system).toContain('Use the format: <type>: <subject>');
  expect(prompt.assistant).toContain(
    'fix: 🐛 change port variable case from lowercase port'
  );
  expect(prompt.assistant).toContain(
    'feat: ✨ add support for process.env.PORT'
  );
});
