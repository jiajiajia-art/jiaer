import { api } from "../base";
import { dedupeInflight } from "../../lib/dedupeInflight";
import type {
    UserGameResponse,
    UserGameRequest,
    PublicGameRequest,
    PublicGameSearchRequest,
    PublicGameSearchResponse,
    GameDetailRequest,
    GameDetailResponse,
    WareHouseResponse,
    GamePlayStatusResponse
} from "./getGameData.type";

const gameDetailInflight = new Map<string, Promise<unknown>>();

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
    searchPublicGames: (data: PublicGameSearchRequest) => {
        return api.get<PublicGameSearchResponse>(`/auth/games/search`, { params: data });
    },
    getGameDetail: (data: GameDetailRequest) => {
        const fileId = String(data.fileId || '').trim();
        const key = `info:${fileId}`;
        return dedupeInflight(gameDetailInflight, key, () =>
            api.get<GameDetailResponse>(`/auth/games/info`, { params: data })
        ) as ReturnType<typeof api.get<GameDetailResponse>>;
    },
    getPlayStatus: (fileId: string) => {
        return api.get<GamePlayStatusResponse>(`/auth/games/${fileId}/play-status`);
    },
    getWareHouseData: (data: PublicGameRequest) => {
        return api.get<WareHouseResponse>(`/auth/games/history`, { params: data });
    }
}

export default getGameDataApi;
