// ==================== 图片生成相关 ====================

import { HOST_ADDRESS } from "../config";

/** 单张图片生成的积分消耗 */
export const IMAGE_GENERATION_COST = 10;

// ==================== 游戏交互相关 ====================
/** 选择选项消耗的积分 */
export const OPTION_COST = 2;

/** 用户自定义输入消耗的积分 */
export const INPUT_COST = 3;

/** 历史消息数量阈值（超过此数量才开始收费） */
export const HISTORY_MESSAGE_THRESHOLD = 5;

/** 每日签到可获得的积分 */
export const CHECK_IN_REWARD_POINTS = 9;

export const getImageUrl = (imagePath: string | null | undefined): string => {
  if (!imagePath) return "";
  
  // 确保 imagePath 是字符串类型
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

export const addImageTimestamp = (url: string | undefined): string => {
  if (!url) return '';
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}t=${Date.now()}`;
};

/**
 * 规范化 icon 数据（统一处理对象和字符串格式）
 * 用于统一处理后端返回的 icon 可能是对象或字符串的情况
 */
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

/**
 * 获取 player 图片的统一兜底函数
 * 支持 imagePath、image、images 三个字段
 * images 可能是 string 或对象 { base: string, ... }
 * 优先级：images > imagePath > image
 * 如果 images 是对象，取 base 字段
 */
export const getPlayerImageUrl = (player: any, defaultImage?: string): string => {
  if (!player) return defaultImage || '';
  
  // 1. 优先使用 images 字段
  if (player.images !== undefined && player.images !== null) {
    if (typeof player.images === 'string') {
      return player.images || defaultImage || '';
    }
    if (typeof player.images === 'object' && player.images !== null) {
      const baseImage = player.images.base || '';
      if (baseImage) return baseImage;
    }
  }
  
  // 2. 其次使用 imagePath 字段
  if (player.imagePath && typeof player.imagePath === 'string') {
    return player.imagePath;
  }
  
  // 3. 最后使用 image 字段
  if (player.image && typeof player.image === 'string') {
    return player.image;
  }
  
  return defaultImage || '';
};

export const DEFAULT_SCENE_IMAGE = `${import.meta.env.BASE_URL}data/assets/创作界面切图/defaultScene.png`;
export const DEFAULT_WORLD_MAP_IMAGE = `${import.meta.env.BASE_URL}data/assets/创作界面切图/defaultMap.png`;

export const getMusicUrlWithHost = (
  musicPath: string | null | undefined
): string => {
  if (!musicPath) return "";
  if (musicPath.startsWith("http://") || musicPath.startsWith("https://")) {
    return musicPath;
  }
  if (musicPath.startsWith("/api")) {
    return `${HOST_ADDRESS}${musicPath}`;
  }
  return `${HOST_ADDRESS}${musicPath}`;
};
