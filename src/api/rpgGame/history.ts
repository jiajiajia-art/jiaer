import { api } from "../base";

const historyApi = {
    getGameHistory: (sessionId: string) => {
        return api.get(`/auth/session/${sessionId}/export-history`, {
            responseType: 'blob' // 告诉 axios 返回 blob
        });
    }
}

export default historyApi;