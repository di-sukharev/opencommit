import { spinner } from '@clack/prompts';

import { getConfig } from '../../commands/config';
import { i18n, I18nLocals } from '../../i18n';
import { COMMITLINT_LLM_CONFIG_PATH } from './constants';
import { computeHash } from './crypto';
import { commitlintPrompts, inferPromptsFromCommitlintConfig } from './prompts';
import { getCommitLintPWDConfig } from './pwd-commitlint';
import { CommitlintLLMConfig } from './types';
import * as utils from './utils';
import { getEngine } from '../../utils/engine';

const config = getConfig();
const translation = i18n[(config?.OCO_LANGUAGE as I18nLocals) || 'en'];

export const configureCommitlintIntegration = async (force = false) => {
  const spin = spinner();
  spin.start('Loading @commitlint configuration');

  const fileExists = await utils.commitlintLLMConfigExists();

  let commitLintConfig = await getCommitLintPWDConfig();

  // debug complete @commitlint configuration
  // await fs.writeFile(
  //   `${OPENCOMMIT_COMMITLINT_CONFIG}-commitlint-debug`,
  //   JSON.stringify(commitLintConfig, null, 2)
  // );

  const hash = await computeHash(JSON.stringify(commitLintConfig));

  spin.stop(`Read @commitlint configuration (hash: ${hash})`);

  if (fileExists) {
    // Check if we need to update the prompts.
    const { hash: existingHash } = await utils.getCommitlintLLMConfig();
    if (hash === existingHash && !force) {
      spin.stop(
        'Hashes are the same, no need to update the config. Run "force" command to bypass.'
      );
      return;
    }
  }

  spin.start('Generating consistency with given @commitlint rules');

  const prompts = inferPromptsFromCommitlintConfig(commitLintConfig);

  const consistencyPrompts =
    commitlintPrompts.GEN_COMMITLINT_CONSISTENCY_PROMPT(prompts);

  // debug prompt which will generate a consistency
  // await fs.writeFile(
  //   `${COMMITLINT_LLM_CONFIG}-debug`,
  //   consistencyPrompts.map((p) => p.content)
  // );

  const engine = getEngine()
  let consistency =
    (await engine.generateCommitMessage(consistencyPrompts)) || '{}';

  // Cleanup the consistency answer. Sometimes 'gpt-3.5-turbo' sends rule's back.
  prompts.forEach((prompt) => (consistency = consistency.replace(prompt, '')));
  // ... remaining might be extra set of "\n"
  consistency = utils.removeDoubleNewlines(consistency);

  const commitlintLLMConfig: CommitlintLLMConfig = {
    hash,
    prompts,
    consistency: {
      [translation.localLanguage]: {
        ...JSON.parse(consistency as string)
      }
    }
  };

  await utils.writeCommitlintLLMConfig(commitlintLLMConfig);

  spin.stop(`Done - please review contents of ${COMMITLINT_LLM_CONFIG_PATH}`);
};
