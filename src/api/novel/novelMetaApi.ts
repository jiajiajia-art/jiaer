import { api } from '../base';

export type PatchNovelMetaRequest = {
  title?: string;
  description?: string;
};

export type PatchNovelMetaResponse = {
  success: boolean;
  message?: string;
  code?: string;
  data?: {
    fileId: string;
    title: string;
    description: string;
  };
};

export type GenerateNovelDescriptionResponse = {
  success: boolean;
  message?: string;
  code?: string;
  data?: {
    fileId: string;
    title: string;
    description: string;
    maxLength: number;
  };
};

const novelMetaApi = {
  patchNovelMeta: (fileId: string, data: PatchNovelMetaRequest) => {
    return api.patch<PatchNovelMetaResponse>(`/auth/novel/${encodeURIComponent(fileId)}/meta`, data);
  },
  generateDescription: (fileId: string, data?: { title?: string }) => {
    return api.post<GenerateNovelDescriptionResponse>(
      `/auth/novel/${encodeURIComponent(fileId)}/generate-description`,
      data || {},
    );
  },
};

export default novelMetaApi;
