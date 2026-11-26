import { execFile } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const actionEntry = readFileSync('action.yml', 'utf8').match(
  /^\s+main:\s*'([^']+)'/m
)![1];
// The bundled tokenizer loads its WebAssembly file from the bundle directory.
const tokenizerWasm = path.join(path.dirname(actionEntry), 'tiktoken_bg.wasm');

// GitHub runs an action from a checkout of its tag, so the action gets only
// the committed files.
it('commits the files that the GitHub Action runs', async () => {
  const { stdout } = await execFileAsync('git', [
    'ls-files',
    '--',
    actionEntry,
    tokenizerWasm
  ]);

  expect(stdout.trim().split('\n').sort()).toEqual(
    [actionEntry, tokenizerWasm].sort()
  );
});

it('starts the GitHub Action and rejects a non-push event', async () => {
  const { stdout } = await execFileAsync(process.execPath, [actionEntry], {
    env: {
      ...process.env,
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_EVENT_PATH: '',
      GITHUB_REPOSITORY: 'owner/repo',
      INPUT_GITHUB_TOKEN: 'test-token'
    }
  });

  expect(stdout).toContain('::error::');
});
