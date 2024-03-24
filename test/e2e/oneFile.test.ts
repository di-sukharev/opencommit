import { resolve } from 'path'
import { render } from 'cli-testing-library'
import 'cli-testing-library/extend-expect';
import { prepareEnvironment } from './utils';

it('cli flow to generate commit message for 1 new file (staged)', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();

  await render('echo' ,[`'console.log("Hello World");' > index.ts`], { cwd: gitDir });
  await render('git' ,['add index.ts'], { cwd: gitDir });

  const cli = await render(`OCO_AI_PROVIDER='test' node`, [resolve('./out/cli.cjs')], { cwd: gitDir });

  expect(await cli.queryByText('No files are staged')).not.toBeInTheConsole();
  expect(await cli.queryByText('Do you want to stage all files and generate commit message?')).not.toBeInTheConsole();

  expect(await cli.findByText('Generating the commit message')).toBeInTheConsole();
  expect(await cli.findByText('Confirm the commit message?')).toBeInTheConsole();
  cli.userEvent.keyboard('[Enter]');

  expect(await cli.findByText('Do you want to run `git push`?')).toBeInTheConsole();
  cli.userEvent.keyboard('[Enter]');

  expect(await cli.findByText('Successfully pushed all commits to origin')).toBeInTheConsole();

  await cleanup();
});

it('cli flow to generate commit message for 1 changed file (not staged)', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();

  await render('echo' ,[`'console.log("Hello World");' > index.ts`], { cwd: gitDir });
  await render('git' ,['add index.ts'], { cwd: gitDir });
  await render('git' ,[`commit -m 'add new file'`], { cwd: gitDir });

  await render('echo' ,[`'console.log("Good night World");' >> index.ts`], { cwd: gitDir });

  const cli = await render(`OCO_AI_PROVIDER='test' node`, [resolve('./out/cli.cjs')], { cwd: gitDir });

  expect(await cli.findByText('No files are staged')).toBeInTheConsole();
  expect(await cli.findByText('Do you want to stage all files and generate commit message?')).toBeInTheConsole();
  cli.userEvent.keyboard('[Enter]');

  expect(await cli.findByText('Generating the commit message')).toBeInTheConsole();
  expect(await cli.findByText('Confirm the commit message?')).toBeInTheConsole();
  cli.userEvent.keyboard('[Enter]');

  expect(await cli.findByText('Successfully committed')).toBeInTheConsole();

  expect(await cli.findByText('Do you want to run `git push`?')).toBeInTheConsole();
  cli.userEvent.keyboard('[Enter]');

  expect(await cli.findByText('Successfully pushed all commits to origin')).toBeInTheConsole();

  await cleanup();
});
