import type { ApiResponse } from "../api.types";
import { api } from "../base";
import type { Currency } from "../common/currency";

export interface AdminShareRatioGame {
    fileId: string;
    title: string;
    gameMode: string;
    shareType: Currency;
    shareRatio: number;
    shareRatioDisplay: string;
    isPublic: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface AdminShareRatioUser {
    userId: string;
    nickname: string;
    userCode: string;
    phoneNumber: string;
}

export interface AdminShareRatioResponse {
    user: AdminShareRatioUser;
    games: AdminShareRatioGame[];
}

export interface AdminSetShareRatioRequest {
    fileId: string;
    shareRatio: number;
}

export interface AdminSetShareRatioResponse {
    fileId: string;
    shareRatio: number;
    shareRatioDisplay: string;
    updatedAt: string;
}

const adminShareRatioApi = {
    getShareRatioByUser: (userCode: string) =>
        api.get<ApiResponse<AdminShareRatioResponse>>(`/admin/games/share-ratio`, {
            params: { userCode },
        }),

    setShareRatio: (data: AdminSetShareRatioRequest) =>
        api.post<ApiResponse<AdminSetShareRatioResponse>>(`/admin/games/share-ratio`, data),
};

export default adminShareRatioApi;
