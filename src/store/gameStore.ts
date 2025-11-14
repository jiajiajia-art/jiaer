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
} from '../api/game/gameData';
import type { MissionData } from '../api/game/missionApi.type';

// 重新导出基础类型（从 gameData 导入）
export type { PlayerProfile, PlayerStats, ScenesMap, Scene, PlayerData, Inventory, GameItem };

// 前端特有的类型定义（与后端数据结构不同）
export interface PlayerState {
    profile: PlayerProfile;
    stats: PlayerStats;
    experience: { current: number; required: number };
    currency: { gold: number };
}

export interface Item {
    id: string;
    name?: string;
    description?: string;
    icon?: string;
    quantity: number;
    stackable?: boolean;
    equippable?: boolean;
    usable?: boolean;
    slots?: string[];
    effects?: Partial<PlayerStats>;
}

export interface EquipmentSlots {
    head: Item | null;
    body: Item | null;
    legs: Item | null;
    hands: Item | null;
    feet: Item | null;
    back: Item | null;
    leftHand: Item | null;
    rightHand: Item | null;
}

export interface InventoryState {
    equipment: EquipmentSlots;
    items: Item[];
}

// SceneNode 类型别名，兼容旧代码
export type SceneNode = Scene;

interface GameState {
  pdfFileId: string | null;
  setPdfFileId: (id: string | null) => void;
  clearPdfFile: () => void;

  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  clearSessionId: () => void;

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

  // 背包数据
  inventory: Inventory | null;
  setInventory: (inventory: Inventory | null) => void;
  updateInventory: (updater: (inventory: Inventory | null) => Inventory | null) => void;

  // 物品定义
  items: Record<string, GameItem>;
  setItems: (items: Record<string, GameItem>) => void;

  // 任务数据
  missionData: MissionData | null;
  setMissionData: (missionData: MissionData | null) => void;

  // 音乐状态（全局共享）
  isPlaying: boolean;
  setIsPlaying: (isPlaying: boolean) => void;
  volume: number;
  setVolume: (volume: number) => void;

  clearAll: () => void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      pdfFileId: '',
      setPdfFileId: (id) => set({ pdfFileId: id }),
      clearPdfFile: () => set({ pdfFileId: null }),

      sessionId: '',
      setSessionId: (id) => set({ sessionId: id }),
      clearSessionId: () => set({ sessionId: null }),

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

      // 背包数据
      inventory: null,
      setInventory: (inventory) => set({ inventory }),
      updateInventory: (updater) => set((state) => ({ inventory: updater(state.inventory) })),

      // 物品定义
      items: {},
      setItems: (items) => set({ items }),

      // 任务数据
      missionData: null,
      setMissionData: (missionData) => set({ missionData }),

      // 音乐状态
      isPlaying: false,
      setIsPlaying: (isPlaying) => set({ isPlaying }),
      volume: 1,
      setVolume: (volume) => set({ volume }),

      clearAll: () => set({ 
        pdfFileId: null, 
        sessionId: null,
        scenes: {},
        currentSceneId: '',
        player: null,
        inventory: null,
        items: {},
        isPlaying: false,
        volume: 1,
      }),
    }),
    { 
      name: 'game-storage',
      // 只持久化关键数据，游戏运行时数据不持久化（每次从后端获取）
      partialize: (state) => ({
        pdfFileId: state.pdfFileId,
        sessionId: state.sessionId,
        // scenes, player, inventory 不持久化，每次从后端加载
      }),
    }
  )
);
