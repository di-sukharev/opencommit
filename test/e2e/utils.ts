import path from 'path';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtemp,
  rm,
  writeFileSync
} from 'fs';
import http from 'http';
import { tmpdir } from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { AddressInfo } from 'net';
import { render } from 'cli-testing-library';
import type { RenderResult } from 'cli-testing-library';

const fsMakeTempDir = promisify(mkdtemp);
const fsExecFile = promisify(execFile);
const fsRemove = promisify(rm);

const CLI_PATH = path.resolve(process.cwd(), 'out/cli.cjs');
const DEFAULT_TEST_ENV = {
  OCO_TEST_SKIP_VERSION_CHECK: 'true'
};
const COMPLETED_MIGRATIONS = [
  '00_use_single_api_key_and_url',
  '01_remove_obsolete_config_keys_from_global_file',
  '02_set_missing_default_values'
];

type ProcessOptions = {
  cwd: string;
  env?: NodeJS.ProcessEnv;
};

type PrepareEnvironmentOptions = {
  remotes?: 0 | 1 | 2;
};

export const getCliPath = () => CLI_PATH;

export const runProcess = async (
  command: string,
  args: string[] = [],
  { cwd, env = {} }: ProcessOptions
): Promise<RenderResult> => {
  return render(command, args, {
    cwd,
    spawnOpts: {
      env: {
        ...process.env,
        ...DEFAULT_TEST_ENV,
        ...env
      }
    }
  });
};

export const runCli = async (
  args: string[] = [],
  options: ProcessOptions
): Promise<RenderResult> => {
  return runProcess(process.execPath, [getCliPath(), ...args], options);
};

export const runGit = async (
  args: string[],
  cwd: string
): Promise<{ stdout: string; stderr: string }> => {
  const { stdout = '', stderr = '' } = await fsExecFile('git', args, { cwd });
  return { stdout, stderr };
};

export const configureGitUser = async (gitDir: string): Promise<void> => {
  await runGit(['config', 'user.email', 'test@example.com'], gitDir);
  await runGit(['config', 'user.name', 'Test User'], gitDir);
};

export const prepareEnvironment = async ({
  remotes = 1
}: PrepareEnvironmentOptions = {}): Promise<{
  tempDir: string;
  gitDir: string;
  remoteDir?: string;
  otherRemoteDir?: string;
  cleanup: () => Promise<void>;
}> => {
  const tempDir = await prepareTempDir();
  const gitDir = path.resolve(tempDir, 'test');
  let remoteDir: string | undefined;
  let otherRemoteDir: string | undefined;

  if (remotes === 0) {
    await fsExecFile('git', ['init', 'test'], { cwd: tempDir });
  } else {
    await fsExecFile('git', ['init', '--bare', 'remote.git'], {
      cwd: tempDir
    });
    remoteDir = path.resolve(tempDir, 'remote.git');

    if (remotes === 2) {
      await fsExecFile('git', ['init', '--bare', 'other.git'], {
        cwd: tempDir
      });
      otherRemoteDir = path.resolve(tempDir, 'other.git');
    }

    await fsExecFile('git', ['clone', 'remote.git', 'test'], { cwd: tempDir });

    if (remotes === 2) {
      await runGit(['remote', 'add', 'other', '../other.git'], gitDir);
    }
  }

  await configureGitUser(gitDir);

  const cleanup = async () => {
    if (existsSync(tempDir)) {
      await fsRemove(tempDir, { force: true, recursive: true });
    }
  };

  return {
    tempDir,
    gitDir,
    remoteDir,
    otherRemoteDir,
    cleanup
  };
};

export const prepareTempDir = async (): Promise<string> => {
  return fsMakeTempDir(path.join(tmpdir(), 'opencommit-test-'));
};

export const prepareRepo = async (
  gitDir: string,
  files: Record<string, string>,
  options: {
    stage?: string[] | true;
    commitMessage?: string;
  } = {}
): Promise<void> => {
  for (const [relativePath, content] of Object.entries(files)) {
    writeRepoFile(gitDir, relativePath, content);
  }

  const stageFiles =
    options.stage === true
      ? Object.keys(files)
      : Array.isArray(options.stage)
      ? options.stage
      : options.commitMessage
      ? Object.keys(files)
      : [];

  if (stageFiles.length > 0) {
    await runGit(['add', ...stageFiles], gitDir);
  }

  if (options.commitMessage) {
    await runGit(['commit', '-m', options.commitMessage], gitDir);
  }
};

