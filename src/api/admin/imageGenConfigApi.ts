import type { ApiResponse } from '../api.types';
import { api } from '../base';
import type { ImageGenModel } from '../../lib/imageGenConfig';

export interface AdminImageGenModuleRow {
  key: string;
  label: string;
  description: string;
  model: ImageGenModel | string;
}

export interface AdminImageGenConfigData {
  models: string[];
  modules: AdminImageGenModuleRow[];
}

const adminImageGenConfigApi = {
  /** 功能注释：读取各模块当前生图模型 */
  getConfig: () =>
    api.get<ApiResponse<AdminImageGenConfigData>>('/admin/image-gen-config'),

  /** 功能注释：批量保存 { moduleKey: model } */
  saveConfig: (models: Record<string, string>) =>
    api.put<ApiResponse<AdminImageGenConfigData>>('/admin/image-gen-config', { models }),
};

export default adminImageGenConfigApi;
