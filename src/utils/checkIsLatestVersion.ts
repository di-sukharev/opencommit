import chalk from 'chalk';

import { outro } from '@clack/prompts';

import currentPackage from '../../package.json' with { type: 'json' };
import { resolveLatestVersion } from '../version';

export const checkIsLatestVersion = async () => {
  if (process.env.OCO_TEST_SKIP_VERSION_CHECK === 'true') {
    return;
  }

  const currentVersion = currentPackage.version;
  const latestVersion = await resolveLatestVersion({ currentVersion });

  if (latestVersion) {
    if (currentVersion !== latestVersion) {
      outro(
        chalk.yellow(
          `
You are not using the latest stable version of OpenCommit with new features and bug fixes.
Current version: ${currentVersion}. Latest version: ${latestVersion}.
🚀 To update run: npm i -g opencommit@latest.
        `
        )
      );
    }
  }
};
