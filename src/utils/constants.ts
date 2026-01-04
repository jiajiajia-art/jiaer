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
    if (!imagePath) return '';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    return `${HOST_ADDRESS}/${imagePath}`;
  };
  
  export const getImageUrlWithHost = (imagePath: string | null | undefined): string => {
    if (!imagePath) return '';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    const isDefaultImage = imagePath.includes('defaultNpc.png') || 
                          imagePath.includes('defaultScene.png') || 
                          imagePath.includes('defaultMap.png') ||
                          imagePath.startsWith(import.meta.env.BASE_URL);
    if (isDefaultImage) {
      return imagePath;
    }
    return `${HOST_ADDRESS}${imagePath}`;
  };

  export const getMusicUrlWithHost = (musicPath: string | null | undefined): string => {
    if (!musicPath) return '';
    if (musicPath.startsWith('http://') || musicPath.startsWith('https://')) {
      return musicPath;
    }
    if (musicPath.startsWith('/api')) {
      return `${HOST_ADDRESS}${musicPath}`;
    }
    return `${HOST_ADDRESS}${musicPath}`;
  };