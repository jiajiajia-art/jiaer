import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
    PlayerProfile, 
    PlayerStats, 
    ScenesMap, 
    Scene,
    PlayerData,
    Inventory,
    GameItem
} from '../api/rpgGame/gameData.type';
import type { MissionData } from '../api/rpgGame/missionApi.type';
import type { UserGameData } from '../api/home/getGameData.type';

// 重新导出基础类型（从 gameData 导入）
export type { PlayerProfile, PlayerStats, ScenesMap, Scene, PlayerData, Inventory, GameItem };

// 前端特有的类型定义（与后端数据结构不同）
export interface PlayerState {
    profile: PlayerProfile;
    stats: PlayerStats;
    experience: { current: number; required: number };
    currency: { gold: number };
}

// SceneNode 类型别名，兼容旧代码
export type SceneNode = Scene;

interface GameState {
  fileId: string | null;
  setFileId: (id: string | null) => void;
  clearPdfFile: () => void;

  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  clearSessionId: () => void;

  isPreset: boolean | null;
  setIsPreset: (isPreset: boolean | null) => void;

  // 场景数据（频繁变化，多组件使用）
  scenes: ScenesMap;
  setScenes: (scenes: ScenesMap) => void;
  updateScenes: (updater: (scenes: ScenesMap) => ScenesMap) => void;
  currentSceneId: string;
  setCurrentSceneId: (id: string) => void;

  // 玩家数据
  player: PlayerData | null;
  setPlayer: (player: PlayerData | null) => void;
  updatePlayer: (updater: (player: PlayerData | null) => PlayerData | null) => void;

  // 物品定义
  items: Record<string, GameItem>;
  setItems: (items: Record<string, GameItem>) => void;

  // 任务数据
  missionData: MissionData | null;
  setMissionData: (missionData: MissionData | null) => void;

  // 游戏详情数据（用于显示简介等）
  gameDetail: UserGameData | null;
  setGameDetail: (gameDetail: UserGameData | null) => void;

  // 游戏是否已开始（基于历史记录判断）
  gameStarted: boolean;
  setGameStarted: (started: boolean) => void;

  // 音乐状态（全局共享）
  isPlaying: boolean;
  setIsPlaying: (isPlaying: boolean) => void;
  volume: number;
  setVolume: (volume: number) => void;

  // 实验功能开关（Galgame专用）
  galgameBetaAttributes: boolean | null; // null 表示未检测
  setGalgameBetaAttributes: (enabled: boolean | null) => void;

  clearAll: () => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      fileId: '',
      setFileId: (id) => set({ fileId: id }),
      clearPdfFile: () => set({ fileId: null }),

      sessionId: '',
      setSessionId: (id) => set({ sessionId: id }),
      clearSessionId: () => set({ sessionId: null }),

      isPreset: false,
      setIsPreset: (isPreset) => set({ isPreset }),

      // 场景数据
      scenes: {},
      setScenes: (scenes) => {
        // 强制创建新对象引用，确保 React 检测到变化
        const updatedScenes: ScenesMap = {};
        Object.keys(scenes).forEach(sceneId => {
          const scene = scenes[sceneId];
          updatedScenes[sceneId] = {
            ...scene,
            npcs: Array.isArray(scene.npcs) ? scene.npcs.map(npc => ({ ...npc })) : [],
            buildings: Array.isArray(scene.buildings) ? scene.buildings.map(building => ({ ...building })) : [],
            exits: scene.exits ? { ...scene.exits } : {},
          };
        });
        set({ scenes: updatedScenes });
      },
      updateScenes: (updater) => set((state) => ({ scenes: updater(state.scenes) })),
      currentSceneId: '',
      setCurrentSceneId: (id) => set({ currentSceneId: id }),

      // 玩家数据
      player: null,
      setPlayer: (player) => set({ player }),
      updatePlayer: (updater) => set((state) => ({ player: updater(state.player) })),


      // 物品定义
      items: {},
      setItems: (items) => set({ items }),

      // 任务数据
      missionData: null,
      setMissionData: (missionData) => set({ missionData }),

      // 游戏详情数据
      gameDetail: null,
      setGameDetail: (gameDetail) => set({ gameDetail }),

      // 游戏是否已开始
      gameStarted: false,
      setGameStarted: (started) => set({ gameStarted: started }),

      // 音乐状态
      isPlaying: false,
      setIsPlaying: (isPlaying) => set({ isPlaying }),
      volume: 1,
      setVolume: (volume) => set({ volume }),

      // 实验功能开关（不持久化）
      galgameBetaAttributes: null,
      setGalgameBetaAttributes: (enabled) => set({ galgameBetaAttributes: enabled }),

      clearAll: () => set({ 
        fileId: null, 
        sessionId: null,
        isPreset: null,
        scenes: {},
        currentSceneId: '',
        player: null,
        items: {},
        gameDetail: null,
        gameStarted: false,
        isPlaying: false,
        volume: 1,
      }),
    }),
    { 
      name: 'game-storage',
      // 只持久化关键数据，游戏运行时数据不持久化（每次从后端获取）
      partialize: (state) => ({
        fileId: state.fileId,
        sessionId: state.sessionId,
        // scenes, player, inventory 不持久化，每次从后端加载
      }),
    }
  )
);
