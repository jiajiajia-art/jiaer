// 女明星养成模拟器 — 核心数据表（依据策划案 V2）

import { GENERATED_GIGS } from "./gigLibrary";
import { loadGlobal, saveGlobal, removeGlobal } from "../lib/saveScope";
import { slot, liveArray, liveRecord, memoBy, currentWorldId } from "../mods/live";
import { asModArray } from "../lib/asModArray";
import type { ChargeBasisItem } from "./chargeBasis";
import type { TuningModuleId, TuningModulesFlag } from "./tuningModules";
import { isTuningModuleOn as tuningModuleOn } from "./tuningModules";
export type { ChargeBasisItem } from "./chargeBasis";
export type { TuningModuleId, TuningModulesFlag } from "./tuningModules";
export {
  TUNING_MODULE_META,
  authoredTuningModule,
  isTuningModuleOn,
  clearTuningModule,
  enableTuningModule,
  pruneTuningSlot,
} from "./tuningModules";

/* 兼容再导出：世界书种子已迁至 game/worldbook.ts（题材无关接口）。
 * 保留此别名，避免热更新残留的旧模块图仍向 data.ts 索取 defaultWorldBook 而报错。 */
export { defaultWorldBook } from "./worldbook";

export type StatKey =
  | "yanji" // 演技
  | "geyi" // 歌艺
  | "koucai" // 口才
  | "yitai" // 仪态
  | "donggan" // 动感
  | "tineng" // 体能
  | "caizhi" // 才智
  | "zixin"; // 自信

export const RAW_STAT_LABELS: Record<StatKey, string> = {
  yanji: "演技",
  geyi: "歌艺",
  koucai: "口才",
  yitai: "仪态",
  donggan: "动感",
  tineng: "体能",
  caizhi: "才智",
  zixin: "自信",
};

/* 心境标签（键与 logic.ts 的 MoodTier 对应）：显示在主角人物档案。 */
export const MOOD_LABELS: Record<"radiant" | "steady" | "strained" | "frayed", string> = {
  radiant: "神采飞扬",
  steady: "心平气和",
  strained: "心绪不宁",
  frayed: "濒临崩溃",
};

export const RAW_STATS_BASE: Record<StatKey, number> = {
  yanji: 100,
  geyi: 100,
  koucai: 100,
  yitai: 100,
  donggan: 100,
  tineng: 100,
  caizhi: 100,
  zixin: 100,
};

export const RAW_STAT_ORDER: StatKey[] = [
  "yanji",
  "geyi",
  "koucai",
  "yitai",
  "donggan",
  "tineng",
  "caizhi",
  "zixin",
];

export type Option = {
  id: string;
  name: string;
  desc: string;
  tag: string;
  fx?: OptFx; // 开局加成：作者在编辑器里配置（能力 / 自定义属性 / 好感等），不配 = 只有文字设定
  /** @deprecated 旧写法，引擎已不再结算；开局数值请改用 fx */
  stats?: Partial<Record<StatKey, number>>;
  /** @deprecated */ money?: number;
  /** @deprecated */ fame?: number;
  /** @deprecated */ reputation?: number;
  /** @deprecated */ stress?: number;
  /** @deprecated */ looksBonus?: number;
};

// 3.2 外形风格
export const RAW_STYLES: Option[] = [
  { id: "sweet", name: "清甜灵气", tag: "邻家 · 综艺", desc: "亲和自然，像邻家女孩，很容易让人放下戒心" },
  { id: "gorgeous", name: "明艳大气", tag: "电影 · 高奢", desc: "五官浓烈、气场张扬，天生适合大银幕与红毯" },
  { id: "cool", name: "冷感高级", tag: "文艺 · 天王线", desc: "疏离清冷，不笑时有距离感，笑起来反差很大" },
  { id: "sporty", name: "元气运动", tag: "爱豆 · 竞技", desc: "阳光健康，精力旺盛，舞台上很有感染力" },
  { id: "gentle", name: "温柔知性", tag: "主持 · 文艺", desc: "谈吐温和、书卷气重，让人觉得可靠" },
];

// 3.3 出道身份
export const RAW_IDENTITIES: Option[] = [
  { id: "kban", name: "科班出道", tag: "学院派", desc: "电影学院出身，基本功扎实，起步时没什么名气" },
  { id: "idol", name: "爱豆出道", tag: "自带流量", desc: "选秀出道，有一批粉丝，但常被质疑实力" },
  { id: "sr", name: "素人出道", tag: "白纸一张", desc: "没有任何训练与人脉，一切从零开始" },
  { id: "royal", name: "皇族出道", tag: "资源咖", desc: "公司力捧、资源不断，争议与黑粉也随之而来" },
];

// 3.4 家庭背景
export const RAW_BACKGROUNDS: Option[] = [
  { id: "normal", name: "普通家庭", tag: "草根逆袭", desc: "家境寻常，父母支持但帮不上忙" },
  { id: "art", name: "艺术世家", tag: "专业人脉", desc: "从小耳濡目染，家里认识不少圈内前辈" },
  { id: "biz", name: "商业家庭", tag: "家底殷实", desc: "家里经商，不缺钱，也容易被说成靠家里" },
  { id: "gov", name: "公职家庭", tag: "家教严格", desc: "家风严谨，父母更希望你走一条稳妥的路" },
  { id: "solo", name: "单亲自立", tag: "独立逆袭", desc: "很早就开始自己扛事，比同龄人更要强" },
];

// 科班出身固定母校
export const RAW_SCHOOL = "京都电影学院";

// 父母职业池（供开局随机 / 手选，影响家世叙事与父母的期望）
export const RAW_PARENT_JOBS = [
  "中学语文教师", "国企中层", "个体服装店主", "三甲医院医生", "基层公务员",
  "银行信贷经理", "土木工程师", "梨园名角", "退役军官", "大学美术教授",
  "上市公司高管", "家族企业掌门", "小城报社记者", "话剧院导演", "农资批发商",
  "出版社编辑", "中医世家传人", "船运商行东家",
];

// 星座（由出生月日推算；bonus 为性格描述，开局数值由作者用 fx 配置）
export type Zodiac = {
  id: string;
  name: string;
  symbol: string;
  from: [number, number]; // 起始 月,日
  to: [number, number]; // 结束 月,日
  bonus: string; // 性格描述（展示用）
  fx?: OptFx; // 开局加成（作者配置；不配 = 只有文字）
  stats?: Partial<Record<StatKey, number>>;
  looksBonus?: number;
  money?: number;
  fame?: number;
  reputation?: number;
  stress?: number;
};

export const RAW_ZODIACS: Zodiac[] = [
  { id: "aries", name: "白羊座", symbol: "♈", from: [3, 21], to: [4, 19], bonus: "冲劲十足，想到就做" },
  { id: "taurus", name: "金牛座", symbol: "♉", from: [4, 20], to: [5, 20], bonus: "踏实稳重，认准了就不放" },
  { id: "gemini", name: "双子座", symbol: "♊", from: [5, 21], to: [6, 21], bonus: "机灵健谈，好奇心旺盛" },
  { id: "cancer", name: "巨蟹座", symbol: "♋", from: [6, 22], to: [7, 22], bonus: "细腻恋家，很会照顾人" },
  { id: "leo", name: "狮子座", symbol: "♌", from: [7, 23], to: [8, 22], bonus: "自信耀眼，天生想站在中央" },
  { id: "virgo", name: "处女座", symbol: "♍", from: [8, 23], to: [9, 22], bonus: "认真挑剔，凡事追求做到位" },
  { id: "libra", name: "天秤座", symbol: "♎", from: [9, 23], to: [10, 23], bonus: "优雅随和，讨厌冲突" },
  { id: "scorpio", name: "天蝎座", symbol: "♏", from: [10, 24], to: [11, 22], bonus: "神秘敏锐，爱憎分明" },
  { id: "sagittarius", name: "射手座", symbol: "♐", from: [11, 23], to: [12, 21], bonus: "自由乐观，说走就走" },
  { id: "capricorn", name: "摩羯座", symbol: "♑", from: [12, 22], to: [1, 19], bonus: "沉稳务实，目标感强" },
  { id: "aquarius", name: "水瓶座", symbol: "♒", from: [1, 20], to: [2, 18], bonus: "想法独特，不随大流" },
  { id: "pisces", name: "双鱼座", symbol: "♓", from: [2, 19], to: [3, 20], bonus: "浪漫感性，想象力丰富" },
];

/** 功能注释：AI 星座常缺 from/to；缺区间的条目不能进活视图，否则建角 zodiacOf 读 .length/.0 崩预览 */
function zodiacEntryOk(z: unknown): z is Zodiac {
  if (!z || typeof z !== "object") return false;
  const row = z as Zodiac;
  return Array.isArray(row.from) && row.from.length >= 2 && Array.isArray(row.to) && row.to.length >= 2;
}

export const ZODIACS: Zodiac[] = liveArray(() => {
  const z = slot<Zodiac[]>("zodiacs", () => RAW_ZODIACS);
  if (!Array.isArray(z) || !z.length) return RAW_ZODIACS;
  const ok = z.filter(zodiacEntryOk);
  return ok.length ? ok : RAW_ZODIACS;
});

export function zodiacOf(month: number, day: number): Zodiac {
  const val = month * 100 + day;
  for (const z of ZODIACS) {
    if (!zodiacEntryOk(z)) continue;
    const f = z.from[0] * 100 + z.from[1];
    const t = z.to[0] * 100 + z.to[1];
    if (f <= t ? val >= f && val <= t : val >= f || val <= t) return z;
  }
  return ZODIACS[0] ?? RAW_ZODIACS[0];
}

/* ═══ 模组槽 · 基础数值 ═══
 * 八维的键由引擎固定（规则里直接引用），世界观可改叫法 / 初值 / 展示顺序（子集即隐藏其余维度的展示）。
 * 以下均为活视图：每次访问读当前生效世界；未声明=引擎默认（娱乐圈原值）。 */
export type StatsSlot = {
  labels?: Partial<Record<StatKey, string>>;
  base?: Partial<Record<StatKey, number>>;
  order?: StatKey[];
  metaLabels?: { fame?: string; looks?: string; stress?: string }; // 能力盘里 名气 / 容貌 / 压力 的叫法
  looksTiers?: FameTier[]; // 容貌分档（缺省=娱乐圈原档）
  tiers?: Partial<Record<StatKey, FameTier[]>>; // 八维分档（缺省=不分档）
  display?: "num" | "tier" | "both"; // 八维显示方式（缺省=只显示数值）
  hidden?: StatKey[]; // 本模组停用的能力槽（不显示、不参与养成；可少于八个）
  range?: Partial<Record<StatKey, { min: number; max: number }>>; // 各能力取值范围（缺省 0~999）
  colors?: Partial<Record<StatKey, string>>; // 各能力进度条颜色：jade/coral/gold/danger 或 #hex
};
const statsSlot = () => slot<StatsSlot>("stats", () => ({}));
export const statMetaLabels = () => ({ fame: "名气", looks: "容貌", stress: "压力", ...(statsSlot().metaLabels ?? {}) });
export const RAW_LOOKS_TIERS: FameTier[] = [
  { min: 0, label: "新人清秀", desc: "" },
  { min: 300, label: "镜头上镜", desc: "" },
  { min: 500, label: "高端脸孔", desc: "" },
  { min: 700, label: "顶级神颜", desc: "" },
];
export const looksTiers = (): FameTier[] => {
  // 功能注释：looksTiers 常被 AI 写成对象；非数组按空，禁止 ?.length 误判后把脏对象当档表用
  const t = statsSlot().looksTiers;
  return Array.isArray(t) && t.length ? t : RAW_LOOKS_TIERS;
};
export const STAT_LABELS: Record<StatKey, string> = liveRecord(() => ({ ...RAW_STAT_LABELS, ...(statsSlot().labels ?? {}) }));
export const STATS_BASE: Record<StatKey, number> = liveRecord(() => ({ ...RAW_STATS_BASE, ...(statsSlot().base ?? {}) }));
/* order 只调整展示顺序：缺失的键按默认顺序补在末尾（引擎循环始终覆盖全部八维） */
export const STAT_ORDER: StatKey[] = liveArray(() => {
  // 功能注释：stats.order / hidden 常被 AI 写成对象；asModArray 后再 filter，禁止 .filter 崩预览
  const o = asModArray<StatKey>(statsSlot().order).filter((k, i, a) => k in RAW_STAT_LABELS && a.indexOf(k) === i);
  const full = o.length ? [...o, ...RAW_STAT_ORDER.filter((k) => !o.includes(k))] : RAW_STAT_ORDER;
  const hid = asModArray<StatKey>(statsSlot().hidden);
  return full.filter((k) => !hid.includes(k));
});
/**
 * 功能注释：人物档案「个人能力」用的键——只读作品自己的 order / hidden。
 * 配了 order 就严格按 order（再扣 hidden），绝不把未声明的八维（如演技）补回来；
 * 未配 order 时：仅娱乐圈回落全量八维再扣 hidden；其它作品不补八维。引擎养成仍用 STAT_ORDER。
 */
