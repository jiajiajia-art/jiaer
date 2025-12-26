import type { Player } from "./EditorData.type";

export interface CreateGalgameSessionRequest {
  presetId: string;
}

export interface CreateGalgameSessionResponse {
  success: boolean;
  message: string;
  data: {
    session: {
      id: number;
      session_id: string;
      user_id: string;
      file_id: string;
      status: string;
      files: string;
      started_at: string;
      ended_at: string | null;
      is_deleted: number;
    };
    initFilesPath: string | null;
    sessionDataSync: any | null;
  };
}

export interface CreateGalgameEditSessionRequest {
  success: boolean;
  message: string;
  sessionId: string;
  fileId: string;
  presetId: string | null;
  player: Player;
  currentScene: {
    id: string;
    name: string;
  };
  worldInfo: {
    title: string;
    summary: string;
    theme: string[];
  };
}
