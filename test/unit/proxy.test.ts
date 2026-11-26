import axios from 'axios';
import { getGlobalDispatcher } from 'undici';
import { AnthropicEngine } from '../../src/engine/anthropic';
import { OpenAiEngine } from '../../src/engine/openAi';
import { resolveProxy, setupProxy } from '../../src/utils/proxy';

describe('proxy utilities', () => {
  const originalEnv = { ...process.env };
  const originalAxiosProxy = axios.defaults.proxy;
  const originalAxiosHttpAgent = axios.defaults.httpAgent;
  const originalAxiosHttpsAgent = axios.defaults.httpsAgent;

  function resetEnv(env: NodeJS.ProcessEnv) {
    Object.keys(process.env).forEach((key) => {
      if (!(key in env)) {
        delete process.env[key];
      } else {
        process.env[key] = env[key];
      }
    });
  }

  beforeEach(() => {
    resetEnv(originalEnv);
    setupProxy(undefined);
  });

  afterEach(() => {
    resetEnv(originalEnv);
    setupProxy(undefined);
    axios.defaults.proxy = originalAxiosProxy;
    axios.defaults.httpAgent = originalAxiosHttpAgent;
    axios.defaults.httpsAgent = originalAxiosHttpsAgent;
  });

  it('should prefer an explicit proxy URL over ambient proxy env vars', () => {
    process.env.HTTPS_PROXY = 'http://ambient-proxy:8080';

    expect(resolveProxy('http://explicit-proxy:8080')).toEqual(
      'http://explicit-proxy:8080'
    );
  });

  it('should return null when proxy is explicitly disabled', () => {
    process.env.HTTPS_PROXY = 'http://ambient-proxy:8080';

    expect(resolveProxy(null)).toEqual(null);
  });

  it('should fall back to ambient proxy env vars when proxy is unset', () => {
    process.env.HTTPS_PROXY = 'http://ambient-proxy:8080';

    expect(resolveProxy(undefined)).toEqual('http://ambient-proxy:8080');
  });

  it('should disable proxy usage when setupProxy receives null', () => {
    process.env.HTTPS_PROXY = 'http://ambient-proxy:8080';

    setupProxy(null);

    expect(getGlobalDispatcher().constructor.name).toEqual('Agent');
    expect(axios.defaults.proxy).toEqual(false);
    expect(axios.defaults.httpAgent).toBeUndefined();
    expect(axios.defaults.httpsAgent).toBeUndefined();
  });

  it('should install proxy agents when setupProxy receives a proxy URL', () => {
    setupProxy('http://127.0.0.1:7890');

    expect(getGlobalDispatcher().constructor.name).toEqual('ProxyAgent');
    expect(axios.defaults.proxy).toEqual(false);
    expect(axios.defaults.httpAgent).toBeDefined();
    expect(axios.defaults.httpsAgent).toBeDefined();
  });
});

describe('engine proxy handling', () => {
  const originalEnv = { ...process.env };
  const baseConfig = {
    apiKey: 'test-key',
    model: 'gpt-4o-mini',
    maxTokensInput: 4096,
    maxTokensOutput: 256
  };

  function resetEnv(env: NodeJS.ProcessEnv) {
    Object.keys(process.env).forEach((key) => {
      if (!(key in env)) {
        delete process.env[key];
      } else {
        process.env[key] = env[key];
      }
    });
  }

  beforeEach(() => {
    resetEnv(originalEnv);
  });

  afterEach(() => {
    resetEnv(originalEnv);
  });

  it('should not let OpenAI engine re-read proxy env vars when proxy is unset', () => {
    process.env.HTTPS_PROXY = 'http://ambient-proxy:8080';

    const engine = new OpenAiEngine({
      ...baseConfig,
      proxy: undefined
    });

    expect(engine.client.httpAgent).toBeUndefined();
  });

  it('should not let Anthropic engine re-read proxy env vars when proxy is unset', () => {
    process.env.HTTPS_PROXY = 'http://ambient-proxy:8080';

    const engine = new AnthropicEngine({
      ...baseConfig,
      model: 'claude-sonnet-4-20250514',
      proxy: undefined
    });

    expect(engine.client.httpAgent).toBeUndefined();
  });
});
