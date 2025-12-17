import type { GameFiles } from "../rpgGame/gameData.type";

export interface CreateSessionRequest {
  fileId: string;
  playerName: string;
}

export interface CharacterProfile {
  avatar: string;
  name: string;
  age: number;
  gender: string;
  job: string;
}

export interface CharacterStatus {
  profile: CharacterProfile;
  stats?: Record<string, number | string>;
}

export interface GameState {
  currentLocation: string;
  inventory: any[];
  progress: Record<string, any>;
  flags: Record<string, any>;
  health: number;
}

export interface CreateSessionResponse {
  success: boolean;
  message: string;
  sessionId: string;
  fileId: string;
  playerName: string;
  isInitialized: boolean;
  files: GameFiles;
  characterStatus: CharacterStatus;
  gameState: GameState;
}


interface GameSession {
  id: number;
  session_id: string;
  user_id: string;
  file_id: string;
  status: string;
  files: string;
  started_at: string;
  ended_at: string;
}

export interface GetSessionRequest {
  fileId: string;
}

export interface GetSessionResponse {
    session: GameSession;
    initFilesPath: string;
    sessionDataSync: {
        success: boolean;
        bucket: string;
        prefix: string;
        destRoot: string;
    }
}