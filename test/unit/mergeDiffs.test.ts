import { mergeDiffs } from '../../src/utils/mergeDiffs';

describe('mergeDiffs', () => {
  it('returns an empty array when given no diffs', () => {
    expect(mergeDiffs([], 100)).toEqual([]);
  });
});

