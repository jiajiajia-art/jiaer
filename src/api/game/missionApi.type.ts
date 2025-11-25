// 完成路径要求
export interface CompletionPathRequirements {
    items?: Array<{
      itemName: string;
      quantity: number;
    }>;
    relationships?: Array<{
      npcName: string;
      minValue: number;
    }>;
    locations?: string[];
    stats?: Array<{
      statName: string;
      minValue: number;
    }>;
  }
  
  // 完成路径
  export interface CompletionPath {
    pathId: string;
    name: string;
    description: string;
    requirements: CompletionPathRequirements;
  }
  
  // 任务奖励
  export interface MissionReward {
    experience: number;
    gold: number;
    items: string[];
  }
  
  // 单个任务
  export interface Mission {
    id: string;
    title: string;
    description: string;
    type: string;
    isStoryMission: boolean;
    blocksStoryline: boolean;
    completionPaths: CompletionPath[];
    requirements?: CompletionPathRequirements | CompletionPathRequirements[] | null;
    reward: MissionReward;
    status: string;
    createdAt: string;
    createdTurn: number;
    attemptedSubmissions: number;
  }
  
  // 任务数据
  export interface MissionData {
    turnCount: number;
    lastMissionTurn: number;
    turnsUntilNextMission: number;
    activeMissions: Mission[];
    completedMissions: Mission[];
    totalMissions: number;
  }
  
  // 任务响应
  export interface MissionResponse {
    success: boolean;
    data: MissionData;
    timestamp: string;
  }

export interface SubmitMissionResponse {
    success: boolean;
    completed: boolean;
    mission: Mission;
    pathResults: any[];
    message: string;
    attempts: number;
    timestamp: string;
}