export const dossierStatKeys = (): StatKey[] => {
  const hid = new Set(asModArray<StatKey>(statsSlot().hidden));
  const ordered = asModArray<StatKey>(statsSlot().order).filter(
    (k, i, a) => k in RAW_STAT_LABELS && a.indexOf(k) === i && !hid.has(k),
  );
  if (ordered.length) return ordered;
  // 功能注释：作品表单没写 stats.order 时不补内置能力，档案显示「尚未配置个人能力」
  return [];
};
export const ALL_STAT_KEYS: readonly StatKey[] = ["yanji", "geyi", "koucai", "yitai", "donggan", "tineng", "caizhi", "zixin"];
/* 开局资金 / 开局天气（开局日期见 content.ts CALENDAR，可用槽 startDate 简写覆盖） */
/** 功能注释：娱乐圈未写开局资金 = 5000；其它作品未写 = 0，不套娱乐圈默认。 */
export const startMoney = (): number => slot("startMoney", () => 5000, () => 0);
export const startWeather = (): string => slot("weather", () => "微雨");

// 3.5 初始职业方向
export const RAW_DIRECTIONS: Option[] = [
  { id: "actor", name: "影视演员", tag: "导师 · 方知远", desc: "主攻影视表演" },
  { id: "singer", name: "歌手爱豆", tag: "导师 · 梁怀音", desc: "主攻唱片与舞台" },
  { id: "host", name: "综艺主持", tag: "导师 · 秦砚舟", desc: "主攻综艺与主持" },
  { id: "biz", name: "商业艺人", tag: "导师 · 孟晚乔", desc: "主攻广告与品牌合作" },
  { id: "all", name: "全能新人", tag: "导师 · 林宜", desc: "什么都想试试" },
];


// 训练项目（2.1 训练数值表，收益为区间随机）
type Range = [number, number];
export type Training = {
  id: string;
  name: string;
  effect: string;
  gain: Partial<Record<StatKey, Range>>;
  cgain?: Record<string, Range>; // 自定义属性收益（键 = AttrDef.id），与八维平级
  cost: number; // 元
  energy: number;
  stress: number;
  fame?: number; // 可选：完成后名气/知名度（如校园社团活动、竞赛备赛）
  reputation?: number; // 可选：完成后口碑
  grades?: CourseGrade[]; // 可选：本课专属等级表（缺省 = 通用 LESSON_GRADES）
};

export const RAW_TRAININGS: Training[] = [
  { id: "expr", name: "表情训练", effect: "演技 +3~5 · 口才 +1~2", gain: { yanji: [3, 5], koucai: [1, 2] }, cost: 3000, energy: 8, stress: 2 },
  { id: "voice", name: "发声训练", effect: "歌艺 +3~5 · 自信 +1~2", gain: { geyi: [3, 5], zixin: [1, 2] }, cost: 3000, energy: 8, stress: 2 },
  { id: "speech", name: "口条训练", effect: "口才 +2~4 · 才智 +1~2", gain: { koucai: [2, 4], caizhi: [1, 2] }, cost: 2500, energy: 6, stress: 1 },
  { id: "body", name: "形体训练", effect: "仪态 +3~5 · 体能 +1~3", gain: { yitai: [3, 5], tineng: [1, 3] }, cost: 3500, energy: 10, stress: 2 },
  { id: "dance", name: "舞蹈训练", effect: "动感 +3~5 · 体能 +2~4", gain: { donggan: [3, 5], tineng: [2, 4] }, cost: 3500, energy: 12, stress: 3 },
  { id: "read", name: "阅读剧本", effect: "才智 +3~5 · 演技 +1~3", gain: { caizhi: [3, 5], yanji: [1, 3] }, cost: 2000, energy: 5, stress: -1 },
  { id: "lens", name: "镜头训练", effect: "自信 +2~4 · 仪态 +2~4", gain: { zixin: [2, 4], yitai: [2, 4] }, cost: 4000, energy: 7, stress: 1 },
];

/** 功能注释：非娱乐圈未声明课程 = 空表，不套用表情训练等娱乐圈课表。 */
export const TRAININGS: Training[] = liveArray(() => slot("trainings", () => RAW_TRAININGS, () => []));

// 周末专属活动（只在周六/周日可排；数值为确定性效果，作用于顶层状态）
export type WeekendAct = {
  id: string;
  name: string;
  effect: string;
  icon: string;
  cost: number; // 元
  energy: number; // 行动力（正=恢复，负=消耗）
  stress: number;
  trust?: number; // 负责人信任
  fame?: number;
  reputation?: number;
  cgain?: Record<string, [number, number]>; // 自定义属性收益
  reqs?: GradeReq[]; // 解锁门槛（全部满足才可排）
  cat?: "rest" | "social"; // 日程板里归入哪类（缺省：recuperate=休息调整，其余=外出社交）
};

export const RAW_WEEKEND_ACTS: WeekendAct[] = [
  { id: "freeroam", name: "自由活动", effect: "外出走走 · 可在地图上踩点探索 · 压力 -6", icon: "", cost: 0, energy: 0, stress: -6 },
  { id: "party", name: "圈内应酬", effect: "负责人信任 +4 · 名气 +3", icon: "", cost: 2000, energy: -14, stress: 6, trust: 4, fame: 3 },
  { id: "recuperate", name: "彻底休整", effect: "压力 -16", icon: "", cost: 0, energy: 34, stress: -16 },
  { id: "meetup", name: "私下约见", effect: "压力 -12 · 负责人信任 +2 · 口碑 +1", icon: "", cost: 800, energy: -6, stress: -12, trust: 2, reputation: 1 },
];

/* ═══ 才艺课程等级（仿《明星志愿》分级授课）═══
 * 级别越高：学费越贵、上限越高，但单次「基础加成」越少（gainMul 递减）——
 * 低级课把某项能力练到瓶颈（cap）后收益骤降，必须升到更高级课程才能继续突破。 */
export type LessonGrade = {
  id: string;
  label: string;
  costMul: number; // 学费倍率（相对课程基础学费）
  gainMul: number; // 属性加成倍率（级别越高越小）
  cap: number; // 该级课程能把能力练到的软上限（越接近上限收益越低，越过上限几乎无收益）
  stressAdd: number; // 附加压力
};

/* 等级解锁门槛：metric = "stat:<八维键>" | "c:<自定义属性id>" | 顶层指标（fame / reputation / money …） */
export type GradeReq = { metric: string; min: number };
export type CourseGrade = LessonGrade & {
  reqs?: GradeReq[]; // 属性门槛，全部满足才解锁
  needPrev?: number; // 上一级需完成的次数
};
export const gradesOf = (t: Training): CourseGrade[] => (t.grades?.length ? t.grades : LESSON_GRADES);
export const reqValue = (s: { stats?: object; cattrs?: Record<string, number> }, m: string): number => {
  if (m.startsWith("stat:")) return (s.stats as Record<string, number> | undefined)?.[m.slice(5)] ?? 0;
  if (m.startsWith("c:")) return s.cattrs?.[m.slice(2)] ?? 0;
  return (s as unknown as Record<string, number>)[m] ?? 0;
};
type LockSim = { stats?: object; cattrs?: Record<string, number>; trainCounts?: Record<string, number> };
/* 通用解锁判定：属性门槛 + 「某前置项需完成 N 次」；返回未满足原因（已解锁返回 null） */
export function unlockLock(s: LockSim, reqs: GradeReq[] | undefined, label: (m: string) => string, prev?: { key: string; name: string; need?: number }): string | null {
  const miss: string[] = [];
  if (prev?.need) {
    const done = s.trainCounts?.[prev.key] ?? 0;
    if (done < prev.need) miss.push(`${prev.name}还需 ${prev.need - done} 次`);
  }
  for (const r of reqs ?? []) {
    const v = reqValue(s, r.metric);
    if (v < r.min) miss.push(`${label(r.metric)} ≥ ${r.min}（现 ${Math.floor(v)}）`);
  }
  return miss.length ? miss.join("；") : null;
}
export function gradeLock(s: LockSim, t: Training, gi: number, label: (m: string) => string): string | null {
  const list = gradesOf(t);
  const gr = list[gi];
  if (!gr) return null;
  const prev = gi > 0 ? list[gi - 1] : undefined;
  return unlockLock(s, gr.reqs, label, prev && { key: `${t.id}:${prev.id}`, name: prev.label, need: gr.needPrev });
}
/* 打工：名气门槛 + 自定义门槛 + 上一档完成次数 */
export function jobLock(s: LockSim & { fame?: number }, jobs: SideJob[], ji: number, label: (m: string) => string): string | null {
  const j = jobs[ji];
  if (!j) return null;
  const prev = ji > 0 ? jobs[ji - 1] : undefined;
  const reqs = [...(j.fameReq ? [{ metric: "fame", min: j.fameReq }] : []), ...(j.reqs ?? [])];
  return unlockLock(s, reqs, label, prev && { key: `work:${prev.id}`, name: prev.label, need: j.needPrev });
}

export const RAW_LESSON_GRADES: LessonGrade[] = [
  { id: "g1", label: "初级", costMul: 1, gainMul: 1.0, cap: 250, stressAdd: 0 },
  { id: "g2", label: "中级", costMul: 2.4, gainMul: 0.72, cap: 500, stressAdd: 1 },
  { id: "g3", label: "高级", costMul: 5, gainMul: 0.52, cap: 760, stressAdd: 2 },
  { id: "g4", label: "专家级", costMul: 10, gainMul: 0.38, cap: 999, stressAdd: 3 },
];
/** 功能注释：非娱乐圈未写通用课程等级时的中性单级，不带某一打工剧本的学费曲线。 */
export const NEUTRAL_LESSON_GRADE: LessonGrade = { id: "g1", label: "标准", costMul: 1, gainMul: 1, cap: 999, stressAdd: 0 };
export const LESSON_GRADES: LessonGrade[] = liveArray(() => {
  const g = tuning().lessonGrades;
  if (g?.length) return g;
  // 娱乐圈未写才回落原 4 级；其它作品未勾/未写不套用娱乐圈等级表
  return currentWorldId() === "ent" ? RAW_LESSON_GRADES : [NEUTRAL_LESSON_GRADE];
});

/* ═══ 打工（分级零工，靠名气变现）═══
 * 级别越高：单次收入越高、压力越大，且要求名气门槛越高才请得动你。 */
