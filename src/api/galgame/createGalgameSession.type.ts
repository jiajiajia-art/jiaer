// export interface CreateGalgameSessionRequest {
//     presetId: string;
// }

// export interface CreateGalgameSessionResponse {
//     success: boolean;
//     message: string;
//     data: {
//         session: {
//             id: number;
//             session_id: string;
//             user_id: string;
//             file_id: string;
//             status: string;
//             files: string;
//             started_at: string;
//             ended_at: string | null;
//             is_deleted: number;
//         };
//         initFilesPath: string | null;
//         sessionDataSync: any | null;
//     };
// }

export interface CreateGalgameSessionRequest {
    presetId: string;
}

export interface PlayerInfo {
    name: string;
    age: number;
    gender: string;
    race: string;
    personality: string;
    appearance: string;
    tone: string;
    image: string; // 图片 URL
    currentLocation: string;
}

export interface CurrentScene {
    id: string;
    name: string;
}

export interface WorldInfo {
    title: string;
    summary: string;
    theme: string[];
}

export interface CreateGalgameSessionResponse {
    success: boolean;
    message: string;
    sessionId: string;
    fileId: string | null;
    presetId: string;
    player: PlayerInfo;
    currentScene: CurrentScene;
    worldInfo: WorldInfo;
}

