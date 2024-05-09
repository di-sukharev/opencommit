import { ChatCompletionRequestMessage } from 'openai';
import { AiEngine } from './Engine';
import { getConfig } from '../commands/config';

export const TEST_MOCK_TYPES = [
  'commit-message',
  'prompt-module-commitlint-config',
] as const
type TestMockType = typeof TEST_MOCK_TYPES[number];

export class TestAi implements AiEngine {
  async generateCommitMessage(
    _messages: Array<ChatCompletionRequestMessage>
  ): Promise<string | undefined> {
    const config = getConfig();
    switch (config?.OCO_TEST_MOCK_TYPE as TestMockType | undefined) {
      case 'commit-message':
        return 'fix(testAi.ts): test commit message';
      case 'prompt-module-commitlint-config':
        return `{\n` +
          `  "localLanguage": "english",\n` +
          `  "commitFix": "fix(server): Change 'port' variable to uppercase 'PORT'",\n` +
          `  "commitFeat": "feat(server): Allow server to listen on a port specified through environment variable",\n` +
          `  "commitDescription": "Change 'port' variable to uppercase 'PORT'. Allow server to listen on a port specified through environment variable."\n` +
          `}`
      default:
        throw Error('unsupported test mock type')
    }
  }
}

export const testAi = new TestAi();
