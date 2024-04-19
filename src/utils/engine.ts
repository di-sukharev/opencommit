import { AiEngine } from '../engine/Engine';
import { api } from '../engine/openAi';
import { getConfig } from '../commands/config';
import { ollamaAi } from '../engine/ollama';

export function getEngine(): AiEngine {
  const config = getConfig();
  if (config?.OCO_AI_PROVIDER == 'ollama') {
    return ollamaAi;
  }
  //open ai gpt by default
  return api;
}
