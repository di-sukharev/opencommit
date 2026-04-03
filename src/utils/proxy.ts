import { setGlobalDispatcher, ProxyAgent } from 'undici';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

export function setupProxy(proxyUrl?: string) {
  const proxy = proxyUrl || process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (proxy) {
    try {
      // Set global dispatcher for undici (affects globalThis.fetch used by Gemini and others)
      const dispatcher = new ProxyAgent(proxy);
      setGlobalDispatcher(dispatcher);

      // Set axios global agent
      const agent = new HttpsProxyAgent(proxy);
      axios.defaults.httpsAgent = agent;
      axios.defaults.proxy = false; // Disable axios built-in proxy handling to use agent
    } catch (error) {
      console.warn(`[Proxy Error] Failed to set proxy: ${error.message}`);
    }
  }
}
