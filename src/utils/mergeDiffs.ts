import { TOKEN_BOUNDARY_RESERVE, tokenCountAsync } from './tokenCount';

export async function mergeDiffs(
  arr: string[],
  maxStringLength: number
): Promise<string[]> {
  if (!arr.length) return [];

  const mergedArr: string[] = [];
  let currentItem: string = arr[0];
  let currentItemTokens = await tokenCountAsync(currentItem);
  let unverifiedBoundaryTokens = 0;

  for (const item of arr.slice(1)) {
    const itemTokens = await tokenCountAsync(item);
    const independentlyCountedTokens = currentItemTokens + itemTokens;
    const conservativeTokens =
      independentlyCountedTokens +
      unverifiedBoundaryTokens +
      TOKEN_BOUNDARY_RESERVE;

    if (conservativeTokens <= maxStringLength) {
      currentItem += item;
      currentItemTokens = independentlyCountedTokens;
      unverifiedBoundaryTokens += TOKEN_BOUNDARY_RESERVE;
      continue;
    }

    // Only re-tokenize the combined text when accumulated boundary uncertainty
    // could cross the limit. This keeps ordinary multi-file diffs together
    // without returning to the previous quadratic behavior.
    const combinedItem = currentItem + item;
    const combinedItemTokens = await tokenCountAsync(combinedItem);

    if (combinedItemTokens <= maxStringLength) {
      currentItem = combinedItem;
      currentItemTokens = combinedItemTokens;
      unverifiedBoundaryTokens = 0;
      continue;
    }

    mergedArr.push(currentItem);
    currentItem = item;
    currentItemTokens = itemTokens;
    unverifiedBoundaryTokens = 0;
  }

  mergedArr.push(currentItem);

  return mergedArr;
}
