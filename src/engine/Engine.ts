import { ChatCompletionRequestMessage } from 'openai';
import { MessageParam } from '@anthropic-ai/sdk/resources';

export interface AiEngine {
  generateCommitMessage(
    messages: Array<ChatCompletionRequestMessage | MessageParam>
  ): Promise<string | undefined>;
}
