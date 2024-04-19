import { AiEngine } from '../engine/Engine';
import { api } from '../engine/openAi';
import { getConfig } from '../commands/config';
import { ollamaAi } from '../engine/ollama';
import { azure } from '../engine/azure';

export function getEngine(): AiEngine {
  const config = getConfig();
  if (config?.OCO_AI_PROVIDER == 'ollama') {
    return ollamaAi;
  }
  if (config?.OCO_AI_PROVIDER == 'azure') {
    return azure;
  }
  //open ai gpt by default
  return api;
}
