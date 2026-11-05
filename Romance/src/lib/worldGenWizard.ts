/**
 * 创作游戏 · 生成世界向导：第 1 步（名称/设定/引擎/勾选 AI 模组）→ 真实 AI 分模组生成 → 第 2 步完整编辑器。
 * 旧六项「选择生成内容」UI 已取消，改为勾选编辑器模组（WORLD_GEN_EDITOR_STEPS）；开局游玩偏好不在向导。
 * 供 WorldGenWizard UI 与单测共用；不依赖 React。
 */
import { EDITOR_HUB_MENUS } from "./editorHubMenus.ts";
import { readFunloomAuthorLabel } from "./platformAvatarLibrary.ts";
import type { PlayPrefs, PlaySlot } from "./types.ts";

export const WORLD_TITLE_MAX = 20;
export const WORLD_SETTING_MAX = 5000;
/** 功能注释：禁止生成清单上限；可选填写，不占故事设定字数 */
export const WORLD_FORBID_MAX = 2000;
/** 功能注释：玩家可见简介默认摘要目标字数；可手改，上限见 modBasicInfoLimits.MOD_DESC_MAX */
export const WORLD_DESC_SUMMARY_TARGET = 100;

/**
 * 功能注释：简介给玩家看，必须是世界观摘要，禁止把创作者长设定原文切片塞进 description。
 * 优先取首句；过长则在标点处压到约 target 字。
 */