export type SideJob = {
  id: string;
  label: string;
  pay: number; // 基础收入（元）
  stress: number;
  fameReq: number; // 名气门槛
  note: string;
  cgain?: Record<string, [number, number]>; // 自定义属性收益
  reqs?: GradeReq[]; // 额外解锁门槛（任意属性）
  needPrev?: number; // 列表中上一档打工需完成的次数
};

export const RAW_SIDE_JOBS: SideJob[] = [
  { id: "sj1", label: "初级打工", pay: 3000, stress: 4, fameReq: 0, note: "商场派单 · 咖啡馆帮工 · 糊口零工" },
  { id: "sj2", label: "中级打工", pay: 9000, stress: 6, fameReq: 60, note: "店庆站台 · 婚礼助唱 · 小有名气才请得动" },
  { id: "sj3", label: "高级打工", pay: 24000, stress: 8, fameReq: 180, note: "商演跑场 · 品牌快闪 · 名气开始变现" },
  { id: "sj4", label: "专家级打工", pay: 60000, stress: 11, fameReq: 350, note: "私人晚宴助阵 · 高端商务陪场 · 顶流价码" },
];

/** 功能注释：非娱乐圈未声明打工 = 空表，不套用便利店/商演等默认档。 */
export const SIDE_JOBS: SideJob[] = liveArray(() => slot("sideJobs", () => RAW_SIDE_JOBS, () => []));

/* ═══ 日程推进结果档位（仿《明星志愿》：完美 / 大成功 / 成功 / 失败 / 糟糕）═══
 * 同一件事，掷出的档位不同，收益倍率也不同。 */
export type DayGrade = "perfect" | "great" | "success" | "fail" | "bad";
export const GRADE_LABEL: Record<DayGrade, string> = {
  perfect: "完美",
  great: "大成功",
  success: "成功",
  fail: "失败",
  bad: "糟糕",
};
export const RAW_GRADE_MUL: Record<DayGrade, number> = {
  perfect: 1.6,
  great: 1.3,
  success: 1.0,
  fail: 0.4,
  bad: 0.0,
};
export const RAW_GRADE_ODDS: Record<DayGrade, number> = { perfect: 8, great: 22, success: 48, fail: 15, bad: 7 };

/* ═══ 引擎规则（模组槽 tuning）：按模块勾选；缺省不预填某一剧本数值，空着开局不生效 ═══ */
export type TuningSlot = {
  /** 创作者勾选要用的模块；false = 强制关闭（即使旧数据也清掉） */
  modules?: TuningModulesFlag;
  gradeOdds?: Partial<Record<DayGrade, number>>; // 每日表现评级的基础概率（%，按比例归一）
  gradeMul?: Partial<Record<DayGrade, number>>; // 各评级的收益倍率
  luckStat?: string; // 提升表现的属性（"stat:<八维>" / "c:<自定义>"）
  luckDiv?: number; // 该属性每多少点 +1% 好评级（0 = 不影响）
  stressDiv?: number; // 压力每多少点 -1% 好评级（0 = 不影响）
  restStress?: number; // 「休息」减压量；未写 = 无效果
  trainGainMul?: number; // 课程收益总倍率；未写 = 1
  trainFeeMul?: number; // 学费总倍率；未写 = 1
  jobPayMul?: number; // 打工收入总倍率；未写 = 1
  lessonGrades?: LessonGrade[]; // 通用课程等级表（课程未自定义等级时使用）
  economy?: EconomyRules; // 经济规则：透支 / 破产 / 新手缓冲
  gigRules?: GigRules; // 工作结算 / 违约等；须勾选对应模块才出现
};
/* 工作结算规则。条件键与恋人加成相同（stat:<八维> / attr:<自定义> / affinity + pid / stress 等顶层数值） */
export type GigCond = { key: string; pid?: string; op: ">=" | "<="; value: number; delta: number };
export type GigRules = {
  crashOn?: boolean; // 是否启用崩溃判定（缺省 true）
  crashStress?: number; // 压力达到多少触发判定（缺省 90）
  crashBase?: number; // 基础崩溃概率 %（缺省 20）
  crashMin?: number; // 修正后的最低概率 %（缺省 5）
  crashMods?: GigCond[]; // 满足条件则概率 + delta（负数为降低）；缺省 = 引擎原规则
  bizOn?: boolean; // 是否启用商业价值成长（缺省 true）
  bizTypes?: string; // 哪些工作类型会涨（类型名包含其一即可，用 | 分隔；缺省 广告|综艺|品牌）
  bizMin?: number; // 每次成长下限（缺省 4）
  bizMax?: number; // 每次成长上限（缺省 9）
  bizKey?: string; // 成长写入的属性键（缺省 bizValue 商业价值）
  repairs?: GigRepair[]; // 工作失败后的补救方案（满足条件的随机触发 1 项）；缺省 = 引擎原 5 项，[] = 关闭
  breachBase?: number; // 每次违约让交涉成功率降低多少 %（缺省 8）
  breachHi?: number; // 下列类型工作每次违约降低多少 %（缺省 14）
  breachHiTypes?: string; // 违约影响更大的工作类型（| 分隔；缺省 广告|品牌|电影）
  managers?: GigManager[]; // 按工作类型对接的负责人与地点（从上往下匹配第一条）；缺省 = 引擎原表
  managerDefault?: { name: string; loc: string }; // 都不匹配时的负责人（缺省 林宜 · 启星事务所）
  failFx?: { key: string; min: number; max: number }[]; // 工作失败的惩罚（每项 min~max 随机）；缺省 = 引擎原值，[] = 不惩罚
  failPayMax?: number; // 失败仍能拿到的报酬上限 %（0~该值随机；缺省 30）
  failStatLoss?: [number, number]; // 失败时该工作成长的能力各降低多少（缺省 1~4；[0,0] = 不降）
};
export const RAW_FAIL_FX: NonNullable<GigRules["failFx"]> = [
  { key: "fame", min: -40, max: -5 }, { key: "reputation", min: -8, max: -3 }, { key: "trust", min: -10, max: -10 },
  { key: "defaults", min: 1, max: 1 }, { key: "stress", min: 6, max: 6 }, { key: "blackFans", min: 1, max: 3 },
];
/* 补救方案：conds 全部满足（any = 任一满足）才可能触发；fx 每项在 min~max 间随机。键同条件键，另支持 money 资金 */
export type GigRepair = { name: string; maxStar?: number; conds?: Omit<GigCond, "delta">[]; any?: boolean; fx: { key: string; min: number; max: number }[] };
export type GigManager = { types: string; name: string; loc: string };
export const RAW_GIG_REPAIRS: GigRepair[] = [
  { name: "临时替补", maxStar: 3, fx: [{ key: "fame", min: 8, max: 8 }] },
  { name: "导演复试", conds: [{ key: "trust", op: ">=", value: 40 }], fx: [{ key: "trust", min: 3, max: 3 }] },
  { name: "朋友陪伴", any: true, conds: [{ key: "affinity", pid: "suqing", op: ">=", value: 40 }, { key: "affinity", pid: "linzhixia", op: ">=", value: 40 }], fx: [{ key: "stress", min: -12, max: -12 }] },
  { name: "公关补救", conds: [{ key: "pr", op: ">=", value: 150 }], fx: [{ key: "money", min: -120000, max: -30000 }, { key: "blackFans", min: -3, max: -1 }] },
  { name: "自费短片", any: true, conds: [{ key: "stat:caizhi", op: ">=", value: 300 }, { key: "stat:yanji", op: ">=", value: 300 }], fx: [{ key: "money", min: -80000, max: -80000 }, { key: "reputation", min: 3, max: 8 }] },
];
export const RAW_GIG_MANAGERS: GigManager[] = [
  { types: "广告|品牌|代言", name: "孟晚乔", loc: "璀璨广告中心" },
  { types: "电影", name: "许砚清", loc: "浮光影视基地" },
  { types: "电视剧|剧", name: "方知远", loc: "浮光影视基地" },
  { types: "综艺|采访|直播", name: "秦砚舟", loc: "云台传媒城" },
  { types: "唱片|音乐|舞台|单曲|演唱会", name: "梁怀音", loc: "迭音音乐工坊" },
];
export const RAW_GIG_MANAGER_DEFAULT = { name: "林宜", loc: "启星事务所" };
/* 工作类型是否命中「a|b|c」形式的类型列表（包含其一即可） */
export const typeHit = (type: string, list: string) => list.split("|").map((x) => x.trim()).filter(Boolean).some((t) => type.includes(t));
export const RAW_CRASH_MODS: GigCond[] = [
  { key: "stat:tineng", op: ">=", value: 500, delta: -5 },
  { key: "affinity", pid: "suqing", op: ">=", value: 60, delta: -5 },
];
export const gigRules = (): GigRules => tuning().gigRules ?? {};
/** 功能注释：仅当作品已写出 gigRules 时视为旧作/自定工作规则；新作品空白不带娱乐圈工作/违约块。 */
export const hasAuthoredGigRules = (gr?: GigRules | null): boolean => !!(gr && Object.keys(gr).length > 0);
/** 功能注释：当前 tuning 是否启用某引擎模块（勾选或旧作已写字段）。 */
export const tuningHasModule = (id: TuningModuleId): boolean => tuningModuleOn(tuning(), id);
/* 经济规则。无账单/生活开销时不应启用透支收官；有账单时创作者勾选 bankrupt 才结束游戏。
 * chargeItems 已下线，周结算不再使用扣费依据名单。 */
export type EconomyRules = {
  bankrupt?: boolean; // 透支到破产线是否结束游戏（缺省 false，须创作者勾选）
  bankruptLine?: number; // 破产线（正数，透支超过即破产）；缺省 = 周固定开销 × 28，夹在 500~50 万
  overdraftStress?: number; // 透支期间每周额外压力（缺省不追加）
  graceWeeks?: number; // 新手缓冲：前 N 周账单打折（缺省 0）
  graceBillMul?: number; // 缓冲期账单倍率（缺省 0.5）
  /** @deprecated 扣费依据已删除；读到也忽略 */
  chargeItems?: ChargeBasisItem[];
};
export const economy = (): EconomyRules => tuning().economy ?? {};
export const bankruptLineFor = (weeklyBase: number, e: EconomyRules = economy()): number =>
  -(e.bankruptLine && e.bankruptLine > 0 ? e.bankruptLine : Math.min(500000, Math.max(500, weeklyBase * 28)));
export const tuning = (): TuningSlot => slot<TuningSlot>("tuning", () => ({}), () => ({}));
/** 功能注释：非娱乐圈未写评级倍率时全按 ×1，不套用娱乐圈 1.6/0.4 曲线。 */
export const GRADE_MUL: Record<DayGrade, number> = liveRecord(() => {
  const authored = tuning().gradeMul ?? {};
  return { perfect: 1, great: 1, success: 1, fail: 1, bad: 1, ...authored };
});
export const GRADE_TONE: Record<DayGrade, string> = {
  perfect: "gold",
  great: "jade",
  success: "jade",
  fail: "coral",
  bad: "danger",
};

// 通告库（GIG_POOL）：一整条从平面广告到电影主角的接戏成长线。
// star=难度星级(1-5)；fameReq=名气门槛；statReq=八维硬门槛；
// pay=片酬(元)；fame=完成名气收益；energy=每日行动力消耗；days=拍摄天数；
// grow=完成后八维成长；note=一句话说明这条通告是什么。
// 剧组阵容：一部戏/电影的四位主要角色（虚构角色名）。玩家出演其中一个 role。
export type GigCast = {
  femaleLead?: string; // 女主角
  maleLead?: string; // 男主角
  femaleSupport?: string; // 女配角
  maleSupport?: string; // 男配角
  /** 功能注释：作者在 gigConfig.roles 里自定义的阵容角色 key（如 师父 / 对手） */
  [role: string]: string | undefined;
};
export type Gig = {
  id: string;
  name: string;
  type: string;
  star: number;
  fameReq: number;
  statReq: Partial<Record<StatKey, number>>;
  fame: number; // 完成名气收益
  pay: number; // 元
  energy: number; // 每日
  days: number;
  grow: Partial<Record<StatKey, number>>;
  note?: string; // 通告简介（说明这是什么活儿）
  genre?: string; // 题材/品类/曲风（如 校园·古风·都市·言情·乡村 / 美妆·数码 / 流行·民谣）
  role?: string; // 玩家出演的角色（女主角 / 女配角 / 客串 …），仅影视类
  cast?: GigCast; // 该剧组的男女主角、男女配角（虚构角色名），仅影视类
  cat?: string; // 显式分类 id（gigConfig.cats）；不写则按类型关键词自动归类
  fixedWeek?: number; // 重点通告的固定开机周：档期锁死，只能在临近该周时到公司接洽
};

