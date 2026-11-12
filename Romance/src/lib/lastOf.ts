/** 功能注释：取数组最后一项；替代 Array.prototype.at(-1)（iOS 15.4 前的 Safari / 旧微信内核没有 .at，会直接报错） */
export function lastOf<T>(arr: readonly T[] | null | undefined): T | undefined {
  return arr && arr.length ? arr[arr.length - 1] : undefined;
}
