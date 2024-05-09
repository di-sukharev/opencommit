import { AiEngine } from '../engine/Engine';
import { OpenAi } from '../engine/openAi';
import { Gemini } from '../engine/gemini';
import { getConfig } from '../commands/config';
import { OllamaAi } from '../engine/ollama';
import { AnthropicAi } from '../engine/anthropic'
import { TestAi } from '../engine/testAi';
import { Azure } from '../engine/azure';

export function getEngine(): AiEngine {
  const config = getConfig();
  
  if (config?.OCO_AI_PROVIDER == 'ollama') {
	const ollamaAi = new OllamaAi();
	const model = provider.split('/')[1];
    if (model) {
      ollamaAi.setModel(model);
    }
    return ollamaAi;
  } else if (config?.OCO_AI_PROVIDER == 'anthropic') {
    return new AnthropicAi();
  } else if (config?.OCO_AI_PROVIDER == 'test') {
    return new TestAi();
  } else if (config?.OCO_AI_PROVIDER == 'gemini') {
    return new Gemini();  
  } else if (config?.OCO_AI_PROVIDER == 'azure') {
  	return new Azure();
  }
  
  //open ai gpt by default
  return new OpenAi();
}
