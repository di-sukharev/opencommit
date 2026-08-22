import { getOpenCommitLatestVersion } from '../../src/version';

describe('getOpenCommitLatestVersion', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetches the latest version from the public npm registry', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: '3.3.9' })
    }) as typeof fetch;

    await expect(getOpenCommitLatestVersion()).resolves.toBe('3.3.9');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://registry.npmjs.org/opencommit/latest'
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
});
