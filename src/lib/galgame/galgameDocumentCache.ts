import getGalgamePresetApi from '../../api/galgame/getGalgamePreset';
import type { GetGalgamePresetResponse } from '../../api/galgame/getGalgamePreset.type';
import type { ApiResponse } from '../../api/api.types';
import type { AxiosResponse } from 'axios';

type DocumentResponse = AxiosResponse<ApiResponse<GetGalgamePresetResponse>>;

type CacheEntry = {
  fileId: string;
  promise: Promise<DocumentResponse>;
  data: GetGalgamePresetResponse | null;
};

let cache: CacheEntry | null = null;

function rememberEntry(fileId: string, promise: Promise<DocumentResponse>): Promise<DocumentResponse> {
  const entry: CacheEntry = {
    fileId,
    promise,
    data: null,
  };
  cache = entry;

  return promise.then((response) => {
    if (cache === entry) {
      entry.data = response.data?.data || null;
    }
    return response;
  }).catch((error) => {
    if (cache === entry) {
      cache = null;
    }
    throw error;
  });
}

/** 进 Galgame 前预拉 document，与创建 session 并行，缩短「正在获取数据」 */
export function prefetchGalgameDocument(fileId: string): void {
  const id = String(fileId || '').trim();
  if (!id) return;
  if (cache?.fileId === id) return;

  void rememberEntry(id, getGalgamePresetApi.getGalgameFileId(id)).catch(() => {
    // 预取失败由正式加载路径处理
  });
}

export async function fetchGalgameDocument(fileId: string): Promise<DocumentResponse> {
  const id = String(fileId || '').trim();
  if (!id) {
    throw new Error('fileId required');
  }

  if (cache?.fileId === id) {
    return cache.promise;
  }

  return rememberEntry(id, getGalgamePresetApi.getGalgameFileId(id));
}

export function peekGalgameDocument(fileId: string): GetGalgamePresetResponse | null {
  const id = String(fileId || '').trim();
  if (!id || cache?.fileId !== id) return null;
  return cache.data;
}

export function clearGalgameDocumentCache(fileId?: string): void {
  if (!fileId) {
    cache = null;
    return;
  }
  if (cache?.fileId === String(fileId).trim()) {
    cache = null;
  }
}
