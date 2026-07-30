import { mergeDiffs } from '../../src/utils/mergeDiffs';

describe('mergeDiffs', () => {
  it('returns no chunks for an empty diff list', async () => {
    await expect(mergeDiffs([], 10)).resolves.toEqual([]);
  });

  it('merges adjacent diffs without repeatedly counting the merged text', async () => {
    await expect(mergeDiffs(['a', 'b', 'c'], 2)).resolves.toEqual(['ab', 'c']);
  });

  it('preserves every diff when splitting groups', async () => {
    const diffs = ['first change\n', 'second change\n', 'third change\n'];
    const chunks = await mergeDiffs(diffs, 3);

    expect(chunks.join('')).toBe(diffs.join(''));
  });
});
