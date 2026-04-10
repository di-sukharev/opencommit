import chalk from 'chalk';

import { outro } from '@clack/prompts';

import currentPackage from '../../package.json';
import { getOpenCommitLatestVersion } from '../version';

export const checkIsLatestVersion = async () => {
  if (process.env.OCO_TEST_SKIP_VERSION_CHECK === 'true') {
    return;
  }

  const latestVersion = await getOpenCommitLatestVersion();

  if (latestVersion) {
    const currentVersion = currentPackage.version;

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
