import { AiEngine } from '../engine/Engine';
import { api } from '../engine/openAi';
import { getConfig } from '../commands/config';
import { ollamaAi } from '../engine/ollama';

export function getEngine(): AiEngine {
  const config = getConfig();
  const provider = config?.OCO_AI_PROVIDER;
  if (provider?.startsWith('ollama')) {
    const model = provider.split('/')[1];
    if (model) {
      ollamaAi.setModel(model);
    }
    return ollamaAi;
  }
  // open ai gpt by default
  return api;
}
