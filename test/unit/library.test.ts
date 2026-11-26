import { createServer, IncomingMessage, Server } from 'http';
import { AddressInfo } from 'net';
import { MODEL_LIST } from '../../src/commands/config';
import { generateCommitMessage } from '../../src/index';
import { GenerateCommitMessageErrorEnum } from '../../src/utils/generateCommitMessageErrors';

type ChatRequest = {
  authorization?: string;
  body: {
    model: string;
    messages: Array<{ role: string; content: string }>;
  };
};

const DIFF = `diff --git a/src/server.ts b/src/server.ts
--- a/src/server.ts
+++ b/src/server.ts
@@ -1 +1 @@
-const port = 7799;
+const PORT = 7799;
`;

const ADDED_LINES = Array.from(
  { length: 300 },
  (_, index) => `+export const value${index} = ${index};`
);

// A unified diff without the `diff --git` file header, like the output of
// `diff -u` or of the `diff` npm package.
const LARGE_HUNK = `--- a/src/values.ts
+++ b/src/values.ts
@@ -0,0 +1,300 @@
${ADDED_LINES.join('\n')}
`;

const LARGE_DIFF = `diff --git a/src/values.ts b/src/values.ts
${LARGE_HUNK}`;

// A small input limit makes the library split these diffs into several
// requests.
const SPLIT_LIMITS = { OCO_TOKENS_MAX_INPUT: 1500, OCO_TOKENS_MAX_OUTPUT: 100 };

const completion = (content: string) => ({
  status: 200,
  body: {
    id: 'chatcmpl-test',
    object: 'chat.completion',
    created: 0,
    model: 'test-model',
    choices: [
      {
        index: 0,
        finish_reason: 'stop',
        message: { role: 'assistant', content }
      }
    ]
  }
});

const readBody = async (request: IncomingMessage): Promise<string> => {
  let body = '';
  for await (const chunk of request) body += chunk;
  return body;
};

describe('generateCommitMessage', () => {
  const originalEnv = { ...process.env };
  const requests: ChatRequest[] = [];
  let server: Server;
  let apiUrl: string;
  let respond: () => { status: number; body: unknown };

  beforeAll(async () => {
    server = createServer(async (request, response) => {
      requests.push({
        authorization: request.headers.authorization,
        body: JSON.parse(await readBody(request))
      });
      const { status, body } = respond();
      response.writeHead(status, { 'content-type': 'application/json' });
      response.end(JSON.stringify(body));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    );
    apiUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    requests.length = 0;
    respond = () => completion('fix(server): rename port');
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it('generates a message with the given config', async () => {
    const message = await generateCommitMessage(DIFF, {
      config: {
        OCO_AI_PROVIDER: 'openai',
        OCO_API_KEY: 'library-key',
        OCO_API_URL: apiUrl,
        OCO_MODEL: 'library-model',
        OCO_EMOJI: true,
        OCO_LANGUAGE: 'German'
      },
      context: 'Rename for consistency'
    });

    expect(message).toBe('fix(server): rename port');
    expect(requests).toHaveLength(1);

    const [{ authorization, body }] = requests;
    expect(authorization).toBe('Bearer library-key');
    expect(body.model).toBe('library-model');

    const systemPrompt = body.messages[0].content;
    expect(systemPrompt).toContain('Use GitMoji convention');
    expect(systemPrompt).toContain('Use Deutsch for the commit message.');
    expect(systemPrompt).toContain('<context>Rename for consistency</context>');
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: DIFF });
  });

  it('does not read OCO_* environment variables', async () => {
    Object.assign(process.env, {
      OCO_API_KEY: 'env-key',
      OCO_MODEL: 'env-model',
      OCO_EMOJI: 'true'
    });

    await generateCommitMessage(DIFF, {
      config: { OCO_API_KEY: 'library-key', OCO_API_URL: apiUrl }
    });

    const [{ authorization, body }] = requests;
    expect(authorization).toBe('Bearer library-key');
    expect(body.model).toBe(MODEL_LIST.openai[0]);
    expect(body.messages[0].content).not.toContain('GitMoji');
  });

  it('uses the conventional commit prompt module', async () => {
    await generateCommitMessage(DIFF, {
      config: {
        OCO_API_KEY: 'library-key',
        OCO_API_URL: apiUrl,
        OCO_PROMPT_MODULE: '@commitlint'
      } as object
    });

    expect(requests[0].body.messages[0].content).toContain(
      'Conventional Commit Convention'
    );
  });

  it('rejects provider errors without interactive recovery', async () => {
    respond = () => ({
      status: 404,
      body: {
        error: {
          message: 'The model `missing-model` does not exist',
          type: 'invalid_request_error',
          code: 'model_not_found'
        }
      }
    });

    await expect(
      generateCommitMessage(DIFF, {
        config: {
          OCO_API_KEY: 'library-key',
          OCO_API_URL: apiUrl,
          OCO_MODEL: 'missing-model'
        }
      })
    ).rejects.toThrow("Model 'missing-model' not found");
    expect(requests).toHaveLength(1);
  });

  it.each([
    ['a git file header', LARGE_HUNK],
    ['a hunk header', `${ADDED_LINES.join('\n')}\n`]
  ])('sends every line of a split diff without %s', async (_, diff) => {
    const message = await generateCommitMessage(diff, {
      config: {
        OCO_API_KEY: 'library-key',
        OCO_API_URL: apiUrl,
        ...SPLIT_LIMITS
      }
    });

    expect(requests.length).toBeGreaterThan(1);
    expect(message).toContain('fix(server): rename port');

    const sentLines = requests.flatMap(({ body }) =>
      body.messages
        .at(-1)!
        .content.split('\n')
        .filter((line) => line.startsWith('+export'))
    );
    expect(sentLines).toEqual(ADDED_LINES);
  });

  it('leaves empty chunk messages out of a split diff message', async () => {
    let responses = 0;
    respond = () => completion(responses++ === 0 ? '' : 'feat: add values');

    const message = await generateCommitMessage(LARGE_DIFF, {
      config: {
        OCO_API_KEY: 'library-key',
        OCO_API_URL: apiUrl,
        ...SPLIT_LIMITS
      }
    });

    expect(requests.length).toBeGreaterThan(2);
    expect(message.split('\n\n')).toEqual(
      Array(requests.length - 1).fill('feat: add values')
    );
  });

  it('rejects a split diff when every chunk message is empty', async () => {
    respond = () => completion('');

    await expect(
      generateCommitMessage(LARGE_DIFF, {
        config: {
          OCO_API_KEY: 'library-key',
          OCO_API_URL: apiUrl,
          ...SPLIT_LIMITS
        }
      })
    ).rejects.toThrow(GenerateCommitMessageErrorEnum.emptyMessage);
    expect(requests.length).toBeGreaterThan(1);
  });

  it.each([
    ['an empty diff', ' \n', {}, 'The diff is empty.'],
    [
      'an unknown provider',
      DIFF,
      { OCO_AI_PROVIDER: 'unknown' },
      'OCO_AI_PROVIDER "unknown" is not supported.'
    ],
    [
      'an unsupported language',
      DIFF,
      { OCO_LANGUAGE: 'Klingon' },
      'OCO_LANGUAGE "Klingon" is not supported.'
    ]
  ])('rejects %s', async (_, diff, config, error) => {
    await expect(generateCommitMessage(diff, { config })).rejects.toThrow(
      error
    );
    expect(requests).toHaveLength(0);
  });
});
