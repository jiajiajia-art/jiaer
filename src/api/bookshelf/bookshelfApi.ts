import type { ApiResponse } from '../api.types';
import { api } from '../base';
import type { ShelfItem, ShelfSaveEntry } from '../../lib/bookshelf';

export interface ShelfListResponse {
  rows: ShelfItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface ShelfBatchResponse {
  fileIds: string[];
  affected: number;
}

export interface ShelfListParams {
  limit: number;
  offset: number;
  q?: string;
}

/** 书架接口：用户身份由 token 决定，请求里不带用户 ID。 */
const bookshelfApi = {
  listRecent: (params: ShelfListParams, signal?: AbortSignal) =>
    api.get<ApiResponse<ShelfListResponse>>('/auth/bookshelf/recent', { params, signal }),

  listFavorites: (params: ShelfListParams, signal?: AbortSignal) =>
    api.get<ApiResponse<ShelfListResponse>>('/auth/bookshelf/favorites', { params, signal }),

  removeRecent: (fileIds: string[]) =>
    api.post<ApiResponse<ShelfBatchResponse>>('/auth/bookshelf/recent/remove', { fileIds }),

  removeFavorites: (fileIds: string[]) =>
    api.post<ApiResponse<ShelfBatchResponse>>('/auth/bookshelf/favorites/remove', { fileIds }),

  /** 含损坏 / 版本不兼容存档（带 reason），供选择存档与存档管理 */
  listSaves: (fileId: string) =>
    api.get<{ items: ShelfSaveEntry[]; total: number }>('/visual/saves', {
      params: { fileId, offset: 0, limit: 50, includeInvalid: 1 },
    }),
};

export default bookshelfApi;
