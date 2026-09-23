/**
 * 一句话生成「完整作品」预计积分与素材勾选。
 * 张数按创意描述启发式估算，并钳制到后端 generate-from-idea 硬性区间
 *（场景 5–10、NPC 3–8；立绘 = NPC + 主角）。
 * 实扣仍以文本生成后的真实张数为准。
 */

/** 与 visualDocConsumer assertIdeaCountRange 对齐 */
export const IDEA_SCENE_COUNT_MIN = 5;
export const IDEA_SCENE_COUNT_MAX = 10;
export const IDEA_NPC_COUNT_MIN = 3;
export const IDEA_NPC_COUNT_MAX = 8;

/** 创意过短时的回退预计（仍落在合法区间内） */
export const EST_PORTRAIT_COUNT = IDEA_NPC_COUNT_MIN + 1;
export const EST_SCENE_COUNT = 6;
/** 封面固定横+竖各 1 张（各扣一次生图积分） */
export const EST_COVER_COUNT = 2;

const DEFAULT_TEXT_COST = 10;
const DEFAULT_IMAGE_UNIT = 6;

/** 创意里常见身份/关系词 → 暗示至少一个 NPC */
const ROLE_HINT_RE = /保姆|管家|女仆|秘书|司机|老师|同学|室友|邻居|朋友|老板|同事|警察|医生|护士|店员|服务员|房东|租客|女友|男友|妻子|丈夫|姐姐|妹妹|哥哥|弟弟|妈妈|爸爸|母亲|父亲|公主|王子|魔王|导师|徒弟|宿管|教练|记者|侦探|杀手|妖怪|精灵|吸血鬼|神明|神仙|妖怪|同学|学长|学姐|学弟|学妹|闺蜜|死党|上司|下属/g;

/** 创意里常见地点词 → 暗示场景 */
const PLACE_HINT_RE = /洗澡|泡澡|浴室|澡堂|卧室|房间|客厅|厨房|阳台|天台|地下室|学校|教室|办公室|咖啡|酒吧|公园|街道|医院|酒店|别墅|宿舍|图书馆|商场|餐厅|森林|城堡|实验室|泳池|更衣室|走廊|门口|电梯|地铁|车站|海边|山顶|庙宇|教堂|神社|宫殿|监狱|操场|礼堂|电影院|夜店|会所/g;

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

export interface IdeaAssetCountEstimate {
  /** 立绘张数（NPC + 主角） */
  portraitCount: number;
  /** 场景背景张数 */
  sceneCount: number;
  /** 对应 NPC 数（不含主角） */
  npcCount: number;
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

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function uniqueRegexHits(text: string, re: RegExp): number {
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
  const matcher = new RegExp(re.source, flags);
  const hits = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = matcher.exec(text)) !== null) {
    hits.add(m[0]);
  }
  return hits.size;
}

/**
 * 功能注释：根据创意描述估算将生成的立绘/场景张数。
 * 贴合后端大纲约束：场景 5–10、NPC 3–8；立绘 = NPC + 1 主角。
 * 创意过短时回退到区间中位附近默认值。
 */
export function estimateIdeaAssetCounts(idea: string): IdeaAssetCountEstimate {
  const text = String(idea || '').trim();
  if (text.length < 10) {
    return {
      portraitCount: EST_PORTRAIT_COUNT,
      sceneCount: EST_SCENE_COUNT,
      npcCount: IDEA_NPC_COUNT_MIN,
    };
  }

  const roleHits = uniqueRegexHits(text, ROLE_HINT_RE);
  const placeHits = uniqueRegexHits(text, PLACE_HINT_RE);

  // 字数越长，故事弧越可能需要更多 NPC/场景（仍钳在后端区间）
  const lengthBonusNpc = text.length >= 120 ? 2 : text.length >= 60 ? 1 : 0;
  const lengthBonusScene = text.length >= 150 ? 3 : text.length >= 80 ? 2 : text.length >= 40 ? 1 : 0;

  // 至少覆盖「我」之外一个配角；命中身份词则累加
  const rawNpc = Math.max(roleHits, 1) + lengthBonusNpc;
  const npcCount = clamp(rawNpc, IDEA_NPC_COUNT_MIN, IDEA_NPC_COUNT_MAX);

  // 地点词 + 剧情节奏填充；短描述也至少到后端下限 5
  const rawScene = Math.max(placeHits, 2) + 2 + lengthBonusScene;
  const sceneCount = clamp(rawScene, IDEA_SCENE_COUNT_MIN, IDEA_SCENE_COUNT_MAX);

  return {
    npcCount,
    portraitCount: npcCount + 1,
    sceneCount,
  };
}

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
  /** 传入创意描述时优先用启发式张数（可被 portraitCount/sceneCount 覆盖） */
  idea?: string;
}): number {
  const textCost = input.textCost ?? DEFAULT_TEXT_COST;
  if (input.mode !== 'full') {
    return textCost;
  }

  const fromIdea = typeof input.idea === 'string'
    ? estimateIdeaAssetCounts(input.idea)
    : null;

  const portraitUnit = input.portraitUnit ?? DEFAULT_IMAGE_UNIT;
  const sceneUnit = input.sceneUnit ?? DEFAULT_IMAGE_UNIT;
  const coverUnit = input.coverUnit ?? DEFAULT_IMAGE_UNIT;

  const portraitCount = input.portraitCount
    ?? fromIdea?.portraitCount
    ?? EST_PORTRAIT_COUNT;
  const sceneCount = input.sceneCount
    ?? fromIdea?.sceneCount
    ?? EST_SCENE_COUNT;

  let imagePoints = 0;
  if (input.assets.portraits) {
    imagePoints += Math.max(0, portraitCount) * portraitUnit;
  }
  if (input.assets.scenes) {
    imagePoints += Math.max(0, sceneCount) * sceneUnit;
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
