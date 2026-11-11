import type { ApiResponse } from '../api.types';
import { api, authFetch } from '../base';
import { HOST_ADDRESS } from '../../config';
import type { BannerCurrentData, BannerGameOption, BannerPayload, BannerRecord } from './banner.type';

async function parseUploadResponse(response: Response): Promise<ApiResponse<{ imageUrl: string }>> {
    const data = await response.json() as ApiResponse<{ imageUrl: string }>;
    if (!response.ok || !data.success) {
        throw new Error(data.message || '轮播图图片上传失败');
    }
    return data;
}

const bannerApi = {
    getCurrent: () =>
        api.get<ApiResponse<BannerCurrentData>>('/admin/banners/current'),

    getGameOptions: (keyword = '') =>
        api.get<ApiResponse<BannerGameOption[]>>('/admin/banners/games', {
            params: keyword.trim() ? { keyword: keyword.trim() } : undefined,
        }),

    publish: (payload: BannerPayload) =>
        api.post<ApiResponse<BannerRecord>>('/admin/banners/publish', payload),

    uploadImage: async (formData: FormData) => {
        const response = await authFetch(`${HOST_ADDRESS}/api/admin/banners/upload`, {
            method: 'POST',
            body: formData,
        });

        return { data: await parseUploadResponse(response) };
    },

    getLatest: () =>
        api.get<ApiResponse<BannerRecord>>('/auth/banners/latest'),
};

export default bannerApi;