export function summarizeWorldGenDescription(
  setting: string,
  title = "",
  target = WORLD_DESC_SUMMARY_TARGET,
): string {
  const cap = Math.max(40, Math.min(200, Math.floor(target) || WORLD_DESC_SUMMARY_TARGET));
  const name = String(title ?? "").trim();
  const raw = String(setting ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return name ? `${name}。` : "";
  if (raw.length <= cap) return raw;
  const firstSentence = raw.match(/^[\s\S]{8,}?[。！？!?]/)?.[0]?.trim();
  if (firstSentence && firstSentence.length <= cap) return firstSentence;
  const slice = (firstSentence && firstSentence.length > cap ? firstSentence : raw).slice(0, cap);
  const marks = ["。", "！", "？", "；", "，", "、", " ", "—", "-"];
  let cut = -1;
  for (const ch of marks) {
    const i = slice.lastIndexOf(ch);
    if (i > cut) cut = i;
  }
  if (cut >= Math.floor(cap * 0.35)) return slice.slice(0, cut + 1).trim();
  return slice.trim();
}

/** 功能注释：写入 prompt.extraRules / 生成提示的标准块；空则返回空串 */
export function formatWorldGenForbidBlock(forbidGen: string | null | undefined): string {
  const text = String(forbidGen ?? "").trim();
  if (!text) return "";
  return `【禁止生成】\n${text}`;
}

/** 创作 AI 线路（消耗倍率仅展示；实际扣费后续接平台账本） */
export type WorldGenEngineId = "balanced" | "deep" | "light";

export type WorldGenEngine = {
  id: WorldGenEngineId;
  name: string;
  desc: string;
  tag: string;
  rate: number;
};

export const WORLD_GEN_ENGINES: readonly WorldGenEngine[] = Object.freeze([
  {
    id: "balanced",
    name: "平衡叙事",
    desc: "兼顾剧情推进、人物塑造与叙事节奏",
    tag: "通用",
    rate: 1,
  },
  {
    id: "deep",
    name: "深度推演",
    desc: "擅长复杂设定、人物动机与长线因果",
    tag: "深度",
    rate: 1.5,
  },
  {
    id: "light",
    name: "轻量灵感",
    desc: "快速完成基础框架，适合反复调整",
    tag: "高效率",
    rate: 0.6,
  },
]);

/**
 * 内容类别：仅作编辑器模块 contentIds 映射（旧六项勾选 UI 已取消）。
 * 实际勾选以 editorStepIds（编辑器模组）为准。
 */
export type WorldGenContentId =
  | "world"
  | "mainPlot"
  | "characters"
  | "locations"
  | "sideEvents"
  | "opening";

export type WorldGenContentOpt = {
  id: WorldGenContentId;
  name: string;
  desc: string;
};

export const WORLD_GEN_CONTENTS: readonly WorldGenContentOpt[] = Object.freeze([
  { id: "world", name: "世界与规则", desc: "时代背景、世界规则与内容边界" },
  { id: "mainPlot", name: "主线剧情", desc: "故事目标、核心冲突与关键转折" },
  { id: "characters", name: "主要角色", desc: "身份设定、行动动机与人物关系" },
  { id: "locations", name: "地点场景", desc: "关键地点、场景功能与环境氛围" },
  { id: "sideEvents", name: "支线事件", desc: "触发事件、选择分支与后续影响" },
  { id: "opening", name: "开场剧情", desc: "生成可直接进入游玩的第一幕" },
]);

export const ALL_WORLD_GEN_CONTENT_IDS: readonly WorldGenContentId[] = Object.freeze(
  WORLD_GEN_CONTENTS.map((c) => c.id),
);

/**
 * 编辑器模块清单（向导第 3 步进入编辑器时默认带入）：
 * 1) 游戏内「编辑器」EditorHub 全部菜单（与胶囊导航 label 完全一致）
 * 2) 模组编辑器 ModEditorPanel 细项（Hub 未单独列出的生成区块；开局游玩偏好不在编辑器/向导，改由建角与局内设置）
 * contentIds：内容类别映射（向导默认全选，用于推导编辑器模块）。
 */
export type WorldGenEditorStep = {
  id: string;
  group: string;
  name: string;
  desc: string;
  contentIds: readonly WorldGenContentId[];
  /** hub = 游戏编辑器菜单；mod = 模组编辑器细项 */
  source: "hub" | "mod";
};

/**
 * 首次 AI 默认只生成「基础世界」模组（地点/人物/势力/建角/开局事件等）。
 * 玩法组件、手机应用、孕育、经营、通告、座驾等扩展不得进默认勾选。
 */
export const DEFAULT_WORLD_GEN_EDITOR_STEP_IDS: readonly string[] = Object.freeze([
  // 世界观：剧本基调 / 世界规则 / 世界书
  "prompt",
  "hub:rules",
  "hub:book",
  // 开局时间 · 资源（出行 / 天气属玩法扩展，不进默认基础世界）
  "travelTime",
  "startResources",
  // 地点 · 人物 · 势力（世界书 = hub:book，已在上方）
  "rooms",
  "npcs",
  // 建角（旧 stats / creationFields 在 normalize 时并入 creation）
  "creation",
  "hub:paths",
  // 开局事件与主线
  "fixedEvents",
  "storylines",
  // 功能注释：开场剧情默认不生成、不进预览必填；创作者可在编辑器⑤美化自行配置
]);

export function isWorldGenCoreStep(id: string): boolean {
  return (DEFAULT_WORLD_GEN_EDITOR_STEP_IDS as readonly string[]).includes(id);
}

/** Hub 菜单 id → 默认关联的第 1 步生成内容 */
const HUB_CONTENT: Record<string, readonly WorldGenContentId[]> = {
  person: ["characters"],
  map: ["locations"],
  rules: ["world"],
  engine: ["world"],
  beauty: ["opening"],
  nav: ["opening"],
  book: ["world"],
  fixed: ["mainPlot", "sideEvents"],
  cg: ["mainPlot", "opening"],
  audio: ["opening"],
  faction: ["characters", "world"],
  timeline: ["mainPlot"],
  end: ["mainPlot"],
  paths: ["characters"],
  mods: ["world"],
};

/**
 * 只有这几个 Hub 菜单产出模组细项里没有的字段（worldRules / worldBook / creation.paths）。
 * 其余 Hub 菜单与模组细项写同一批字段（人物=npcs、地点=rooms…）或只有素材引用（CG），
 * 列进 AI 勾选只会重复计数、重复扣费，故不单列。世界书只走 hub:book。
 */
const WORLD_GEN_HUB_MENU_IDS: readonly string[] = ["rules", "book", "paths"];

/** 旧草稿里已下架的 AI 勾选 id → 写同一批字段的现行模组；映射为空数组表示直接丢弃 */
const RETIRED_WORLD_GEN_STEP_IDS: Record<string, readonly string[]> = {
  stats: ["creation"],
  creationFields: ["creation"],
  creationPools: ["creation"],
  endings: ["storylines"],
  // 功能注释：经济收官已并进③养成引擎规则（tuning.economy），旧勾选映射到 tuning
  economy: ["tuning"],
  lore: ["hub:book"],
  festivals: ["hub:book"],
  // 功能注释：功能开关已下线；旧草稿勾选映射到「已添加的玩法」
  features: ["playModInstalls"],
  // 功能注释：旧「养成规则」拆开——分档进建角属性，头衔进玩法头衔包
  growRules: ["creation", "titles"],
  "hub:cg": [],
  "hub:person": ["npcs"],
  "hub:map": ["rooms"],
  "hub:fixed": ["fixedEvents"],
  "hub:faction": ["hub:paths"],
  "hub:timeline": ["storylines"],
  "hub:end": ["storylines"],
  "hub:engine": ["tuning"],
  // 功能注释：开局封面 / 手机应用 / 皮肤美化不再进 AI 勾选，旧 hub:beauty 只映射到仍可生成的剧情美化
  "hub:beauty": ["lookRules"],
  "hub:nav": ["navTabs"],
  "hub:audio": ["bgm", "audioRefs"],
  "hub:mods": ["playModInstalls"],
  // 功能注释：美化默认项不交 AI；旧草稿勾选直接丢弃（封面标题在 draftModFromWorldGen 用剧本名写入）
  cover: [],
  phoneAppsCfg: [],
  theme: [],
  // 功能注释：开场默认不要；旧会话勾选开场剧情直接丢弃，改走编辑器手配
  opening: [],
};

const HUB_STEPS: WorldGenEditorStep[] = EDITOR_HUB_MENUS.filter((m) => WORLD_GEN_HUB_MENU_IDS.includes(m.id)).map((m) => ({
  id: `hub:${m.id}`,
  group: m.group,
  name: m.label,
  desc: m.hint,
  contentIds: HUB_CONTENT[m.id] ?? ["world"],
  source: "hub" as const,
}));

/** 模组细项：Hub 已有同名入口的不再重复列出（世界书/阵营/CG/人物线路等） */
const MOD_STEPS: WorldGenEditorStep[] = [
  // ① 基础（头像 + 建角在地点之上；时间字段并入时间与推进）
  { id: "travelTime", group: "① 基础", name: "时间与推进", desc: "开局日期 · 行动点 · 按日/周/月/年推进 · 年龄随日历", contentIds: ["world"], source: "mod" },
  { id: "avatars", group: "① 基础", name: "头像", desc: "私库 · 公库 · 分类 · 私人/公共库优先 · 通用兜底（随本剧保存）", contentIds: ["characters"], source: "mod" },
  { id: "creation", group: "① 基础", name: "建角", desc: "建角字段：系统四项 + 文本/单选/数值/日期/货币（含开局资金）；数值可配分档（多少分叫什么）", contentIds: ["characters", "world"], source: "mod" },
  { id: "startResources", group: "① 基础", name: "开局资金", desc: "已并入建角字段列表的货币项", contentIds: ["world"], source: "mod" },

  // ② 角色（「人物」「人物线路」已在 Hub；关系玩法已迁至①基础玩法 Mod）
  { id: "npcs", group: "② 角色", name: "人物（模组库）", desc: "统一角色表：名字 · 关系 · 开局认识/联系人 · 地点 · 时间线 · 音色", contentIds: ["characters"], source: "mod" },
  { id: "contacts", group: "② 角色", name: "关系档位与卡片数值", desc: "嵌在开局人物上方 · 档位分段 · 卡片数值条数自定可隐藏", contentIds: ["characters"], source: "mod" },

  // ③ 养成（名气分档已并入建角属性；头衔改为玩法 Mod）
  { id: "trainings", group: "③ 养成", name: "培训课程", desc: "须先勾选「课程」模块 · 学费 · 体力 · 属性收益", contentIds: ["world", "mainPlot"], source: "mod" },
  { id: "sideJobs", group: "③ 养成", name: "打工 · 周末活动", desc: "须先勾选「打工」模块 · 收入 · 压力 · 解锁条件", contentIds: ["world", "mainPlot"], source: "mod" },
  { id: "income", group: "③ 养成", name: "账单与周期收入", desc: "须先勾选「账单」模块 · 固定账单 · 每周发放/扣除", contentIds: ["world"], source: "mod" },
  { id: "gameRules", group: "③ 养成", name: "玩法规则", desc: "须先勾选 · 如果/否则 · 每天/每周判定", contentIds: ["world", "mainPlot"], source: "mod" },
  { id: "tuning", group: "③ 养成", name: "引擎规则与经济", desc: "表现评级 · 休息 ·（有相关玩法才生成）课程/通告结算/违约 · 扣费依据（破产规则在结局配置）", contentIds: ["world"], source: "mod" },

  // 地点已并入①基础（取消独立「④ 世界」页签）；出行属玩法 Mod
  { id: "rooms", group: "① 基础", name: "地点（模组库）", desc: "多级子地点 · 树状预览 · 准入 · 出口 · 开局地点", contentIds: ["locations"], source: "mod" },

  // ④ 剧情（开场页与剧情美化在⑥美化；结局插图仍随结局留在这里）
  { id: "prompt", group: "① 基础", name: "剧本基调", desc: "写给模型的整段基调（原 GM / 世界观 / 口吻合并）", contentIds: ["world"], source: "mod" },
  { id: "fixedEvents", group: "④ 剧情", name: "固定事件（模组库）", desc: "首次事件 · 预设剧本 · 时间 / 条件触发 · 事件链", contentIds: ["mainPlot", "sideEvents", "opening"], source: "mod" },
  { id: "storylines", group: "④ 剧情", name: "剧情线", desc: "一条主线（有序节点）· 结局与时限 · 评级；支线手建", contentIds: ["mainPlot", "sideEvents", "world"], source: "mod" },

  // 玩法并入①基础：添加即启用，不再单独生成「功能开关」
  { id: "playModInstalls", group: "① 基础", name: "已添加的玩法", desc: "推荐 · 确认添加 · 底栏名 · 显隐（添加即启用）", contentIds: ["world", "mainPlot"], source: "mod" },
  { id: "travel", group: "① 基础", name: "出行与交通", desc: "须添加玩法后自定义：选择区标题 · 货币 · 出行方式 · 花费", contentIds: ["locations", "world"], source: "mod" },
  { id: "cars", group: "① 基础", name: "座驾", desc: "须添加座驾包后配置购车与切换（建议先加出行与交通）", contentIds: ["locations", "world"], source: "mod" },
  { id: "gigs", group: "① 基础", name: "通告库", desc: "通告门槛 · 酬劳 · 名气 · 成长 · 星级价目表", contentIds: ["mainPlot", "world"], source: "mod" },
  { id: "contracts", group: "① 基础", name: "经纪合约", desc: "开局候选合约 · 通告性质 · 议价规则", contentIds: ["characters", "mainPlot"], source: "mod" },
  { id: "projects", group: "① 基础", name: "影视项目", desc: "项目模板 · 试镜 · 片场事件 · 质量与上映", contentIds: ["mainPlot"], source: "mod" },
  { id: "industry", group: "① 基础", name: "行业生态", desc: "经纪公司 · 片名库 · 代言品牌 · 奖项 · 圈内动态", contentIds: ["world", "characters"], source: "mod" },
  { id: "imageCrisis", group: "① 基础", name: "舆情人设", desc: "人设 · 公开行动 · 危机 · 公关应对 · 判定权重", contentIds: ["characters", "sideEvents"], source: "mod" },
  { id: "weeklyPaper", group: "① 基础", name: "娱乐周报", desc: "报头 · 副标题", contentIds: ["world"], source: "mod" },
  { id: "meals", group: "① 基础", name: "每周吃什么", desc: "伙食档位 · 每周花费 · 压力 / 能力 / 气色", contentIds: ["world"], source: "mod" },
  { id: "titles", group: "① 基础", name: "头衔", desc: "须添加「头衔包」后配置 · 达标条件 · 品阶", contentIds: ["world", "mainPlot"], source: "mod" },
  { id: "pregnancy", group: "① 基础", name: "孕育", desc: "孕期 · 受孕率 · 察觉时间 · 孩子名字池", contentIds: ["characters", "world"], source: "mod" },
  { id: "relations", group: "① 基础", name: "关系玩法", desc: "须添加「关系玩法」包后配置 · 表白门槛 · 婚礼 · 牵线 · 伴侣加成（勿预置牵线方式）", contentIds: ["characters"], source: "mod" },

  // ⑤ 美化：开局封面 / 手机应用配置 / 皮肤美化不进 AI 勾选（引擎默认 + 剧本名作封面标题）
  // 功能注释：开场白默认进基础生成；自定义 HTML 开场页仍由编辑器 OpeningStyleStudio 手改，不交本步
  { id: "opening", group: "⑤ 美化", name: "开场剧情", desc: "开场白段落 · 标题 · 等待提示（可再改自定义开场页）", contentIds: ["opening"], source: "mod" },
  { id: "bgm", group: "⑤ 美化", name: "音乐", desc: "内嵌 / 本机 / 链接 · 开局自动播放 · 平台曲目只记 id", contentIds: ["opening"], source: "mod" },
  { id: "audioRefs", group: "⑤ 美化", name: "作品音频引用", desc: "只引用作品音频库里已有的 id，不打包文件", contentIds: ["opening"], source: "mod" },
  { id: "lookRules", group: "⑤ 美化", name: "剧情美化", desc: "条件满足时自动切换外观 · 玩家可在美化里关闭", contentIds: ["opening", "mainPlot"], source: "mod" },
  { id: "navTabs", group: "⑤ 美化", name: "底栏页签", desc: "图标 · 顺序 · 选中态 · 显示名", contentIds: ["world"], source: "mod" },
];

/** 功能注释：永不进「本次需要 AI 生成」勾选、也不占生成次数的美化细项 */
export const WORLD_GEN_NO_AI_BEAUTIFY_STEP_IDS = Object.freeze(["cover", "phoneAppsCfg", "theme"] as const);

export const WORLD_GEN_EDITOR_GROUP_ORDER = [
  "本局修订",
  "世界观",
  "① 基础",
  "② 角色",
  "③ 养成",
  "④ 剧情",
  "⑤ 美化",
] as const;

export const WORLD_GEN_EDITOR_STEPS: readonly WorldGenEditorStep[] = Object.freeze([
  ...HUB_STEPS,
  ...MOD_STEPS,
]);

/** 功能注释：全部可勾选编辑器模组 id（含扩展；仅作者主动勾选才生成） */
export const ALL_WORLD_GEN_EDITOR_STEP_IDS: readonly string[] = Object.freeze(
  WORLD_GEN_EDITOR_STEPS.map((s) => s.id),
);

/** 功能注释：扩展玩法 / 美化 / 手机等，默认不生成 */
export const EXTENDED_WORLD_GEN_EDITOR_STEP_IDS: readonly string[] = Object.freeze(
  ALL_WORLD_GEN_EDITOR_STEP_IDS.filter((id) => !isWorldGenCoreStep(id)),
);

/** 按编辑器分组折叠展示用 */
export function groupWorldGenEditorSteps(
  steps: readonly WorldGenEditorStep[] = WORLD_GEN_EDITOR_STEPS,
): { group: string; steps: WorldGenEditorStep[] }[] {
  const map = new Map<string, WorldGenEditorStep[]>();
  for (const s of steps) {
    const list = map.get(s.group) ?? [];
    list.push(s);
    map.set(s.group, list);
  }
  return WORLD_GEN_EDITOR_GROUP_ORDER
    .filter((g) => map.has(g))
    .map((g) => ({ group: g, steps: map.get(g)! }));
}

/**
 * 功能注释：向导勾选区只渲染基础世界；extended 仍返回供单测对照「扩展已移出生成勾选」。
 * UI 不得再展开 extended；扩展玩法只走编辑器「添加玩法」。
 */
export function groupWorldGenEditorStepsByTier(): {
  core: { group: string; steps: WorldGenEditorStep[] }[];
  extended: { group: string; steps: WorldGenEditorStep[] }[];
} {
  const coreIds = new Set(DEFAULT_WORLD_GEN_EDITOR_STEP_IDS);
  const coreSteps = WORLD_GEN_EDITOR_STEPS.filter((s) => coreIds.has(s.id));
  const extSteps = WORLD_GEN_EDITOR_STEPS.filter((s) => !coreIds.has(s.id));
  return {
    core: groupWorldGenEditorSteps(coreSteps),
    extended: groupWorldGenEditorSteps(extSteps),
  };
}

/** 功能注释：勾选范围版本；低于 2 的「近似全选」视为旧默认，收束为基础世界 */
export const WORLD_GEN_SCOPE_VERSION = 2;

export type WorldGenStep1 = {
  title: string;
  setting: string;
  /**
   * 功能注释：禁止生成清单——创作者写明不要出现的内容/设定。
   * 与故事设定分离；「由 AI 整理设定」只润色设定与作品名，不得改写本字段。
   */
  forbidGen: string;
  aiPolish: boolean;
  engineId: WorldGenEngineId;
  /** @deprecated 仅兼容旧草稿；实际以 editorStepIds 为准 */
  contentIds: WorldGenContentId[];
  /** 本次需要 AI 生成的编辑器模组 id（WORLD_GEN_EDITOR_STEPS） */
  editorStepIds: string[];
  /** 勾选范围契约版本；升级后用于识别并收束旧「全选 59」会话 */
  scopeVersion?: number;
};

export type WorldGenDraft = WorldGenStep1 & {
  /** 第 2 步：写入模组 content.play，作为建角页预选 */
  playPrefs?: PlayPrefs;
};

export function defaultWorldGenStep1(): WorldGenStep1 {
  return {
    title: "",
    setting: "",
    forbidGen: "",
    aiPolish: true,
    engineId: "balanced",
    contentIds: contentIdsFromEditorSteps(DEFAULT_WORLD_GEN_EDITOR_STEP_IDS),
    editorStepIds: [...DEFAULT_WORLD_GEN_EDITOR_STEP_IDS],
    scopeVersion: WORLD_GEN_SCOPE_VERSION,
  };
}

/**
 * 功能注释：规范化勾选列表。
 * 生成世界只允许基础世界模组；孕育/通告/座驾等扩展一律剥掉，改走编辑器「添加玩法」。
 * 旧会话「含扩展全选」也会被收束，禁止再从这里 AI 生成扩展玩法。
 */
export function normalizeWorldGenStep1(s1: WorldGenStep1): WorldGenStep1 {
  const known = new Set(ALL_WORLD_GEN_EDITOR_STEP_IDS);
  // 功能注释：旧草稿里已下架的 id 换成写同一批字段的现行模组（CG / opening 等直接丢弃）
  const raw = (s1.editorStepIds ?? []).flatMap((id) => RETIRED_WORLD_GEN_STEP_IDS[id] ?? [id]);
  // 功能注释：只保留基础世界 id，顺序跟 DEFAULT 一致；扩展玩法永不进生成勾选
  const want = new Set(raw.filter((id) => known.has(id) && isWorldGenCoreStep(id)));
  let ids = DEFAULT_WORLD_GEN_EDITOR_STEP_IDS.filter((id) => want.has(id));
  if (!ids.length) {
    ids = [...DEFAULT_WORLD_GEN_EDITOR_STEP_IDS];
  }

  return {
    ...s1,
    // 功能注释：旧会话缺字段时补空串，避免 UI/持久化读到 undefined
    forbidGen: typeof s1.forbidGen === "string" ? s1.forbidGen : "",
    editorStepIds: ids,
    contentIds: contentIdsFromEditorSteps(ids),
    scopeVersion: WORLD_GEN_SCOPE_VERSION,
  };
}

/** 功能注释：草稿与设定同步勾选；旧 draft 全选时同样收束 */
export function normalizeWorldGenDraft(d: WorldGenDraft): WorldGenDraft {
  const s1 = normalizeWorldGenStep1(d);
  return { ...d, ...s1 };
}

/** 功能注释：由已勾选模组反推内容类别，供旧映射/统计使用 */
export function contentIdsFromEditorSteps(editorStepIds: readonly string[]): WorldGenContentId[] {
  const set = new Set<WorldGenContentId>();
  const known = new Set(WORLD_GEN_EDITOR_STEPS.map((s) => s.id));
  for (const id of editorStepIds) {
    if (!known.has(id)) continue;
    const step = WORLD_GEN_EDITOR_STEPS.find((s) => s.id === id);
    step?.contentIds.forEach((c) => set.add(c));
  }
  return ALL_WORLD_GEN_CONTENT_IDS.filter((c) => set.has(c));
}

/** 默认游玩偏好：游戏模式 + 跟随世界观（不写入 play 槽） */
export function defaultWorldGenPlayPrefs(): PlayPrefs {
  return { mode: "game" };
}

/**
 * 功能注释：把向导第 2 步的 PlayPrefs 压成模组 PlaySlot。
 * 游戏模式 / 跟随世界观为缺省，不占键，避免空对象污染 content.play。
 */
export function playSlotFromPrefs(p?: PlayPrefs): PlaySlot | undefined {
  if (!p) return undefined;
  const slot: PlaySlot = {};
  if (p.mode && p.mode !== "game") slot.mode = p.mode;
  if (p.pov) slot.pov = p.pov;
  return Object.keys(slot).length ? slot : undefined;
}

/** 按第 1 步已选内容，推导进入编辑器时默认勾选的模块 */
export function defaultEditorStepsFromContent(contentIds: readonly WorldGenContentId[]): string[] {
  const set = new Set(contentIds);
  return WORLD_GEN_EDITOR_STEPS.filter((s) => s.contentIds.some((c) => set.has(c))).map((s) => s.id);
}

export function validateWorldGenStep1(s: WorldGenStep1): string | null {
  const title = String(s.title ?? "").trim();
  if (!title) return "请填写作品名称";
  if (title.length > WORLD_TITLE_MAX) return `作品名称最多 ${WORLD_TITLE_MAX} 字`;
  const setting = String(s.setting ?? "").trim();
  if (!setting) return "请填写故事设定";
  // 功能注释：超限时未勾选 AI 不得照常提交（须先确认截断）；勾选 AI 则交由模型整理到上限内
  if (String(s.setting ?? "").length > WORLD_SETTING_MAX && !s.aiPolish) {
    return `故事设定最多 ${WORLD_SETTING_MAX} 字`;
  }
  if (String(s.forbidGen ?? "").length > WORLD_FORBID_MAX) {
    return `禁止生成最多 ${WORLD_FORBID_MAX} 字`;
  }
  if (!WORLD_GEN_ENGINES.some((e) => e.id === s.engineId)) return "请选择创作引擎";
  const ids = s.editorStepIds ?? [];
  if (!ids.length) return "请至少勾选一个模组供 AI 生成";
  const known = new Set(WORLD_GEN_EDITOR_STEPS.map((x) => x.id));
  if (ids.some((id) => !known.has(id))) return "包含未知的编辑器模组";
  // 功能注释：扩展玩法不得在生成世界勾选；须走编辑器「添加玩法」
  if (ids.some((id) => !isWorldGenCoreStep(id))) return "扩展玩法请到编辑器「添加玩法」，不可在此生成";
  return null;
}

export function validateWorldGenDraft(d: WorldGenDraft): string | null {
  return validateWorldGenStep1(d);
}

/**
 * 功能注释：AI 新建世界默认关掉娱乐圈扩展玩法开关，且不预装任何玩法/手机组件。
 * 作者确认安装后才由编辑器显示对应配置区。
 */
export function defaultWorldGenFeatureFlags(): {
  industryTab: false;
  career: false;
  weeklyPaper: false;
  imageCrisis: false;
  pregnancy: false;
  cars: false;
  transport: false;
  phone: true;
  phoneApps: string[];
} {
  return {
    industryTab: false,
    career: false,
    weeklyPaper: false,
    imageCrisis: false,
    pregnancy: false,
    cars: false,
    transport: false,
    phone: true,
    // 功能注释：仅基础通讯，不含直播/商城/论坛等扩展应用
    phoneApps: ["wechat", "sms", "call", "settings"],
  };
}

/**
 * 功能注释：开局封面不交 AI；其余美化走引擎默认，只把剧本名写进封面标题替换默认名。
 */
export function worldGenDefaultCover(title: string): { title: string } {
  return { title: String(title ?? "").trim() };
}

/** 把向导结果落成空白世界观模组骨架（后续由工坊 / 编辑器继续填） */
export function draftModFromWorldGen(d: WorldGenDraft): {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  kind: "world";
  dependencies: string[];
  content: {
    prompt: { extraRules?: string; scriptTone?: string };
    features: ReturnType<typeof defaultWorldGenFeatureFlags>;
    cover: { title: string };
    /** 功能注释：与 blankMod 一致——开局资金默认 0、货币名「元」，0 已算填好；创作者可改名称 */
    startMoney: number;
    moneyLabel: string;
    play?: PlaySlot;
  };
  meta?: { worldGen: WorldGenDraft };
} {
  const id = `ai-${Date.now().toString(36)}`;
  const title = String(d.title ?? "").trim();
  const setting = String(d.setting ?? "").trim();
  const forbidBlock = formatWorldGenForbidBlock(d.forbidGen);
  const play = playSlotFromPrefs(d.playPrefs);
  // 功能注释：新作品作者绑当前账号；旧作品打开时不会走本函数，避免覆盖原作者
  return {
    id,
    name: title,
    version: "0.1.0",
    author: readFunloomAuthorLabel(),
    // 功能注释：简介默认是约 100 字摘要，禁止 setting.slice 原文照搬；剧本基调留给 AI 写入 scriptTone
    description: summarizeWorldGenDescription(setting, title),
    kind: "world",
    dependencies: [],
    content: {
      // 功能注释：禁止清单进 extraRules；故事设定不进 worldIntro/scriptTone，避免①基础开局贴长文
      prompt: {
        ...(forbidBlock ? { extraRules: forbidBlock } : {}),
      },
      features: defaultWorldGenFeatureFlags(),
      // 功能注释：封面其余字段留空用引擎默认；标题用剧本名，禁止 AI 改写
      cover: worldGenDefaultCover(title),
      // 功能注释：建角「开局资金」默认就绪，预览不因缺资金拦截；货币名开局页/局内共用
      startMoney: 0,
      moneyLabel: "元",
      // 功能注释：禁止预写 playModInstalls，扩展玩法须作者确认安装
      ...(play ? { play } : {}),
    },
    meta: { worldGen: d },
  };
}

export const WORLD_GEN_QUERY = "createWorld";

/** 从当前 URL 判断是否从创作中心「创作游戏」进入生成世界向导 */
export function shouldOpenWorldGenWizard(search = typeof location !== "undefined" ? location.search : ""): boolean {
  try {
    const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const v = q.get(WORLD_GEN_QUERY);
    return v === "1" || v === "true" || v === "yes";
  } catch {
    return false;
  }
}

/** 清掉 createWorld 查询参数，避免刷新反复进向导 */
export function clearWorldGenQuery(): void {
  if (typeof location === "undefined" || typeof history === "undefined") return;
  try {
    const url = new URL(location.href);
    if (!url.searchParams.has(WORLD_GEN_QUERY)) return;
    url.searchParams.delete(WORLD_GEN_QUERY);
    const next = `${url.pathname}${url.search}${url.hash}`;
    history.replaceState(history.state, "", next);
  } catch {
    /* ignore */
  }
}
