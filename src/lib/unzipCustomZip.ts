/**
 * 功能注释：自定义 ZIP 解压。勿再走 jsDelivr CDN（国内 Aliyun 常加载失败 →「fflate load failed」），
 * 改为打包内动态 import fflate。
 */
import type { Unzipped } from 'fflate';

let unzipSyncCached: ((data: Uint8Array, opts?: { filter?: (file: { name: string }) => boolean }) => Unzipped) | null = null;

/** 功能注释：懒加载 fflate.unzipSync，整页只 import 一次。 */
export async function loadUnzipSync() {
  if (unzipSyncCached) return unzipSyncCached;
  const mod = await import('fflate');
  unzipSyncCached = mod.unzipSync;
  return unzipSyncCached;
}

/**
 * 功能注释：解压 ZIP 为路径 → Uint8Array；失败时抛带可读文案的 Error。
 */
export async function unzipCustomZipBytes(buf: Uint8Array): Promise<Unzipped> {
  const unzipSync = await loadUnzipSync();
  try {
    return unzipSync(buf);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(message || 'unzip failed');
  }
}
