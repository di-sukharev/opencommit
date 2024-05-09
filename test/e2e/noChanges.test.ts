import { resolve } from 'path'
import { render } from 'cli-testing-library'
import 'cli-testing-library/extend-expect';
import { prepareEnvironment } from './utils';

it('cli flow when there are no changes', async () => {
  const { gitDir, cleanup } = await prepareEnvironment();
  const { findByText } = await render(`OCO_AI_PROVIDER='test' node`, [resolve('./out/cli.cjs')], { cwd: gitDir });
  expect(await findByText('No changes detected')).toBeInTheConsole();

  await cleanup();
});
