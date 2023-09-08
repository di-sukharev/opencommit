import { prepareEnvironment } from '@gmrchk/cli-testing-library';

it('run basic cli flow to generate commit message for single staged file', async () => {
  const { execute, spawn, writeFile, cleanup } = await prepareEnvironment();

  await writeFile('src/test-index.ts', 'console.log("hello world")');

  await execute('git' ,'add src/test-index.ts');

  const { waitForText, pressKey, getExitCode } = await spawn(
    'npm',
    'start'
);

  await waitForText('Confirm the commit message?');
  await pressKey('enter');

  await waitForText('Choose a remote to push to');
  await pressKey('enter');

  expect(getExitCode()).toBe(0);

  await cleanup();
});

it('run basic cli flow to generate commit message for multiple staged files', async () => {
});

it('run basic cli flow to generate commit message for 1 changed file (not staged)', async () => {
  const { execute, spawn, writeFile, cleanup } = await prepareEnvironment();

  await writeFile('src/test-index.ts', 'console.log("hello world")');

  const { waitForText, pressKey, getExitCode } = await spawn(
    'npm',
    'start -- --test'
);

waitForText('Do you want to stage all files and generate commit message?');
await pressKey('enter');

waitForText('Confirm the commit message?');
await pressKey('enter');



});