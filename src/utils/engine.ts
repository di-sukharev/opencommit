import { getConfig } from '../commands/config';
import { AnthropicEngine } from '../engine/anthropic';
import { AzureEngine } from '../engine/azure';
import { AiEngine } from '../engine/Engine';
import { FlowiseAi } from '../engine/flowise';
import { Gemini } from '../engine/gemini';
import { OllamaAi } from '../engine/ollama';
import { OpenAiEngine } from '../engine/openAi';
import { TestAi, TestMockType } from '../engine/testAi';

export function getEngine(): AiEngine {
  const config = getConfig();
  const provider = config.OCO_AI_PROVIDER;

  const DEFAULT_CONFIG = {
    model: config.OCO_MODEL!,
    maxTokensOutput: config.OCO_TOKENS_MAX_OUTPUT!,
    maxTokensInput: config.OCO_TOKENS_MAX_INPUT!,
    basePath: config.OCO_OPENAI_BASE_PATH!
  };

  switch (provider) {
    case provider?.startsWith('ollama') && provider:
      const model = provider.substring('ollama/'.length);
      return new OllamaAi({
        ...DEFAULT_CONFIG,
        apiKey: '',
        model,
        basePath: config.OCO_OLLAMA_API_URL!
      });

    case 'anthropic':
      return new AnthropicEngine({
        ...DEFAULT_CONFIG,
        apiKey: config.OCO_ANTHROPIC_API_KEY!
      });

    case 'test':
      return new TestAi(config.OCO_TEST_MOCK_TYPE as TestMockType);

    case 'gemini':
      return new Gemini({
        apiKey: config.OCO_GEMINI_API_KEY!,
        ...DEFAULT_CONFIG
      });

    case 'azure':
      return new AzureEngine({
        apiKey: config.OCO_AZURE_API_KEY!,
        ...DEFAULT_CONFIG
      });

    case 'flowise':
      return new FlowiseAi({
        apiKey: config.OCO_FLOWISE_API_KEY!,
        model: config.OCO_MODEL!,
        maxTokensOutput: config.OCO_TOKENS_MAX_OUTPUT!,
        maxTokensInput: config.OCO_TOKENS_MAX_INPUT!
      });

    default:
      return new OpenAiEngine({
        apiKey: config.OCO_OPENAI_API_KEY!,
        model: config.OCO_MODEL!,
        maxTokensOutput: config.OCO_TOKENS_MAX_OUTPUT!,
        maxTokensInput: config.OCO_TOKENS_MAX_INPUT!
      });
  }
}
