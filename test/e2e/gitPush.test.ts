import path from 'path';
import 'cli-testing-library/extend-expect';
import { exec } from 'child_process';
import { prepareTempDir } from './utils';
import { promisify } from 'util';
import { render } from 'cli-testing-library';
import { resolve } from 'path';
import { rm } from 'fs';
const fsExec = promisify(exec);
const fsRemove = promisify(rm);

/**
 * git remote -v
 *
 * [no remotes]
 */
const prepareNoRemoteGitRepository = async (): Promise<{
  gitDir: string;
  cleanup: () => Promise<void>;
}> => {
  const tempDir = await prepareTempDir();
  await fsExec('git init test', { cwd: tempDir });
  const gitDir = path.resolve(tempDir, 'test');

  const cleanup = async () => {
    return fsRemove(tempDir, { recursive: true });
  };
  return {
    gitDir,
    cleanup
  };
};

/**
 * git remote -v
 *
 * origin  /tmp/remote.git (fetch)
 * origin  /tmp/remote.git (push)
 */
const prepareOneRemoteGitRepository = async (): Promise<{
  gitDir: string;
  cleanup: () => Promise<void>;
}> => {
  const tempDir = await prepareTempDir();
  await fsExec('git init --bare remote.git', { cwd: tempDir });
  await fsExec('git clone remote.git test', { cwd: tempDir });
  const gitDir = path.resolve(tempDir, 'test');

  const cleanup = async () => {
    return fsRemove(tempDir, { recursive: true });
  };
  return {
    gitDir,
    cleanup
  };
};

/**
 * git remote -v
 *
 * origin  /tmp/remote.git (fetch)
 * origin  /tmp/remote.git (push)
 * other   ../remote2.git (fetch)
 * other   ../remote2.git (push)
 */
const prepareTwoRemotesGitRepository = async (): Promise<{
  gitDir: string;
  cleanup: () => Promise<void>;
}> => {
  const tempDir = await prepareTempDir();
  await fsExec('git init --bare remote.git', { cwd: tempDir });
  await fsExec('git init --bare other.git', { cwd: tempDir });
  await fsExec('git clone remote.git test', { cwd: tempDir });
  const gitDir = path.resolve(tempDir, 'test');
  await fsExec('git remote add other ../other.git', { cwd: gitDir });

  const cleanup = async () => {
    return fsRemove(tempDir, { recursive: true });
  };
  return {
    gitDir,
    cleanup
  };
};

describe('cli flow to push git branch', () => {
  it('do nothing when OCO_GITPUSH is set to false', async () => {
    const { gitDir, cleanup } = await prepareNoRemoteGitRepository();

    await render('echo', [`'console.log("Hello World");' > index.ts`], {
      cwd: gitDir
    });
    await render('git', ['add index.ts'], { cwd: gitDir });

    const { queryByText, findByText, userEvent } = await render(
      `OCO_AI_PROVIDER='test' OCO_GITPUSH='false' node`,
      [resolve('./out/cli.cjs')],
      { cwd: gitDir }
    );
    expect(await findByText('Confirm the commit message?')).toBeInTheConsole();
    userEvent.keyboard('[Enter]');

    expect(
      await queryByText('Choose a remote to push to')
    ).not.toBeInTheConsole();
    expect(
      await queryByText('Do you want to run `git push`?')
    ).not.toBeInTheConsole();
    expect(
      await queryByText('Successfully pushed all commits to origin')
    ).not.toBeInTheConsole();
    expect(
      await queryByText('Command failed with exit code 1')
    ).not.toBeInTheConsole();

    await cleanup();
  });

  it('push and cause error when there is no remote', async () => {
    const { gitDir, cleanup } = await prepareNoRemoteGitRepository();

    await render('echo', [`'console.log("Hello World");' > index.ts`], {
      cwd: gitDir
    });
    await render('git', ['add index.ts'], { cwd: gitDir });

    const { queryByText, findByText, userEvent } = await render(
      `OCO_AI_PROVIDER='test' node`,
      [resolve('./out/cli.cjs')],
      { cwd: gitDir }
    );
    expect(await findByText('Confirm the commit message?')).toBeInTheConsole();
    userEvent.keyboard('[Enter]');

    expect(
      await queryByText('Choose a remote to push to')
    ).not.toBeInTheConsole();
    expect(
      await queryByText('Do you want to run `git push`?')
    ).not.toBeInTheConsole();
    expect(
      await queryByText('Successfully pushed all commits to origin')
    ).not.toBeInTheConsole();

    expect(
      await findByText('Command failed with exit code 1')
    ).toBeInTheConsole();

    await cleanup();
  });

  it('push when one remote is set', async () => {
    const { gitDir, cleanup } = await prepareOneRemoteGitRepository();

    await render('echo', [`'console.log("Hello World");' > index.ts`], {
      cwd: gitDir
    });
    await render('git', ['add index.ts'], { cwd: gitDir });

    const { findByText, userEvent } = await render(
      `OCO_AI_PROVIDER='test' node`,
      [resolve('./out/cli.cjs')],
      { cwd: gitDir }
    );
    expect(await findByText('Confirm the commit message?')).toBeInTheConsole();
    userEvent.keyboard('[Enter]');

    expect(
      await findByText('Do you want to run `git push`?')
    ).toBeInTheConsole();
    userEvent.keyboard('[Enter]');

    expect(
      await findByText('Successfully pushed all commits to origin')
    ).toBeInTheConsole();

    await cleanup();
  });

  it('push when two remotes are set', async () => {
    const { gitDir, cleanup } = await prepareTwoRemotesGitRepository();

    await render('echo', [`'console.log("Hello World");' > index.ts`], {
      cwd: gitDir
    });
    await render('git', ['add index.ts'], { cwd: gitDir });

    const { findByText, userEvent } = await render(
      `OCO_AI_PROVIDER='test' node`,
      [resolve('./out/cli.cjs')],
      { cwd: gitDir }
    );
    expect(await findByText('Confirm the commit message?')).toBeInTheConsole();
    userEvent.keyboard('[Enter]');

    expect(await findByText('Choose a remote to push to')).toBeInTheConsole();
    userEvent.keyboard('[Enter]');

    expect(
      await findByText('Successfully pushed all commits to origin')
    ).toBeInTheConsole();

    await cleanup();
  });
});
