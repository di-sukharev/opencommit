import { execa } from 'execa';
import { outro, spinner } from '@clack/prompts';

export const assertGitRepo = async () => {
  try {
    process.chdir(await execa('git', ['rev-parse', '--show-toplevel']));
  } catch (error) {
    throw new Error(error as string);
  }
};

// const excludeBigFilesFromDiff = ['*-lock.*', '*.lock'].map(
//   (file) => `:(exclude)${file}`
// );

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
    (file) => file.includes('.lock') || file.includes('-lock.')
  );

  if (lockFiles.length) {
    outro(
      `Some files are '.lock' files which are excluded by default from 'git diff'. No commit messages are generated for this files:\n${lockFiles.join(
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
    ...filesWithoutLocks
  ]);

  return diff;
};
