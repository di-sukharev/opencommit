import { resolve } from 'path'
import { render } from 'cli-testing-library'
import 'cli-testing-library/extend-expect';
import { prepareEnvironment } from './utils';

it('cli flow to generate commit message for 1 new file (staged)', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();

  await render('echo' ,[`'console.log("Hello World");' > index.ts`], { cwd: gitDir });
  await render('git' ,['add index.ts'], { cwd: gitDir });

  const { queryByText, findByText, userEvent } = await render(`OCO_AI_PROVIDER='test' node`, [resolve('./out/cli.cjs')], { cwd: gitDir });
  expect(await queryByText('No files are staged')).not.toBeInTheConsole();
  expect(await queryByText('Do you want to stage all files and generate commit message?')).not.toBeInTheConsole();

  expect(await findByText('Generating the commit message')).toBeInTheConsole();
  expect(await findByText('Confirm the commit message?')).toBeInTheConsole();
  userEvent.keyboard('[Enter]');

  expect(await findByText('Do you want to run `git push`?')).toBeInTheConsole();
  userEvent.keyboard('[Enter]');

  expect(await findByText('Successfully pushed all commits to origin')).toBeInTheConsole();

  await cleanup();
});

it('cli flow to generate commit message for 1 changed file (not staged)', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();

  await render('echo' ,[`'console.log("Hello World");' > index.ts`], { cwd: gitDir });
  await render('git' ,['add index.ts'], { cwd: gitDir });
  await render('git' ,[`commit -m 'add new file'`], { cwd: gitDir });

  await render('echo' ,[`'console.log("Good night World");' >> index.ts`], { cwd: gitDir });

  const { findByText, userEvent } = await render(`OCO_AI_PROVIDER='test' node`, [resolve('./out/cli.cjs')], { cwd: gitDir });

  expect(await findByText('No files are staged')).toBeInTheConsole();
  expect(await findByText('Do you want to stage all files and generate commit message?')).toBeInTheConsole();
  userEvent.keyboard('[Enter]');

  expect(await findByText('Generating the commit message')).toBeInTheConsole();
  expect(await findByText('Confirm the commit message?')).toBeInTheConsole();
  userEvent.keyboard('[Enter]');

  expect(await findByText('Successfully committed')).toBeInTheConsole();

  expect(await findByText('Do you want to run `git push`?')).toBeInTheConsole();
  userEvent.keyboard('[Enter]');

  expect(await findByText('Successfully pushed all commits to origin')).toBeInTheConsole();

  await cleanup();
});
