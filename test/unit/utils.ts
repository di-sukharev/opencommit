import path from 'path';
import { mkdtemp, rm, writeFile } from 'fs';
import { promisify } from 'util';
import { tmpdir } from 'os';
const fsMakeTempDir = promisify(mkdtemp);
const fsRemove = promisify(rm);
const fsWriteFile = promisify(writeFile);

/**
 * Prepare tmp file for the test
 */
export async function prepareFile(
  fileName: string,
  content: string
): Promise<{
  filePath: string;
  cleanup: () => Promise<void>;
}> {
  const tempDir = await fsMakeTempDir(path.join(tmpdir(), 'opencommit-test-'));
  const filePath = path.resolve(tempDir, fileName);
  await fsWriteFile(filePath, content);
  const cleanup = async () => {
    return fsRemove(tempDir, { recursive: true });
  };
  return {
    filePath,
    cleanup
  };
}
