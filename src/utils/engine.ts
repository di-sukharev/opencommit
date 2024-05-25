import { AiEngine } from '../engine/Engine';
import { api } from '../engine/openAi';
import { getConfig } from '../commands/config';
import { ollamaAi } from '../engine/ollama';
import { azure } from '../engine/azure';
import { anthropicAi } from '../engine/anthropic'
import { testAi } from '../engine/testAi';

export function getEngine(): AiEngine {
  const config = getConfig();
  const provider = config?.OCO_AI_PROVIDER;
  if (provider?.startsWith('ollama')) {
    const model = provider.split('/')[1];
    if (model) ollamaAi.setModel(model);
    
    return ollamaAi;
  } else if (config?.OCO_AI_PROVIDER == 'anthropic') {
    return anthropicAi;
  } else if (config?.OCO_AI_PROVIDER == 'test') {
    return testAi;
  } else if (config?.OCO_AI_PROVIDER == 'azure') {
    return azure;
  }
  // open ai gpt by default
  return api;
}
