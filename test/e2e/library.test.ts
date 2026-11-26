import { execFile } from 'child_process';
import { mkdir, rm, writeFile } from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { prepareTempDir } from './utils';

const execFileAsync = promisify(execFile);

const TSC_PATH = path.resolve(process.cwd(), 'node_modules/typescript/bin/tsc');

const DIFF = `diff --git a/src/server.ts b/src/server.ts
--- a/src/server.ts
+++ b/src/server.ts
@@ -1 +1 @@
-const port = 7799;
+const PORT = 7799;
`;

const TEST_PROVIDER_MESSAGE = 'fix(testAi.ts): test commit message';

const CONSUMER_SOURCE = `import { generateCommitMessage, type OpenCommitConfig } from 'opencommit';

const config: OpenCommitConfig = { OCO_AI_PROVIDER: 'test' };

export const run = (diff: string): Promise<string> =>
  generateCommitMessage(diff, { config });
`;

const CONSUMER_TSCONFIG = {
  compilerOptions: {
    target: 'es2022',
    strict: true,
    noEmit: true,
    types: []
  },
  files: ['index.cts', 'index.mts']
};

let tempDir: string;
let consumerDir: string;

// Install the packed package into a consumer, like `npm install` does.
beforeAll(async () => {
  tempDir = await prepareTempDir();
  consumerDir = path.join(tempDir, 'consumer');
  const packageDir = path.join(consumerDir, 'node_modules', 'opencommit');
  await mkdir(packageDir, { recursive: true });

  const { stdout } = await execFileAsync('npm', [
    'pack',
    '--json',
    '--pack-destination',
    tempDir
  ]);
  const [{ filename }] = JSON.parse(stdout);
  await execFileAsync('tar', [
    '-xzf',
    path.join(tempDir, filename),
    '-C',
    packageDir,
    '--strip-components=1'
  ]);

  await writeFile(path.join(consumerDir, 'package.json'), '{}');
  await writeFile(
    path.join(consumerDir, 'tsconfig.json'),
    JSON.stringify(CONSUMER_TSCONFIG)
  );
  await writeFile(path.join(consumerDir, 'index.cts'), CONSUMER_SOURCE);
  await writeFile(path.join(consumerDir, 'index.mts'), CONSUMER_SOURCE);
});

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

it.each(['node16', 'nodenext'])(
  'type-checks CommonJS and ES module consumers with %s',
  async (moduleKind) => {
    await execFileAsync(
      process.execPath,
      [TSC_PATH, '--module', moduleKind, '--moduleResolution', moduleKind],
      { cwd: consumerDir }
    ).catch((error) => {
      throw new Error(error.stdout || error.message);
    });
  }
);

it.each([
  ['require', ['-e'], "require('opencommit')"],
  ['import', ['--input-type=module', '-e'], "await import('opencommit')"]
])('generates a message after %s', async (_, nodeArgs, load) => {
  const script = `const { generateCommitMessage } = ${load};
generateCommitMessage(${JSON.stringify(DIFF)}, {
  config: { OCO_AI_PROVIDER: 'test' }
}).then(console.log);`;

  const { stdout } = await execFileAsync(
    process.execPath,
    [...nodeArgs, script],
    { cwd: consumerDir }
  );

  expect(stdout.trim()).toBe(TEST_PROVIDER_MESSAGE);
});
