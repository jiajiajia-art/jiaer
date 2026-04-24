// src/api/incentive/creatorProfileApi.ts
import { api } from '../base';
import type { CreatorProfileData } from '../../components/CreatorProfile';

const BASE_URL = '/creator/profile';

/**
 * 获取创作者资料
 */
export const getCreatorProfile = async (): Promise<CreatorProfileData> => {
    const response = await api.get<{ success: boolean; data?: CreatorProfileData }>(BASE_URL);
    return response.data.data || {};
};

/**
 * 保存创作者资料
 */
export const saveCreatorProfile = async (data: CreatorProfileData): Promise<CreatorProfileData> => {
    const response = await api.post<{ success: boolean; data?: CreatorProfileData }>(BASE_URL, data);
    return response.data.data || data;
};
