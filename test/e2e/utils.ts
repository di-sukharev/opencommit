import path from 'path'
import { mkdtemp, rm } from 'fs'
import { promisify } from 'util';
import { tmpdir } from 'os';
import { exec } from 'child_process';
const fsMakeTempDir = promisify(mkdtemp);
const fsExec = promisify(exec);
const fsRemove = promisify(rm);

/**
 * Prepare the environment for the test
 * Create a temporary git repository in the temp directory
 */
export const prepareEnvironment = async (): Promise<{
  gitDir: string;
  cleanup: () => Promise<void>;
}> => {
  const tempDir = await prepareTempDir();
  // Create a remote git repository int the temp directory. This is necessary to execute the `git push` command
  await fsExec('git init --bare remote.git', { cwd: tempDir }); 
  await fsExec('git clone remote.git test', { cwd: tempDir });
  const gitDir = path.resolve(tempDir, 'test');

  const cleanup = async () => {
    return fsRemove(tempDir, { recursive: true });
  }
  return {
    gitDir,
    cleanup,
  }
}

export const prepareTempDir = async(): Promise<string> => {
  return await fsMakeTempDir(path.join(tmpdir(), 'opencommit-test-'));
}

export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
