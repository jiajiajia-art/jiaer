export interface CreateGameRequest {
    file: File;
    cover: File;
    title: string;
    subtitle: string;
    description: string;
    creator_user_id: string;
    author_name: string;
    generateImages: boolean;
}

export interface CreateGameResponse {
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