export const writeRepoFile = (
  gitDir: string,
  relativePath: string,
  content: string
): void => {
  const filePath = path.resolve(gitDir, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
};

export const appendRepoFile = (
  gitDir: string,
  relativePath: string,
  content: string
): void => {
  const filePath = path.resolve(gitDir, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  appendFileSync(filePath, content);
};

export const writeGlobalConfig = (homeDir: string, lines: string[]): string => {
  const configPath = path.resolve(homeDir, '.opencommit');
  writeFileSync(configPath, lines.join('\n'));
  return configPath;
};

export const seedMigrations = (
  homeDir: string,
  completedMigrations: string[] = COMPLETED_MIGRATIONS
): string => {
  const migrationsPath = path.resolve(homeDir, '.opencommit_migrations');
  writeFileSync(migrationsPath, JSON.stringify(completedMigrations));
  return migrationsPath;
};

export const seedModelCache = async (
  homeDir: string,
  models: Record<string, string[]>
): Promise<void> => {
  const modelCachePath = path.resolve(homeDir, '.opencommit-models.json');
  writeFileSync(
    modelCachePath,
    JSON.stringify(
      {
        timestamp: Date.now(),
        models
      },
      null,
      2
    )
  );
};

export const getMockOpenAiEnv = (
  baseUrl: string,
  overrides: NodeJS.ProcessEnv = {}
): NodeJS.ProcessEnv => ({
  OCO_AI_PROVIDER: 'openai',
  OCO_API_KEY: 'test-openai-key',
  OCO_MODEL: 'gpt-4o-mini',
  OCO_API_URL: baseUrl,
  OCO_GITPUSH: 'false',
  ...overrides
});

export const getMockGeminiEnv = (
  baseUrl: string,
  overrides: NodeJS.ProcessEnv = {}
): NodeJS.ProcessEnv => ({
  OCO_AI_PROVIDER: 'gemini',
  OCO_API_KEY: 'test-gemini-key',
  OCO_MODEL: 'gemini-1.5-flash',
  OCO_API_URL: baseUrl,
  OCO_GITPUSH: 'false',
  ...overrides
});

export const wait = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const waitForExit = async (
  instance: RenderResult,
  timeoutMs: number = 20_000
): Promise<number> => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const exit = instance.hasExit();
    if (exit) {
      return exit.exitCode;
    }
    await wait(25);
  }

  throw new Error('Process did not exit within the expected timeout');
};

export const getHeadCommitSubject = async (gitDir: string): Promise<string> => {
  const { stdout } = await runGit(['log', '-1', '--pretty=%s'], gitDir);
  return stdout.trim();
};

export const getHeadCommitMessage = async (gitDir: string): Promise<string> => {
  const { stdout } = await runGit(['log', '-1', '--pretty=%B'], gitDir);
  return stdout.trim();
};

export const getHeadCommitFiles = async (gitDir: string): Promise<string[]> => {
  const { stdout } = await runGit(
    ['diff-tree', '--root', '--no-commit-id', '--name-only', '-r', 'HEAD'],
    gitDir
  );

  return stdout
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean)
    .sort();
};

export const getShortGitStatus = async (gitDir: string): Promise<string> => {
  const { stdout } = await runGit(['status', '--short'], gitDir);
  return stdout.trim();
};

export const getCurrentBranchName = async (gitDir: string): Promise<string> => {
  const { stdout } = await runGit(['branch', '--show-current'], gitDir);
  return stdout.trim();
};

export const getRemoteBranchHeadSubject = async (
  remoteGitDir: string,
  branchName: string
): Promise<string> => {
  const { stdout = '' } = await fsExecFile(
    'git',
    [
      '--git-dir',
      remoteGitDir,
      'log',
      '-1',
      '--pretty=%s',
      `refs/heads/${branchName}`
    ],
    { cwd: process.cwd() }
  );

  return stdout.trim();
};

export const remoteBranchExists = async (
  remoteGitDir: string,
  branchName: string
): Promise<boolean> => {
  try {
    await fsExecFile(
      'git',
      [
        '--git-dir',
        remoteGitDir,
        'rev-parse',
        '--verify',
        '--quiet',
        `refs/heads/${branchName}`
      ],
      { cwd: process.cwd() }
    );
    return true;
  } catch {
    return false;
  }
};

