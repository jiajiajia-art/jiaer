import { api } from "../base";
import type { UploadFileResponse } from "./uploadFileApi.type";

const uploadFileApi = {
  uploadAndProcess: (file: File, generateImages: boolean) => {
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('generateImages', generateImages.toString());
    
    return api.post<UploadFileResponse>('/backend/pdf/upload-and-process', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 0,
    });
  },
};

export default uploadFileApi;
