import { outro } from '@clack/prompts';
import { execa } from 'execa';

export const getOpenCommitLatestVersion = async (): Promise<
  string | undefined
> => {
  try {
    const { stdout } = await execa('npm', ['view', 'opencommit', 'version']);
    return stdout;
  } catch (_) {
    outro('Error while getting the latest version of opencommit');
    return undefined;
  }
};
