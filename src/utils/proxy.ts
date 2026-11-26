import axios, { AxiosRequestConfig } from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { Agent, ProxyAgent, setGlobalDispatcher } from 'undici';

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

// Engines apply the proxy to their own clients, so a library call does not
// change the global state of the host process. The CLI also calls
// `setupProxy` for the requests outside the engines.

/**
 * Returns a fetch that sends requests through the proxy. Without a proxy, it
 * uses the default dispatcher. It resolves globalThis.fetch at call time.
 */
export function createProxyFetch(proxySetting: ProxySetting): typeof fetch {
  const dispatcher = proxySetting ? new ProxyAgent(proxySetting) : undefined;

  return (input, init) =>
    globalThis.fetch(input, { ...init, dispatcher } as RequestInit);
}

/**
 * Returns the axios options that send requests through the proxy. A null
 * proxy also stops axios from reading HTTP_PROXY and HTTPS_PROXY.
 */
export function getAxiosProxyOptions(
  proxySetting: ProxySetting
): AxiosRequestConfig {
  if (proxySetting === null) {
    return { proxy: false };
  }

  if (!proxySetting) {
    return {};
  }

  const agent = new HttpsProxyAgent(proxySetting);
  return { httpAgent: agent, httpsAgent: agent, proxy: false };
}

export function setupProxy(proxySetting?: ProxySetting) {
  try {
    // The global dispatcher of undici affects globalThis.fetch.
    setGlobalDispatcher(
      proxySetting ? new ProxyAgent(proxySetting) : new Agent()
    );

    Object.assign(
      axios.defaults,
      { httpAgent: undefined, httpsAgent: undefined, proxy: undefined },
      getAxiosProxyOptions(proxySetting)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[Proxy Error] Failed to set proxy: ${message}`);
  }
}
