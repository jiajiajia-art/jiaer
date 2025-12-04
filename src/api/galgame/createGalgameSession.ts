import { api } from "../base";
import type { CreateGalgameSessionResponse } from "./createGalgameSession.type";

const createGalgameSessionApi = {
    createGalgameSession: ({presetId}: {presetId: string}) =>
        api.post<CreateGalgameSessionResponse>(`/optical/games/session/create`, {presetId}),
}

export default createGalgameSessionApi;

// import { api } from "../base";
// import type { CreateGalgameSessionResponse } from "./createGalgameSession.type";

// const createGalgameSessionApi = {
//     createGalgameSession: ({presetId}: {presetId: string}) =>
//         api.post<CreateGalgameSessionResponse>(`/visual/session/create`, {presetId}),
// }

// export default createGalgameSessionApi;