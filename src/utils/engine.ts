import { AiEngine } from '../engine/Engine';
import { OpenAi } from '../engine/openAi';
import { Gemini } from '../engine/gemini';
import { getConfig } from '../commands/config';
import { OllamaAi } from '../engine/ollama';
import { AnthropicAi } from '../engine/anthropic'
import { TestAi } from '../engine/testAi';

export function getEngine(): AiEngine {
  const config = getConfig();
  
  if (config?.OCO_AI_PROVIDER == 'ollama') {
    return new OllamaAi();
  } else if (config?.OCO_AI_PROVIDER == 'anthropic') {
    return new AnthropicAi();
  } else if (config?.OCO_AI_PROVIDER == 'test') {
    return new TestAi();
  } else if (config?.OCO_AI_PROVIDER == 'gemini') {
    return new Gemini();  
  }
  
  //open ai gpt by default
  return new OpenAi();
}
