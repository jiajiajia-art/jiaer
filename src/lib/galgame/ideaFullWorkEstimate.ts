/**
 * 一句话生成「完整作品」预计积分与素材勾选（开弹窗时用预计张数，实扣按生成后张数）。
 * 默认单价与 src/utils/constants 对齐：文本 10、立绘/场景/封面 6。
 */

/** 开弹窗时尚无真实角色数时的预计立绘张数（含主角） */
export const EST_PORTRAIT_COUNT = 4;
/** 开弹窗时尚无真实场景数时的预计背景张数 */
export const EST_SCENE_COUNT = 6;
/** 封面固定 1 张 */
export const EST_COVER_COUNT = 1;

const DEFAULT_TEXT_COST = 10;
const DEFAULT_IMAGE_UNIT = 6;

export type IdeaGenerateMode = 'text' | 'full';

export interface IdeaAssetFlags {
  portraits: boolean;
  scenes: boolean;
  cover: boolean;
}

export interface IdeaGenerateOptions {
  mode: IdeaGenerateMode;
  assets: IdeaAssetFlags;
}

/** 完整作品默认勾选：立绘+场景，封面默认不勾（对齐设计稿） */
export const DEFAULT_FULL_ASSET_FLAGS: IdeaAssetFlags = {
  portraits: true,
  scenes: true,
  cover: false,
};

export const DEFAULT_TEXT_GENERATE_OPTIONS: IdeaGenerateOptions = {
  mode: 'text',
  assets: { portraits: false, scenes: false, cover: false },
};

/**
 * 功能注释：按勾选类型与预计张数估算完整作品总积分（文本 10 + 图片单价×张数）。
 */
export function estimateFullWorkPoints(input: {
  mode: IdeaGenerateMode;
  assets: IdeaAssetFlags;
  portraitCount?: number;
  sceneCount?: number;
  coverCount?: number;
  textCost?: number;
  portraitUnit?: number;
  sceneUnit?: number;
  coverUnit?: number;
}): number {
  const textCost = input.textCost ?? DEFAULT_TEXT_COST;
  if (input.mode !== 'full') {
    return textCost;
  }

  const portraitUnit = input.portraitUnit ?? DEFAULT_IMAGE_UNIT;
  const sceneUnit = input.sceneUnit ?? DEFAULT_IMAGE_UNIT;
  const coverUnit = input.coverUnit ?? DEFAULT_IMAGE_UNIT;

  let imagePoints = 0;
  if (input.assets.portraits) {
    imagePoints += Math.max(0, input.portraitCount ?? EST_PORTRAIT_COUNT) * portraitUnit;
  }
  if (input.assets.scenes) {
    imagePoints += Math.max(0, input.sceneCount ?? EST_SCENE_COUNT) * sceneUnit;
  }
  if (input.assets.cover) {
    imagePoints += Math.max(0, input.coverCount ?? EST_COVER_COUNT) * coverUnit;
  }
  return textCost + imagePoints;
}

/** 功能注释：是否需要在文本 job 成功后接力生图 */
export function shouldGenerateAssetsAfterIdea(options: IdeaGenerateOptions): boolean {
  if (options.mode !== 'full') return false;
  const { portraits, scenes, cover } = options.assets;
  return Boolean(portraits || scenes || cover);
}