export const GIG_POOL: Gig[] = [
  // ── 一星 · 新人起步（无名气门槛，练手赚口粮）──
  { id: "g1", name: "口香糖平面广告", type: "平面广告", star: 1, fameReq: 0, statReq: { yitai: 60 }, fame: 12, pay: 45000, energy: 10, days: 1, grow: { yitai: 6, zixin: 3 }, note: "便利店海报里的清爽笑容，出镜一天，新人试水的第一支广告。" },
  { id: "g0a", name: "校园剧龙套", type: "电视剧龙套", star: 1, fameReq: 0, statReq: {}, fame: 8, pay: 22000, energy: 8, days: 1, grow: { yanji: 8, tineng: 3 }, note: "一句台词的过场同学，站在镜头边缘，也是熬资历的开始。" },
  { id: "g0b", name: "网店服装模特", type: "平面广告", star: 1, fameReq: 0, statReq: { yitai: 40 }, fame: 6, pay: 18000, energy: 9, days: 1, grow: { yitai: 8 }, note: "一整天换二十套衣服拍图，钱不多，却练出了镜头感。" },

  // ── 二星 · 崭露头角（小有名气后接得到的活）──
  { id: "g2", name: "青春网剧配角", type: "电视剧配角", star: 2, fameReq: 50, statReq: { yanji: 120 }, fame: 22, pay: 90000, energy: 12, days: 2, grow: { yanji: 12, koucai: 5 }, note: "都市青春剧里的女二号，有几场哭戏，是磨演技的好机会。" },
  { id: "g3", name: "少女团体单曲", type: "团体唱片", star: 2, fameReq: 40, statReq: { geyi: 100 }, fame: 20, pay: 80000, energy: 10, days: 2, grow: { geyi: 12 }, note: "五人女团的合体单曲，跟唱跟跳，粉丝基本盘从这里攒起。" },
  { id: "g2b", name: "地方台综艺嘉宾", type: "综艺", star: 2, fameReq: 60, statReq: { koucai: 90 }, fame: 18, pay: 60000, energy: 10, days: 1, grow: { koucai: 8, zixin: 4 }, note: "周末档游戏综艺的飞行嘉宾，放得开就能圈一波路人缘。" },
  { id: "g2c", name: "校园民谣 MV 女主", type: "MV", star: 2, fameReq: 45, statReq: { yitai: 110 }, fame: 16, pay: 55000, energy: 11, days: 1, grow: { yitai: 6, geyi: 5 }, note: "为热门民谣拍摄故事感 MV，一支镜头就是一帧海报。" },

  // ── 三星 · 稳步上升（挑大梁前的历练）──
  { id: "g4", name: "都市轻综艺飞行", type: "综艺", star: 3, fameReq: 120, statReq: { koucai: 150, zixin: 100 }, fame: 30, pay: 120000, energy: 12, days: 2, grow: { koucai: 8, zixin: 6, tineng: 4 }, note: "当红棚内综艺的常驻飞行，临场反应决定能剪进多少镜头。" },
  { id: "g3b", name: "商场开业商演", type: "商演", star: 3, fameReq: 100, statReq: { donggan: 120, tineng: 100 }, fame: 24, pay: 150000, energy: 14, days: 1, grow: { donggan: 8, tineng: 6 }, note: "新商场剪彩，露天舞台唱跳三首，来钱快但赶场累人。" },
  { id: "g3c", name: "年代剧重要配角", type: "电视剧配角", star: 3, fameReq: 150, statReq: { yanji: 200, yitai: 120 }, fame: 38, pay: 200000, energy: 15, days: 3, grow: { yanji: 16, caizhi: 6 }, note: "长篇年代大戏里贯穿始终的重要角色，演好了就是口碑作。" },

  // ── 四星 · 一线在望（名气与实力双高门槛）──
  { id: "g5", name: "香槟高奢代言", type: "代言", star: 4, fameReq: 260, statReq: { yitai: 220 }, fame: 45, pay: 260000, energy: 14, days: 2, grow: { yitai: 10, zixin: 5 }, note: "国际香槟品牌年度代言，红毯与硬照并重，是身价的象征。" },
  { id: "g6", name: "《雾港来信》女主", type: "电视剧主角", star: 4, fameReq: 200, statReq: { yanji: 240, koucai: 120 }, fame: 80, pay: 400000, energy: 18, days: 3, grow: { yanji: 22, caizhi: 8 }, note: "热门悬爱剧的绝对女主，扛收视的一部戏，成了就是当红花旦。", role: "女主角", cast: { femaleLead: "苏时予（你）", maleLead: "霍延之", femaleSupport: "林晚", maleSupport: "陈牧" }, fixedWeek: 20 },
  { id: "g8", name: "个人首张专辑", type: "个人唱片", star: 4, fameReq: 260, statReq: { geyi: 260, donggan: 150 }, fame: 100, pay: 500000, energy: 14, days: 3, grow: { geyi: 25, zixin: 8, donggan: 6 }, note: "从团体走向个人的第一张专辑，从选曲到打歌都是硬仗。" },

  // ── 五星 · 封神之作（顶级资源，可遇不可求）──
  { id: "g7", name: "文艺电影女主", type: "电影主角", star: 5, fameReq: 400, statReq: { yanji: 320, zixin: 200 }, fame: 140, pay: 900000, energy: 22, days: 3, grow: { yanji: 30, zixin: 12 }, note: "名导筹备三年的文艺片女主，冲奖之作，一部戏定演员生涯。", role: "女主角", cast: { femaleLead: "苏时予（你）", maleLead: "江既明", femaleSupport: "何知夏", maleSupport: "秋原" }, fixedWeek: 48 },
  { id: "g7b", name: "贺岁大片双女主", type: "电影主角", star: 5, fameReq: 480, statReq: { yanji: 300, yitai: 260 }, fame: 160, pay: 1200000, energy: 24, days: 4, grow: { yanji: 26, yitai: 12, zixin: 8 }, note: "全明星阵容的春节档大制作，票房与番位皆是战场。", role: "女主角之一", cast: { femaleLead: "苏时予（你）", maleLead: "傅承屿", femaleSupport: "许南乔", maleSupport: "程知野" }, fixedWeek: 52 },
  { id: "g7c", name: "跨年演唱会主咖", type: "个人唱片", star: 5, fameReq: 520, statReq: { geyi: 320, donggan: 260, tineng: 200 }, fame: 150, pay: 1500000, energy: 26, days: 4, grow: { geyi: 22, donggan: 14, tineng: 10 }, note: "卫视跨年晚会的压轴主咖，全国直播的高光,也是体力的极限考验。" },
  // ── 通告库大全：广告 / 电视剧 / 电影 / 唱片 各 100 档（gigLibrary.ts 确定性生成，名称唯一） ──
  ...GENERATED_GIGS,
];

// 名气区间（策划案 名气：通告资格）
export type FameTier = { min: number; label: string; desc: string };
export const RAW_FAME_TIERS: FameTier[] = [
  { min: 0, label: "无名新人", desc: "一星通告、临时替补、低成本网剧" },
  { min: 50, label: "小有水花", desc: "二星广告、电视剧配角、基础写真" },
  { min: 150, label: "上升艺人", desc: "三星通告、常规综艺候选、品牌合作" },
  { min: 300, label: "当红艺人", desc: "综艺正式邀请、四星主角竞争" },
  { min: 500, label: "一线女星", desc: "五星候选、年度大制作、国际活动" },
  { min: 750, label: "国民级女星", desc: "顶级资源优先、终局大奖、隐藏路线" },
];

/* 名气分档（模组槽 fameTiers；未声明 → 通用分档） */
const GENERIC_FAME_TIERS: FameTier[] = [
  { min: 0, label: "默默无闻", desc: "刚刚起步" },
  { min: 50, label: "小有名气", desc: "身边人开始认识你" },
  { min: 150, label: "崭露头角", desc: "圈子里有了你的名字" },
  { min: 300, label: "声名鹊起", desc: "走到哪里都有人认出" },
  { min: 500, label: "名满一方", desc: "众人瞩目" },
  { min: 750, label: "家喻户晓", desc: "传奇人物" },
];
export const FAME_TIERS: FameTier[] = liveArray(() => {
  const t = slot<FameTier[]>("fameTiers", () => RAW_FAME_TIERS, () => GENERIC_FAME_TIERS);
  return Array.isArray(t) && t.length ? t : GENERIC_FAME_TIERS;
});
/** 按分档取档名（tiers 无序也可） */
export function tierOf(v: number, tiers?: { min: number; label: string }[]): string | undefined {
  // 功能注释：AI 常把 tiers 写成对象；非数组直接视为无分档，禁止 [...tiers] → is not iterable
  if (!Array.isArray(tiers) || !tiers.length) return undefined;
  const t = [...tiers].sort((a, b) => a.min - b.min);
  return [...t].reverse().find((x) => v >= x.min)?.label ?? t[0].label;
}
export const statTiers = () => statsSlot().tiers ?? {};
export const statDisplay = () => statsSlot().display ?? "num";
/** 能力取值范围（模组可改；缺省 0~999） */
export const statRange = (k: StatKey) => { const r = statsSlot().range?.[k]; const min = Math.max(0, r?.min ?? 0); return { min, max: Math.max(min + 1, r?.max ?? 999) }; };
export const clampStat = (k: StatKey, v: number) => { const { min, max } = statRange(k); return Math.max(min, Math.min(max, v)); };
export const statColor = (k: StatKey) => statsSlot().colors?.[k];

export function fameTier(fame: number): FameTier {
  const tiers = [...FAME_TIERS];
  return [...tiers].reverse().find((t) => fame >= t.min) ?? tiers[0];
}

// 8. 地图系统（P0 首版开放 / P1 即将开放）
export type MapLocation = {
  id: string;
  name: string;
  icon: string;
  func: string;
  tier: "P0" | "P1";
  action: string; // 固定行动
  hint: string; // 今日可做 / 关键人物提示
};

