/**
 * 编辑器 API 类型定义
 * 编辑器使用 UnifiedGameData 联合类型，可以处理两种模式
 */

import type { AbilityNode } from "./worldInteractionApi.type";

export interface NpcSlot {
  position: [number, number];
  zoom: number; // 缩放
  layer?: number; // 层级
}

export interface GenerateNpcImage {
  success: boolean;
  message: string;
  results: {
    npcsGenerated: number;
    npcsTotal: number;
    errors: number;
  };
  details: {
    npcs: {
      npcId: string;
      npcName: string;
      imagePath: string;
      success: boolean;
    }[];
  };
  errors: string[];
}

export interface GenerateALLSceneImage {
  success: boolean;
  message: string;
  results: {
    scenesGenerated: number;
    scenesTotal: number;
    errors: number;
  };
}

export interface BatchImageJobPayload {
  success: boolean;
  message: string;
  results: {
    npcsGenerated?: number;
    npcsTotal?: number;
    scenesGenerated?: number;
    scenesTotal?: number;
    effectiveSuccessful?: number;
    totalSuccessful?: number;
    totalGenerated?: number;
    totalImages?: number;
    pointsDeducted?: number;
    remainingPoints?: number | null;
    [key: string]: unknown;
  };
  details?: unknown;
  errors?: unknown;
}

export interface StartBatchImageJobResponse {
  success: boolean;
  jobId: string;
  fileId: string;
  status: 'running' | 'queued' | 'pending' | 'completed';
  totalCount: number;
  message?: string;
  error?: string;
}

export interface BatchImageJobStatus {
  success: boolean;
  jobId: string;
  fileId?: string;
  status: 'running' | 'queued' | 'pending' | 'completed' | 'failed' | 'unknown';
  totalCount: number;
  completedCount: number;
  failedCount: number;
  progress?: number;
  startedAt?: string;
  updatedAt?: string;
  elapsedSeconds?: number | null;
  estimatedRemainingSeconds?: number | null;
  estimatedTotalSeconds?: number | null;
  result?: BatchImageJobPayload | null;
  error?: string | null;
  message?: string;
}

export interface BatchImageJobResult {
  success: boolean;
  jobId: string;
  fileId: string;
  result: BatchImageJobPayload;
  error?: string;
}

export interface CalculatePointsResponse {
  success: boolean;
  message: string;
  points: number;
}

export interface UploadSceneImageResponse {
  success: boolean;
  message: string;
  imagePath: string;
  sceneId: string;
}

export interface UploadNpcImageResponse {
  success: boolean;
  message: string;
  imagePath: string;
  variant: string;
  npcId: string;
}

export interface UploadPlayerImageResponse {
  success: boolean;
  message: string;
  imagePath: string;
  variant: string;
}

export interface UploadSubSceneImageResponse {
  success: boolean;
  message: string;
  imagePath: string;
  sceneId: string;
  subsceneId: string;
}

export interface UploadMusicResponse {
  success: boolean;
  message: string;
  musicPath: string;
  filename: string;
}

export interface GetMusicListResponse {
  success: boolean;
  count: number;
  files: {
    filename: string;
    originalFilename: string;
    name: string;
    description: string;
    uploadedAt: string;
    path: string;
    url: string;
  }[];
}

export interface CreateEmptyWorldInteractionResponse {
  success: boolean;
  fileId: string;
  message: string;
  data: {
    world: {
      title: string;
      background: string;
      summary: string;
      preamble: string;
      initialPlot: string;
      literary: string;
      Theme: string[];
      player: {
        name: string;
        gender: string;
        appearance: string;
        age: number | null;
        personality: string;
        background: string;
        image: string;
      };
      music: string[];
    };
    npcs: {
      npcs: [];
    };
    scenes: {
      scenes: [];
    };
  };
}

export interface GenerateFunctionImageResponse {
  success: boolean;
  message: string;
  result: {
    success: boolean;
    tempImagePath: string;
    url: string;
    tempImageId: string;
  };
}

export interface AbilityNodeItem {
  node_id: string;
  name: string;
  success: boolean;
  imagePath: string | null;
  bgRemoved: boolean;
}

export interface GenerateAllFunctionImageResponse {
  success: boolean;
  message: string;
  results: AbilityNodeItem[];
  errors: string[];
}

export interface AddFunctionalNpcResponse {
  success: boolean;
  message: string;
  node: AbilityNode;
}

export interface FunctionalNpcPatch {
  patches: {
      node_id: string;
      sceneBinding: {
        sceneId: string;
        subsceneId: string;
      };
      position: [number, number];
      layer: number;
      scale: number;
      color?: string;
    }[];
}
