import { prepareEnvironment } from "@gmrchk/cli-testing-library";

it('run cli flow to get the no changes message', async () => {
  const { execute, spawn, cleanup } = await prepareEnvironment();

  console.log('hello world');

  const { code, stdout, stderr } = await execute(
    'npm',
    'start'
  );

  console.log(code);
  console.log(stdout);
  console.log(stderr); 

  await cleanup();
}, 100000);