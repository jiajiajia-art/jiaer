/**
 * 功能注释：一次拉取头像年龄/背景选项，供上传、筛选、建角匹配共用，避免多处重复请求。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { avatarLibraryApi } from '../api/galgame/avatarLibrary';
import {
  AVATAR_AGE_GROUPS,
  AVATAR_BACKGROUNDS,
  tagOptionsToSeg,
  type AvatarTagOption,
} from '../lib/galgame/avatarLibrary';

type CacheEntry = {
  token: string;
  options: AvatarTagOption[];
  inflight?: Promise<AvatarTagOption[]>;
};

let cache: CacheEntry | null = null;

async function fetchTagOptions(token: string, force = false): Promise<AvatarTagOption[]> {
  if (!force && cache?.token === token && cache.options.length) {
    return cache.options;
  }
  if (!force && cache?.token === token && cache.inflight) {
    return cache.inflight;
  }
  const inflight = avatarLibraryApi.listTagOptions(token).then((res) => {
    const list = res.success && Array.isArray(res.data) ? res.data : [];
    cache = { token, options: list };
    return list;
  }).finally(() => {
    if (cache?.token === token) delete cache.inflight;
  });
  cache = { token, options: cache?.token === token ? cache.options : [], inflight };
  return inflight;
}

export function useAvatarTagOptions(token?: string | null, { includeDisabled = false } = {}) {
  const [options, setOptions] = useState<AvatarTagOption[]>(() => (
    token && cache?.token === token ? cache.options : []
  ));
  const [loading, setLoading] = useState(!options.length);

  const reload = useCallback(async (force = true) => {
    if (!token) {
      setOptions([]);
      setLoading(false);
      return [];
    }
    setLoading(true);
    try {
      if (includeDisabled) {
        const res = await avatarLibraryApi.listTagOptions(token, { includeDisabled: true });
        const list = res.success && Array.isArray(res.data) ? res.data : [];
        setOptions(list);
        return list;
      }
      const list = await fetchTagOptions(token, force);
      setOptions(list);
      return list;
    } catch {
      setOptions([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [token, includeDisabled]);

  useEffect(() => {
    void reload(false);
  }, [reload]);

  const ageOptions = useMemo(
    () => tagOptionsToSeg(options, 'age_group', AVATAR_AGE_GROUPS),
    [options],
  );
  const backgroundOptions = useMemo(
    () => tagOptionsToSeg(options, 'background_type', AVATAR_BACKGROUNDS),
    [options],
  );

  return { options, ageOptions, backgroundOptions, loading, reload };
}

/** 功能注释：管理端改选项后清缓存，仓库页下次进入拿新配置 */
export function invalidateAvatarTagOptionsCache() {
  cache = null;
}
