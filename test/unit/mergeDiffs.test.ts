import { mergeDiffs } from '../../src/utils/mergeDiffs';

describe('mergeDiffs', () => {
  it('returns no chunks for an empty diff list', async () => {
    await expect(mergeDiffs([], 10)).resolves.toEqual([]);
  });

  it('merges adjacent diffs without repeatedly counting the merged text', async () => {
    await expect(mergeDiffs(['a', 'b', 'c'], 130)).resolves.toEqual(['abc']);
  });

  it('preserves every diff when splitting groups', async () => {
    const diffs = ['first change\n', 'second change\n', 'third change\n'];
    const chunks = await mergeDiffs(diffs, 3);

    expect(chunks.join('')).toBe(diffs.join(''));
  });

  it('reserves tokens when a join changes cl100k segmentation', async () => {
    await expect(mergeDiffs(['🙂', '.a'], 3)).resolves.toEqual(['🙂', '.a']);
  });

  it('keeps many small diffs together after verifying boundary uncertainty', async () => {
    const diffs = Array.from(
      { length: 100 },
      (_, index) => `+const value${index} = ${index};\n`
    );

    await expect(mergeDiffs(diffs, 3_000)).resolves.toEqual([diffs.join('')]);
  });
});
