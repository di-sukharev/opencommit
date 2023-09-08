import { prepareEnvironment } from "@gmrchk/cli-testing-library";

it('run cli flow to get the no changes message', async () => {
  const { spawn, cleanup } = await prepareEnvironment();

  const { waitForText, waitForFinish, getExitCode } = await spawn(
    'node',
    './out/cli.cjs'
  );

  await waitForText("No changes detected")
  await waitForFinish();

  expect(getExitCode()).toBe(1);

  await cleanup();
});