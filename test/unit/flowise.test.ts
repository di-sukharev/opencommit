import { createServer } from 'http';
import { AddressInfo } from 'net';
import { FlowiseEngine } from '../../src/engine/flowise';

describe('FlowiseEngine', () => {
  it('posts the diff to the chatflow prediction URL', async () => {
    const requests: Array<{ url?: string; body: unknown }> = [];
    const server = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        requests.push({ url: req.url, body: JSON.parse(body) });
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ text: 'feat: add the flowise engine' }));
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    );
    const { port } = server.address() as AddressInfo;

    try {
      const engine = new FlowiseEngine({
        apiKey: 'chatflow-id',
        baseURL: `http://127.0.0.1:${port}/api/v1/prediction`,
        model: 'flowise',
        maxTokensInput: 4096,
        maxTokensOutput: 500
      });

      const message = await engine.generateCommitMessage([
        { role: 'system', content: 'system prompt' },
        { role: 'user', content: 'diff --git a/file b/file' }
      ]);

      expect(message).toBe('feat: add the flowise engine');
      expect(requests).toEqual([
        {
          url: '/api/v1/prediction/chatflow-id',
          body: expect.objectContaining({
            question: 'diff --git a/file b/file',
            overrideConfig: { systemMessagePrompt: 'system prompt' }
          })
        }
      ]);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
