import { api } from '../base';
import type {
    AdminSpecialThemeTagListResponse,
    CreateSpecialThemeTagRequest,
    PublicSpecialThemeTagGamesResponse,
    PublicSpecialThemeTagListResponse,
    SaveSpecialThemeGamesRequest,
    SpecialThemeAudienceGender,
    SpecialThemeTagMutationResponse,
    UpdateSpecialThemeTagRequest,
} from './specialThemeTagsApi.type';

const specialThemeTagsApi = {
    getAdminTags: () => api.get<AdminSpecialThemeTagListResponse>('/admin/special-theme-tags'),
    createAdminTag: (data: CreateSpecialThemeTagRequest) => api.post<SpecialThemeTagMutationResponse>('/admin/special-theme-tags', data),
    updateAdminTag: (data: UpdateSpecialThemeTagRequest) => api.put<SpecialThemeTagMutationResponse>(`/admin/special-theme-tags/${data.id}`, data),
    deleteAdminTag: (id: number) => api.delete<SpecialThemeTagMutationResponse>(`/admin/special-theme-tags/${id}`),
    reorderAdminTags: (ids: number[]) => api.post<SpecialThemeTagMutationResponse>('/admin/special-theme-tags/reorder', { ids }),
    saveAdminTagGames: (id: number, data: SaveSpecialThemeGamesRequest) => api.put<SpecialThemeTagMutationResponse>(`/admin/special-theme-tags/${id}/games`, data),
    getPublicTags: () => api.get<PublicSpecialThemeTagListResponse>('/auth/special-theme-tags'),
    getPublicTagGames: (id: number, limit = 12, gender?: SpecialThemeAudienceGender | null) => api.get<PublicSpecialThemeTagGamesResponse>(`/auth/special-theme-tags/${id}/games`, {
        params: {
            limit,
            ...(gender ? { gender } : {}),
        },
    }),
};

export default specialThemeTagsApi;
