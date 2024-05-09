import { resolve } from 'path';
import { configure, render } from 'cli-testing-library';
import 'cli-testing-library/extend-expect';
import { prepareEnvironment, wait } from '../utils';
import path from 'path';

const commitlint18PackagePath = './data/commitlint_18/node_modules';
const commitlint18ConfigPath = './data/commitlint_18/commitlint.config.js';
const commitlint19PackagePath = './data/commitlint_19/node_modules';
const commitlint19ConfigPath = './data/commitlint_19/commitlint.config.js';
function getAbsolutePath(relativePath: string) {
  const scriptDir = path.dirname(__filename);
  return path.resolve(scriptDir, relativePath);
}
async function setupCommitlintAsCJS(dir: string) {
  const packagePath = getAbsolutePath(commitlint18PackagePath);
  const configPath = getAbsolutePath(commitlint18ConfigPath);
  await render('cp', ['-r', packagePath, '.'], { cwd: dir });
  await render('cp', [configPath, '.'], { cwd: dir });
  await wait(3000); // Avoid flakiness by waiting
}
async function setupCommitlintAsESM(dir: string) {
  const packagePath = getAbsolutePath(commitlint19PackagePath);
  const configPath = getAbsolutePath(commitlint19ConfigPath);
  await render('cp', ['-r', packagePath, '.'], { cwd: dir });
  await render('cp', [configPath, '.'], { cwd: dir });
  await wait(3000); // Avoid flakiness by waiting
}

describe('cli flow to run "oco commitlint force"', () => {
  it('on commitlint@18 using CJS', async () => {
    const { gitDir, cleanup } = await prepareEnvironment();

    await setupCommitlintAsCJS(gitDir);
    const npmList = await render('npm', ['list', '@commitlint/load'], {
      cwd: gitDir
    });
    expect(await npmList.findByText('@commitlint/load@18')).toBeInTheConsole();

    await render('echo', [`'console.log("Hello World");' > index.ts`], {
      cwd: gitDir
    });
    await render('git', ['add index.ts'], { cwd: gitDir });

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

    await setupCommitlintAsESM(gitDir);
    const npmList = await render('npm', ['list', '@commitlint/load'], {
      cwd: gitDir
    });
    expect(await npmList.findByText('@commitlint/load@19')).toBeInTheConsole();

    await render('echo', [`'console.log("Hello World");' > index.ts`], {
      cwd: gitDir
    });
    await render('git', ['add index.ts'], { cwd: gitDir });

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
