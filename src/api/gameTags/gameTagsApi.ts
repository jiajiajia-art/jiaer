import { api } from '../base';
import type {
    AdminGameTagListResponse,
    CreateAdminGameTagRequest,
    FeaturedGameTagsResponse,
    GameTagTreeResponse,
    SetGameTagsRequest,
    SetGameTagsResponse,
    UpdateAdminGameTagRequest,
} from './gameTagsApi.type';

const gameTagsApi = {
    getGameTagsTree: () => {
        return api.get<GameTagTreeResponse>('/auth/game-tags/tree');
    },
    getFeaturedGameTags: () => {
        return api.get<FeaturedGameTagsResponse>('/auth/game-tags/featured');
    },
    setGameTagsForGame: (data: SetGameTagsRequest) => {
        return api.post<SetGameTagsResponse>('/auth/games/tags', data);
    },
    getAdminGameTags: (keyword?: string) => {
        return api.get<AdminGameTagListResponse>('/admin/game-tags', {
            params: keyword ? { keyword } : undefined,
        });
    },
    createAdminGameTag: (data: CreateAdminGameTagRequest) => {
        return api.post('/admin/game-tags', data);
    },
    updateAdminGameTag: (data: UpdateAdminGameTagRequest) => {
        return api.put(`/admin/game-tags/${data.id}`, data);
    },
    deleteAdminGameTag: (id: number) => {
        return api.delete(`/admin/game-tags/${id}`);
    },
    reorderAdminGameTags: (tagIds: number[]) => {
        return api.post('/admin/game-tags/reorder', { tagIds });
    },
    replaceFeaturedGameTags: (tagIds: number[]) => {
        return api.post('/admin/game-tags/featured', { tagIds });
    },
};

export default gameTagsApi;
