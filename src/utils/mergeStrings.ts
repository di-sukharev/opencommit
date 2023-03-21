export function mergeStrings(arr: string[], maxStringLength: number): string[] {
  const mergedArr: string[] = [];
  let currentItem: string = arr[0];
  for (const item of arr.slice(1)) {
    if (currentItem.length + item.length <= maxStringLength) {
      currentItem += item;
    } else {
      mergedArr.push(currentItem);
      currentItem = item;
    }
  }

  mergedArr.push(currentItem);

  return mergedArr;
}
