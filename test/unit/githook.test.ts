import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { buildHookScript } from '../../src/commands/githook';

describe('githook launcher', () => {
  it('runs with a minimal PATH and paths containing spaces and quotes', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oco hook 'dir' "));

    try {
      const cliPath = path.join(dir, 'cli file.cjs');
      const hookPath = path.join(dir, 'prepare-commit-msg');
      fs.writeFileSync(
        cliPath,
        'console.log(["hook", process.env.OCO_GIT_HOOK, ...process.argv.slice(2)].join(","))'
      );
      fs.writeFileSync(hookPath, buildHookScript(process.execPath, cliPath), {
        mode: 0o755
      });

      const stdout = execFileSync(hookPath, ['msg file', 'message'], {
        env: { PATH: '/nonexistent' },
        encoding: 'utf8'
      });

      expect(stdout.trim()).toBe('hook,1,msg file,message');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