export const LOCATIONS: MapLocation[] = [
  { id: "apartment", name: "天光小区", icon: "", func: "排日程 · 休息 · 邻里 · 私密事件", tier: "P0", action: "深度休息：行动力 +40、压力 -12", hint: "江叙白常在楼下中庭出没 · 顾沉/宋时序短信需已认识" },
  { id: "agency", name: "启星事务所", icon: "", func: "查日程 · 接基础资源", tier: "P0", action: "查看新人资源（免费）", hint: "林宜固定出现 · 名气<30 必出临时替补" },
  { id: "fuguang", name: "浮光影视基地", icon: "", func: "电视剧 · 电影 · 试镜", tier: "P0", action: "查看剧本库（免费）", hint: "方知远、许砚清固定 · 演技≥240 遇沈曼" },
  { id: "yuntai", name: "云台传媒城", icon: "", func: "综艺 · 采访 · 直播", tier: "P0", action: "查看节目排期（免费）", hint: "秦砚舟固定 · 名气榜前10 遇陆曜" },
  { id: "cancan", name: "璀璨广告中心", icon: "", func: "广告 · 品牌 · 代言", tier: "P0", action: "查看广告库（免费）", hint: "孟晚乔固定 · 容貌≥600 遇宋时序" },
  { id: "dieyin", name: "迭音音乐工坊", icon: "", func: "单曲 · 舞台 · 演唱会", tier: "P0", action: "查看唱片库（免费）", hint: "梁怀音固定 · 歌艺≥160 遇林知夏" },
  { id: "street", name: "星桥商业街", icon: "", func: "逛街 · 街拍 · 偶遇", tier: "P1", action: "街拍：名气 +5~12", hint: "第2周后 白衬衫眼镜男子随机出现" },
  { id: "cafe", name: "白栀咖啡馆", icon: "", func: "社交 · 约见 · 恢复压力", tier: "P1", action: "深度谈话：关系 +4~7", hint: "第6周后遇苏晴 · 记者按事件出现" },
  { id: "redcarpet", name: "红毯会客厅", icon: "", func: "晚宴 · 典礼 · 结识金主", tier: "P1", action: "参加晚宴：3万~10万", hint: "闻予安在公益活动开放后出现" },
  { id: "gym", name: "星栖练习馆", icon: "", func: "训练八维属性", tier: "P1", action: "私教冲刺：收益 +50%", hint: "训练导师固定 · 苏晴压力高时同练" },
  { id: "bookstore", name: "墨痕书店", icon: "", func: "购书 · 充电 · 静一静", tier: "P1", action: "翻翻书架（免费）", hint: "买回表演教材，在家看书涨才智" },
  { id: "wardrobe", name: "华裳时装屋", icon: "", func: "置装 · 造型 · 提升仪态", tier: "P1", action: "试搭一身行头（免费）", hint: "买回战袍礼服，出席场合更出挑" },
  { id: "academy", name: "京都电影学院", icon: "", func: "母校 · 进修 · 师生人脉", tier: "P0", action: "回母校旁听（免费）：才智 +3", hint: "科班出身的起点 · 恩师与同窗常在此" },
  { id: "airport", name: "京畿国际机场", icon: "", func: "远行 · 外地通告 · 接送机", tier: "P0", action: "候机厅小憩：压力 -8", hint: "外地拍摄与国际活动由此出发" },
  { id: "beauty", name: "昭华形象管理中心", icon: "", func: "医美 · 皮肤管理 · 提升容貌", tier: "P1", action: "专业护理（付费）：造型值 +60", hint: "名气≥50 方能预约 · 容貌线进阶" },
  { id: "theater", name: "星光剧场", icon: "", func: "粉丝见面会 · 舞台 · 涨名气", tier: "P1", action: "办场见面会：名气 +8~15", hint: "需已有作品傍身，粉丝才会买单" },
  { id: "lounge", name: "云顶私人会所", icon: "", func: "顶级社交 · 人脉 · 资本局", tier: "P1", action: "赴一场资本局：人脉 +5", hint: "名气≥120、口碑≥60 方得引荐入内" },
  { id: "fours", name: "星辉 4S 汽车城", icon: "", func: "买车 · 置换 · 二手回收", tier: "P0", action: "看车选车（免费）", hint: "购入座驾后出行可「自己开车」· 卖车按残值回收" },
];

/* ═══ 世界·社会规则（玩家可在设置里下拉调整 / 开关，注入 AI 叙事）═══
 * 每个维度给若干可选项；总开关关闭时沿用现实默认。 */
export type WorldRuleOption = { id: string; label: string; desc: string };
export type WorldRuleDim = { id: string; label: string; hint: string; def: string; options: WorldRuleOption[] };

export const WORLD_RULE_DIMS: WorldRuleDim[] = [
  {
    id: "love", label: "恋爱模式", hint: "谈恋爱时能否同时交往多人", def: "loyal",
    options: [
      { id: "loyal", label: "专一", desc: "一次只谈一段恋爱" },
      { id: "player", label: "海王", desc: "可同时与多人交往，但恋人之间会吃醋" },
    ],
  },
  {
    id: "marriage", label: "婚姻制度", hint: "恋人之间能否、能与几人缔结夫妻（需举办婚礼）", def: "mono",
    options: [
      { id: "mono", label: "一夫一妻", desc: "只能与一位恋人缔结婚约" },
      { id: "poly_wife", label: "一夫多妻", desc: "男性可与多位恋人成婚" },
      { id: "poly_husband", label: "一妻多夫", desc: "女性可与多位恋人成婚" },
      { id: "free", label: "自由伴侣", desc: "没有婚姻制度，无法举办婚礼" },
    ],
  },
  {
    id: "samesex", label: "同性婚恋", hint: "同性之间能否确认交往、缔结婚姻", def: "allow",
    options: [
      { id: "allow", label: "允许", desc: "同性恋人可交往，也可举办婚礼" },
      { id: "forbid", label: "禁止", desc: "社会不认可同性关系，无法确认交往或成婚" },
    ],
  },
  {
    id: "divorce", label: "离婚权限", hint: "婚姻能否解除、需要谁同意", def: "mutual",
    options: [
      { id: "mutual", label: "双方同意", desc: "需配偶也愿意分开（好感 ≤ 40）" },
      { id: "unilateral", label: "单方可离", desc: "任一方提出即可离婚，但伤感情" },
      { id: "forbid", label: "禁止离异", desc: "婚姻一经缔结不可解除" },
    ],
  },
  {
    id: "inherit", label: "子嗣继承权", hint: "子女如何分配家产与名望", def: "equal",
    options: [
      { id: "equal", label: "均分继承", desc: "婚生子女均分，非婚生子女得半份" },
      { id: "eldest", label: "长子优先", desc: "最年长的婚生儿子继承全部，无子则长女" },
      { id: "legit", label: "仅婚生继承", desc: "只有婚内所生的子女有继承权" },
      { id: "any", label: "私生同等", desc: "无论婚生与否，所有子女均分" },
    ],
  },
  {
    id: "surname", label: "冠姓权", hint: "子女随谁的姓氏", def: "father",
    options: [
      { id: "father", label: "随父姓", desc: "子女默认承袭父姓" },
      { id: "mother", label: "随母姓", desc: "子女默认承袭母姓" },
      { id: "either", label: "父母皆可", desc: "由双方协商决定" },
      { id: "new", label: "另立新姓", desc: "可创立全新姓氏" },
    ],
  },
  {
    id: "birth", label: "生育制度", hint: "谁能怀胎生子（十月怀胎，第十一个月分娩）", def: "female",
    options: [
      { id: "female", label: "女子生育", desc: "现实默认：仅女性可怀孕" },
      { id: "male", label: "男子生育", desc: "男性怀胎生子，女性不孕" },
      { id: "both", label: "男女皆可", desc: "无论男女，亲密后皆可能受孕" },
    ],
  },
  {
    id: "order", label: "社会秩序", hint: "两性在社会中的地位格局", def: "standard",
    options: [
      { id: "standard", label: "标准规范", desc: "贴近现实的两性格局" },
      { id: "matriarchy", label: "女尊社会", desc: "女性主导社会与话语权" },
      { id: "patriarchy", label: "男尊社会", desc: "男性主导社会与话语权" },
      { id: "egalitarian", label: "绝对平权", desc: "彻底的性别平等" },
    ],
  },
];

export const defaultWorldRules = (): { enabled: boolean; choices: Record<string, string> } => ({
  enabled: false,
  choices: Object.fromEntries(WORLD_RULE_DIMS.map((d) => [d.id, d.def])),
});

export const worldRuleLabel = (dimId: string, optId: string): string =>
  WORLD_RULE_DIMS.find((d) => d.id === dimId)?.options.find((o) => o.id === optId)?.label ?? optId;

/* ═══ 车辆（在星辉 4S 店购入 / 置换）═══
 * 有车后，出行可选「自己开车」——免费又体面。卖车按残值率回收，差价即折旧。
 * comfort：开车出行时额外舒缓的压力（越高档越省心）。 */
export type Car = {
  id: string;
  name: string;
  price: number; // 裸车价（元）
  resale: number; // 残值率：卖出可回收 price×resale，其余为折旧
  comfort: number; // 自驾一次额外 -压力
  tag: string;
  desc: string;
  buyBonus?: Record<string, number>; // 购买时一次性增益（属性键 / stress / mood / energy / money）
  tripBonus?: Record<string, number>; // 每次自己驾驶出行的增益
};
/* 把增益表应用到存档（属性键写入 stats，其余为顶层数值） */
/** 功能注释：属性显示名——先查作者建角属性，再查内置属性与常用数值；玩法包界面统一用它 */
export function attrLabelOf(key: string): string {
  const def = asModArray<{ id: string; label?: string }>(slot("customAttrs", () => [], () => [])).find((d) => d.id === key);
  if (def) return def.label || key;
  return (STAT_LABELS as Record<string, string>)[key] ?? ({ stress: "压力", mood: "心情", energy: "体力", money: "资金", fame: "名气" } as Record<string, string>)[key] ?? key;
}

export function applyBonus<T extends { stats: Record<string, number>; cattrs?: Record<string, number> }>(s: T, b?: Record<string, number>): { next: T; notes: string[] } {
  if (!b) return { next: s, notes: [] };
  const n = { ...s, stats: { ...s.stats } } as T & Record<string, unknown>;
  const notes: string[] = [];
  // 功能注释：key 为作者建角属性 id 时写入 cattrs（按属性上下限截断），玩法包不依赖娱乐圈八维
  const attrDefs = asModArray<{ id: string; label?: string; min?: number; max?: number; init?: number }>(slot("customAttrs", () => [], () => []));
  for (const [k, v] of Object.entries(b)) {
    if (!v) continue;
    const def = attrDefs.find((d) => d.id === k);
    if (def) {
      const cur = n.cattrs?.[k] ?? def.init ?? 0;
      const max = typeof def.max === "number" && def.max > 0 ? def.max : Infinity;
      n.cattrs = { ...(n.cattrs ?? {}), [k]: Math.max(def.min ?? 0, Math.min(max, cur + v)) };
      notes.push(`${def.label || k} ${v > 0 ? "+" : ""}${v}`);
      continue;
    }
    if (k in n.stats) n.stats[k] = clampStat(k as StatKey, (n.stats[k] ?? 0) + v); // 遵守本世界属性上下限
    else if (typeof n[k] === "number") (n as Record<string, number>)[k] = k === "money" ? (n[k] as number) + v : Math.max(0, Math.min(100, (n[k] as number) + v));
    else continue;
    notes.push(`${(STAT_LABELS as Record<string, string>)[k] ?? ({ stress: "压力", mood: "心情", energy: "体力", money: "资金" } as Record<string, string>)[k] ?? k} ${v > 0 ? "+" : ""}${v}`);
  }
  return { next: n, notes };
}

export const RAW_CARS: Car[] = [
  { id: "ev_mini", name: "灵动 mini 电动车", price: 38000, resale: 0.5, comfort: 1, tag: "代步", desc: "小巧灵活的入门电动车，挤地铁的日子总算到头了。" },
  { id: "sedan", name: "家用舒适轿车", price: 128000, resale: 0.58, comfort: 3, tag: "家用", desc: "空间够、油耗低，接送通告体面又踏实。" },
  { id: "suv", name: "都市越野 SUV", price: 265000, resale: 0.6, comfort: 4, tag: "全能", desc: "底盘高、视野好，外地拍摄山路也不怵。" },
  { id: "coupe", name: "轻奢运动轿跑", price: 720000, resale: 0.64, comfort: 6, tag: "轻奢", desc: "流线车身回头率拉满，红毯与街拍都镇得住。" },
  { id: "flagship", name: "旗舰豪华座驾", price: 1680000, resale: 0.68, comfort: 8, tag: "旗舰", desc: "顶级静谧与真皮内饰，一坐进去就知道什么叫顶流待遇。" },
];
export const CARS: Car[] = liveArray(() => slot<Car[]>("cars", () => RAW_CARS, () => []));
export const carById = (id: string | null | undefined) => CARS.find((c) => c.id === id) ?? null;
/* 卖出回收价（就近取整） */
export const resaleValue = (c: Car) => Math.round(c.price * c.resale);

