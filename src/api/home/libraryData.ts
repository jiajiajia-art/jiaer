import { api } from "../base";
import type { LibraryDataResponse, LibraryRequest } from "./libraryData.type";

const libraryDataApi = {
    getLibraryData: (userId: number, request: LibraryRequest) => {
        return api.get<LibraryDataResponse>(`/auth/games/user/${userId}`, { params: request });
    }
}

export default libraryDataApi;