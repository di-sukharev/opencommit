import { cpSync } from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import 'cli-testing-library/extend-expect';
import {
  assertHeadCommit,
  prepareEnvironment,
  prepareRepo,
  runCli,
  waitForExit
} from '../utils';

const execFileAsync = promisify(execFile);

const getFixturePath = (version: 9 | 18 | 19, fileName: string) =>
  path.resolve(
    process.cwd(),
    `test/e2e/prompt-module/data/commitlint_${version}/${fileName}`
  );

const getPromptModuleEnv = (
  mockType: 'commit-message' | 'prompt-module-commitlint-config'
): NodeJS.ProcessEnv => ({
  OCO_TEST_MOCK_TYPE: mockType,
  OCO_PROMPT_MODULE: '@commitlint',
  OCO_AI_PROVIDER: 'test',
  OCO_GITPUSH: 'true'
});

async function setupCommitlint(dir: string, version: 9 | 18 | 19) {
  cpSync(getFixturePath(version, 'node_modules'), path.join(dir, 'node_modules'), {
    recursive: true
  });
  cpSync(getFixturePath(version, 'package.json'), path.join(dir, 'package.json'));
  cpSync(
    getFixturePath(version, 'commitlint.config.js'),
    path.join(dir, 'commitlint.config.js')
  );
}

async function assertInstalledCommitlintVersion(
  cwd: string,
  version: string
): Promise<void> {
  const { stdout = '', stderr = '' } = await execFileAsync(
    'npm',
    ['list', '@commitlint/load'],
    { cwd }
  );
  expect(`${stdout}\n${stderr}`).toContain(`@commitlint/load@${version}`);
}

describe('cli flow to run "oco commitlint force"', () => {
  it('on commitlint@9 using CJS', async () => {
    const { gitDir, cleanup } = await prepareEnvironment();

    try {
      await setupCommitlint(gitDir, 9);
      await assertInstalledCommitlintVersion(gitDir, '9');

      const oco = await runCli(['commitlint', 'force'], {
        cwd: gitDir,
        env: getPromptModuleEnv('prompt-module-commitlint-config')
      });

      expect(
        await oco.findByText('opencommit — configure @commitlint')
      ).toBeInTheConsole();
      expect(
        await oco.findByText('Read @commitlint configuration')
      ).toBeInTheConsole();
      expect(
        await oco.findByText('Generating consistency with given @commitlint rules')
      ).toBeInTheConsole();
      expect(
        await oco.findByText('Done - please review contents of')
      ).toBeInTheConsole();
      expect(await waitForExit(oco)).toBe(0);
    } finally {
      await cleanup();
    }
  });

  it('on commitlint@18 using CJS', async () => {
    const { gitDir, cleanup } = await prepareEnvironment();

    try {
      await setupCommitlint(gitDir, 18);
      await assertInstalledCommitlintVersion(gitDir, '18');

      const oco = await runCli(['commitlint', 'force'], {
        cwd: gitDir,
        env: getPromptModuleEnv('prompt-module-commitlint-config')
      });

      expect(
        await oco.findByText('opencommit — configure @commitlint')
      ).toBeInTheConsole();
      expect(
        await oco.findByText('Read @commitlint configuration')
      ).toBeInTheConsole();
      expect(
        await oco.findByText('Generating consistency with given @commitlint rules')
      ).toBeInTheConsole();
      expect(
        await oco.findByText('Done - please review contents of')
      ).toBeInTheConsole();
      expect(await waitForExit(oco)).toBe(0);
    } finally {
      await cleanup();
    }
  });

  it('on commitlint@19 using ESM', async () => {
    const { gitDir, cleanup } = await prepareEnvironment();

    try {
      await setupCommitlint(gitDir, 19);
      await assertInstalledCommitlintVersion(gitDir, '19');

      const oco = await runCli(['commitlint', 'force'], {
        cwd: gitDir,
        env: getPromptModuleEnv('prompt-module-commitlint-config')
      });

      expect(
        await oco.findByText('opencommit — configure @commitlint')
      ).toBeInTheConsole();
      expect(
        await oco.findByText('Read @commitlint configuration')
      ).toBeInTheConsole();
      expect(
        await oco.findByText('Generating consistency with given @commitlint rules')
      ).toBeInTheConsole();
      expect(
        await oco.findByText('Done - please review contents of')
      ).toBeInTheConsole();
      expect(await waitForExit(oco)).toBe(0);
    } finally {
      await cleanup();
    }
  });
});

describe('cli flow to generate commit message using @commitlint prompt-module', () => {
  it('on commitlint@19 using ESM', async () => {
    const { gitDir, cleanup } = await prepareEnvironment();

    try {
      await setupCommitlint(gitDir, 19);
      await assertInstalledCommitlintVersion(gitDir, '19');

      const commitlintForce = await runCli(['commitlint', 'force'], {
        cwd: gitDir,
        env: getPromptModuleEnv('prompt-module-commitlint-config')
      });
      expect(
        await commitlintForce.findByText('Done - please review contents of')
      ).toBeInTheConsole();
      expect(await waitForExit(commitlintForce)).toBe(0);

      const commitlintGet = await runCli(['commitlint', 'get'], {
        cwd: gitDir,
        env: getPromptModuleEnv('prompt-module-commitlint-config')
      });
      expect(await commitlintGet.findByText('consistency')).toBeInTheConsole();
      expect(await waitForExit(commitlintGet)).toBe(0);

      await prepareRepo(
        gitDir,
        {
          'index.ts': 'console.log("Hello World");\n'
        },
        { stage: true }
      );

      const oco = await runCli([], {
        cwd: gitDir,
        env: getPromptModuleEnv('commit-message')
      });

      expect(
        await oco.findByText('Generating the commit message')
      ).toBeInTheConsole();
      expect(await oco.findByText('Confirm the commit message?')).toBeInTheConsole();
      oco.userEvent.keyboard('[Enter]');

      expect(
        await oco.findByText('Do you want to run `git push`?')
      ).toBeInTheConsole();
      oco.userEvent.keyboard('[Enter]');

      expect(
        await oco.findByText('Successfully pushed all commits to origin')
      ).toBeInTheConsole();
      expect(await waitForExit(oco)).toBe(0);
      await assertHeadCommit(gitDir, 'fix(testAi.ts): test commit message');
    } finally {
      await cleanup();
    }
  });
});
