// 女明星养成模拟器 — 核心数据表（依据策划案 V2）

import { GENERATED_GIGS } from "./gigLibrary";

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

export const STAT_LABELS: Record<StatKey, string> = {
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

export const STATS_BASE: Record<StatKey, number> = {
  yanji: 100,
  geyi: 100,
  koucai: 100,
  yitai: 100,
  donggan: 100,
  tineng: 100,
  caizhi: 100,
  zixin: 100,
};

export const STAT_ORDER: StatKey[] = [
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
  stats?: Partial<Record<StatKey, number>>;
  money?: number; // 万元
  fame?: number;
  reputation?: number;
  stress?: number;
  looksBonus?: number;
};

// 3.2 外形风格
export const STYLES: Option[] = [
  { id: "sweet", name: "清甜灵气", tag: "邻家 · 综艺", desc: "亲和事件成功率 +8%，高冷角色交涉 -5%", looksBonus: 35, stats: {} },
  { id: "gorgeous", name: "明艳大气", tag: "电影 · 高奢", desc: "容貌与仪态突出，早期压力 +2", looksBonus: 55, stats: { yitai: 25 }, stress: 2 },
  { id: "cool", name: "冷感高级", tag: "文艺 · 天王线", desc: "容貌与自信突出，友情初始好感 -3", looksBonus: 45, stats: { zixin: 25 } },
  { id: "sporty", name: "元气运动", tag: "爱豆 · 竞技", desc: "体能动感突出，口碑初始 -2", looksBonus: 0, stats: { tineng: 35, donggan: 25 }, reputation: -2 },
  { id: "gentle", name: "温柔知性", tag: "主持 · 文艺", desc: "才智口才突出，舞曲动作片收益 -5%", looksBonus: 0, stats: { caizhi: 35, koucai: 25 } },
];

// 3.3 出道身份
export const IDENTITIES: Option[] = [
  { id: "kban", name: "科班出道", tag: "沈曼关系 +10", desc: "演技才智口碑高，初始名气 -10", stats: { yanji: 80, caizhi: 40 }, reputation: 8, fame: -10 },
  { id: "idol", name: "爱豆出道", tag: "自带流量", desc: "歌艺动感自信名气高，口碑 -5", stats: { geyi: 70, donggan: 70, zixin: 30 }, fame: 25, reputation: -5 },
  { id: "sr", name: "素人出道", tag: "资金 +20万", desc: "公司公关 +30，八维各 -15", stats: { yanji: -15, geyi: -15, koucai: -15, yitai: -15, donggan: -15, tineng: -15, caizhi: -15, zixin: -15 }, money: 20 },
  { id: "royal", name: "皇族出道", tag: "高定造型", desc: "容貌名气高，黑粉 +6，口碑 -10", looksBonus: 80, fame: 45, reputation: -10 },
];

// 3.4 家庭背景
export const BACKGROUNDS: Option[] = [
  { id: "normal", name: "普通家庭", tag: "草根逆袭", desc: "资金 +5万，压力上限 -5", money: 5 },
  { id: "art", name: "艺术世家", tag: "专业人脉", desc: "演技 +30，专业线事件更多", stats: { yanji: 30 } },
  { id: "biz", name: "商业家庭", tag: "商业价值 +10", desc: "资金 +15万，黑粉关注 +2", money: 15 },
  { id: "gov", name: "公职家庭", tag: "公益顺遂", desc: "口碑 +8，才智 +25", reputation: 8, stats: { caizhi: 25 } },
  { id: "solo", name: "单亲自立", tag: "独立逆袭", desc: "资金 -5万，自信 +35，体能 +20", money: -5, stats: { zixin: 35, tineng: 20 } },
];

// 科班出身固定母校
export const SCHOOL = "京都电影学院";

// 父母职业池（供开局随机 / 手选，影响家世叙事与父母的期望）
export const PARENT_JOBS = [
  "中学语文教师", "国企中层", "个体服装店主", "三甲医院医生", "基层公务员",
  "银行信贷经理", "土木工程师", "梨园名角", "退役军官", "大学美术教授",
  "上市公司高管", "家族企业掌门", "小城报社记者", "话剧院导演", "农资批发商",
  "出版社编辑", "中医世家传人", "船运商行东家",
];

// 星座（由出生月日推算，各有专属加成；money 单位为万，engine 会 ×10000）
export type Zodiac = {
  id: string;
  name: string;
  symbol: string;
  from: [number, number]; // 起始 月,日
  to: [number, number]; // 结束 月,日
  bonus: string; // 加成说明（展示用）
  stats?: Partial<Record<StatKey, number>>;
  looksBonus?: number;
  money?: number;
  fame?: number;
  reputation?: number;
  stress?: number;
};

export const ZODIACS: Zodiac[] = [
  { id: "aries", name: "白羊座", symbol: "♈", from: [3, 21], to: [4, 19], bonus: "体能 +15 · 自信 +10", stats: { tineng: 15, zixin: 10 } },
  { id: "taurus", name: "金牛座", symbol: "♉", from: [4, 20], to: [5, 20], bonus: "仪态 +15 · 口碑 +3", stats: { yitai: 15 }, reputation: 3 },
  { id: "gemini", name: "双子座", symbol: "♊", from: [5, 21], to: [6, 21], bonus: "口才 +20", stats: { koucai: 20 } },
  { id: "cancer", name: "巨蟹座", symbol: "♋", from: [6, 22], to: [7, 22], bonus: "演技 +15 · 压力 -3", stats: { yanji: 15 }, stress: -3 },
  { id: "leo", name: "狮子座", symbol: "♌", from: [7, 23], to: [8, 22], bonus: "名气 +12 · 自信 +8", fame: 12, stats: { zixin: 8 } },
  { id: "virgo", name: "处女座", symbol: "♍", from: [8, 23], to: [9, 22], bonus: "才智 +18", stats: { caizhi: 18 } },
  { id: "libra", name: "天秤座", symbol: "♎", from: [9, 23], to: [10, 23], bonus: "仪态 +12 · 容貌 +20", stats: { yitai: 12 }, looksBonus: 20 },
  { id: "scorpio", name: "天蝎座", symbol: "♏", from: [10, 24], to: [11, 22], bonus: "容貌 +25 · 口碑 -2", looksBonus: 25, reputation: -2 },
  { id: "sagittarius", name: "射手座", symbol: "♐", from: [11, 23], to: [12, 21], bonus: "动感 +15 · 体能 +10", stats: { donggan: 15, tineng: 10 } },
  { id: "capricorn", name: "摩羯座", symbol: "♑", from: [12, 22], to: [1, 19], bonus: "资金 +3万 · 才智 +8", money: 3, stats: { caizhi: 8 } },
  { id: "aquarius", name: "水瓶座", symbol: "♒", from: [1, 20], to: [2, 18], bonus: "才智 +10 · 歌艺 +10", stats: { caizhi: 10, geyi: 10 } },
  { id: "pisces", name: "双鱼座", symbol: "♓", from: [2, 19], to: [3, 20], bonus: "歌艺 +18 · 演技 +5", stats: { geyi: 18, yanji: 5 } },
];

export function zodiacOf(month: number, day: number): Zodiac {
  const val = month * 100 + day;
  for (const z of ZODIACS) {
    const f = z.from[0] * 100 + z.from[1];
    const t = z.to[0] * 100 + z.to[1];
    if (f <= t ? val >= f && val <= t : val >= f || val <= t) return z;
  }
  return ZODIACS[0];
}

// 3.5 初始职业方向
export const DIRECTIONS: Option[] = [
  { id: "actor", name: "影视演员", tag: "导师 · 方知远", desc: "演技 +35，才智 +15", stats: { yanji: 35, caizhi: 15 } },
  { id: "singer", name: "歌手爱豆", tag: "导师 · 梁怀音", desc: "歌艺 +35，动感 +25", stats: { geyi: 35, donggan: 25 } },
  { id: "host", name: "综艺主持", tag: "导师 · 秦砚舟", desc: "口才 +35，自信 +15", stats: { koucai: 35, zixin: 15 } },
  { id: "biz", name: "商业艺人", tag: "导师 · 孟晚乔", desc: "仪态 +35，容貌 +25", stats: { yitai: 35 }, looksBonus: 25 },
  { id: "all", name: "全能新人", tag: "导师 · 林宜", desc: "八维各 +10", stats: { yanji: 10, geyi: 10, koucai: 10, yitai: 10, donggan: 10, tineng: 10, caizhi: 10, zixin: 10 } },
];

// 3.6 初始特质
export const TRAITS: Option[] = [
  { id: "voice", name: "天籁嗓音", tag: "成长", desc: "歌艺 +20，唱片歌艺成长 +15%", stats: { geyi: 20 } },
  { id: "acting", name: "戏感天赋", tag: "成长", desc: "演技 +20，影视稳定率 +5%", stats: { yanji: 20 } },
  { id: "camera", name: "天生镜头脸", tag: "资源", desc: "容貌 +35，广告写真判定 +8%", looksBonus: 35 },
  { id: "steady", name: "稳场体质", tag: "成长", desc: "体能 +25，拍摄失误上限 +1", stats: { tineng: 25 } },
  { id: "lang", name: "语言天赋", tag: "成长", desc: "口才 +20、才智 +10，采访 +15%", stats: { koucai: 20, caizhi: 10 } },
  { id: "lucky", name: "幸运加持", tag: "风险", desc: "正面踩点 +10%，特殊通告 +5%" },
  { id: "topic", name: "话题焦点", tag: "风险", desc: "名气获取 +15%，负面事件 +10%", fame: 5 },
  { id: "res", name: "资源体质", tag: "资源", desc: "初始资金 +8万，初识信任 +8", money: 8 },
  { id: "save", name: "省钱达人", tag: "资源", desc: "训练/造型/宣传成本 -15%" },
  { id: "closet", name: "百搭衣橱", tag: "资源", desc: "造型值 +60，服装冲突惩罚减半" },
];

// 训练项目（2.1 训练数值表，收益为区间随机）
type Range = [number, number];
export type Training = {
  id: string;
  name: string;
  effect: string;
  gain: Partial<Record<StatKey, Range>>;
  cost: number; // 元
  energy: number;
  stress: number;
};

export const TRAININGS: Training[] = [
  { id: "expr", name: "表情训练", effect: "演技 +3~5 · 口才 +1~2", gain: { yanji: [3, 5], koucai: [1, 2] }, cost: 3000, energy: 8, stress: 2 },
  { id: "voice", name: "发声训练", effect: "歌艺 +3~5 · 自信 +1~2", gain: { geyi: [3, 5], zixin: [1, 2] }, cost: 3000, energy: 8, stress: 2 },
  { id: "speech", name: "口条训练", effect: "口才 +2~4 · 才智 +1~2", gain: { koucai: [2, 4], caizhi: [1, 2] }, cost: 2500, energy: 6, stress: 1 },
  { id: "body", name: "形体训练", effect: "仪态 +3~5 · 体能 +1~3", gain: { yitai: [3, 5], tineng: [1, 3] }, cost: 3500, energy: 10, stress: 2 },
  { id: "dance", name: "舞蹈训练", effect: "动感 +3~5 · 体能 +2~4", gain: { donggan: [3, 5], tineng: [2, 4] }, cost: 3500, energy: 12, stress: 3 },
  { id: "read", name: "阅读剧本", effect: "才智 +3~5 · 演技 +1~3", gain: { caizhi: [3, 5], yanji: [1, 3] }, cost: 2000, energy: 5, stress: -1 },
  { id: "lens", name: "镜头训练", effect: "自信 +2~4 · 仪态 +2~4", gain: { zixin: [2, 4], yitai: [2, 4] }, cost: 4000, energy: 7, stress: 1 },
];

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
};

