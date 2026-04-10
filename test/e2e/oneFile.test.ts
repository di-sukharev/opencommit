import 'cli-testing-library/extend-expect';
import {
  assertHeadCommit,
  getCurrentBranchName,
  getMockOpenAiEnv,
  getRemoteBranchHeadSubject,
  prepareEnvironment,
  prepareRepo,
  runCli,
  startMockOpenAiServer,
  appendRepoFile,
  waitForExit
} from './utils';

it('cli flow to generate commit message for 1 new file (staged)', async () => {
  const { gitDir, remoteDir, cleanup } = await prepareEnvironment();
  const server = await startMockOpenAiServer(
    'feat(cli): commit one staged file through the CLI'
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

    expect(await oco.queryByText('No files are staged')).not.toBeInTheConsole();
    expect(
      await oco.queryByText(
        'Do you want to stage all files and generate commit message?'
      )
    ).not.toBeInTheConsole();

    expect(
      await oco.findByText('Do you want to run `git push`?')
    ).toBeInTheConsole();
    oco.userEvent.keyboard('[Enter]');

    expect(await waitForExit(oco)).toBe(0);
    await assertHeadCommit(
      gitDir,
      'feat(cli): commit one staged file through the CLI'
    );
    expect(
      await getRemoteBranchHeadSubject(
        remoteDir!,
        await getCurrentBranchName(gitDir)
      )
    ).toBe('feat(cli): commit one staged file through the CLI');
  } finally {
    await server.cleanup();
    await cleanup();
  }
});

it('cli flow to generate commit message for 1 changed file (not staged)', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();
  const server = await startMockOpenAiServer(
    'fix(cli): stage modified files before committing'
  );

  try {
    await prepareRepo(
      gitDir,
      {
        'index.ts': 'console.log("Hello World");\n'
      },
      {
        stage: true,
        commitMessage: 'add new file'
      }
    );
    appendRepoFile(gitDir, 'index.ts', 'console.log("Good night World");\n');

    const oco = await runCli(['--yes'], {
      cwd: gitDir,
      env: getMockOpenAiEnv(server.baseUrl, {
        OCO_GITPUSH: 'true'
      })
    });

    expect(await oco.findByText('No files are staged')).toBeInTheConsole();
    expect(
      await oco.findByText(
        'Do you want to stage all files and generate commit message?'
      )
    ).toBeInTheConsole();
    oco.userEvent.keyboard('[Enter]');

    expect(
      await oco.findByText('Confirm the commit message?')
    ).toBeInTheConsole();
    oco.userEvent.keyboard('[Enter]');

    expect(
      await oco.findByText('Do you want to run `git push`?')
    ).toBeInTheConsole();
    oco.userEvent.keyboard('[Enter]');

    expect(await waitForExit(oco)).toBe(0);
    await assertHeadCommit(
      gitDir,
      'fix(cli): stage modified files before committing'
    );
  } finally {
    await server.cleanup();
    await cleanup();
  }
});
