import { tokenCountAsync } from './tokenCount';

export async function mergeDiffs(
  arr: string[],
  maxStringLength: number
): Promise<string[]> {
  if (!arr.length) return [];

  const mergedArr: string[] = [];
  let currentItem: string = arr[0];
  let currentItemTokens = await tokenCountAsync(currentItem);

  for (const item of arr.slice(1)) {
    const itemTokens = await tokenCountAsync(item);

    // Adding independently counted chunks is conservative at a BPE boundary
    // and avoids repeatedly tokenizing an ever-growing merged diff.
    if (currentItemTokens + itemTokens <= maxStringLength) {
      currentItem += item;
      currentItemTokens += itemTokens;
    } else {
      mergedArr.push(currentItem);
      currentItem = item;
      currentItemTokens = itemTokens;
    }
  }

  mergedArr.push(currentItem);

  return mergedArr;
}
