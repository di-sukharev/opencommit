import { ChatCompletionRequestMessage } from 'openai';
import { AiEngine } from './Engine';

export class TestAi implements AiEngine {
  async generateCommitMessage(
    messages: Array<ChatCompletionRequestMessage>
  ): Promise<string | undefined> {
    return 'test commit message';
  }
}

export const testAi = new TestAi();
