import { existsSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join as pathJoin } from 'path';

const NPM_REGISTRY = 'https://registry.npmjs.org';
const PACKAGE_NAME = 'opencommit';

// The version check is best-effort: it must never hold up commit generation,
// e.g. when offline with a local provider such as Ollama (see #347).
export const VERSION_CHECK_TIMEOUT_MS = 2000;

export const VERSION_CACHE_PATH = pathJoin(
  homedir(),
  '.opencommit-version.json'
);
export const VERSION_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day
// A failed check (offline, registry unreachable) is remembered for a shorter
// time, so offline runs don't pay the timeout on every invocation.
export const VERSION_CACHE_FAILURE_TTL_MS = 30 * 60 * 1000; // 30 minutes

type NpmLatestResponse = {
  version?: string;
};

interface VersionCache {
  // When the registry was last asked, whether or not it answered.
  timestamp: number;
  // Whether that last check succeeded.
  ok: boolean;
  // The installed version at the time of the check. A different installed
  // version (after an upgrade or downgrade) invalidates the cache.
  currentVersion: string;
  // The last version the registry reported, kept across failed checks.
  latestVersion?: string;
}

interface ResolveLatestVersionOptions {
  currentVersion: string;
  cachePath?: string;
  timeoutMs?: number;
}

export const getOpenCommitLatestVersion = async (
  timeoutMs: number = VERSION_CHECK_TIMEOUT_MS
): Promise<string | undefined> => {
  try {
    const response = await fetch(`${NPM_REGISTRY}/${PACKAGE_NAME}/latest`, {
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (!response.ok) {
      return undefined;
    }

    const data = (await response.json()) as NpmLatestResponse;
    return data.version;
  } catch {
    return undefined;
  }
};

const readVersionCache = (
  currentVersion: string,
  cachePath: string
): VersionCache | undefined => {
  try {
    if (!existsSync(cachePath)) {
      return undefined;
    }

    const cache = JSON.parse(readFileSync(cachePath, 'utf8')) as VersionCache;

    if (
      typeof cache.timestamp !== 'number' ||
      cache.currentVersion !== currentVersion ||
      (cache.latestVersion !== undefined &&
        typeof cache.latestVersion !== 'string')
    ) {
      return undefined;
    }

    return cache;
  } catch {
    return undefined;
  }
};

const isVersionCacheFresh = (cache: VersionCache): boolean => {
  const age = Date.now() - cache.timestamp;
  const ttl = cache.ok ? VERSION_CACHE_TTL_MS : VERSION_CACHE_FAILURE_TTL_MS;

  return age >= 0 && age < ttl;
};

const writeVersionCache = (cache: VersionCache, cachePath: string): void => {
  try {
    writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
  } catch {
    // Silently fail if we can't write cache
  }
};

/**
 * Returns the latest published version while keeping network I/O off the
 * startup path as much as possible:
 * - a successful check is reused for VERSION_CACHE_TTL_MS;
 * - a failed check is not retried for VERSION_CACHE_FAILURE_TTL_MS, and the
 *   last known latest version (if any) is returned in the meantime.
 */
export const resolveLatestVersion = async ({
  currentVersion,
  cachePath = VERSION_CACHE_PATH,
  timeoutMs = VERSION_CHECK_TIMEOUT_MS
}: ResolveLatestVersionOptions): Promise<string | undefined> => {
  const cache = readVersionCache(currentVersion, cachePath);

  if (cache && isVersionCacheFresh(cache)) {
    return cache.latestVersion;
  }

  const fetchedVersion = await getOpenCommitLatestVersion(timeoutMs);
  const latestVersion = fetchedVersion ?? cache?.latestVersion;

  writeVersionCache(
    {
      timestamp: Date.now(),
      ok: fetchedVersion !== undefined,
      currentVersion,
      ...(latestVersion ? { latestVersion } : {})
    },
    cachePath
  );

  return latestVersion;
};
