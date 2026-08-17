import packageJson from '../../package.json';
import 'cli-testing-library/extend-expect';
import { runCli, waitForExit } from './utils';

it('prints help without entering the interactive flow', async () => {
  const help = await runCli(['--help'], {
    cwd: process.cwd()
  });

  expect(await help.findByText('opencommit')).toBeInTheConsole();
  expect(await help.findByText('--context')).toBeInTheConsole();
  expect(await help.findByText('--yes')).toBeInTheConsole();
  expect(
    await help.queryByText('Select your AI provider:')
  ).not.toBeInTheConsole();
  expect(await help.queryByText('Enter your API key:')).not.toBeInTheConsole();
  expect(await waitForExit(help)).toBe(0);
});

it('prints the current version without booting the CLI runtime', async () => {
  const version = await runCli(['--version'], {
    cwd: process.cwd()
  });

  expect(await version.findByText(packageJson.version)).toBeInTheConsole();
  expect(
    await version.queryByText('Generating the commit message')
  ).not.toBeInTheConsole();
  expect(await waitForExit(version)).toBe(0);
});
