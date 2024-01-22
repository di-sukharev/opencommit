import chalk from 'chalk';
import semver from 'semver';

import { outro } from '@clack/prompts';

import currentPackage from '../../package.json';
import { getOpenCommitLatestVersion } from '../api';

export async function checkIsLatestVersion() {
  const latestVersion = await getOpenCommitLatestVersion();

  if (latestVersion) {
    const currentVersion = currentPackage.version;
    if (semver.lt(currentVersion, latestVersion)) {
      outro(
        chalk.yellow(
          `
You are not using the latest version of OpenCommit with new features and bug fixes.
Current version: ${currentVersion}. Latest version: ${latestVersion}.
🚀 To update run: npm i -g opencommit@latest.
          `
        )
      );
    }
  }
}
