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
  // 人物 / 地点 / 规则 / 世界书 / 基础事件 / 势力 / 人物线路
  "hub:person",
  "hub:map",
  "hub:rules",
  "hub:book",
  "hub:fixed",
  "hub:faction",
  "hub:paths",
  // 开局时间 · 资源（出行 / 天气属玩法扩展，不进默认基础世界）
  "travelTime",
  "startResources",
  // 建角与人物（旧 stats / creationFields 在 normalize 时并入 creation）
  "creation",
  "creationPools",
  "npcs",
  "relations",
  "contacts",
  // 地图
  "rooms",
  // 世界观文案与基础剧情
  "prompt",
  "lore",
  "opening",
  "fixedEvents",
  "storylines",
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

const HUB_STEPS: WorldGenEditorStep[] = EDITOR_HUB_MENUS.map((m) => ({
  id: `hub:${m.id}`,
  group: m.group,
  name: m.label,
  desc: m.hint,
  contentIds: HUB_CONTENT[m.id] ?? ["world"],
  source: "hub" as const,
}));

/** 模组细项：Hub 已有同名入口的不再重复列出（世界书/阵营/CG/人物线路等） */
const MOD_STEPS: WorldGenEditorStep[] = [
  // ① 基础（已取消「开局设定」聚合；时间字段并入时间与推进）
  { id: "travelTime", group: "① 基础", name: "时间与推进", desc: "开局日期 / 时刻 · 每日作息 · 行动点 · 推进节奏 · 年龄随日历", contentIds: ["world"], source: "mod" },

  // ② 角色（「人物」「人物线路」已在 Hub；头像库是人物素材）
  { id: "avatars", group: "② 角色", name: "头像库与匹配优先级", desc: "我的头像池 · 平台公共分类 · 私人/公共库优先 · 通用兜底（随本剧保存）", contentIds: ["characters"], source: "mod" },
  { id: "creation", group: "② 角色", name: "建角", desc: "创作者属性 · 建角字段改名 / 锁定 / 选项联动（开局页只显示这里配过的）", contentIds: ["characters", "world"], source: "mod" },
  { id: "creationPools", group: "② 角色", name: "建角选项池", desc: "外形 · 身份 · 家世 · 方向 · 星座 · 母校 · 父母职业", contentIds: ["characters"], source: "mod" },
  { id: "npcs", group: "② 角色", name: "人物（模组库）", desc: "写入模组的 NPC 表：名字 · 身份 · 地点 · 头像池 · 时间线 · 音色", contentIds: ["characters"], source: "mod" },
  { id: "relations", group: "② 角色", name: "关系玩法", desc: "表白门槛 · 婚礼费用与好感 · NPC 牵线 · 伴侣加成", contentIds: ["characters"], source: "mod" },
  { id: "contacts", group: "② 角色", name: "人脉页面配置", desc: "标签名 · 分组与排序 · 卡片双数值与图标 · 关系阶段词", contentIds: ["characters"], source: "mod" },

  // ③ 养成
  { id: "startResources", group: "③ 养成", name: "开局资源", desc: "开局资金 · 初始资源（唯一编辑入口）", contentIds: ["world"], source: "mod" },
  { id: "trainings", group: "③ 养成", name: "培训课程", desc: "学费 · 体力 · 属性收益 · 自定义等级与解锁条件", contentIds: ["world", "mainPlot"], source: "mod" },
  { id: "sideJobs", group: "③ 养成", name: "打工 · 周末活动", desc: "收入 · 压力 · 属性收益 · 解锁条件", contentIds: ["world", "mainPlot"], source: "mod" },
  { id: "growRules", group: "③ 养成", name: "养成规则", desc: "名气分档 · 头衔 · 固定账单", contentIds: ["world", "mainPlot"], source: "mod" },
  { id: "income", group: "③ 养成", name: "周期收入", desc: "每周结算按条件发放 / 扣除", contentIds: ["world"], source: "mod" },
  { id: "gameRules", group: "③ 养成", name: "玩法规则", desc: "如果 · 否则如果 · 否则 · 每天 / 每周判定 · 规则变量", contentIds: ["world", "mainPlot"], source: "mod" },
  { id: "economy", group: "③ 养成", name: "数值平衡", desc: "扣费依据 · 现金流估算 · 透支 / 破产 / 新手缓冲", contentIds: ["world"], source: "mod" },
  { id: "tuning", group: "③ 养成", name: "引擎规则（数值）", desc: "表现评级概率 / 倍率 · 休息减压 · 课程与打工倍率（不同于「底层规则」）", contentIds: ["world"], source: "mod" },

  // 地点已并入①基础（取消独立「④ 世界」页签）；出行属玩法 Mod
  { id: "rooms", group: "① 基础", name: "地点（模组库）", desc: "多级子地点 · 树状预览 · 准入 · 出口 · 开局地点", contentIds: ["locations"], source: "mod" },

  // ④ 剧情（开场页与剧情美化在⑥美化；结局插图仍随结局留在这里）
  { id: "prompt", group: "① 基础", name: "剧本基调", desc: "写给模型的整段基调（原 GM / 世界观 / 口吻合并）", contentIds: ["world"], source: "mod" },
  { id: "lore", group: "④ 剧情", name: "详细设定", desc: "地区 · 势力 · 角色 · 只发主角所在地区的完整设定", contentIds: ["world", "locations"], source: "mod" },
  { id: "festivals", group: "④ 剧情", name: "节日", desc: "平时只发名称 · 临近或提到时发完整设定", contentIds: ["world", "sideEvents"], source: "mod" },
  { id: "fixedEvents", group: "④ 剧情", name: "固定事件（模组库）", desc: "首次事件 · 预设剧本 · 时间 / 条件触发 · 事件链", contentIds: ["mainPlot", "sideEvents", "opening"], source: "mod" },
  { id: "storylines", group: "④ 剧情", name: "主线与目标", desc: "有序节点 · 完成 / 失败条件 · 奖励 · 失败分支", contentIds: ["mainPlot"], source: "mod" },
  { id: "endings", group: "④ 剧情", name: "结局与时限", desc: "主线时限 · 自定义固定结局 · 结局插图与评级 · 评定维度", contentIds: ["mainPlot"], source: "mod" },

  // ⑤ 玩法 Mod（功能开关与玩法本体；手机外观与底栏样子在⑥）
  { id: "features", group: "⑤ 玩法 Mod", name: "功能开关", desc: "关闭后界面自动隐藏对应玩法", contentIds: ["world"], source: "mod" },
  { id: "playModInstalls", group: "⑤ 玩法 Mod", name: "已添加的玩法", desc: "推荐 · 确认添加 · 启用开关 · 底栏名 · 显隐", contentIds: ["world", "mainPlot"], source: "mod" },
  { id: "travel", group: "⑤ 玩法 Mod", name: "出行与交通", desc: "须添加玩法后自定义：选择区标题 · 货币 · 出行方式 · 花费", contentIds: ["locations", "world"], source: "mod" },
  { id: "cars", group: "⑤ 玩法 Mod", name: "座驾", desc: "须添加座驾包后配置购车与切换（建议先加出行与交通）", contentIds: ["locations", "world"], source: "mod" },
  { id: "gigs", group: "⑤ 玩法 Mod", name: "通告库", desc: "通告门槛 · 酬劳 · 名气 · 成长 · 星级价目表", contentIds: ["mainPlot", "world"], source: "mod" },
  { id: "contracts", group: "⑤ 玩法 Mod", name: "经纪合约", desc: "开局候选合约 · 通告性质 · 议价规则", contentIds: ["characters", "mainPlot"], source: "mod" },
  { id: "projects", group: "⑤ 玩法 Mod", name: "影视项目", desc: "项目模板 · 试镜 · 片场事件 · 质量与上映", contentIds: ["mainPlot"], source: "mod" },
  { id: "industry", group: "⑤ 玩法 Mod", name: "行业生态", desc: "经纪公司 · 片名库 · 代言品牌 · 奖项 · 圈内动态", contentIds: ["world", "characters"], source: "mod" },
  { id: "imageCrisis", group: "⑤ 玩法 Mod", name: "舆情人设", desc: "人设 · 公开行动 · 危机 · 公关应对 · 判定权重", contentIds: ["characters", "sideEvents"], source: "mod" },
  { id: "weeklyPaper", group: "⑤ 玩法 Mod", name: "娱乐周报", desc: "报头 · 副标题", contentIds: ["world"], source: "mod" },
  { id: "meals", group: "⑤ 玩法 Mod", name: "每周吃什么", desc: "伙食档位 · 每周花费 · 压力 / 能力 / 气色", contentIds: ["world"], source: "mod" },
  { id: "pregnancy", group: "⑤ 玩法 Mod", name: "孕育", desc: "孕期 · 受孕率 · 察觉时间 · 孩子名字池", contentIds: ["characters", "world"], source: "mod" },

  // ⑥ 美化（原「⑥ 开场」并入；不收玩法数据与世界设定）
  { id: "cover", group: "⑥ 美化", name: "开局封面", desc: "画布布局 · AI 对话生成 · 自由搭配 · 自定义 HTML（唯一入口）", contentIds: ["opening"], source: "mod" },
  { id: "phoneAppsCfg", group: "⑥ 美化", name: "手机应用配置", desc: "显示名 · 图标 · 主屏顺序 · 开局预装 · 小手机试玩", contentIds: ["world", "opening"], source: "mod" },
  { id: "theme", group: "⑥ 美化", name: "皮肤美化", desc: "皮肤 · 主题色 · 字体 · 深浅色 · 底色描边 · 阴影动画 · 自定义 CSS", contentIds: ["opening"], source: "mod" },
  { id: "bgm", group: "⑥ 美化", name: "音乐", desc: "内嵌 / 本机 / 链接 · 开局自动播放 · 平台曲目只记 id", contentIds: ["opening"], source: "mod" },
  { id: "audioRefs", group: "⑥ 美化", name: "作品音频引用", desc: "只引用作品音频库里已有的 id，不打包文件", contentIds: ["opening"], source: "mod" },
  { id: "opening", group: "⑥ 美化", name: "开场剧情", desc: "开场页外观 · AI 对话 / 粘贴 HTML", contentIds: ["opening"], source: "mod" },
  { id: "lookRules", group: "⑥ 美化", name: "剧情美化", desc: "条件满足时自动切换外观 · 玩家可在美化里关闭", contentIds: ["opening", "mainPlot"], source: "mod" },
  { id: "navTabs", group: "⑥ 美化", name: "底栏页签", desc: "图标 · 顺序 · 选中态 · 显示名", contentIds: ["world"], source: "mod" },
];

