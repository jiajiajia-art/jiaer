import { api } from '../base';
import type { ApiResponse } from '../api.types';

export interface StatsOverview {
  pv: number;
  uv: number;
  likeCount: number;
  shareCount: number;
  shareUv: number;
  playCount: number;
  playUv: number;
  playDurationSeconds: number;
  commentCount: number;
  spendPoints: number;
  activeHours: Array<{ hour: number; count: number }>;
  workCount?: number;
  fileIds?: string[];
}

export interface WorkMetrics {
  pv: number;
  uv: number;
  likeCount: number;
  shareCount: number;
  playCount: number;
  playDurationSeconds: number;
  commentCount: number;
  spendPoints: number;
}

export interface CreatorWorkItem {
  fileId: string;
  title: string;
  coverUrl: string | null;
  isPublic: boolean;
  ratingAvg: number | null;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
  metrics: WorkMetrics;
}

export interface CreatorWorkDetail extends WorkMetrics {
  fileId: string;
  title: string;
  coverUrl: string | null;
  isPublic: boolean;
  creatorUserId: string | null;
  ratingAvg: number | null;
  ratingCount: number;
  activeHours: Array<{ hour: number; count: number }>;
  comments: Array<{
    ratingId: string;
    userId: string;
    nickname: string | null;
    ratingValue: number | null;
    commentContent: string;
    createdAt: string;
  }>;
}

export interface CreatorProfileFlags {
  role: string;
  isVerified: boolean;
}

const creatorStatsApi = {
  getOverview: (params?: { startDate?: string; endDate?: string }) =>
    api.get<ApiResponse<StatsOverview>>('/creator/stats/overview', { params }),
  getWorks: (params?: { startDate?: string; endDate?: string }) =>
    api.get<ApiResponse<{ works: CreatorWorkItem[] }>>('/creator/stats/works', { params }),
  getWorkDetail: (fileId: string, params?: { startDate?: string; endDate?: string; commentLimit?: number }) =>
    api.get<ApiResponse<CreatorWorkDetail>>(`/creator/stats/works/${fileId}`, { params }),
  getProfileFlags: () =>
    api.get<ApiResponse<CreatorProfileFlags>>('/creator/profile/flags'),
};

export default creatorStatsApi;
