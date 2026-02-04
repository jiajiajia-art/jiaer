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
}

export interface CreateReplayResponse {
  success: boolean;
  replayId: string;
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

export interface ListReplaysResponse {
  success: boolean;
  items: ReplaySummary[];
  total: number;
}

export interface GetReplayStepsResponse {
  success: boolean;
  allSteps: any[];
}

const replayApi = {
  createFromSession: (data: CreateReplayRequest) =>
    api.post<CreateReplayResponse>('/visual/replay/create-from-session', data),

  listByFileId: (params: { fileId: string; offset?: number; limit?: number; sort?: 'createdAt' | 'hot' }) =>
    api.get<ListReplaysResponse>(`/visual/replay/by-file/${params.fileId}`, {
      params: {
        offset: params.offset ?? 0,
        limit: params.limit ?? 20,
        sort: params.sort ?? 'createdAt',
      },
    }),

  getReplayAllSteps: (replayId: string) =>
    api.get<GetReplayStepsResponse>(`/visual/replay/${replayId}/all-steps`),
};

export default replayApi;

