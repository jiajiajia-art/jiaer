// 任务奖励
export interface MissionReward {
    experience: number;
    gold: number;
}

// 任务要求
export interface MissionRequirements {
    targetLocation?: string;
    [key: string]: unknown;
}

// 单个任务
export interface Mission {
    id: string;
    title: string;
    description: string;
    type: string;
    requirements: MissionRequirements;
    reward: MissionReward;
    status: string;
    createdAt: string;
    createdTurn: number;
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