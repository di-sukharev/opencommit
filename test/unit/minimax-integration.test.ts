import { OpenAI } from 'openai';

// Mock @clack/prompts to prevent process.exit calls
jest.mock('@clack/prompts', () => ({
  intro: jest.fn(),
  outro: jest.fn()
}));

/**
 * Integration tests for MiniMax engine.
 * These tests verify the MiniMax API works correctly via OpenAI-compatible SDK.
 * This mirrors the exact behavior of MiniMaxEngine which extends OpenAiEngine.
 *
 * Run with: MINIMAX_API_KEY=<key> npm run test -- test/unit/minimax-integration.test.ts
 */
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
const describeIntegration = MINIMAX_API_KEY ? describe : describe.skip;

describeIntegration('MiniMax Integration (requires MINIMAX_API_KEY)', () => {
  let client: OpenAI;

  beforeAll(() => {
    client = new OpenAI({
      apiKey: MINIMAX_API_KEY!,
      baseURL: 'https://api.minimax.io/v1'
    });
  });

  it('should generate a commit message with M2.7', async () => {
    const completion = await client.chat.completions.create({
      model: 'MiniMax-M2.7',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert at writing concise, meaningful git commit messages. Generate a conventional commit message for the provided code diff. Output only the commit message, nothing else.'
        },
        {
          role: 'user',
          content: `diff --git a/src/utils.ts b/src/utils.ts
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -10,6 +10,10 @@ export function formatDate(date: Date): string {
   return date.toISOString();
 }

+export function formatCurrency(amount: number, currency: string = 'USD'): string {
+  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
+}
+
 export function capitalize(str: string): string {`
        }
      ],
      temperature: 0.01,
      top_p: 0.1,
      max_tokens: 500
    });

    const content = completion.choices[0].message?.content;
    expect(content).toBeDefined();
    expect(typeof content).toBe('string');
    expect(content!.length).toBeGreaterThan(0);
  }, 30000);

  it('should generate commit message with M2.5-highspeed', async () => {
    const completion = await client.chat.completions.create({
      model: 'MiniMax-M2.5-highspeed',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert at writing concise git commit messages. Generate a conventional commit message. Output only the commit message.'
        },
        {
          role: 'user',
          content: `diff --git a/README.md b/README.md
--- a/README.md
+++ b/README.md
@@ -1,3 +1,5 @@
 # My Project

 A simple project.
+
+## Installation`
        }
      ],
      temperature: 0.01,
      top_p: 0.1,
      max_tokens: 500
    });

    const content = completion.choices[0].message?.content;
    expect(content).toBeDefined();
    expect(typeof content).toBe('string');
    expect(content!.length).toBeGreaterThan(0);
  }, 30000);

  it('should handle authentication error with invalid API key', async () => {
    const badClient = new OpenAI({
      apiKey: 'invalid-api-key',
      baseURL: 'https://api.minimax.io/v1'
    });

    await expect(
      badClient.chat.completions.create({
        model: 'MiniMax-M2.7',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 10
      })
    ).rejects.toThrow();
  }, 30000);
});
