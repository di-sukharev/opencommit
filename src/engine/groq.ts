import { OpenAiConfig, OpenAiEngine } from './openAi';

interface GroqConfig extends OpenAiConfig {}

// Groq serves OpenAI's gpt-oss models as reasoning models: their reasoning
// counts toward the completion token limit.
export const isGroqReasoningModel = (model: string): boolean =>
  /^openai\/gpt-oss/.test(model);

export class GroqEngine extends OpenAiEngine {
  constructor(config: GroqConfig) {
    config.baseURL = 'https://api.groq.com/openai/v1';
    if (
      typeof config.isReasoning !== 'boolean' &&
      isGroqReasoningModel(config.model)
    ) {
      config.isReasoning = true;
    }
    super(config);
  }
}
