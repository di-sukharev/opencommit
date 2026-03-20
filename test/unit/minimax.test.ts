import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  MODEL_LIST,
  OCO_AI_PROVIDER_ENUM,
  PROVIDER_API_KEY_URLS,
  RECOMMENDED_MODELS
} from '../../src/commands/config';
import {
  PROVIDER_BILLING_URLS,
  getRecommendedModel,
  getSuggestedModels
} from '../../src/utils/errors';

// Mock @clack/prompts to prevent process.exit calls
jest.mock('@clack/prompts', () => ({
  intro: jest.fn(),
  outro: jest.fn()
}));

const testDir = dirname(fileURLToPath(import.meta.url));

function readSource(relPath: string): string {
  return readFileSync(join(testDir, relPath), 'utf8');
}

describe('MiniMax Provider', () => {
  describe('Engine file structure', () => {
    it('should have a minimax.ts engine file', () => {
      const enginePath = join(testDir, '../../src/engine/minimax.ts');
      expect(existsSync(enginePath)).toBe(true);
    });

    it('should export MiniMaxEngine extending OpenAiEngine', () => {
      const content = readSource('../../src/engine/minimax.ts');
      expect(content).toContain('export class MiniMaxEngine extends OpenAiEngine');
      expect(content).toContain('export interface MiniMaxConfig extends OpenAiConfig');
    });

    it('should use MiniMax API base URL', () => {
      const content = readSource('../../src/engine/minimax.ts');
      expect(content).toContain("baseURL: 'https://api.minimax.io/v1'");
    });

    it('should use low temperature for deterministic output', () => {
      const content = readSource('../../src/engine/minimax.ts');
      expect(content).toContain('temperature: 0.01');
    });

    it('should strip think tags from response', () => {
      const content = readSource('../../src/engine/minimax.ts');
      expect(content).toContain("removeContentTags(content, 'think')");
    });

    it('should normalize errors with minimax provider name', () => {
      const content = readSource('../../src/engine/minimax.ts');
      expect(content).toContain("normalizeEngineError(error, 'minimax'");
    });

    it('should handle token count validation', () => {
      const content = readSource('../../src/engine/minimax.ts');
      expect(content).toContain('GenerateCommitMessageErrorEnum.tooMuchTokens');
      expect(content).toContain('tokenCount');
    });

    it('should allow user baseURL to override default via spread', () => {
      const content = readSource('../../src/engine/minimax.ts');
      // The pattern: baseURL first, then ...config, so user config overrides
      expect(content).toContain("baseURL: 'https://api.minimax.io/v1'");
      expect(content).toContain('...config');
    });
  });

  describe('Config Integration', () => {
    it('should have MINIMAX in OCO_AI_PROVIDER_ENUM', () => {
      expect(OCO_AI_PROVIDER_ENUM.MINIMAX).toBe('minimax');
    });

    it('should have MiniMax models in MODEL_LIST', () => {
      expect(MODEL_LIST.minimax).toBeDefined();
      expect(MODEL_LIST.minimax).toContain('MiniMax-M2.7');
      expect(MODEL_LIST.minimax).toContain('MiniMax-M2.5');
      expect(MODEL_LIST.minimax).toContain('MiniMax-M2.5-highspeed');
    });

    it('should have correct number of MiniMax models', () => {
      expect(MODEL_LIST.minimax.length).toBe(3);
    });

    it('should have MiniMax in PROVIDER_API_KEY_URLS', () => {
      expect(PROVIDER_API_KEY_URLS[OCO_AI_PROVIDER_ENUM.MINIMAX]).toBeDefined();
      expect(typeof PROVIDER_API_KEY_URLS[OCO_AI_PROVIDER_ENUM.MINIMAX]).toBe('string');
    });

    it('should have MiniMax in RECOMMENDED_MODELS', () => {
      expect(RECOMMENDED_MODELS[OCO_AI_PROVIDER_ENUM.MINIMAX]).toBe('MiniMax-M2.7');
    });

    it('should have MiniMax recommended model in MODEL_LIST', () => {
      const recommended = RECOMMENDED_MODELS[OCO_AI_PROVIDER_ENUM.MINIMAX];
      expect(MODEL_LIST.minimax).toContain(recommended);
    });

    it('should have M2.7 as first model (default)', () => {
      expect(MODEL_LIST.minimax[0]).toBe('MiniMax-M2.7');
    });

    it('should include minimax in provider validator', () => {
      const content = readSource('../../src/commands/config.ts');
      // Check the validator includes minimax
      const validatorSection = content.slice(
        content.indexOf('[CONFIG_KEYS.OCO_AI_PROVIDER]'),
        content.indexOf('[CONFIG_KEYS.OCO_AI_PROVIDER]') + 500
      );
      expect(validatorSection).toContain("'minimax'");
    });

    it('should have minimax in getDefaultModel switch', () => {
      const content = readSource('../../src/commands/config.ts');
      expect(content).toContain("case 'minimax':");
      expect(content).toContain('MODEL_LIST.minimax[0]');
    });
  });

  describe('Engine Factory Integration', () => {
    it('should import MiniMaxEngine', () => {
      const content = readSource('../../src/utils/engine.ts');
      expect(content).toContain("import { MiniMaxEngine } from '../engine/minimax'");
    });

    it('should have minimax case in engine switch', () => {
      const content = readSource('../../src/utils/engine.ts');
      expect(content).toContain('case OCO_AI_PROVIDER_ENUM.MINIMAX:');
      expect(content).toContain('new MiniMaxEngine(DEFAULT_CONFIG)');
    });
  });

  describe('Error Integration', () => {
    it('should have MiniMax in PROVIDER_BILLING_URLS', () => {
      expect(PROVIDER_BILLING_URLS[OCO_AI_PROVIDER_ENUM.MINIMAX]).toBeDefined();
      expect(typeof PROVIDER_BILLING_URLS[OCO_AI_PROVIDER_ENUM.MINIMAX]).toBe('string');
    });

    it('should return MiniMax-M2.7 as recommended model', () => {
      expect(getRecommendedModel(OCO_AI_PROVIDER_ENUM.MINIMAX)).toBe('MiniMax-M2.7');
    });

    it('should return MiniMax model suggestions excluding failed model', () => {
      const suggestions = getSuggestedModels(OCO_AI_PROVIDER_ENUM.MINIMAX, 'MiniMax-M2.7');
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions).not.toContain('MiniMax-M2.7');
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should return all models when no model is excluded', () => {
      const suggestions = getSuggestedModels(OCO_AI_PROVIDER_ENUM.MINIMAX, 'nonexistent-model');
      expect(suggestions.length).toBe(3);
    });

    it('should have minimax case in getRecommendedModel', () => {
      const content = readSource('../../src/utils/errors.ts');
      expect(content).toContain('case OCO_AI_PROVIDER_ENUM.MINIMAX:');
    });
  });

  describe('Setup Integration', () => {
    it('should have MiniMax in provider display names', () => {
      const content = readSource('../../src/commands/setup.ts');
      expect(content).toContain('[OCO_AI_PROVIDER_ENUM.MINIMAX]');
      expect(content).toContain('MiniMax');
    });

    it('should be listed in OTHER_PROVIDERS', () => {
      const content = readSource('../../src/commands/setup.ts');
      // Check OTHER_PROVIDERS array contains MINIMAX
      const otherSection = content.slice(
        content.indexOf('OTHER_PROVIDERS'),
        content.indexOf('OTHER_PROVIDERS') + 500
      );
      expect(otherSection).toContain('OCO_AI_PROVIDER_ENUM.MINIMAX');
    });
  });

  describe('Model Cache Integration', () => {
    it('should have fetchMiniMaxModels function', () => {
      const content = readSource('../../src/utils/modelCache.ts');
      expect(content).toContain('export async function fetchMiniMaxModels');
      expect(content).toContain('https://api.minimax.io/v1/models');
    });

    it('should have MiniMax case in fetchModelsForProvider', () => {
      const content = readSource('../../src/utils/modelCache.ts');
      expect(content).toContain('case OCO_AI_PROVIDER_ENUM.MINIMAX:');
      expect(content).toContain('fetchMiniMaxModels');
    });

    it('should filter MiniMax models by prefix', () => {
      const content = readSource('../../src/utils/modelCache.ts');
      expect(content).toContain("id.startsWith('MiniMax-')");
    });

    it('should fall back to MODEL_LIST.minimax on error', () => {
      const content = readSource('../../src/utils/modelCache.ts');
      expect(content).toContain('MODEL_LIST.minimax');
    });
  });

  describe('README', () => {
    it('should mention minimax as a provider option', () => {
      const content = readSource('../../README.md');
      expect(content).toContain('minimax');
    });

    it('should show minimax config example', () => {
      const content = readSource('../../README.md');
      expect(content).toContain('OCO_AI_PROVIDER=minimax');
    });
  });
});
