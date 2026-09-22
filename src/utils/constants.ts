import { HOST_ADDRESS } from "../config";
export { toDisplayCoverUrl, resolveGameCoverUrl, resolveGameListCoverUrl } from './displayCoverUrl';
export { preferCharacterPortraitWebp } from './characterPortraitUrl';
import { preferCharacterPortraitWebp } from './characterPortraitUrl';

// ==================== 积分相关常量 ====================
export const SCENE_GENERATION_COST = 6;      // 场景生成费用
export const CHARACTER_GENERATION_COST = 6;   // 角色/NPC/差分图生成费用
/** 局内角色档案字段 AI 生成（关系/简介/态度），对齐后端 txt_npc_profile_field */
export const NPC_PROFILE_FIELD_GENERATION_COST = 1;
/** TXT 文游：AI 一句话生成游戏设定，对齐后端 txt_idea_generate */
export const TXT_IDEA_GENERATE_COST = 10;
/** TXT 文游：一句话弹窗内创意描述 AI 生成，对齐后端 txt_idea_text */
export const TXT_IDEA_TEXT_COST = 1;
/** TXT 文游：文档导入解析，对齐后端 txt_doc_parse */
export const TXT_DOC_PARSE_COST = 10;
export const OPTION_COST = 2;
export const INPUT_COST = 3;
export const HISTORY_MESSAGE_THRESHOLD = 5;
export const CHECK_IN_REWARD_POINTS = 9;

// ==================== 会员折扣 ====================
// 会员在创作类操作（生成角色立绘/场景/差分等）上的折扣比例
// 0.5 = 5 折（半价），1 = 不打折
// 注意：这是硬编码的业务规则常量，如需后端下发请迁移到 usePricingStore
export const MEMBER_CREATION_DISCOUNT = 0.5;

// ==================== 默认图片 ====================
export const DEFAULT_SCENE_IMAGE = `${import.meta.env.BASE_URL}data/assets/创作界面切图/defaultScene.png`;
export const DEFAULT_WORLD_MAP_IMAGE = `${import.meta.env.BASE_URL}data/assets/创作界面切图/defaultMap.png`;

// ==================== URL 处理函数 ====================
export const getImageUrl = (imagePath: string | null | undefined): string => {
  if (!imagePath) return "";
  
  const path = typeof imagePath === 'string' ? imagePath : String(imagePath || '');
  if (!path) return "";

  // 功能注释：NPC/玩家立绘展示优先同名 webp（历史 png 由后端懒转）
  const displayPath = preferCharacterPortraitWebp(path);

  if (displayPath.startsWith("http://") || displayPath.startsWith("https://")) {
    return displayPath;
  }

  const isDefaultImage =
    displayPath.includes("defaultNpc.png") ||
    displayPath.includes("defaultScene.png") ||
    displayPath.includes("defaultMap.png") ||
    displayPath.startsWith(import.meta.env.BASE_URL);
  if (isDefaultImage) {
    return displayPath;
  }

  const normalizedPath = displayPath.startsWith("/")
    ? displayPath
    : `/${displayPath}`;
  return `${HOST_ADDRESS}${normalizedPath}`;
};

export const getPlayerImageUrl = (player: any, defaultImage?: string): string => {
  if (!player) return defaultImage || '';
  
  if (player.images !== undefined && player.images !== null) {
    if (typeof player.images === 'string') {
      return player.images || defaultImage || '';
    }
    if (typeof player.images === 'object' && player.images !== null) {
      const baseImage = player.images.base || '';
      if (baseImage) return baseImage;
    }
  }
  
  if (player.imagePath && typeof player.imagePath === 'string') {
    return player.imagePath;
  }
  
  if (player.image && typeof player.image === 'string') {
    return player.image;
  }
  
  return defaultImage || '';
};

export const getMusicUrlWithHost = (musicPath: string | null | undefined): string => {
  if (!musicPath) return "";
  if (musicPath.startsWith("http://") || musicPath.startsWith("https://")) {
    return musicPath;
  }
  if (musicPath.startsWith("/api")) {
    return `${HOST_ADDRESS}${musicPath}`;
  }
  return `${HOST_ADDRESS}${musicPath}`;
};

export const normalizeIcon = (icon: any): string => {
  if (!icon) return '';
  if (typeof icon === 'string') return icon;
  if (typeof icon === 'object' && icon !== null) {
    const iconObj = icon as any;
    if (Object.keys(iconObj).length === 0) return '';
    return iconObj.url || iconObj.path || iconObj.icon || iconObj.src || iconObj.value || '';
  }
  return '';
};

