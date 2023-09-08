import { prepareEnvironment } from "@gmrchk/cli-testing-library";

it('run cli flow to get the no changes message', async () => {
  const { execute, spawn, cleanup } = await prepareEnvironment();

  console.log('hello world');

  // Stash all changes to have a clean working directory

  await execute('git', 'stash push -m "test"');

  const { waitForText, getExitCode } = await spawn(
    'npm',
    'start'
  );

  console.log('hello world');

  await waitForText('No changes detected');

  expect(getExitCode()).toBe(1);

  execute('git', 'stash pop');

  await cleanup();
});