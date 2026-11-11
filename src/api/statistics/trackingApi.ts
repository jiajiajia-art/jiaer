import type { ApiResponse } from '../api.types';
import { api } from '../base';
import type { DailyTaskPayload } from './dailyTask.type';

export interface AnalyticsEndRequest {
    durationSeconds: number;
    gameFileId?: string;
}

export interface GameEntryRequest {
    gameFileId: string;
    source: 'game_detail';
}

export interface EnterGameDetailRequest {
    gameFileId: string;
    source: 'link' | 'main_page' | 'search' | 'other';
}

export interface GameShareRequest {
    gameFileId: string;
    shareChannel: 'copy_link' | 'native_share' | 'wechat' | 'other';
    source?: string;
}

export const trackingApi = {
    analyticsEnd: (data: AnalyticsEndRequest) =>
        api.post<ApiResponse<DailyTaskPayload>>('/analytics/session/duration', data),
    reportGameEntry: (data: GameEntryRequest) =>
        api.post<ApiResponse<DailyTaskPayload>>('/analytics/game-entry', data),
    enterGameDetail: (data: EnterGameDetailRequest) =>
        api.post<ApiResponse<null>>('/analytics/game-detail-view', data),
    reportGameShare: (data: GameShareRequest) =>
        api.post<ApiResponse<null>>('/analytics/game-share', data),
};

