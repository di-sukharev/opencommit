import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import {
  Agent,
  ProxyAgent,
  setGlobalDispatcher
} from 'undici';

export type ProxySetting = string | null | undefined;

export function resolveProxy(proxySetting?: ProxySetting): ProxySetting {
  if (proxySetting === null) {
    return null;
  }

  if (typeof proxySetting === 'string' && proxySetting.trim().length > 0) {
    return proxySetting;
  }

  return process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
}

function resetProxySetup(disableEnvProxy: boolean) {
  setGlobalDispatcher(new Agent());
  axios.defaults.httpAgent = undefined;
  axios.defaults.httpsAgent = undefined;
  axios.defaults.proxy = disableEnvProxy ? false : undefined;
}

export function setupProxy(proxySetting?: ProxySetting) {
  try {
    if (proxySetting === null) {
      resetProxySetup(true);
      return;
    }

    resetProxySetup(false);

    if (!proxySetting) {
      return;
    }

    // Set global dispatcher for undici (affects globalThis.fetch used by Gemini and others)
    const dispatcher = new ProxyAgent(proxySetting);
    setGlobalDispatcher(dispatcher);

    // Set axios global agents and disable axios built-in proxy handling.
    const agent = new HttpsProxyAgent(proxySetting);
    axios.defaults.httpAgent = agent;
    axios.defaults.httpsAgent = agent;
    axios.defaults.proxy = false;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[Proxy Error] Failed to set proxy: ${message}`);
  }
}