export const assertHeadCommit = async (
  gitDir: string,
  expectedSubject: string
): Promise<void> => {
  expect(await getHeadCommitSubject(gitDir)).toBe(expectedSubject);
};

export const assertGitStatus = async (
  gitDir: string,
  expected: string | RegExp
): Promise<void> => {
  const status = await getShortGitStatus(gitDir);
  if (typeof expected === 'string') {
    expect(status).toContain(expected);
    return;
  }

  expect(status).toMatch(expected);
};

export const startMockOpenAiServer = async (
  response:
    | string
    | ((request: {
        authorization?: string;
        body: Record<string, any> | undefined;
        requestIndex: number;
      }) => {
        status?: number;
        body: Record<string, any>;
        headers?: Record<string, string>;
      })
): Promise<{
  authHeaders: string[];
  requestBodies: Array<Record<string, any>>;
  baseUrl: string;
  cleanup: () => Promise<void>;
}> => {
  const authHeaders: string[] = [];
  const requestBodies: Array<Record<string, any>> = [];

  const server = http.createServer((req, res) => {
    const authorization = req.headers.authorization;
    if (authorization) {
      authHeaders.push(
        Array.isArray(authorization) ? authorization[0] : authorization
      );
    }

    const chunks: Buffer[] = [];
    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf8');
      let parsedBody: Record<string, any> | undefined;
      if (rawBody) {
        try {
          parsedBody = JSON.parse(rawBody);
          requestBodies.push(parsedBody);
        } catch {
          requestBodies.push({ rawBody });
        }
      }

      if (req.method === 'POST' && req.url?.includes('/chat/completions')) {
        const payload =
          typeof response === 'string'
            ? {
                status: 200,
                body: {
                  choices: [
                    {
                      message: {
                        content: response
                      }
                    }
                  ]
                }
              }
            : response({
                authorization: Array.isArray(authorization)
                  ? authorization[0]
                  : authorization,
                body: parsedBody,
                requestIndex: requestBodies.length - 1
              });

        res.writeHead(payload.status ?? 200, {
          'Content-Type': 'application/json',
          ...payload.headers
        });
        res.end(JSON.stringify(payload.body));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const { port } = server.address() as AddressInfo;

  return {
    authHeaders,
    requestBodies,
    baseUrl: `http://127.0.0.1:${port}/v1`,
    cleanup: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      })
  };
};

export const startMockGeminiServer = async (
  response:
    | Record<string, any>
    | ((request: {
        apiKey?: string;
        body: Record<string, any> | undefined;
        requestIndex: number;
      }) => {
        status?: number;
        body: Record<string, any>;
        headers?: Record<string, string>;
      })
): Promise<{
  apiKeys: string[];
  requestBodies: Array<Record<string, any>>;
  baseUrl: string;
  cleanup: () => Promise<void>;
}> => {
  const apiKeys: string[] = [];
  const requestBodies: Array<Record<string, any>> = [];

  const server = http.createServer((req, res) => {
    const apiKeyHeader = req.headers['x-goog-api-key'];
    if (apiKeyHeader) {
      apiKeys.push(
        Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader
      );
    }

    const chunks: Buffer[] = [];
    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf8');
      let parsedBody: Record<string, any> | undefined;
      if (rawBody) {
        try {
          parsedBody = JSON.parse(rawBody);
          requestBodies.push(parsedBody);
        } catch {
          requestBodies.push({ rawBody });
        }
      }

      if (req.method === 'POST' && req.url?.includes(':generateContent')) {
        const payload =
          typeof response === 'function'
            ? response({
                apiKey: Array.isArray(apiKeyHeader)
                  ? apiKeyHeader[0]
                  : apiKeyHeader,
                body: parsedBody,
                requestIndex: requestBodies.length - 1
              })
            : {
                status: 200,
                body: response
              };

        res.writeHead(payload.status ?? 200, {
          'Content-Type': 'application/json',
          ...payload.headers
        });
        res.end(JSON.stringify(payload.body));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const { port } = server.address() as AddressInfo;

  return {
    apiKeys,
    requestBodies,
    baseUrl: `http://127.0.0.1:${port}`,
    cleanup: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      })
  };
};
