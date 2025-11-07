import { api } from "../base";
import type { LibraryDataResponse, LibraryRequest } from "./libraryData.type";

const libraryDataApi = {
    getLibraryData: (request: LibraryRequest) => {
        return api.get<LibraryDataResponse>('/auth/games/user/2', { params: request });
    }
}

export default libraryDataApi;