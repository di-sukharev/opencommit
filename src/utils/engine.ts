import { getConfig, OCO_AI_PROVIDER_ENUM } from '../commands/config';
import { AnthropicEngine } from '../engine/anthropic';
import { AzureEngine } from '../engine/azure';
import { AiEngine } from '../engine/Engine';
import { FlowiseEngine } from '../engine/flowise';
import { GeminiEngine } from '../engine/gemini';
import { OllamaEngine } from '../engine/ollama';
import { OpenAiEngine } from '../engine/openAi';
import { TestAi, TestMockType } from '../engine/testAi';
import { GroqEngine } from '../engine/groq';

export function getEngine(): AiEngine {
  const config = getConfig();
  const provider = config.OCO_AI_PROVIDER;

  const DEFAULT_CONFIG = {
    model: config.OCO_MODEL!,
    maxTokensOutput: config.OCO_TOKENS_MAX_OUTPUT!,
    maxTokensInput: config.OCO_TOKENS_MAX_INPUT!,
    baseURL: config.OCO_API_URL!,
    apiKey: config.OCO_API_KEY!
  };

  switch (provider) {
    case OCO_AI_PROVIDER_ENUM.OLLAMA:
      return new OllamaEngine(DEFAULT_CONFIG);

    case OCO_AI_PROVIDER_ENUM.ANTHROPIC:
      return new AnthropicEngine(DEFAULT_CONFIG);

    case OCO_AI_PROVIDER_ENUM.TEST:
      return new TestAi(config.OCO_TEST_MOCK_TYPE as TestMockType);

    case OCO_AI_PROVIDER_ENUM.GEMINI:
      return new GeminiEngine(DEFAULT_CONFIG);

    case OCO_AI_PROVIDER_ENUM.AZURE:
      return new AzureEngine(DEFAULT_CONFIG);

    case OCO_AI_PROVIDER_ENUM.FLOWISE:
      return new FlowiseEngine(DEFAULT_CONFIG);

    case OCO_AI_PROVIDER_ENUM.GROQ:
      return new GroqEngine(DEFAULT_CONFIG);

    default:
      return new OpenAiEngine(DEFAULT_CONFIG);
  }
}
