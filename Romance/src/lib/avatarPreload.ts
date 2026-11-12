/* 平台头像库预拉取：开局时拉一次写入 avatarPools 缓存，供 AI 新人物套用平台头像（未登录 / 失败静默） */
import { fetchPlatformSystemAvatarPools, readFunloomAuthToken } from "./platformAvatarLibrary";
import { getPlatformSystemPoolsCache, setPlatformSystemPoolsCache } from "../game/avatarPools";

let inflight: Promise<boolean> | null = null;

/** 返回是否有可用平台头像 */
export function preloadPlatformAvatarPools(): Promise<boolean> {
  const cached = getPlatformSystemPoolsCache();
  if (cached) return Promise.resolve(cached.length > 0);
  if (!readFunloomAuthToken()) return Promise.resolve(false);
  if (!inflight) {
    inflight = fetchPlatformSystemAvatarPools()
      .then((pools) => { setPlatformSystemPoolsCache(pools); return pools.length > 0; })
      .catch(() => { inflight = null; return false; });
  }
  return inflight;
}
