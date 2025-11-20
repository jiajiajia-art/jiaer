import { api } from "../base";
import type { UserGameResponse, UserGameRequest, PublicGameRequest, GameDetailRequest, GameDetailResponse, WareHouseResponse } from "./getGameData.type";

const getGameDataApi = {
    getUserData: (userId: number, request: UserGameRequest) => {
        return api.get<UserGameResponse>(`/auth/games/user/${userId}`, { params: request });
    },
    getGameData: (data: PublicGameRequest) => {
        return api.get<UserGameResponse>(`/auth/games/public`, { params: data });
    },
    getGameDetail: (data: GameDetailRequest) => {
        return api.get<GameDetailResponse>(`/auth/games/info`, { params: data });
    },
    getWareHouseData: ( data: {userId: number}) => {
        return api.get<WareHouseResponse>(`/auth/games/history`, { params: data });
    }
}

export default getGameDataApi;