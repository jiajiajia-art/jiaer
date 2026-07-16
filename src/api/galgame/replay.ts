import { api } from '../base';

// Galgame Replay APIs
// - Create replay from a running galgame session
// - List replays by fileId (for GameDetail replay tab)
// - Fetch replay steps for playback

export interface CreateReplayRequest {
  sessionId: string;
  fileId: string;
  title: string;
  description?: string;
  visibility: 'public' | 'unlisted' | 'private';
  range?: { fromStepId?: string; toStepId?: string };
  createAsNovel?: boolean;
  /** 覆盖本人同名草稿/回放（二次确认后传入；不影响其他账号） */
  overwrite?: boolean;
  /** 导出小说时用户确认后的章节目录（含可改标题） */
  chapters?: Array<{
    id?: string;
    title: string;
    startStepIndex: number;
    endStepIndex: number;
  }>;
}

export interface CreateReplayResponse {
  success: boolean;
  replayId: string;
  novelFileId?: string;
}

export interface ReplaySummary {
  replayId: string;
  fileId: string;
  ownerId: string;
  ownerName: string;
  title: string;
  description?: string;
  visibility: 'public' | 'unlisted' | 'private';
  createdAt: number;
  coverImageUrl?: string;
  previewText?: string;
  stepsCount?: number;
  pv?: number;
  likeCount?: number;
}

export type ReplayVisibility = ReplaySummary['visibility'];

export interface ReplayMeta extends ReplaySummary {
  updatedAt?: number;
  worldVersion?: string | null;
  stats?: {
    pv?: number;
    likeCount?: number;
    commentCount?: number;
  };
}

export interface ListReplaysResponse {
  success: boolean;
  items: ReplaySummary[];
  total: number;
}

export interface GetReplayMetaResponse {
  success: boolean;
  replay: ReplayMeta;
}

export interface GetReplayStepsResponse {
  success: boolean;
  allSteps: any[];
}

export interface GetReplayStepsPageResponse {
  success: boolean;
  steps: any[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface DeleteReplayResponse {
  success: boolean;
}

const getAppBasePath = () => {
  const rawBase = String(import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  return rawBase && rawBase !== '/' ? rawBase : '/funloom';
};

export const buildReplayRoutePath = (replayId: string) =>
  `/replay/${encodeURIComponent(replayId)}`;

export const buildReplayShareUrl = (replayId: string) => {
  const routePath = buildReplayRoutePath(replayId);
  const basePath = getAppBasePath();

  if (typeof window === 'undefined') {
    return `${basePath}${routePath}`;
  }

  return `${window.location.origin}${basePath}${routePath}`;
};

const replayApi = {
  createFromSession: (data: CreateReplayRequest) =>
    api.post<CreateReplayResponse>('/visual/replay/create-from-session', data),

  /** 导出前：用标题 + 会话历史生成可编辑简介 */
  generateNovelDescriptionFromSession: (data: {
    sessionId: string;
    fileId: string;
    title: string;
  }) =>
    api.post<{
      success: boolean;
      message?: string;
      code?: string;
      data?: {
        sessionId: string;
        fileId: string;
        title: string;
        description: string;
        maxLength: number;
      };
    }>('/visual/session/generate-novel-description', data),

  /** 导出前：AI 生成可编辑章节目录 */
  generateNovelChaptersFromSession: (data: {
    sessionId: string;
    fileId: string;
    title: string;
  }) =>
    api.post<{
      success: boolean;
      message?: string;
      code?: string;
      data?: {
        sessionId: string;
        fileId: string;
        title: string;
        stepCount: number;
        chapters: Array<{
          id: string;
          title: string;
          startStepIndex: number;
          endStepIndex: number;
        }>;
        usedFallback?: boolean;
      };
    }>('/visual/session/generate-novel-chapters', data),

  listByFileId: (params: {
    fileId: string;
    offset?: number;
    limit?: number;
    sort?: 'createdAt' | 'hot';
    includeUnlisted?: boolean;
    visibility?: ReplayVisibility;
  }) =>
    api.get<ListReplaysResponse>(`/visual/replay/by-file/${params.fileId}`, {
      params: {
        offset: params.offset ?? 0,
        limit: params.limit ?? 20,
        sort: params.sort ?? 'createdAt',
        includeUnlisted: params.includeUnlisted ?? false,
        visibility: params.visibility,
      },
    }),

  getReplayMeta: (replayId: string) =>
    api.get<GetReplayMetaResponse>(`/visual/replay/${replayId}/meta`),

  getReplayAllSteps: (replayId: string) =>
    api.get<GetReplayStepsResponse>(`/visual/replay/${replayId}/all-steps`),

  getReplaySteps: (replayId: string, params?: { offset?: number; limit?: number }) =>
    api.get<GetReplayStepsPageResponse>(`/visual/replay/${replayId}/steps`, { params }),

  deleteReplay: (replayId: string) =>
    api.delete<DeleteReplayResponse>(`/visual/replay/${replayId}`),
};

export default replayApi;

