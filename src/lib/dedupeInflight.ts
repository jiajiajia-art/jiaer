/**
 * 合并同一时刻、同一 key 的进行中 Promise。
 * 用于消化 React StrictMode 开发态双重 mount 造成的重复请求。
 */
export function dedupeInflight<T>(
  cache: Map<string, Promise<T>>,
  key: string,
  factory: () => Promise<T>,
): Promise<T> {
  const existing = cache.get(key);
  if (existing) {
    return existing;
  }

  const promise = factory().finally(() => {
    if (cache.get(key) === promise) {
      cache.delete(key);
    }
  });
  cache.set(key, promise);
  return promise;
}
