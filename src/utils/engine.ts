import { AiEngine } from '../engine/Engine';
import { getConfig } from '../commands/config';
import * as engines from '../engine';

export function getEngine(): AiEngine {
  const config = getConfig();
  
  if (config?.OCO_AI_PROVIDER == 'ollama') {
    return new engines.OllamaAi();
  } else if (config?.OCO_AI_PROVIDER == 'gemini') {
    return new engines.GeminiAi();
  }
  
  //open ai gpt by default
  return new engines.OpenAi();
}
