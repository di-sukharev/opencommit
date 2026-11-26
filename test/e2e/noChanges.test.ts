import 'cli-testing-library/extend-expect';
import { prepareEnvironment, runCli, waitForExit } from './utils';

it('cli flow when there are no changes', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();

  try {
    const oco = await runCli([], {
      cwd: gitDir,
      env: {
        OCO_AI_PROVIDER: 'openai',
        OCO_API_KEY: 'dummy-openai-key',
        OCO_GITPUSH: 'false'
      }
    });

    expect(await oco.findByText('No changes detected')).toBeInTheConsole();
    expect(await waitForExit(oco)).toBe(1);
  } finally {
    await cleanup();
  }
});
