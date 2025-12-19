import { api } from "../base";
import type { CreateWorldSessionResponse, GetWorldFilesBySessionResponse } from "./createWorldSession.type";
import { useMapGalgameStore } from "../../store/mapGalgameStore";

export interface CreateWorldSessionRequest {
    presetId?: string;
    fileId?: string;
}

const createWorldSessionApi = {
    createWorldSession: async (data: CreateWorldSessionRequest) => {
        const response = await api.post<CreateWorldSessionResponse>(`/worldInteraction/session/create`, data);
        
        // 创建 session 成功后，清理状态
        if (response.data?.success) {
            const { clearState } = useMapGalgameStore.getState();
            clearState();
            // 清理 sessionStorage 中的视图栈
            if (typeof window !== 'undefined') {
                sessionStorage.setItem('worldMapViewStack', JSON.stringify([{ mode: 'mainScenes', scene: null }]));
            }
            console.log('[WorldInteraction] 创建新 session，已清理状态');
        }
        
        return response;
    },
    getWorldFilesBySession: (sessionId: string) =>
        api.get<GetWorldFilesBySessionResponse>(`/world-interaction/session/${sessionId}`),
}

export default createWorldSessionApi;