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

export const getStagedFiles = async (): Promise<string[]> => {
  const { stdout: files } = await execa('git', [
    'diff',
    '--name-only',
    '--cached'
  ]);

  if (!files) return [];

  return files.split('\n').sort();
};

export const getChangedFiles = async (): Promise<string[]> => {
  const { stdout: modified } = await execa('git', ['ls-files', '--modified']);
  const { stdout: others } = await execa('git', ['ls-files', '--others', '--exclude-standard']);

  const files = [...modified.split('\n'), ...others.split('\n')];

  return files.filter(Boolean).sort();
};

export const gitAdd = async ({ files }: { files: string[] }) => {
  const gitAddSpinner = spinner();
  gitAddSpinner.start('Adding files to commit');
  await execa('git', ['add', ...files]);
  gitAddSpinner.stop('Done');
};

export const getDif = async ({ files }: { files: string[] }) => {
  const { stdout: diff } = await execa('git', [
    'diff',
    '--staged',
    ...files,
    ...excludeBigFilesFromDiff
  ]);

  return diff;
};