// 5. 固定核心人物 + 可攻略角色
export type PersonDef = {
  id: string;
  name: string;
  role: string;
  line: string;
  desc: string;
  color: string; // 头像底色
  init: number; // 初始关系
};

export const PEOPLE: PersonDef[] = [
  { id: "luyao", name: "陆曜", role: "顶流同期", line: "竞争者", desc: "排行榜宿敌，阶段对比对象", color: "#0f4c45", init: 0 },
  { id: "suqing", name: "苏晴", role: "元气小花", line: "挚友线", desc: "友情互动、互相营业、缓压", color: "#e47768", init: 15 },
  { id: "linzhixia", name: "林知夏", role: "创作才女", line: "合作线", desc: "原创作品、音乐路线加成", color: "#5c7f8c", init: 5 },
  { id: "shenman", name: "沈曼", role: "金奖影后", line: "前辈线", desc: "影视资源、演技成长、提携剧情", color: "#c69b52", init: 0 },
  { id: "guchen", name: "顾沉", role: "国民天王", line: "可攻略 · 天王线", desc: "高难度恋爱线、隐藏高级结局", color: "#29333a", init: 0 },
  { id: "songshixu", name: "宋时序", role: "顶级金主", line: "可攻略 · 资本线", desc: "高额投资、品牌资源、危险感恋爱线", color: "#6a6157", init: 0 },
  { id: "wenyuan", name: "闻予安", role: "市长之子", line: "可攻略 · 世家线", desc: "极高门槛恋爱线、公共形象保护", color: "#176b62", init: 0 },
  { id: "jiangxu", name: "江叙白", role: "邻居哥哥", line: "可攻略 · 陪伴线", desc: "日常陪伴、生活恢复、稳定关系", color: "#8a9b6e", init: 18 },
  { id: "zhouyan", name: "周砚川", role: "离婚创一代", line: "可攻略 · 成熟事业线", desc: "创业合作、资源边界、成年人的感情", color: "#4a5259", init: 0 },
];

export const RAW_RANDOM_NAMES = [
  "宋砚", "许澄", "季白", "顾宁", "夏予", "沈屿", "江眠", "林屿",
  "云舒", "南枝", "温言", "乔安", "陆星", "黎川", "沈曜", "简宁",
];

// 7. 随机 NPC 生成池
export const RAW_NPC_NAME_POOL = [
  "白蔻", "凌汐", "苏念", "唐楚", "叶知秋", "祝清", "关山月", "颜栩",
  "米朵", "秦岚", "何以歌", "郑好", "费霓", "邵允", "柯月", "汤圆",
  "毕星", "简一", "洛薇", "钟离", "沈青梧", "陆则明", "夏承欢", "程见夏",
  "林砚", "顾知微", "温向晚", "江照", "许听澜", "方与之", "薛见山", "邬桑",
  "戚南乔", "阮时安", "任遥", "卓亦然",
];

export const RAW_NPC_DIRECTIONS = ["影视演员", "歌手爱豆", "综艺主持", "商业艺人", "全能新人"];
export const RAW_NPC_PERSONALITIES = ["高冷", "拼命", "话题女王", "学院派", "亲和", "神秘", "锋芒", "佛系"];

// 头衔系统：达标即获得（模组槽 titles 为纯数据：req 中各项阈值全部满足即达成）
/* 头衔条件：键 = fame / reputation / works / awards 等顶层指标，或 "stat:<八维>" / "c:<自定义属性id>" */
export type TitleReq = Partial<Record<"fame" | "reputation" | "works" | "awards", number>> & Record<string, number | undefined>;
export type TitleTier = "青铜" | "白银" | "黄金" | "钻石";
export type TitleDef = { id: string; name: string; tier: TitleTier; req: TitleReq; desc: string };
export type Title = TitleDef & {
  cond: (s: { fame: number; reputation: number; works: number; awards: number; stats?: object; cattrs?: Record<string, number> }) => boolean;
};

export const RAW_TITLES: TitleDef[] = [
  { id: "newface", name: "出道新人", tier: "青铜", req: { fame: 35 }, desc: "名气 ≥ 35" },
  { id: "rising", name: "上升新星", tier: "白银", req: { fame: 150 }, desc: "名气 ≥ 150" },
  { id: "hasworks", name: "有作品傍身", tier: "白银", req: { works: 3 }, desc: "完成作品 ≥ 3" },
  { id: "goodrep", name: "口碑之选", tier: "黄金", req: { reputation: 80 }, desc: "口碑 ≥ 80" },
  { id: "hot", name: "当红艺人", tier: "黄金", req: { fame: 300 }, desc: "名气 ≥ 300" },
  { id: "firstline", name: "一线女星", tier: "钻石", req: { fame: 500, reputation: 70 }, desc: "名气 ≥ 500 且口碑 ≥ 70" },
  { id: "national", name: "国民级女星", tier: "钻石", req: { fame: 750 }, desc: "名气 ≥ 750" },
];
const toTitle = (d: TitleDef): Title => ({
  ...d,
  cond: (s) => Object.entries(d.req ?? {}).every(([k, v]) => v == null || reqValue(s, k) >= v),
});
const titlesOf = memoBy(() => slot<TitleDef[]>("titles", () => RAW_TITLES, () => []), (a) => a.map(toTitle));
export const TITLES: Title[] = liveArray(titlesOf);

/* ═══ 建角池 · 周末活动 · NPC 池 · 账单 —— 全部为模组内容槽（ent 提供原值；未声明 → 通用兜底 / 界面隐藏） ═══ */
export const STYLES: Option[] = liveArray(() => slot<Option[]>("styles", () => RAW_STYLES, () => []));
export const IDENTITIES: Option[] = liveArray(() => slot<Option[]>("identities", () => RAW_IDENTITIES, () => []));
export const BACKGROUNDS: Option[] = liveArray(() => slot<Option[]>("backgrounds", () => RAW_BACKGROUNDS, () => []));
export const DIRECTIONS: Option[] = liveArray(() => slot<Option[]>("directions", () => RAW_DIRECTIONS, () => []));
/* 母校：未声明 → 空串；不再当系统内置选项池，作者要用请走自定义建角字段 */
export const schoolName = (): string => slot<string>("school", () => RAW_SCHOOL, () => "");
/* 父母职业：仅娱乐圈等已写 parentJobs 的模组才有值；空白世界不预置公务员/医生池 */
export const PARENT_JOBS: string[] = liveArray(() => slot<string[]>("parentJobs", () => RAW_PARENT_JOBS, () => []));

/* 建角页文案与叙事池（人物线路卡片 / 引导语 / 身份登记 / 家世叙述 / 阶层） */
export type CreationPath = {
  id: string; name: string; tag: string; blurb: string; open: boolean;
  about: string; fixed: string[]; choose: string[]; perks: string;
  formIntro?: string; // 选了这条路径后的自设页引导语（覆盖 creation.formIntro）；支持占位符
  npcs?: PathNpc[]; // 这条路径的开局固定人际：与固定人物的初始关系 / 好感 / 是否已相识
  fx?: import("./routeFx").RouteFx; // 开局数值（动态 JSON：属性 / 好感 / 声望词条 + 备注），开局按名称遍历赋值
  hero?: string; // 预设主角：固定人物 id。选这条线路时玩家操控 TA（沿用其姓名 / 年龄 / 身份 / 简介 / 关系网）；其余预设角色照常作为 NPC 生活
  room?: string; // 开局地点（地图房间 id，缺省按地图默认起点）
  memory?: string; // 专属前置记忆：写进主角档案，AI 可读
  event?: string; // 开局独有小事件：序章里必须发生的一件小事
  eventId?: string; // 绑定事件库里的固定事件 id：开局序章按该事件演绎（可与 event 同时填写）
  storylineId?: string; // 关联主线 id：建角选线路时按该主线 nodes 顺序生成可视化路线（优先）
  routeNodes?: string[]; // 手写路线节点（未关联主线或主线无节点时兜底）
  perksLabel?: string; // 开局数值小标题（作者自填，留空 = 不显示标题）
  lockTag?: string; // 未解锁时的角标文字（默认「未解锁」）
  /** @deprecated 仅兼容旧草稿展示；新编辑用 lockConds 生成提示 */
  lockHint?: string;
  /** 功能注释：结构化解锁条件（属性/人物/地点/事件依赖）；未选中的不生效 */
  lockConds?: import("../lib/types").FixedCond[];
};
/* 人物线路的开局人际：选这条路径开局时，对指定固定人物直接设定 */
export type PathNpc = {
  id: string; // 固定人物 id
  relation?: string; // 与玩家的关系（如「恩师」「青梅竹马」），写进人物档案，AI 可读
  rel?: number; // 初始好感（0~100，直接设为该值）
  met?: boolean; // 开局即已相识
};
/* 路径弹窗里可对玩家隐藏的内容块 */
export type PathCardPart = "about" | "choose" | "fixed" | "perks" | "npcs" | "soon";
export type CreationOptCat = "identityOpts" | "backgroundOpts" | "klassOpts" | "parentJobs";
export type BuiltinFieldKey = "name" | "gender" | "age" | "birthday" | "identity" | "description" | "klass" | "background" | "fatherJob" | "motherJob" | "extra"
  | "style" | "family" | "direction" | "zodiac"; // 后四项是选项池字段：只支持改名 / 隐藏（隐藏 = 不显示也不结算其开局加成）
export type BuiltinFieldCfg = { label?: string; hidden?: boolean; locked?: boolean; value?: string; options?: string[] };
/** 功能注释：建角字段类型；date 供自定义日期项；textarea/select/number 旧稿仍可读 */
export type CreationFieldType = "text" | "textarea" | "select" | "radio" | "number" | "date";
export type CreationField = {
  id: string; label: string; type: CreationFieldType;
  options?: string[]; init?: string; min?: number; max?: number; placeholder?: string;
  required?: boolean;
  locked?: boolean; // 玩家不可改，固定为 init
  paths?: string[]; bgs?: string[]; // 仅在这些人物线路 / 家庭背景下出现（空=全部）
  optionLinks?: Record<string, { paths?: string[]; bgs?: string[] }>; // 单选/下拉逐选项出现条件
  desc?: string; // 给 AI 的说明
  optFx?: Record<string, OptFx>; // 下拉选项 → 开局效果（选中哪项就结算哪项）
};
/* 建角选项的开局效果：数值增减、写入档案的文本、NPC 初始好感、改开局日期 */
export type OptFx = {
  stats?: Partial<Record<StatKey, number>>; // 八维 / 能力 ±
  metrics?: Partial<Record<"money" | "fame" | "reputation" | "stress" | "looks", number>>; // 资金 / 名气 / 口碑 / 压力 / 容貌 ±（容貌为永久加成）
  attrs?: Record<string, number>; // 自定义属性 ±（含绑定为货币的属性）
  rel?: Record<string, number>; // NPC 对主角的初始好感 ±
  note?: string; // 写进角色档案的一句设定（AI 可读），如「自幼随外婆长大」
  startDate?: string; // 改开局日期「YYYY.MM.DD」（如「穿越到 2008 年」）
};
/* 旧模组兼容：选项没配 fx、但用旧写法填过数值（stats / money / fame / reputation / stress）时，自动转成等价 fx。
   引擎默认选项已不含数值，所以这里只会转换模组作者自己写的数值。looksBonus 转为容貌永久加成。 */
