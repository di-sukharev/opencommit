import * as followRedirects from 'follow-redirects';
import { getConfig, OCO_AI_PROVIDER_ENUM } from '../commands/config';

import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import tls from 'node:tls';
import * as fs from 'node:fs';
import { globalAgent } from 'https';
const { http, https } = (followRedirects as any).default;
import { Agent } from 'agent-base';

function isDefinedAndNotEmpty(variable) {
  return typeof variable !== 'undefined' && variable.length > 0;
}

export function getHttpAgent(url_: URL | string): Agent {
  const TIMEOUT = 7200; // 7200 seconds = 2 hours

  const config = getConfig();

  let url = url_;
  if (typeof url === 'string') {
    url = new URL(url);
  }

  let globalCerts: string[] = [];
  if (process.env.IS_BINARY) {
    if (Array.isArray(globalAgent.options.ca)) {
      globalCerts = [...globalAgent.options.ca.map((cert) => cert.toString())];
    } else if (typeof globalAgent.options.ca !== 'undefined') {
      globalCerts.push(globalAgent.options.ca.toString());
    }
  }
  const ca = Array.from(new Set([...tls.rootCertificates, ...globalCerts]));

  const customCerts = config.OCO_HTTP_CA_BUNDLE;
  if (isDefinedAndNotEmpty(customCerts)) {
    ca.push(
      ...customCerts.split(",").map((customCert) => fs.readFileSync(customCert, 'utf8'))
    );
  }

  const timeout = (config.OCO_HTTP_TIMEOUT ?? TIMEOUT) * 1000; // measured in ms

  const agentOptions: { [key: string]: any } = {
    ca,
    rejectUnauthorized: config.OCO_HTTP_VERIFY_SSL,
    timeout,
    sessionTimeout: timeout,
    keepAlive: true,
    keepAliveMsecs: timeout
  };

  // Handle ClientCertificateOptions
  if (
    isDefinedAndNotEmpty(config.OCO_HTTP_CLIENT_CERTIFICATE_CERT) &&
    isDefinedAndNotEmpty(config.OCO_HTTP_CLIENT_CERTIFICATE_KEY)
  ) {
    agentOptions.cert = fs.readFileSync(
      config.OCO_HTTP_CLIENT_CERTIFICATE_CERT,
      'utf8'
    );
    agentOptions.key = fs.readFileSync(
      config.OCO_HTTP_CLIENT_CERTIFICATE_KEY,
      'utf8'
    );
    if (isDefinedAndNotEmpty(config.OCO_HTTP_CLIENT_CERTIFICATE_PASSPHRASE)) {
      agentOptions.passphrase =
        config.OCO_HTTP_CLIENT_CERTIFICATE_PASSPHRASE.length;
    }
  }

  const proxy = config.OCO_HTTP_PROXY;
  // Create agent
  const protocol = url.protocol === 'https:' ? https : http;
  const agent =
    isDefinedAndNotEmpty(proxy)
      ? protocol === https
        ? new HttpsProxyAgent(proxy, agentOptions)
        : new HttpProxyAgent(proxy, agentOptions)
      : new protocol.Agent(agentOptions);

  return agent;
}
