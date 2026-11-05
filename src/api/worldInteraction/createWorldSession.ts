import { api } from "../base";
import type { CreateWorldEditSessionRequest, CreateWorldSessionResponse, GetAVGFilesResponse } from "./createWorldSession.type";
import { useMapGalgameStore } from "../../store/mapGalgameStore";

export interface CreateWorldSessionRequest {
    presetId?: string;
    fileId?: string;
    source?: 'link' | 'game_detail' | 'history' | 'other';
    restart?: boolean;
    billingMode?: 'creator_test';
}

const createWorldSessionApi = {
    createWorldPlaySession: async (data: CreateWorldSessionRequest) => {
        const response = await api.post<CreateWorldSessionResponse>(`/worldInteraction/session/create`, data);
        // 创建 session 成功后，清理状态
        if (response.data?.success) {
            const { clearState, setHasAttributes } = useMapGalgameStore.getState();
            clearState();
            const hasAttributes =
                response.data.data?.session?.hasAttributes === true;
            setHasAttributes(hasAttributes);
            console.log('[WorldInteraction] 创建新 session，已清理状态');
        }
        return response;
    },
    getWorldFilesByFileId: (fielId: string) =>
        api.get<GetAVGFilesResponse>(`/world-interaction/document/${fielId}`),
    createWorldEditSession: (data: { fileId: string; restart?: boolean; billingMode?: 'creator_test' }) =>
        api.post<CreateWorldEditSessionRequest>(`/world-interaction/session/create`, data),
}

export default createWorldSessionApi;
