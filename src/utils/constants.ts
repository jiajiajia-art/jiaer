import { HOST_ADDRESS } from "../config";

// ==================== 积分相关常量 ====================
export const SCENE_GENERATION_COST = 6;      // 场景生成费用
export const CHARACTER_GENERATION_COST = 6;   // 角色/NPC/差分图生成费用
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

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const isDefaultImage =
    path.includes("defaultNpc.png") ||
    path.includes("defaultScene.png") ||
    path.includes("defaultMap.png") ||
    path.startsWith(import.meta.env.BASE_URL);
  if (isDefaultImage) {
    return path;
  }

  const normalizedPath = path.startsWith("/")
    ? path
    : `/${path}`;
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

