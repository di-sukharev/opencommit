import { execa } from 'execa';
import { readFileSync } from 'fs';
import ignore, { Ignore } from 'ignore';

import { outro, spinner } from '@clack/prompts';

export const assertGitRepo = async () => {
  try {
    await execa('git', ['rev-parse']);
  } catch (error) {
    throw new Error(error as string);
  }
};

// const excludeBigFilesFromDiff = ['*-lock.*', '*.lock'].map(
//   (file) => `:(exclude)${file}`
// );

export const getOpenCommitIgnore = (): Ignore => {
  const ig = ignore();

  try {
    ig.add(readFileSync('.opencommitignore').toString().split('\n'));
  } catch (e) {}

  return ig;
};

export const getCoreHooksPath = async (): Promise<string> => {
  const { stdout } = await execa('git', ['config', 'core.hooksPath']);

  return stdout;
};

export const getStagedFiles = async (): Promise<string[]> => {
  const { stdout: gitDir } = await execa('git', [
    'rev-parse',
    '--show-toplevel'
  ]);

  const { stdout: files } = await execa('git', [
    'diff',
    '--name-only',
    '--cached',
    '--relative',
    gitDir
  ]);

  if (!files) return [];

  const filesList = files.split('\n');

  const ig = getOpenCommitIgnore();
  const allowedFiles = filesList.filter((file) => !ig.ignores(file));

  if (!allowedFiles) return [];

  return allowedFiles.sort();
};

export const getChangedFiles = async (): Promise<string[]> => {
  const { stdout: modified } = await execa('git', ['ls-files', '--modified']);
  const { stdout: others } = await execa('git', [
    'ls-files',
    '--others',
    '--exclude-standard'
  ]);

  const files = [...modified.split('\n'), ...others.split('\n')].filter(
    (file) => !!file
  );

  return files.sort();
};

export const gitAdd = async ({ files }: { files: string[] }) => {
  const gitAddSpinner = spinner();
  gitAddSpinner.start('Adding files to commit');
  await execa('git', ['add', ...files]);
  gitAddSpinner.stop('Done');
};

export const getDiff = async ({ files }: { files: string[] }) => {
  const lockFiles = files.filter(
    (file) =>
      file.includes('.lock') ||
      file.includes('-lock.') ||
      file.includes('.svg') ||
      file.includes('.png') ||
      file.includes('.jpg') ||
      file.includes('.jpeg') ||
      file.includes('.webp') ||
      file.includes('.gif')
  );

  if (lockFiles.length) {
    outro(
      `Some files are excluded by default from 'git diff'. No commit messages are generated for this files:\n${lockFiles.join(
        '\n'
      )}`
    );
  }

  const filesWithoutLocks = files.filter(
    (file) => !file.includes('.lock') && !file.includes('-lock.')
  );

  const { stdout: diff } = await execa('git', [
    'diff',
    '--staged',
    '--',
    ...filesWithoutLocks
  ]);

  return diff;
};
