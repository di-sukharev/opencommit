import { execa } from 'execa';
import { readFileSync } from 'fs';
import ignore, { Ignore } from 'ignore';
import { join } from 'path';
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

export const getOpenCommitIgnore = async (): Promise<Ignore> => {
  const gitDir = await getGitDir();

  const ig = ignore();

  try {
    ig.add(
      readFileSync(join(gitDir, '.opencommitignore')).toString().split('\n')
    );
  } catch (e) {}

  return ig;
};

export const getCoreHooksPath = async (): Promise<string> => {
  const gitDir = await getGitDir();

  const { stdout } = await execa('git', ['config', 'core.hooksPath'], {
    cwd: gitDir
  });

  return stdout;
};

export const getStagedFiles = async (): Promise<string[]> => {
  const gitDir = await getGitDir();

  const { stdout: files } = await execa(
    'git',
    ['diff', '--name-only', '--cached', '--relative'],
    { cwd: gitDir }
  );

  if (!files) return [];

  const filesList = files.split('\n');

  const ig = await getOpenCommitIgnore();
  const allowedFiles = filesList.filter((file) => !ig.ignores(file));

  if (!allowedFiles) return [];

  return allowedFiles.sort();
};

export const getChangedFiles = async (): Promise<string[]> => {
  const gitDir = await getGitDir();

  const { stdout: modified } = await execa('git', ['ls-files', '--modified'], {
    cwd: gitDir
  });

  const { stdout: others } = await execa(
    'git',
    ['ls-files', '--others', '--exclude-standard'],
    { cwd: gitDir }
  );

  const files = [...modified.split('\n'), ...others.split('\n')].filter(
    (file) => !!file
  );

  return files.sort();
};

export const gitAdd = async ({ files }: { files: string[] }) => {
  const gitDir = await getGitDir();

  const gitAddSpinner = spinner();

  gitAddSpinner.start('Adding files to commit');

  await execa('git', ['add', ...files], { cwd: gitDir });

  gitAddSpinner.stop(`Staged ${files.length} files`);
};

export const getDiff = async ({ files }: { files: string[] }) => {
  const gitDir = await getGitDir();

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

  const { stdout: diff } = await execa(
    'git',
    ['diff', '--staged', '--no-ext-diff', '--', ...filesWithoutLocks],
    { cwd: gitDir }
  );

  return diff;
};

export const getGitDir = async (): Promise<string> => {
  const { stdout: gitDir } = await execa('git', [
    'rev-parse',
    '--show-toplevel'
  ]);

  return gitDir;
};
