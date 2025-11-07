export interface UploadFileRequest {
  file: File;
}

export interface UploadFileResponse {
  success: boolean;
  fileId: string;
  message: string;
  data: {
    fileName: string;
    fileType: string;
    size: number;
    textLength: number;
    numPages: number;
  };
}

