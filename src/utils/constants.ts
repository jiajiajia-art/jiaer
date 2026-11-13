import { ASSET_HOST_ADDRESS, HOST_ADDRESS, resolveImageHostAddress } from "../config";
export {
  toDisplayCoverUrl,
  resolveGameCoverUrl,
  resolveGameListCoverUrl,
  resolveOriginalCoverUrl,
  coverUrlAfterDisplayCoverError,
} from './displayCoverUrl';
export { preferCharacterPortraitWebp } from './characterPortraitUrl';
import { preferCharacterPortraitWebp } from './characterPortraitUrl';

// ==================== 积分相关常量 ====================
/** 局内角色档案字段 AI 生成（关系/简介/态度），对齐后端 txt_npc_profile_field */
export const NPC_PROFILE_FIELD_GENERATION_COST = 1;
/** TXT 文游：AI 一句话生成游戏设定，对齐后端 txt_idea_generate */
export const TXT_IDEA_GENERATE_COST = 10;
/** TXT 文游：一句话弹窗内创意描述 AI 生成，对齐后端 txt_idea_text */
export const TXT_IDEA_TEXT_COST = 1;
export const OPTION_COST = 2;
export const INPUT_COST = 3;
export const HISTORY_MESSAGE_THRESHOLD = 5;
export const CHECK_IN_REWARD_POINTS = 9;
/** 旧世界互动编辑器继续沿用固定织梦豆价格，不接入平台生图动态配置。 */
export const LEGACY_WORLD_CHARACTER_GENERATION_COST = 6;
export const LEGACY_WORLD_SCENE_GENERATION_COST = 6;
export const LEGACY_WORLD_ABILITY_NODE_GENERATION_COST = 6;
export const LEGACY_WORLD_OBJECT_BATCH_GENERATION_COST = 10;
export const LEGACY_WORLD_MAP_GENERATION_COST = 6;

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
  // 功能注释：Romance 草稿封面可能是 data:/blob:，禁止再拼 ASSET_HOST
  if (displayPath.startsWith("data:") || displayPath.startsWith("blob:")) {
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
  // 功能注释：封面走 ASSET_HOST；用户头像走 API 主机，见 resolveImageHostAddress
  return `${resolveImageHostAddress(normalizedPath, HOST_ADDRESS)}${normalizedPath}`;
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
  // 功能注释：音频等同静态资源，走 ASSET_HOST，避免 cn-test-api 前缀导致 404
  return `${ASSET_HOST_ADDRESS}${musicPath.startsWith("/") ? musicPath : `/${musicPath}`}`;
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

