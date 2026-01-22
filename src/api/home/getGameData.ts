import { api } from "../base";
import type { UserGameResponse, UserGameRequest, PublicGameRequest, GameDetailRequest, GameDetailResponse, WareHouseResponse } from "./getGameData.type";

const getGameDataApi = {
    getUserData: (request: UserGameRequest) => {
        return api.get<UserGameResponse>(`/auth/games/user`, { params: request });
    },
    getGameData: (type: string, data: PublicGameRequest) => {
        return api.get<UserGameResponse>(`/auth/games/public/${type}`, { params: data });
    },
    getCarouselData: () => {
        return api.get<UserGameResponse>(`/auth/games/featured`);
    },
    getGameDetail: (data: GameDetailRequest) => {
        return api.get<GameDetailResponse>(`/auth/games/info`, { params: data });
    },
    getWareHouseData: (data: PublicGameRequest) => {
        return api.get<WareHouseResponse>(`/auth/games/history`, { params: data });
    }
}

export default getGameDataApi;