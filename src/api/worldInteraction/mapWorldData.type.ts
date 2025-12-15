// 使用统一的类型定义
import type { 
    UnifiedGameData,
    WorldSetting as UnifiedWorldSetting,
    Player as UnifiedPlayer,
    NPC as UnifiedNPC,
    Scene as UnifiedScene,
    SceneSetting as UnifiedSceneSetting,
    NPCSetting as UnifiedNPCSetting
} from "../common/gameData.type";

// 重新导出统一类型，保持向后兼容
export type { KeyEvent, SubScene } from "../common/gameData.type";
export type PlayerCharacter = UnifiedPlayer;
export type NPC = UnifiedNPC;
export type Scene = UnifiedScene;
export type WorldSetting = UnifiedWorldSetting;
export type NPCSetting = UnifiedNPCSetting;
export type SceneSetting = UnifiedSceneSetting;

// 为了向后兼容，保留原有类型定义
export type AllGameData = UnifiedGameData;