type LegacyFx = { fx?: OptFx; stats?: Partial<Record<StatKey, number>>; money?: number; fame?: number; reputation?: number; stress?: number; looksBonus?: number };
export function optFx(o?: LegacyFx): OptFx | undefined {
  if (!o) return undefined;
  if (o.fx) return o.fx;
  const stats = Object.fromEntries(Object.entries(o.stats ?? {}).filter(([, v]) => typeof v === "number" && v)) as Partial<Record<StatKey, number>>;
  const metrics: NonNullable<OptFx["metrics"]> = {};
  for (const k of ["money", "fame", "reputation", "stress"] as const) if (typeof o[k] === "number" && o[k]) metrics[k] = o[k];
  if (typeof o.looksBonus === "number" && o.looksBonus) metrics.looks = o.looksBonus;
  const fx: OptFx = {};
  if (Object.keys(stats).length) fx.stats = stats;
  if (Object.keys(metrics).length) fx.metrics = metrics;
  return Object.keys(fx).length ? fx : undefined;
}
export type CreationCopy = {
  paths?: CreationPath[]; // 人物线路（career 世界的第一步）；id 对应 identities
  /** @deprecated 开局是否弹窗改由开放路径条数决定（>1 弹窗）；旧稿字段读写忽略 */
  pathPicker?: "modal" | "off";
  /** @deprecated 弹窗固定只展示路径名+开局处境；旧稿字段读写忽略 */
  pathHide?: Partial<Record<PathCardPart, boolean>>;
  /* 文案均支持占位符（见 game/creationText.ts）：{world} {path} {city} {year} {season} {date} {school} {openPaths} {lock} */
  pathTitle?: string; // 「人物线路选择」
  pathIntro?: string; // 路径页引导语
  formTitle?: string; // 自设页标题（缺省「{path} · 自设」，无路径时「{world} · 自设」）
  formIntro?: string; // 自设页引导语（路径可单独覆盖）
  identityLabel?: string; // 「出道身份」
  identityOpts?: string[]; // 身份登记可选值（缺省=自由输入）
  backgroundOpts?: string[]; // 家世叙述
  klassOpts?: string[]; // 出身阶层
  /* —— 选项联动（全部可选；未声明=不过滤） ——
   * pathOpts：按人物线路 id 收窄「身份 / 家世 / 阶层」可选值
   * bgLinks：按家庭背景 id 收窄「出身阶层 / 家世叙述 / 父母职业」可选值 */
  pathOpts?: Record<string, { identityOpts?: string[]; backgroundOpts?: string[]; klassOpts?: string[]; parentJobs?: string[] }>;
  /* 逐个选项的联动（编辑器「建角字段」写这里）：选项 → 仅在这些路径 / 家庭背景下出现 */
  optLinks?: Partial<Record<CreationOptCat, Record<string, { paths?: string[]; bgs?: string[] }>>>;
  builtin?: Partial<Record<BuiltinFieldKey, BuiltinFieldCfg>>; // 内置字段：改名 / 隐藏 / 锁定为固定值
  fields?: CreationField[]; // 创作者自定义建角字段（写入角色档案 extra，AI 可读）
  bgLinks?: Record<string, { klassOpts?: string[]; backgroundOpts?: string[]; parentJobs?: string[] }>;
  fixedAge?: string; // 固定年龄（缺省=可随机）
  parentNote?: string; // 父母职业下方的提示
  cta?: string; // 开局按钮
  seedDescription?: string; // 随机人物描述（占位 {name}）
  startFactions?: StartFaction[]; // 开局可勾选加入的势力（创作者自设）：开局时全部装入存档的阵营，勾选的给初始声望
  factionPickMax?: number; // 最多可勾选几个（缺省 = 不限）
};
export type StartFaction = { id: string; name: string; desc?: string; tags?: string[]; rep?: number /* 加入后的初始声望，缺省 20 */; rooms?: string[] /* 势力范围：控制的地点 id；选上级地点即包含其下所有子地点 */ };
export const RAW_CREATION: CreationCopy = {
  paths: [
    {
      id: "kban",
      name: "科班出道",
      tag: "{school} · 表演系",
      blurb: "",
      open: true,
      about:
        "你是{school}表演系的应届生，基本功过硬、被恩师看好，却也背着「学院派、不够灵、不会来事」的成见入行。这条线更偏影视正剧与演技路线：靠一部部作品与奖项立住脚，比起流量更看重口碑与专业认可。开局家人多半反对你入行——他们盼你安稳，而非抛头露面。",
      fixed: ["人物线路：{path}", "年龄：固定 22 岁", "母校：{school}"],
      choose: ["姓名 / 性别 / 头像", "出生月日 → 星座与专属加成", "父亲职业 / 母亲职业", "家庭背景 / 出身阶层 / 家世叙述", "外形风格 / 职业方向", "签约经纪公司"],
      perks: "演技 +80、才智 +40、口碑 +8、恩师沈曼好感 +10；初始名气 -10（专业底子厚，但还没名气）。",
      npcs: [{ id: "shenman", relation: "电影学院恩师", rel: 25, met: true }],
      formIntro: "{city} · {year} {season}。你毕业于 {school}。一页定型——锁住满意的（{lock}），其余随时重掷。",
    },
    {
      id: "idol",
      name: "爱豆出道",
      tag: "唱跳练习生出身",
      blurb: "",
      open: true,
      about:
        "你曾是选秀或练习生企划里最亮眼的苗子，唱跳功底与舞台表现力过硬，还未正式挂牌就已积累了一批死忠粉。但主流影视圈对爱豆向来挑剔，你需要用实力撕掉「只会唱跳的花瓶」标签。",
      fixed: ["人物线路：{path}", "年龄：固定 22 岁"],
      choose: ["姓名 / 性别 / 头像", "出生月日 → 星座与专属加成", "父亲职业 / 母亲职业", "家庭背景 / 出身阶层 / 家世叙述", "外形风格 / 职业方向", "签约经纪公司"],
      perks: "歌艺 +70、动感 +70、自信 +30、初始名气 +25；初始口碑 -5。",
      npcs: [{ id: "lianghuaiyin", relation: "音乐制作前辈", rel: 20, met: true }],
      formIntro: "{city} · {year} {season}。舞台灯光已为你亮起。一页定型——锁住满意的（{lock}），其余随时重掷。",
    },
    {
      id: "royal",
      name: "皇族出道",
      tag: "名门出身",
      blurb: "",
      open: true,
      about: "含着金汤匙踏入娱乐圈，高定造型与话题度拉满。家人原本盼你走一条体面安稳的道路而非抛头露面；入行后顶级资源触手可及，但「资本硬捧、资源咖」的非议也如影随形，每一步都在放大镜下。",
      fixed: ["人物线路：{path}", "年龄：固定 22 岁"],
      choose: ["姓名 / 性别 / 头像", "出生月日 → 星座与专属加成", "父亲职业 / 母亲职业", "家庭背景 / 出身阶层 / 家世叙述", "外形风格 / 职业方向", "签约经纪公司"],
      perks: "造型容貌 +80、初始名气 +45；初始黑粉 +6、口碑 -10。",
      formIntro: "{city} · {year} {season}。聚光灯与流言一同落在你肩上。一页定型——锁住满意的（{lock}），其余随时重掷。",
    },
    {
      id: "sr",
      name: "素人出道",
      tag: "无背景 · 自主入行",
      blurb: "",
      open: true,
      about: "没有科班文凭、没有圈内人脉，全凭一腔孤勇与此前攒下的积蓄闯进星城。从最底层的通告与试镜摸爬滚打，虽然八维基础薄弱，但手头启动资金充裕、公关回旋余地大，最适合走出草根逆袭之路。",
      fixed: ["人物线路：{path}", "年龄：固定 22 岁"],
      choose: ["姓名 / 性别 / 头像", "出生月日 → 星座与专属加成", "父亲职业 / 母亲职业", "家庭背景 / 出身阶层 / 家世叙述", "外形风格 / 职业方向", "签约经纪公司"],
      perks: "初始资金额外 +20万、公关能力 +30；八维初始各 -15（白纸起步）。",
      formIntro: "{city} · {year} {season}。白手起家的第一天。一页定型——锁住满意的（{lock}），其余随时重掷。",
    },
  ],
  pathTitle: "人物线路选择",
  pathIntro: "", // 缺省不显示引导语。已保存的 pathIntro 仍会显示，编辑器不再提供填写
  formIntro: "{city} · {year} {season}。一页定型——锁住满意的（{lock}），其余随时重掷。",
  identityLabel: "具体身份", // 路线（科班 / 偶像…）之下的细分身份，避免和出道路线重名
  identityOpts: ["练习生", "新人演员", "选秀出身歌手", "模特转型艺人", "音乐剧演员", "网络小生", "综艺新面孔"],
  backgroundOpts: ["单亲家庭长大", "小城书香门第", "梨园世家", "普通工薪家庭", "海外归国", "隐姓埋名的旧贵族"],
  klassOpts: ["草根逆袭", "中产", "殷实之家", "落魄名门"],
  pathOpts: {
    kban: { identityOpts: ["新人演员", "音乐剧演员", "模特转型艺人", "综艺新面孔"] },
    idol: { identityOpts: ["练习生", "选秀出身歌手", "网络小生", "综艺新面孔"] },
    sr: { identityOpts: ["网络小生", "模特转型艺人", "综艺新面孔", "新人演员"] },
    royal: { identityOpts: ["新人演员", "选秀出身歌手", "模特转型艺人"], klassOpts: ["殷实之家", "落魄名门"] },
  },
  bgLinks: {
    normal: { klassOpts: ["草根逆袭", "中产"], backgroundOpts: ["普通工薪家庭", "小城书香门第"],
      parentJobs: ["中学语文教师", "国企中层", "个体服装店主", "基层公务员", "土木工程师", "小城报社记者", "出版社编辑", "农资批发商", "银行信贷经理"] },
    art: { klassOpts: ["中产", "殷实之家", "落魄名门"], backgroundOpts: ["梨园世家", "小城书香门第", "隐姓埋名的旧贵族"],
      parentJobs: ["梨园名角", "大学美术教授", "话剧院导演", "出版社编辑", "中医世家传人", "中学语文教师"] },
    biz: { klassOpts: ["殷实之家", "中产"], backgroundOpts: ["海外归国", "普通工薪家庭"],
      parentJobs: ["上市公司高管", "家族企业掌门", "船运商行东家", "银行信贷经理", "个体服装店主", "农资批发商"] },
    gov: { klassOpts: ["中产", "殷实之家"], backgroundOpts: ["小城书香门第", "普通工薪家庭"],
      parentJobs: ["基层公务员", "国企中层", "退役军官", "三甲医院医生", "中学语文教师", "小城报社记者"] },
    solo: { klassOpts: ["草根逆袭", "中产"], backgroundOpts: ["单亲家庭长大"] },
  },
  fixedAge: "22",
  parentNote: "父母的职业与出身阶层，会决定他们为何不愿你入行——开局剧情将由此展开。",
  cta: "签约 · 开启她的故事",
  seedDescription: "{name}，出道倒计时的这一年，带着一身不肯认输的倔强站上舞台。",
};
const PATH_LOCK_KEY = "star_path_locks_v1";
/* 游戏内编辑器对线路的本地覆盖；hero / room / memory / event 存 "" 表示清空作者设定 */
export type PathLockOverride = { open?: boolean; lockTag?: string; lockHint?: string; lockConds?: import("../lib/types").FixedCond[]; hero?: string; room?: string; memory?: string; event?: string; eventId?: string;
  name?: string; blurb?: string; perksLabel?: string; fx?: import("./routeFx").RouteFx; perks?: string; // 线路管理面板里改写的名称 / 简介 / 开局数值（结构化 JSON；perks 只是由 fx 渲染出的预览）
};
export function loadPathLocks(): Record<string, PathLockOverride> {
  // 线路覆盖 = 编辑器作者设定（全局公共数据，跨存档共享），不属于玩家私有数据
  const v = loadGlobal<Record<string, PathLockOverride> | null>(PATH_LOCK_KEY, null);
  return v && typeof v === "object" ? v : {};
}
export function savePathLock(id: string, patch: PathLockOverride | null) {
  const cur = loadPathLocks();
  if (!patch) delete cur[id];
  else cur[id] = { ...cur[id], ...patch };
  saveGlobal(PATH_LOCK_KEY, cur);
  window.dispatchEvent(new Event("star:path-locks"));
}
export function clearPathLocks() {
  removeGlobal(PATH_LOCK_KEY);
  window.dispatchEvent(new Event("star:path-locks"));
}

