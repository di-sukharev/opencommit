import { OpenAiConfig, OpenAiEngine } from './openAi';

interface GroqConfig extends OpenAiConfig {}

export class GroqEngine extends OpenAiEngine {
  constructor(config: GroqConfig) {
    config.baseURL = 'https://api.groq.com/openai/v1';
    super(config);
  }
}