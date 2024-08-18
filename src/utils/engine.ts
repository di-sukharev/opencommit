import { AiEngine } from '../engine/Engine';
import { OpenAi } from '../engine/openAi';
import { Gemini } from '../engine/gemini';
import { getConfig } from '../commands/config';
import { OllamaAi } from '../engine/ollama';
import { AnthropicAi } from '../engine/anthropic'
import { TestAi } from '../engine/testAi';
import { Azure } from '../engine/azure';
import { FlowiseAi } from '../engine/flowise'

export function getEngine(): AiEngine {
  const config = getConfig();
  const provider = config?.OCO_AI_PROVIDER;
  
  if (provider?.startsWith('ollama')) {
    const ollamaAi = new OllamaAi();
    const model = provider.substring('ollama/'.length);
    if (model) {
      ollamaAi.setModel(model);
      ollamaAi.setUrl(config?.OCO_OLLAMA_API_URL);
    }
    return ollamaAi;
  } else if (provider == 'anthropic') {
    return new AnthropicAi();
  } else if (provider == 'test') {
    return new TestAi();
  } else if (provider == 'gemini') {
    return new Gemini();  
  } else if (provider == 'azure') {
  	return new Azure();
  } else if( provider == 'flowise'){
    return new FlowiseAi();
  }
  
  //open ai gpt by default
  return new OpenAi();
}
