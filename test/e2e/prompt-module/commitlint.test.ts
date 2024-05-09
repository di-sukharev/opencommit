import { resolve } from 'path';
import { configure, render } from 'cli-testing-library';
import 'cli-testing-library/extend-expect';
import { prepareEnvironment, wait } from '../utils';
import path from 'path';

function getAbsolutePath(relativePath: string) {
  const scriptDir = path.dirname(__filename);
  return path.resolve(scriptDir, relativePath);
}
async function setupCommitlint(dir: string, ver: 9 | 18 | 19) {
  let packagePath, configPath
  switch (ver) {
    case 9:
      packagePath = getAbsolutePath('./data/commitlint_9/node_modules');
      configPath = getAbsolutePath('./data/commitlint_9/commitlint.config.js');
      break;
    case 18:
      packagePath = getAbsolutePath('./data/commitlint_18/node_modules');
      configPath = getAbsolutePath('./data/commitlint_18/commitlint.config.js');
      break;
    case 19:
      packagePath = getAbsolutePath('./data/commitlint_19/node_modules');
      configPath = getAbsolutePath('./data/commitlint_19/commitlint.config.js');
      break;
  }
  await render('cp', ['-r', packagePath, '.'], { cwd: dir });
  await render('cp', [configPath, '.'], { cwd: dir });
  await wait(3000); // Avoid flakiness by waiting
}

describe('cli flow to run "oco commitlint force"', () => {
  it('on commitlint@9 using CJS', async () => {
    const { gitDir, cleanup } = await prepareEnvironment();

    await setupCommitlint(gitDir, 9);
    const npmList = await render('npm', ['list', '@commitlint/load'], {
      cwd: gitDir
    });
    expect(await npmList.findByText('@commitlint/load@9')).toBeInTheConsole();

    const { findByText } = await render(
      `
      OCO_TEST_MOCK_TYPE='prompt-module-commitlint-config' \
      OCO_PROMPT_MODULE='@commitlint'  \
      OCO_AI_PROVIDER='test'  \
      node ${resolve('./out/cli.cjs')} commitlint force \
    `,
      [],
      { cwd: gitDir }
    );

    expect(
      await findByText('opencommit — configure @commitlint')
    ).toBeInTheConsole();
    expect(
      await findByText('Read @commitlint configuration')
    ).toBeInTheConsole();

    expect(
      await findByText('Generating consistency with given @commitlint rules')
    ).toBeInTheConsole();
    expect(
      await findByText('Done - please review contents of')
    ).toBeInTheConsole();

    await cleanup();
  });
  it('on commitlint@18 using CJS', async () => {
    const { gitDir, cleanup } = await prepareEnvironment();

    await setupCommitlint(gitDir, 18);
    const npmList = await render('npm', ['list', '@commitlint/load'], {
      cwd: gitDir
    });
    expect(await npmList.findByText('@commitlint/load@18')).toBeInTheConsole();

    const { findByText } = await render(
      `
      OCO_TEST_MOCK_TYPE='prompt-module-commitlint-config' \
      OCO_PROMPT_MODULE='@commitlint'  \
      OCO_AI_PROVIDER='test'  \
      node ${resolve('./out/cli.cjs')} commitlint force \
    `,
      [],
      { cwd: gitDir }
    );

    expect(
      await findByText('opencommit — configure @commitlint')
    ).toBeInTheConsole();
    expect(
      await findByText('Read @commitlint configuration')
    ).toBeInTheConsole();

    expect(
      await findByText('Generating consistency with given @commitlint rules')
    ).toBeInTheConsole();
    expect(
      await findByText('Done - please review contents of')
    ).toBeInTheConsole();

    await cleanup();
  });
  it('on commitlint@19 using ESM', async () => {
    const { gitDir, cleanup } = await prepareEnvironment();

    await setupCommitlint(gitDir, 19);
    const npmList = await render('npm', ['list', '@commitlint/load'], {
      cwd: gitDir
    });
    expect(await npmList.findByText('@commitlint/load@19')).toBeInTheConsole();

    const { findByText } = await render(
      `
      OCO_TEST_MOCK_TYPE='prompt-module-commitlint-config' \
      OCO_PROMPT_MODULE='@commitlint'  \
      OCO_AI_PROVIDER='test'  \
      node ${resolve('./out/cli.cjs')} commitlint force \
    `,
      [],
      { cwd: gitDir }
    );

    expect(
      await findByText('opencommit — configure @commitlint')
    ).toBeInTheConsole();
    expect(
      await findByText('Read @commitlint configuration')
    ).toBeInTheConsole();

    expect(
      await findByText('Generating consistency with given @commitlint rules')
    ).toBeInTheConsole();
    expect(
      await findByText('Done - please review contents of')
    ).toBeInTheConsole();

    await cleanup();
  });
});
