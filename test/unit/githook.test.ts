import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { buildHookScript } from '../../src/commands/githook';

const itPosix = process.platform === 'win32' ? it.skip : it;

describe('githook launcher', () => {
  itPosix(
    'runs with a minimal PATH and paths containing spaces and quotes',
    () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oco hook 'dir' "));

      try {
        const nodePath = path.join(dir, 'node binary');
        const cliPath = path.join(dir, 'cli file.cjs');
        const hookPath = path.join(dir, 'prepare-commit-msg');
        fs.symlinkSync(process.execPath, nodePath);
        fs.writeFileSync(
          cliPath,
          'console.log(JSON.stringify({ args: process.argv.slice(1), hookMode: process.env.OCO_GIT_HOOK }))'
        );
        fs.writeFileSync(hookPath, buildHookScript(nodePath, cliPath), {
          mode: 0o755
        });

        const stdout = execFileSync(hookPath, ['msg file', 'message'], {
          env: { PATH: '/nonexistent' },
          encoding: 'utf8'
        });

        expect(JSON.parse(stdout)).toEqual({
          args: [hookPath, 'msg file', 'message']
        });
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  );
});
