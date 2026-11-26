import 'cli-testing-library/extend-expect';
import {
  assertHeadCommit,
  getCurrentBranchName,
  getMockOpenAiEnv,
  getRemoteBranchHeadSubject,
  prepareEnvironment,
  prepareRepo,
  remoteBranchExists,
  runCli,
  startMockOpenAiServer,
  waitForExit
} from './utils';

describe('cli flow to push git branch', () => {
  it('does nothing when OCO_GITPUSH is set to false', async () => {
    const { gitDir, cleanup } = await prepareEnvironment({ remotes: 0 });
    const server = await startMockOpenAiServer(
      'fix(push): keep the commit local when push is disabled'
    );

    try {
      await prepareRepo(
        gitDir,
        {
          'index.ts': 'console.log("Hello World");\n'
        },
        { stage: true }
      );

      const oco = await runCli(['--yes'], {
        cwd: gitDir,
        env: getMockOpenAiEnv(server.baseUrl, {
          OCO_GITPUSH: 'false'
        })
      });

      expect(await waitForExit(oco)).toBe(0);
      await assertHeadCommit(
        gitDir,
        'fix(push): keep the commit local when push is disabled'
      );
    } finally {
      await server.cleanup();
      await cleanup();
    }
  });

  it('fails after committing when push is enabled but there is no remote', async () => {
    const { gitDir, cleanup } = await prepareEnvironment({ remotes: 0 });
    const server = await startMockOpenAiServer(
      'fix(push): commit even when the push later fails'
    );

    try {
      await prepareRepo(
        gitDir,
        {
          'index.ts': 'console.log("Hello World");\n'
        },
        { stage: true }
      );

      const oco = await runCli(['--yes'], {
        cwd: gitDir,
        env: getMockOpenAiEnv(server.baseUrl, {
          OCO_GITPUSH: 'true'
        })
      });

      expect(await waitForExit(oco)).toBe(1);
      await assertHeadCommit(
        gitDir,
        'fix(push): commit even when the push later fails'
      );
    } finally {
      await server.cleanup();
      await cleanup();
    }
  });

  it('pushes to the only configured remote', async () => {
    const { gitDir, remoteDir, cleanup } = await prepareEnvironment({
      remotes: 1
    });
    const server = await startMockOpenAiServer(
      'feat(push): publish the commit to the only remote'
    );

    try {
      await prepareRepo(
        gitDir,
        {
          'index.ts': 'console.log("Hello World");\n'
        },
        { stage: true }
      );

      const oco = await runCli(['--yes'], {
        cwd: gitDir,
        env: getMockOpenAiEnv(server.baseUrl, {
          OCO_GITPUSH: 'true'
        })
      });

      expect(
        await oco.findByText('Do you want to run `git push`?')
      ).toBeInTheConsole();
      oco.userEvent.keyboard('[Enter]');

      expect(await waitForExit(oco)).toBe(0);
      await assertHeadCommit(
        gitDir,
        'feat(push): publish the commit to the only remote'
      );
      expect(
        await getRemoteBranchHeadSubject(
          remoteDir!,
          await getCurrentBranchName(gitDir)
        )
      ).toBe('feat(push): publish the commit to the only remote');
    } finally {
      await server.cleanup();
      await cleanup();
    }
  });

  it('pushes to the selected remote when multiple remotes are configured', async () => {
    const { gitDir, remoteDir, cleanup } = await prepareEnvironment({
      remotes: 2
    });
    const server = await startMockOpenAiServer(
      'feat(push): choose a remote explicitly when several exist'
    );

    try {
      await prepareRepo(
        gitDir,
        {
          'index.ts': 'console.log("Hello World");\n'
        },
        { stage: true }
      );

      const oco = await runCli(['--yes'], {
        cwd: gitDir,
        env: getMockOpenAiEnv(server.baseUrl, {
          OCO_GITPUSH: 'true'
        })
      });

      expect(
        await oco.findByText('Choose a remote to push to')
      ).toBeInTheConsole();
      oco.userEvent.keyboard('[Enter]');

      expect(await waitForExit(oco)).toBe(0);
      await assertHeadCommit(
        gitDir,
        'feat(push): choose a remote explicitly when several exist'
      );
      expect(
        await getRemoteBranchHeadSubject(
          remoteDir!,
          await getCurrentBranchName(gitDir)
        )
      ).toBe('feat(push): choose a remote explicitly when several exist');
    } finally {
      await server.cleanup();
      await cleanup();
    }
  });

  it("keeps the commit local when the user chooses 'don't push'", async () => {
    const { gitDir, remoteDir, otherRemoteDir, cleanup } =
      await prepareEnvironment({ remotes: 2 });
    const server = await startMockOpenAiServer(
      "fix(push): skip the remote step when the user chooses don't push"
    );

    try {
      await prepareRepo(
        gitDir,
        {
          'index.ts': 'console.log("Hello World");\n'
        },
        { stage: true }
      );

      const oco = await runCli(['--yes'], {
        cwd: gitDir,
        env: getMockOpenAiEnv(server.baseUrl, {
          OCO_GITPUSH: 'true'
        })
      });

      expect(
        await oco.findByText('Choose a remote to push to')
      ).toBeInTheConsole();
      oco.userEvent.keyboard('[ArrowDown][ArrowDown][Enter]');

      expect(await waitForExit(oco)).toBe(0);
      await assertHeadCommit(
        gitDir,
        "fix(push): skip the remote step when the user chooses don't push"
      );

      const branchName = await getCurrentBranchName(gitDir);
      expect(await remoteBranchExists(remoteDir!, branchName)).toBe(false);
      expect(await remoteBranchExists(otherRemoteDir!, branchName)).toBe(false);
    } finally {
      await server.cleanup();
      await cleanup();
    }
  });
});
