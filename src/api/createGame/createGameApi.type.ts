import { api } from "../base";
import type { CreateGameRequest, CreateGameResponse } from "./createGameApi";

const createGameApi = {
    createGame: (data: CreateGameRequest) => {
        const formData = new FormData();
        formData.append('file', data.file);
        formData.append('cover', data.cover);
        formData.append('title', data.title);
        formData.append('subtitle', data.subtitle);
        formData.append('description', data.description);
        formData.append('creator_user_id', data.creator_user_id);
        formData.append('author_name', data.author_name);
        formData.append('generateImages', data.generateImages.toString());
        
        return api.post<CreateGameResponse>('/auth/games', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            timeout: 0,
        });
    }
}

export default createGameApi;