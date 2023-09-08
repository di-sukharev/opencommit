import { prepareEnvironment } from "@gmrchk/cli-testing-library";

it('run cli flow to get the no changes message', async () => {
  const { spawn, cleanup } = await prepareEnvironment();

  const { waitForFinish, getExitCode } = await spawn(
    'npm',
    'start'
  );

  await waitForFinish();

  expect(getExitCode()).toBe(1);

  await cleanup();
}, 100000);