import { execa } from 'execa';
import { spinner } from '@clack/prompts';

export const assertGitRepo = async () => {
  try {
    await execa('git', ['rev-parse']);
  } catch (error) {
    throw new Error(error as string);
  }
};

const excludeBigFilesFromDiff = ['*-lock.*', '*.lock'].map(
  (file) => `:(exclude)${file}`
);

export interface StagedDiff {
  files: string[];
  diff: string;
}

export const getStagedGitDiff = async (
  isStageAllFlag = false
): Promise<StagedDiff | null> => {
  if (isStageAllFlag) {
    const stageAllSpinner = spinner();
    stageAllSpinner.start('Staging all changes');
    await execa('git', ['add', '.']);
    stageAllSpinner.stop('Done');
  }

  const diffStaged = ['diff', '--staged'];
  const { stdout: files } = await execa('git', [
    ...diffStaged,
    '--name-only',
    ...excludeBigFilesFromDiff
  ]);

  if (!files) return null;

  const { stdout: diff } = await execa('git', [
    ...diffStaged,
    ...excludeBigFilesFromDiff
  ]);

  return {
    files: files.split('\n').sort(),
    diff
  };
};