export const creationCopy = (): CreationCopy => {
  const base = slot<CreationCopy>("creation", () => RAW_CREATION, () => ({}));
  const locks = loadPathLocks();
  // 功能注释：paths 非数组时 length/map 会炸；收成数组再往下走
  const paths = Array.isArray(base.paths) ? base.paths : [];
  if (!paths.length || !Object.keys(locks).length) return { ...base, ...(paths.length ? { paths } : { paths: undefined }) };
  return {
    ...base,
    paths: paths.map((p) => {
      const ov = locks[p.id];
      if (!ov) return p;
      return {
        ...p,
        open: ov.open !== undefined ? ov.open : p.open,
        lockTag: ov.lockTag !== undefined ? ov.lockTag : p.lockTag,
        lockHint: ov.lockHint !== undefined ? ov.lockHint : p.lockHint,
        ...(ov.lockConds !== undefined ? { lockConds: ov.lockConds } : {}),
        ...(ov.name?.trim() ? { name: ov.name } : {}),
        ...(ov.blurb !== undefined ? { blurb: ov.blurb } : {}),
        ...("fx" in ov ? { fx: ov.fx, perks: ov.perks ?? "" } : {}),
        ...Object.fromEntries((["hero", "room", "memory", "event", "eventId", "perksLabel"] as const).filter((k) => ov[k] !== undefined).map((k) => [k, ov[k] || undefined])),
      };
    }),
  };
};

/* 周末活动：娱乐圈未声明 → 原表；其它作品未声明 / 空数组 → 不出现现代周末项 */
export const WEEKEND_ACTS: WeekendAct[] = liveArray(() => slot<WeekendAct[]>("weekendActs", () => RAW_WEEKEND_ACTS, () => []));

/* 随机 NPC 池（行业名册 / 路人）：未声明 → 通用姓名池 */
export type NpcPool = {
  surnames?: string[]; femaleNames?: string[]; maleNames?: string[]; // 分性别姓名字库（缺省=内置易次元式字库）
  names?: string[]; randomNames?: string[]; directions?: string[]; personalities?: string[]; prefs?: string[] };
export const RAW_NPC_PREFS = ["抢影视资源", "抢音乐舞台", "刷综艺曝光", "冲商业代言", "红毯高奢", "话题营销"];
const GENERIC_NPC_POOL: Required<Omit<NpcPool, "surnames" | "femaleNames" | "maleNames">> = {
  names: ["林晓", "陈默", "周宁", "许然", "苏青", "顾远", "沈禾", "江遥", "叶舟", "唐糖", "宋词", "白露"],
  randomNames: ["林晓", "陈默", "周宁", "许然", "苏青", "顾远"],
  directions: ["新人"],
  personalities: ["高冷", "拼命", "亲和", "神秘", "佛系"],
  prefs: ["埋头苦干", "广结人缘", "爱出风头"],
};
const npcPool = (): Required<Omit<NpcPool, "surnames" | "femaleNames" | "maleNames">> => {
  const p = slot<NpcPool>("npcPool", () => ({ names: RAW_NPC_NAME_POOL, randomNames: RAW_RANDOM_NAMES, directions: RAW_NPC_DIRECTIONS, personalities: RAW_NPC_PERSONALITIES, prefs: RAW_NPC_PREFS }), () => GENERIC_NPC_POOL);
  const f = (k: "names" | "randomNames" | "directions" | "personalities" | "prefs") => (p[k]?.length ? p[k]! : GENERIC_NPC_POOL[k]);
  return { names: f("names"), randomNames: f("randomNames"), directions: f("directions"), personalities: f("personalities"), prefs: f("prefs") };
};
export const NPC_NAME_POOL: string[] = liveArray(() => npcPool().names);
export const RANDOM_NAMES: string[] = liveArray(() => npcPool().randomNames);
export const NPC_DIRECTIONS: string[] = liveArray(() => npcPool().directions);
export const NPC_PERSONALITIES: string[] = liveArray(() => npcPool().personalities);
export const NPC_PREFS: string[] = liveArray(() => npcPool().prefs);

/* 固定账单：每周 weekly，每月末（第 4/8/12…周）追加 monthly。未声明 → 没有固定开销（由「生活开销包」或世界自己提供）
 * tiers（可选）：按名气分档的生活水准——名气达到 minFame 起改付该档账单（取已达到的最高一档），
 * 没达到任何一档时用顶层 weekly / monthly。 */
export type BillLine = { label: string; amount: number };
export type BillTier = { minFame: number; label?: string; weekly?: BillLine[]; monthly?: BillLine[] };
export type BillsSlot = { weekly?: BillLine[]; monthly?: BillLine[]; tiers?: BillTier[] };
export const RAW_BILLS: BillsSlot = {
  weekly: [{ label: "生活起居", amount: 12000 }, { label: "餐饮美食", amount: 6000 }],
  monthly: [{ label: "公寓房租", amount: 35000 }, { label: "形象宣传", amount: 15000 }],
};
/* 生活开销包 · 住行账单：开销随名气水涨船高。无名新人只付普通生活费，越红住得越好、形象投入越大，
 * 到「当红艺人」（名气 300）才是星光级。名气分档与 RAW_FAME_TIERS 对齐。
 * 吃饭不在这里——每周吃什么由玩家在日程板「本周伙食」自己选（见 RAW_MEALS）。 */
export const ENT_BILLS: BillsSlot = {
  weekly: [{ label: "生活起居", amount: 3000 }],
  monthly: [{ label: "公寓房租", amount: 8000 }],
  tiers: [
    { minFame: 50, label: "小有水花", weekly: [{ label: "生活起居", amount: 4000 }], monthly: [{ label: "公寓房租", amount: 12000 }, { label: "形象打理", amount: 3000 }] },
    { minFame: 150, label: "上升艺人", weekly: [{ label: "生活起居", amount: 7000 }], monthly: [{ label: "公寓房租", amount: 20000 }, { label: "形象宣传", amount: 8000 }] },
    { minFame: 300, label: "当红艺人", weekly: [{ label: "生活起居", amount: 12000 }], monthly: RAW_BILLS.monthly },
  ],
};
export const GENERIC_BILLS: BillsSlot = {};
export const billsSlot = (): BillsSlot => slot<BillsSlot>("bills", () => GENERIC_BILLS, () => GENERIC_BILLS);
/** 按当前名气取实际要付的账单（有 tiers 时取已达到的最高一档） */
export function billsFor(fame: number, b: BillsSlot = billsSlot()): { weekly: BillLine[]; monthly: BillLine[]; tier?: string } {
  const t = (b.tiers ?? []).filter((x) => fame >= x.minFame).sort((x, y) => y.minFame - x.minFame)[0];
  return { weekly: t?.weekly ?? b.weekly ?? [], monthly: t?.monthly ?? b.monthly ?? [], tier: t?.label };
}

/* 饮食生活（模组槽 meals；生活开销包提供，未声明 → 没有这项玩法）
 * 玩家每周选一种吃法，选择一直沿用到改为止；周日随账单扣伙食费，并结算对身体 / 造型 / 压力的影响。
 * 钱不够付所选伙食时，当周自动降到付得起的最便宜一档。 */
export type MealPlan = {
  id: string;
  name: string;
  desc?: string;
  cost: number; // 每周伙食费
  stress?: number; // 每周压力变化（负=减压）
  gain?: Partial<Record<StatKey, number>>; // 每周能力变化（内置属性，娱乐圈等内置世界用；可为负）
  cgain?: Record<string, number>; // 每周自定义建角属性变化（键=AttrDef.id；可为负）
  styling?: number; // 每周造型（气色）变化
  reqs?: GradeReq[]; // 解锁门槛（全部满足才可选）
  default?: boolean; // 未选择时默认这一档
};
export const RAW_MEALS: MealPlan[] = [
  { id: "instant", name: "泡面速冻", desc: "能省则省，胃和气色都在抗议", cost: 300, stress: 3, gain: { tineng: -1 }, styling: -1 },
  { id: "home", name: "家常自炊", desc: "买菜做饭，踏实养人", cost: 1500, stress: -1, gain: { tineng: 1 }, default: true },
  { id: "takeout", name: "外卖快餐", desc: "省时省心，就是油盐偏重", cost: 2500, stress: -3, gain: { tineng: -1 } },
  { id: "light", name: "健身轻食", desc: "控卡塑形，上镜更好看，就是嘴馋", cost: 4000, stress: 2, gain: { tineng: 2 }, styling: 2 },
  { id: "dine", name: "下馆子", desc: "约上朋友吃顿好的，心情大好", cost: 6000, stress: -6 },
  { id: "chef", name: "营养师私厨", desc: "专人配餐，体能气色双双在线", cost: 12000, stress: -2, gain: { tineng: 3 }, styling: 3, reqs: [{ metric: "fame", min: 150 }] },
];
/* 孕育参数（模组槽 pregnancy；孕育包提供，全部可选，缺省=引擎默认） */
export type PregnancySlot = {
  gestationDays?: number; // 孕期天数（默认 300 = 怀胎十月）
  baseChance?: number; // 基础受孕率 %（× 生育率/100；默认 25）
  maxChance?: number; // 单次受孕率上限 %（默认 50）
  stressFrom?: number; // 压力超过多少开始降低受孕率（默认 50）
  revealMin?: number; revealMax?: number; // 受孕后第几天察觉（默认 14~30）
  fertilityMin?: number; fertilityMax?: number; // 开局隐藏生育率随机区间（默认 20~80）
  birthStress?: number; // 分娩带来的压力（默认 10）
  childNames?: string[]; // 孩子名字池（不含姓）
};
export const MEALS: MealPlan[] = liveArray(() => slot<MealPlan[]>("meals", () => [], () => []));
/** 当前所选伙食（未选 / 已失效 → 默认档 → 第一档；本世界没有饮食玩法时为 undefined） */
export const mealOf = (id?: string | null): MealPlan | undefined => MEALS.find((m) => m.id === id) ?? MEALS.find((m) => m.default) ?? MEALS[0];
/** 伙食效果文案：体能 +1 · 造型 -1 · 压力 -3 */
/** 功能注释：伙食效果说明；attrLabels 为本世界自定义属性 id→名称（cgain 与写成属性 id 的旧 gain 都按它显示） */
export function mealEffect(m: MealPlan, attrLabels: Record<string, string> = {}): string {
  const sg = (v: number) => `${v > 0 ? "+" : ""}${v}`;
  const parts = Object.entries(m.cgain ?? {}).filter(([, v]) => v).map(([k, v]) => `${attrLabels[k] ?? attrLabelOf(k)} ${sg(v)}`);
  for (const [k, v] of Object.entries(m.gain ?? {})) {
    if (!v) continue;
    parts.push(`${attrLabels[k] ?? attrLabelOf(k)} ${sg(v)}`);
  }
  if (m.styling) parts.push(`造型 ${sg(m.styling)}`);
  if (m.stress) parts.push(`压力 ${sg(m.stress)}`);
  return parts.join(" · ") || "无额外影响";
}