export const WORLD_GEN_EDITOR_GROUP_ORDER = [
  "本局修订",
  "剧情编排",
  "世界观",
  "① 基础",
  "② 角色",
  "③ 养成",
  "④ 剧情",
  "⑤ 玩法 Mod",
  "⑥ 美化",
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

/** 功能注释：向导勾选区拆成「基础默认」与「扩展（默认不生成）」两栏 */
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
    aiPolish: true,
    engineId: "balanced",
    contentIds: contentIdsFromEditorSteps(DEFAULT_WORLD_GEN_EDITOR_STEP_IDS),
    editorStepIds: [...DEFAULT_WORLD_GEN_EDITOR_STEP_IDS],
    scopeVersion: WORLD_GEN_SCOPE_VERSION,
  };
}

/**
 * 功能注释：规范化勾选列表。
 * 旧会话/草稿若仍是「全选含扩展」（约 59 项），一律收束为 DEFAULT 基础模组，避免刷新后继续打孕育/通告等。
 * 作者在新版本里主动「含扩展全选」时会带 scopeVersion=2，予以保留。
 */
export function normalizeWorldGenStep1(s1: WorldGenStep1): WorldGenStep1 {
  const known = new Set(ALL_WORLD_GEN_EDITOR_STEP_IDS);
  // 功能注释：旧草稿把「角色属性 / 建角字段」拆成两步；合成「建角」后把二者映射为 creation
  const raw = (s1.editorStepIds ?? []).flatMap((id) =>
    id === "stats" || id === "creationFields" ? ["creation"] : [id],
  );
  let ids = [...new Set(raw.filter((id) => known.has(id)))];
  const ver = s1.scopeVersion ?? 1;
  const extendedSelected = EXTENDED_WORLD_GEN_EDITOR_STEP_IDS.filter((id) => ids.includes(id)).length;
  const looksLikeLegacyFullSelect =
    ids.length >= ALL_WORLD_GEN_EDITOR_STEP_IDS.length ||
    (extendedSelected >= 8 && ids.length >= DEFAULT_WORLD_GEN_EDITOR_STEP_IDS.length + 8);

  if (ver < WORLD_GEN_SCOPE_VERSION && looksLikeLegacyFullSelect) {
    ids = [...DEFAULT_WORLD_GEN_EDITOR_STEP_IDS];
  } else if (!ids.length) {
    ids = [...DEFAULT_WORLD_GEN_EDITOR_STEP_IDS];
  }

  return {
    ...s1,
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
  if (setting.length > WORLD_SETTING_MAX) return `故事设定最多 ${WORLD_SETTING_MAX} 字`;
  if (!WORLD_GEN_ENGINES.some((e) => e.id === s.engineId)) return "请选择创作引擎";
  const ids = s.editorStepIds ?? [];
  if (!ids.length) return "请至少勾选一个模组供 AI 生成";
  const known = new Set(WORLD_GEN_EDITOR_STEPS.map((x) => x.id));
  if (ids.some((id) => !known.has(id))) return "包含未知的编辑器模组";
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
    phone: true,
    // 功能注释：仅基础通讯，不含直播/商城/论坛等扩展应用
    phoneApps: ["wechat", "sms", "call", "settings"],
  };
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
    prompt: { worldIntro: string };
    features: ReturnType<typeof defaultWorldGenFeatureFlags>;
    play?: PlaySlot;
  };
  meta?: { worldGen: WorldGenDraft };
} {
  const id = `ai-${Date.now().toString(36)}`;
  const title = String(d.title ?? "").trim();
  const setting = String(d.setting ?? "").trim();
  const play = playSlotFromPrefs(d.playPrefs);
  // 功能注释：新作品作者绑当前账号；旧作品打开时不会走本函数，避免覆盖原作者
  return {
    id,
    name: title,
    version: "0.1.0",
    author: readFunloomAuthorLabel(),
    description: setting.slice(0, 200),
    kind: "world",
    dependencies: [],
    content: {
      // 功能注释：aiPolish 只影响生成提示语，不再写入已下架的 prompt.extraRules
      prompt: { worldIntro: setting },
      features: defaultWorldGenFeatureFlags(),
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
