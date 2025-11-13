import { api } from "../base";
import type { UserGameResponse, UserGameRequest, PublicGameRequest } from "./getGameData.type";

const getGameDataApi = {
    getUserData: (userId: number, request: UserGameRequest) => {
        return api.get<UserGameResponse>(`/auth/games/user/${userId}`, { params: request });
    },
    getGameData: (data: PublicGameRequest) => {
        return api.get<UserGameResponse>(`/auth/games/public`, { params: data });
    }
}

export default getGameDataApi;