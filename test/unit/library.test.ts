import { createServer, IncomingMessage, Server } from 'http';
import { AddressInfo, connect } from 'net';
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
    ],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
  }
});

const PROXIED_MESSAGE = 'fix(server): rename port';

// Nothing listens on the discard port, so a request to it fails locally.
const CLOSED_URL = 'http://127.0.0.1:9';

const PROVIDER_RESPONSES = {
  openai: completion(PROXIED_MESSAGE),
  mistral: completion(PROXIED_MESSAGE),
  anthropic: {
    status: 200,
    body: {
      id: 'msg-test',
      type: 'message',
      role: 'assistant',
      model: 'test-model',
      content: [{ type: 'text', text: PROXIED_MESSAGE }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 1 }
    }
  },
  ollama: {
    status: 200,
    body: { message: { role: 'assistant', content: PROXIED_MESSAGE } }
  }
};

// A forward proxy double. It tunnels CONNECT requests to local targets and
// rejects all other requests. It records the target of each request.
const startProxy = async () => {
  const targets: string[] = [];
  const proxy = createServer((request, response) => {
    targets.push(request.url!);
    response.writeHead(502).end();
  });
  proxy.on('connect', (request, client, head) => {
    targets.push(request.url!);
    const [host, port] = request.url!.split(':');
    if (host !== '127.0.0.1') {
      client.end('HTTP/1.1 403 Forbidden\r\n\r\n');
      return;
    }
    const target = connect(Number(port), host, () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      target.write(head);
      target.pipe(client).pipe(target);
    });
    target.on('error', () => client.destroy());
    client.on('error', () => target.destroy());
  });
  await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve));

  return {
    targets,
    url: `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`,
    close: () => {
      proxy.closeAllConnections();
      return new Promise((resolve) => proxy.close(resolve));
    }
  };
};

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
  let apiHost: string;
  let proxy: Awaited<ReturnType<typeof startProxy>>;
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
    apiHost = `127.0.0.1:${(server.address() as AddressInfo).port}`;
    apiUrl = `http://${apiHost}/v1`;
    proxy = await startProxy();
  });

  afterAll(async () => {
    await proxy.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    requests.length = 0;
    proxy.targets.length = 0;
    respond = () => completion('fix(server): rename port');
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it('passes a final-line edit diff with the no-newline marker through to the model input', async () => {
    // Issue #427: a small last-line change whose long unchanged context line
    // dominated the generated commit message. This pins the input contract:
    // the raw diff reaches the model verbatim (marker included) and the
    // system prompt tells the model to describe only changed lines.
    const FINAL_LINE_EDIT_DIFF = `diff --git a/.aliases b/.aliases
index 1111111..2222222 100644
--- a/.aliases
+++ b/.aliases
@@ -1,2 +1,2 @@
 alias velero-makecontainer='make container'
-alias restart-displaylink='echo old'
+alias restart-displaylink='osascript -e "quit app DisplayLink"'
\\ No newline at end of file
`;

    await generateCommitMessage(FINAL_LINE_EDIT_DIFF, {
      config: {
        OCO_AI_PROVIDER: 'openai',
        OCO_API_KEY: 'library-key',
        OCO_API_URL: apiUrl,
        OCO_MODEL: 'library-model'
      }
    });

    expect(requests).toHaveLength(1);
    const [{ body }] = requests;
    expect(body.messages.at(-1)).toEqual({
      role: 'user',
      content: FINAL_LINE_EDIT_DIFF
    });
    const systemPrompt = body.messages[0].content;
    expect(systemPrompt).toContain('lines that start with + or -');
    expect(systemPrompt).toContain('unchanged context');
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

  it.each(Object.entries(PROVIDER_RESPONSES))(
    'sends %s requests through OCO_PROXY',
    async (provider, response) => {
      respond = () => response;

      const message = await generateCommitMessage(DIFF, {
        config: {
          OCO_AI_PROVIDER: provider,
          OCO_API_KEY: 'library-key',
          OCO_API_URL: apiUrl,
          OCO_PROXY: proxy.url
        }
      });

      expect(message).toBe(PROXIED_MESSAGE);
      expect(proxy.targets).toEqual([apiHost]);
      expect(requests).toHaveLength(1);
    }
  );

  it('does not use HTTP_PROXY when OCO_PROXY is null', async () => {
    process.env.HTTP_PROXY = proxy.url;
    respond = () => PROVIDER_RESPONSES.ollama;

    await generateCommitMessage(DIFF, {
      config: {
        OCO_AI_PROVIDER: 'ollama',
        OCO_API_URL: apiUrl,
        OCO_PROXY: null
      }
    });

    expect(proxy.targets).toEqual([]);
    expect(requests).toHaveLength(1);
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
    ],
    ...['gemini', 'azure'].map((provider) => [
      `OCO_PROXY with the ${provider} provider`,
      DIFF,
      {
        OCO_AI_PROVIDER: provider,
        OCO_API_URL: CLOSED_URL,
        OCO_PROXY: CLOSED_URL
      },
      `OCO_PROXY is not supported with OCO_AI_PROVIDER "${provider}".`
    ])
  ])('rejects %s', async (_, diff, config, error) => {
    await expect(generateCommitMessage(diff, { config })).rejects.toThrow(
      error
    );
    expect(requests).toHaveLength(0);
  });
});