export const WEEKEND_ACTS: WeekendAct[] = [
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

export const LESSON_GRADES: LessonGrade[] = [
  { id: "g1", label: "初级", costMul: 1, gainMul: 1.0, cap: 250, stressAdd: 0 },
  { id: "g2", label: "中级", costMul: 2.4, gainMul: 0.72, cap: 500, stressAdd: 1 },
  { id: "g3", label: "高级", costMul: 5, gainMul: 0.52, cap: 760, stressAdd: 2 },
  { id: "g4", label: "专家级", costMul: 10, gainMul: 0.38, cap: 999, stressAdd: 3 },
];

/* ═══ 打工（分级零工，靠名气变现）═══
 * 级别越高：单次收入越高、压力越大，且要求名气门槛越高才请得动你。 */
export type SideJob = {
  id: string;
  label: string;
  pay: number; // 基础收入（元）
  stress: number;
  fameReq: number; // 名气门槛
  note: string;
};

export const SIDE_JOBS: SideJob[] = [
  { id: "sj1", label: "初级打工", pay: 3000, stress: 4, fameReq: 0, note: "商场派单 · 咖啡馆帮工 · 糊口零工" },
  { id: "sj2", label: "中级打工", pay: 9000, stress: 6, fameReq: 60, note: "店庆站台 · 婚礼助唱 · 小有名气才请得动" },
  { id: "sj3", label: "高级打工", pay: 24000, stress: 8, fameReq: 180, note: "商演跑场 · 品牌快闪 · 名气开始变现" },
  { id: "sj4", label: "专家级打工", pay: 60000, stress: 11, fameReq: 350, note: "私人晚宴助阵 · 高端商务陪场 · 顶流价码" },
];

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
export const GRADE_MUL: Record<DayGrade, number> = {
  perfect: 1.6,
  great: 1.3,
  success: 1.0,
  fail: 0.4,
  bad: 0.0,
};
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
export const FAME_TIERS = [
  { min: 0, label: "无名新人", desc: "一星通告、临时替补、低成本网剧" },
  { min: 50, label: "小有水花", desc: "二星广告、电视剧配角、基础写真" },
  { min: 150, label: "上升艺人", desc: "三星通告、常规综艺候选、品牌合作" },
  { min: 300, label: "当红艺人", desc: "综艺正式邀请、四星主角竞争" },
  { min: 500, label: "一线女星", desc: "五星候选、年度大制作、国际活动" },
  { min: 750, label: "国民级女星", desc: "顶级资源优先、终局大奖、隐藏路线" },
];

export function fameTier(fame: number) {
  return [...FAME_TIERS].reverse().find((t) => fame >= t.min) ?? FAME_TIERS[0];
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
  { id: "apartment", name: "天光公寓", icon: "", func: "排日程 · 休息 · 私密事件", tier: "P0", action: "深度休息：行动力 +40、压力 -12", hint: "顾沉/宋时序短信需已认识" },
  { id: "tianguang", name: "天光小区", icon: "", func: "邻里 · 唠家常 · 遇邻居", tier: "P1", action: "长椅小坐：压力 -8", hint: "江叙白常在楼下中庭出没" },
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
    id: "marriage", label: "婚姻制度", hint: "决定这个世界如何缔结婚姻", def: "mono",
    options: [
      { id: "mono", label: "一夫一妻", desc: "现实通行的单偶婚姻" },
      { id: "poly_wife", label: "一夫多妻", desc: "男性可娶多位配偶" },
      { id: "poly_husband", label: "一妻多夫", desc: "女性可纳多位配偶" },
      { id: "free", label: "自由伴侣", desc: "不以婚姻绑定，伴侣关系自由结合" },
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
};

export const CARS: Car[] = [
  { id: "ev_mini", name: "灵动 mini 电动车", price: 38000, resale: 0.5, comfort: 1, tag: "代步", desc: "小巧灵活的入门电动车，挤地铁的日子总算到头了。" },
  { id: "sedan", name: "家用舒适轿车", price: 128000, resale: 0.58, comfort: 3, tag: "家用", desc: "空间够、油耗低，接送通告体面又踏实。" },
  { id: "suv", name: "都市越野 SUV", price: 265000, resale: 0.6, comfort: 4, tag: "全能", desc: "底盘高、视野好，外地拍摄山路也不怵。" },
  { id: "coupe", name: "轻奢运动轿跑", price: 720000, resale: 0.64, comfort: 6, tag: "轻奢", desc: "流线车身回头率拉满，红毯与街拍都镇得住。" },
  { id: "flagship", name: "旗舰豪华座驾", price: 1680000, resale: 0.68, comfort: 8, tag: "旗舰", desc: "顶级静谧与真皮内饰，一坐进去就知道什么叫顶流待遇。" },
];
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

export const RANDOM_NAMES = [
  "宋砚", "许澄", "季白", "顾宁", "夏予", "沈屿", "江眠", "林屿",
  "云舒", "南枝", "温言", "乔安", "陆星", "黎川", "沈曜", "简宁",
];

// 7. 随机 NPC 生成池
export const NPC_NAME_POOL = [
  "白蔻", "凌汐", "苏念", "唐楚", "叶知秋", "祝清", "关山月", "颜栩",
  "米朵", "秦岚", "何以歌", "郑好", "费霓", "邵允", "柯月", "汤圆",
  "毕星", "简一", "洛薇", "钟离", "沈青梧", "陆则明", "夏承欢", "程见夏",
  "林砚", "顾知微", "温向晚", "江照", "许听澜", "方与之", "薛见山", "邬桑",
  "戚南乔", "阮时安", "任遥", "卓亦然",
];

export const NPC_DIRECTIONS = ["影视演员", "歌手爱豆", "综艺主持", "商业艺人", "全能新人"];
export const NPC_PERSONALITIES = ["高冷", "拼命", "话题女王", "学院派", "亲和", "神秘", "锋芒", "佛系"];

// 头衔系统：达标即获得
export type Title = {
  id: string;
  name: string;
  tier: "青铜" | "白银" | "黄金" | "钻石";
  cond: (s: { fame: number; reputation: number; works: number; awards: number }) => boolean;
  desc: string;
};

export const TITLES: Title[] = [
  { id: "newface", name: "出道新人", tier: "青铜", cond: (s) => s.fame >= 35, desc: "名气 ≥ 35" },
  { id: "rising", name: "上升新星", tier: "白银", cond: (s) => s.fame >= 150, desc: "名气 ≥ 150" },
  { id: "hasworks", name: "有作品傍身", tier: "白银", cond: (s) => s.works >= 3, desc: "完成作品 ≥ 3" },
  { id: "goodrep", name: "口碑之选", tier: "黄金", cond: (s) => s.reputation >= 80, desc: "口碑 ≥ 80" },
  { id: "hot", name: "当红艺人", tier: "黄金", cond: (s) => s.fame >= 300, desc: "名气 ≥ 300" },
  { id: "firstline", name: "一线女星", tier: "钻石", cond: (s) => s.fame >= 500 && s.reputation >= 70, desc: "名气 ≥ 500 且口碑 ≥ 70" },
  { id: "national", name: "国民级女星", tier: "钻石", cond: (s) => s.fame >= 750, desc: "名气 ≥ 750" },
];
