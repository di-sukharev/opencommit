import { tokenCount } from './token-count';

export function mergeDiffs(array: string[], maxStringLength: number): string[] {
  const mergedArray: string[] = [];
  let currentItem: string = array[0];
  for (const item of array.slice(1)) {
    if (tokenCount(currentItem + item) <= maxStringLength) {
      currentItem += item;
    } else {
      mergedArray.push(currentItem);
      currentItem = item;
    }
  }

  mergedArray.push(currentItem);

  return mergedArray;
}
