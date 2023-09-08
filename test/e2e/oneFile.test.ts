import { prepareEnvironment } from '@gmrchk/cli-testing-library';

it('run basic cli flow to generate commit message for single staged file', async () => {
  const { execute, spawn, writeFile, cleanup } = await prepareEnvironment();

  await writeFile('src/test-index.ts', 'console.log("hello world")');

  await execute('git' ,'add src/test-index.ts');

  const { waitForText, pressKey, getExitCode } = await spawn(
    'node',
    './out/cli.cjs --test'
);

  await waitForText('Confirm the commit message?');
  await pressKey('enter');

  await waitForText('Do you want to run `git push`?');
  await pressKey('enter');
  
  await waitForText('Successfully pushed all commits');
  expect(getExitCode()).toBe(0);
  
  await cleanup();
}, 100000);

it('run basic cli flow to generate commit message for 1 changed file (not staged)', async () => {
  const { spawn, writeFile, cleanup } = await prepareEnvironment();
  
  await writeFile('src/test-index.ts', 'console.log("hello world")');
  
  const { waitForText, pressKey, getExitCode } = await spawn(
    'node',
    './out/cli.cjs --test'
  );

  await waitForText('Do you want to stage all files and generate commit message?');
  await pressKey('enter');

  await waitForText('Confirm the commit message?');
  await pressKey('enter');

  await waitForText('Successfully committed');

  await waitForText('Do you want to run `git push`?');
  await pressKey('enter');

  await waitForText('Successfully pushed all commits');
  
  expect(getExitCode()).toBe(0);
  
  await cleanup();
}, 100000);