import { getConfig, OCO_AI_PROVIDER_ENUM } from '../commands/config';
import { AnthropicEngine } from '../engine/anthropic';
import { AzureEngine } from '../engine/azure';
import { AiEngine } from '../engine/Engine';
import { FlowiseEngine } from '../engine/flowise';
import { GeminiEngine } from '../engine/gemini';
import { OllamaEngine } from '../engine/ollama';
import { OpenAiEngine } from '../engine/openAi';
import { TestAi, TestMockType } from '../engine/testAi';

export function getEngine(): AiEngine {
  const config = getConfig();
  const provider = config.OCO_AI_PROVIDER;

  const DEFAULT_CONFIG = {
    model: config.OCO_MODEL!,
    maxTokensOutput: config.OCO_TOKENS_MAX_OUTPUT!,
    maxTokensInput: config.OCO_TOKENS_MAX_INPUT!,
    baseURL: config.OCO_OPENAI_BASE_PATH!
  };

  switch (provider) {
    case OCO_AI_PROVIDER_ENUM.OLLAMA:
      return new OllamaEngine({
        ...DEFAULT_CONFIG,
        apiKey: '',
        baseURL: config.OCO_OLLAMA_API_URL!
      });

    case OCO_AI_PROVIDER_ENUM.ANTHROPIC:
      return new AnthropicEngine({
        ...DEFAULT_CONFIG,
        apiKey: config.OCO_ANTHROPIC_API_KEY!
      });

    case OCO_AI_PROVIDER_ENUM.TEST:
      return new TestAi(config.OCO_TEST_MOCK_TYPE as TestMockType);

    case OCO_AI_PROVIDER_ENUM.GEMINI:
      return new GeminiEngine({
        ...DEFAULT_CONFIG,
        apiKey: config.OCO_GEMINI_API_KEY!,
        baseURL: config.OCO_GEMINI_BASE_PATH!
      });

    case OCO_AI_PROVIDER_ENUM.AZURE:
      return new AzureEngine({
        ...DEFAULT_CONFIG,
        apiKey: config.OCO_AZURE_API_KEY!
      });

    case OCO_AI_PROVIDER_ENUM.FLOWISE:
      return new FlowiseEngine({
        ...DEFAULT_CONFIG,
        baseURL: config.OCO_FLOWISE_ENDPOINT || DEFAULT_CONFIG.baseURL,
        apiKey: config.OCO_FLOWISE_API_KEY!
      });

    default:
      return new OpenAiEngine({
        ...DEFAULT_CONFIG,
        apiKey: config.OCO_OPENAI_API_KEY!
      });
  }
}
