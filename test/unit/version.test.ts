import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'fs';
import { tmpdir } from 'os';
import { join as pathJoin } from 'path';

import {
  getOpenCommitLatestVersion,
  resolveLatestVersion,
  VERSION_CACHE_FAILURE_TTL_MS,
  VERSION_CACHE_TTL_MS
} from '../../src/version';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('getOpenCommitLatestVersion', () => {
  it('fetches the latest version from the public npm registry', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: '3.3.9' })
    }) as typeof fetch;

    await expect(getOpenCommitLatestVersion()).resolves.toBe('3.3.9');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://registry.npmjs.org/opencommit/latest',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('returns undefined when the registry request fails', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false
    }) as typeof fetch;

    await expect(getOpenCommitLatestVersion()).resolves.toBeUndefined();
  });

  it('returns undefined when the registry request throws', async () => {
    globalThis.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network error')) as typeof fetch;

    await expect(getOpenCommitLatestVersion()).resolves.toBeUndefined();
  });

  it('gives up quickly when the registry never responds', async () => {
    // Simulates a hanging connection (e.g. offline with a slow DNS timeout):
    // the request only settles when its abort signal fires.
    globalThis.fetch = jest.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason)
          );
        })
    ) as unknown as typeof fetch;

    const startedAt = Date.now();

    await expect(getOpenCommitLatestVersion(50)).resolves.toBeUndefined();
    expect(Date.now() - startedAt).toBeLessThan(1000);
  });
});

describe('resolveLatestVersion', () => {
  let cacheDir: string;
  let cachePath: string;

  const mockRegistryVersion = (version: string) => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version })
    }) as typeof fetch;
  };

  beforeEach(() => {
    cacheDir = mkdtempSync(pathJoin(tmpdir(), 'oco-version-'));
    cachePath = pathJoin(cacheDir, 'version.json');
  });

  afterEach(() => {
    rmSync(cacheDir, { recursive: true, force: true });
  });

  it('caches a successful check and skips the network next time', async () => {
    mockRegistryVersion('3.3.11');

    await expect(
      resolveLatestVersion({ currentVersion: '3.3.10', cachePath })
    ).resolves.toBe('3.3.11');
    await expect(
      resolveLatestVersion({ currentVersion: '3.3.10', cachePath })
    ).resolves.toBe('3.3.11');

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  const mockRegistryOffline = () => {
    globalThis.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network error')) as typeof fetch;
  };

  it('remembers a failed check so offline runs skip the network', async () => {
    mockRegistryOffline();

    await expect(
      resolveLatestVersion({ currentVersion: '3.3.10', cachePath })
    ).resolves.toBeUndefined();
    await expect(
      resolveLatestVersion({ currentVersion: '3.3.10', cachePath })
    ).resolves.toBeUndefined();

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries a failed check once the failure window has passed', async () => {
    writeFileSync(
      cachePath,
      JSON.stringify({
        timestamp: Date.now() - VERSION_CACHE_FAILURE_TTL_MS - 1,
        ok: false,
        currentVersion: '3.3.10'
      })
    );
    mockRegistryVersion('3.3.11');

    await expect(
      resolveLatestVersion({ currentVersion: '3.3.10', cachePath })
    ).resolves.toBe('3.3.11');

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back to the last known version when offline', async () => {
    writeFileSync(
      cachePath,
      JSON.stringify({
        timestamp: Date.now() - VERSION_CACHE_TTL_MS - 1,
        ok: true,
        currentVersion: '3.3.10',
        latestVersion: '3.3.11'
      })
    );
    mockRegistryOffline();

    await expect(
      resolveLatestVersion({ currentVersion: '3.3.10', cachePath })
    ).resolves.toBe('3.3.11');
    await expect(
      resolveLatestVersion({ currentVersion: '3.3.10', cachePath })
    ).resolves.toBe('3.3.11');

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(readFileSync(cachePath, 'utf8'))).toMatchObject({
      ok: false,
      latestVersion: '3.3.11'
    });
  });

  it('checks again once the cache has expired', async () => {
    writeFileSync(
      cachePath,
      JSON.stringify({
        timestamp: Date.now() - VERSION_CACHE_TTL_MS - 1,
        ok: true,
        currentVersion: '3.3.10',
        latestVersion: '3.3.10'
      })
    );
    mockRegistryVersion('3.3.11');

    await expect(
      resolveLatestVersion({ currentVersion: '3.3.10', cachePath })
    ).resolves.toBe('3.3.11');

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(readFileSync(cachePath, 'utf8')).latestVersion).toBe(
      '3.3.11'
    );
  });

  it('checks again after the installed version changes', async () => {
    writeFileSync(
      cachePath,
      JSON.stringify({
        timestamp: Date.now(),
        ok: true,
        currentVersion: '3.3.10',
        latestVersion: '3.3.11'
      })
    );
    mockRegistryVersion('3.3.12');

    await expect(
      resolveLatestVersion({ currentVersion: '3.3.12', cachePath })
    ).resolves.toBe('3.3.12');

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('ignores a corrupt cache file', async () => {
    writeFileSync(cachePath, 'not json');
    mockRegistryVersion('3.3.11');

    await expect(
      resolveLatestVersion({ currentVersion: '3.3.10', cachePath })
    ).resolves.toBe('3.3.11');
  });
});
