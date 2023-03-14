import { execa } from 'execa';
import { spinner, text } from '@clack/prompts';

export const assertGitRepo = async () => {
  try {
    await execa('git', ['rev-parse']);
  } catch (error) {
    throw new Error(error as string);
  }
};

export const getStagedFiles = async (): Promise<string[]> => {
  const { stdout: files } = await execa('git', [
    'diff',
    '--name-only',
    '--cached'
  ]);

  if (!files) return [];

  const excludedFiles = files
    .split('\n')
    .filter((file) => !!file)
    .filter((file) => file.includes('.lock') || file.includes('-lock.'));

  if (excludedFiles.length === files.split('\n').length) {
    throw new Error(
      `Staged files are .lock files which are excluded by default as it's too big, commit it yourself, don't waste your api tokens. \n${excludedFiles.join(
        '\n'
      )}`
    );
  }

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

  const filesWithoutLocks = files.filter(
    (file) => !file.includes('.lock') && !file.includes('-lock.')
  );

  if (files.length !== filesWithoutLocks.length) {
    text({
      message: `Some files are .lock files which are excluded by default as it's too big, commit it yourself, don't waste your api tokens. \n${files
        .filter((file) => file.includes('.lock') || file.includes('-lock.'))
        .join('\n')}`
    });
  }

  return filesWithoutLocks.sort();
};

export const gitAdd = async ({ files }: { files: string[] }) => {
  const filteredFiles = files.filter(
    (file) => !file.includes('.lock') && !file.includes('-lock.')
  );

  const gitAddSpinner = spinner();
  gitAddSpinner.start('Adding files to commit');
  await execa('git', ['add', ...filteredFiles]);
  gitAddSpinner.stop('Done');

  if (filteredFiles.length !== files.length) {
    text({
      message: `Some files are .lock files which are excluded by default as it's too big, commit it yourself, don't waste your api tokens. \n${files
        .filter((file) => file.includes('.lock') || file.includes('-lock.'))
        .join('\n')}`
    });
  }
};

export const getDiff = async ({ files }: { files: string[] }) => {
  const filesWithoutLocks = files.filter(
    (file) => !file.includes('.lock') && !file.includes('-lock.')
  );

  if (filesWithoutLocks.length !== files.length) {
    text({
      message: `Some files are .lock files which are excluded by default as it's too big, commit it yourself, don't waste your api tokens. \n${files
        .filter((file) => file.includes('.lock') || file.includes('-lock.'))
        .join('\n')}`
    });
  }

  const { stdout: diff } = await execa('git', [
    'diff',
    '--staged',
    ...filesWithoutLocks
  ]);

  return diff;
};
