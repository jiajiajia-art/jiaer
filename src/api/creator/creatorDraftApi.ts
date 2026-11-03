import { api } from "../base";

export type CreatorDraftCapacity = {
  count: number;
  limit: number;
  canCreate: boolean;
};

export type RomanceDraftUpdate = {
  fileId: string;
  title: string;
  updatedAt?: string;
  authorName?: string | null;
};

const creatorDraftApi = {
  getCapacity: () =>
    api.get<{ success: boolean; data: CreatorDraftCapacity }>("/auth/games/drafts/capacity"),
  createRomance: () =>
    api.post<{ success: boolean; data?: { fileId: string; title?: string }; message?: string }>(
      "/auth/games/drafts/romance",
      {},
    ),
  /** 功能注释：同一份 Romance 作品保存/自动保存只更新这一条，禁止再 create。 */
  updateRomance: (fileId: string, body: { title?: string }) =>
    api.patch<{ success: boolean; data?: RomanceDraftUpdate; message?: string }>(
      `/auth/games/drafts/romance/${encodeURIComponent(fileId)}`,
      body,
    ),
  /** 功能注释：书架重复草稿清理（同引擎同标题只留最新）。 */
  dedupe: () =>
    api.post<{ success: boolean; data?: { removed: number; fileIds: string[] }; message?: string }>(
      "/auth/games/drafts/dedupe",
      {},
    ),
};

export default creatorDraftApi;
