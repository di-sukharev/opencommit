import { tokenCount } from './tokenCount';

export function mergeDiffs(arr: string[], maxStringLength: number): string[] {
  const mergedArr: string[] = [];
  let currentItem: string = arr[0];
  for (const item of arr.slice(1)) {
    if (tokenCount(currentItem + item) <= maxStringLength) {
      currentItem += item;
    } else {
      mergedArr.push(currentItem);
      currentItem = item;
    }
  }

  mergedArr.push(currentItem);

  return mergedArr;
}
