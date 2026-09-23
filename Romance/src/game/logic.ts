import {
  BACKGROUNDS,
  DIRECTIONS,
  GIG_POOL,
  Gig,
  IDENTITIES,
  NPC_DIRECTIONS,
  NPC_NAME_POOL,
  NPC_PERSONALITIES,
  Option,
  PEOPLE,
  STATS_BASE,
  TITLES,
  STAT_LABELS,
  STAT_ORDER,
  STYLES,
  StatKey,
  TRAININGS,
  TRAITS,
  WEEKEND_ACTS,
  ZODIACS,
  LESSON_GRADES,
  SIDE_JOBS,
  GRADE_LABEL,
  GRADE_MUL,
  type DayGrade,
} from "./data";
import { activitiesOfRoom, CALENDAR, itemsOfRoom, NEGOTIATION, RELATIONS, TRAVEL } from "../worlds/star2005/content";
import type { ProjectInstance, WorkPiece } from "./projects";
import type { RelExt } from "./relations";
import type { XianyuListing } from "./xianyu";

export type Character = {
  name: string;
  styleId: string;
  identityId: string;
  backgroundId: string;
  directionId: string;
  traitIds: string[];
  zodiacId?: string; // 星座（由出生月日推算，附带加成）
};

export type GameState = {
  char: Character;
  week: number; // 生涯第几周（恒 = careerWeekOf(day)，随日推进派生同步）
  day: number; // 生涯第几天（0 基，day 0 = calendar.startDate 周一）
  clockMin: number; // 当日时刻（0 基分钟，从内容池 dayStartMinute 起算；移动/活动令其流动）
  daySeg: number; // 保留字段（旧时段模型遗留，恒 0）；日程已改回周一~周日整周制
  stats: Record<StatKey, number>;
  styling: number; // 造型值 → 容貌构成
  fame: number;
  reputation: number; // 口碑 0-100
  stress: number; // 0-100
  blackFans: number;
  pr: number; // 公司公关
  money: number; // 元
  energy: number; // 行动力 0-100
  works: number;
  awards: number;
  activeGigId: string | null;
  gigDaysLeft: number;
  gigMisses: number; // 当前通告累计「拍摄失误」层数（3 层撤换）
  gigStartWeek: number; // 开拍周（签约次周一开机），无通告为 0
  gigDeadlineWeek: number; // 截止周（含）：越过仍未拍完即被撤换，无通告为 0
  activeGigMods: { payMul: number; fameMul: number } | null; // 交涉结果对报酬/名气的修正（低价/降级）
  standby: Record<string, number>; // 候补资格：通告 id → 下次交涉成功率加成
  offersViewedWeek: number; // 本周是否已进入发布场所查看通告（公关 +5，每周一次）
  schedule: (string | null)[]; // 本周 7 天（周一~周日）各安排的一件事：index = day % 7
  offers: string[]; // gig ids on offer
  usedGigs: string[]; // 已接取/拍过的通告 id：结算后记入，之后不再出现在通告库与打听结果中
  rel: Record<string, number>; // 人物关系值（好感主轴）
  relations: Record<string, RelExt>; // 多维私人关系：心情/心动/私人信任 + 冷落衰减
  metPeople: string[]; // 已结识人物
  npcs: NPC[]; // 随机娱乐圈艺人
  companies: Company[]; // 经纪公司生态（开局生成，含声望数值）
  titles: string[]; // 已获得头衔 id
  equippedTitle: string | null; // 当前佩戴展示的头衔 id（可自由更换/摘下）
  safetyNetUsed: boolean; // 新人保底是否已用（只出现一次）
  trust: number; // 负责人信任 0~100
  defaults: number; // 违约记录累计
  bizValue: number; // 商业价值 0~999（品牌/商业线）
  arcStage: Record<string, number>; // 各攻略线已完成段数
  lifeRules?: import("./lifecycle").LifeRules;
  npcLives?: Record<string, { age: number | null; health: number; dead: boolean; lastDay: number; deathDay?: number }>;
  romanceEnabled?: Record<string, boolean>; // 玩家设定的可攻略状态，未设置沿用原规则
  dating: string | null; // 已确认交往对象 id
  room: string; // MUD 当前所在房间（地图位置 id）
  visited: string[]; // 已探索过的房间 id
  discoveredAt: Record<string, number>; // 战争迷雾：房间 id → 首次抵达的生涯天数（登记后地点解锁资料）
  bag: string[]; // 已拾取的地点物品 id
  cars: string[]; // 已购入的车辆 id（在 4S 店购买）
  activeCar: string | null; // 当前选定的座驾 id（在「主角」页选择，出行才可自己开车）
  xianyu: XianyuListing[]; // 「咸鱼」二手集市挂单（在售/已售 + 买家评价）
  mobs: Record<string, string>; // MUD 人物「心跳」实时位置：人物 id → 房间 id
  tick: number; // 世界心跳计数（每次移动 +1，驱动 NPC 走动与环境事件）
  eventsFired: string[]; // 已触发过的一次性条件事件 id（避免重复触发）
  projects: ProjectInstance[]; // 通告/项目全生命周期实例
  portfolio: WorkPiece[]; // 待发行 / 已发行作品库
  knownFacts: Record<string, string[]>; // 制作人对话解锁的项目字段：projectId → 已知字段名
  knownIntel: string[]; // 与人物交谈打听到的情报 id（每人只知与自己相关的）
  lastMeetDay: Record<string, number>; // 各负责人最近正式会面日（当日可继续追问）
  // —— 人设与危机 ——
  persona: string | null; // 已公开的人设标签 id
  brandMatch: number; // 品牌匹配度 / 认知稳定度 0-100
  audience: number; // 目标受众认可 0-100（成功指标）
  controversy: number; // 舆情/争议热度 0-100
  personaStreak: number; // 连续一致的公开内容次数
  personaSwings: number; // 累计人设反转次数
  crisis: CrisisState | null; // 当前进行中的危机
  crisesResolved: number; // 已处理危机数
  starBuzz: StarBuzz[]; // 圈内动态：同行之间每周演化的事件（引擎只存抽象类别+参与者+抽签，文案在内容池）
  lastCheck: WeekCheck | null; // 最近一次周日进账支票
  lastBill: WeekBill | null; // 最近一次账单明细（供「人物」页查看）
  gigDepositPaid: boolean; // 当前通告是否已发放签约定金（避免重复入账）
  checks: GigCheck[]; // 通告签约定金 / 拍毕尾款支票凭证（近期若干张，供「财务」查看）
  breach: BreachEvent | null; // 逾期违约：制片人上门追责的对话事件（未了结前挂起）
  log: string[];
};

/* 同行之间的事件条目：kind 为抽象关系类别（英文键，不含娱乐圈中文），文案模板在内容池按 kind 提供，
 * pick 为一次性抽签（0~999），供内容池 pick % 模板数 稳定选中同一条文案，避免每次渲染漂移。 */
export type StarBuzzKind = "rivalry" | "romance" | "collab" | "breakup" | "rise";
export type StarBuzz = { week: number; kind: StarBuzzKind; aId: string; bId: string | null; pick: number };

export type CrisisState = {
  id: string; // 危机模板 id
  day: number; // 触发时的生涯天
  severity: number; // 严重度 1-3
  evidence: "clear" | "mixed" | "none"; // 是否握有可举证的实锤
};

export type NPC = {
  id: string;
  name: string;
  gender: string;
  dir: string;
  personality: string;
  pref: string; // 竞争偏好
  fame: number;
  stats: Record<StatKey, number>; // 八维属性
  companyId: string; // 所属经纪公司 id（co_N；名字由内容池按序号取）
  debutYear: number; // 出道年份（内容池年代设定内）
  works: number[]; // 代表作：MOVIE_TITLES 序号（引擎不写死中文）
  partnerId: string | null; // 现任伴侣（另一名艺人 id）
  exId: string | null; // 前任（另一名艺人 id）
};

// 经纪公司：引擎只存序号与声望数值，公司名号/简介来自内容池 industry.yaml
export type Company = { id: string; prestige: number };

const rng = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

const NPC_PREFS = ["抢影视资源", "抢音乐舞台", "刷综艺曝光", "冲商业代言", "红毯高奢", "话题营销"];

// 生成 5~8 家公司 + 至少 count 名艺人，每家至少 minPerCompany 人；公司声望在基线上下浮动
function generateIndustry(count = 30, minPerCompany = 4): { companies: Company[]; npcs: NPC[] } {
  const companyCount = rng(5, 8);
  const companies: Company[] = Array.from({ length: companyCount }, (_, i) => ({
    id: `co_${i}`,
    prestige: clamp(rng(30, 88) - i * 3, 15, 95),
  }));
  const total = Math.max(count, companyCount * minPerCompany);
  const names = [...NPC_NAME_POOL].sort(() => Math.random() - 0.5);
  // 先按最小配额铺满每家公司，其余随机分配
  const assign: string[] = [];
  for (const c of companies) for (let k = 0; k < minPerCompany; k++) assign.push(c.id);
  for (let k = assign.length; k < total; k++) assign.push(companies[rng(0, companyCount - 1)].id);
  assign.sort(() => Math.random() - 0.5);

  const MOVIE_COUNT = 24; // 代表作序号上界（与内容池 movies 长度对齐；越界 UI 会取模兜底）
  const npcs: NPC[] = Array.from({ length: total }, (_, i) => {
    const stats = {} as Record<StatKey, number>;
    for (const k of STAT_ORDER) stats[k] = rng(80, 520);
    const co = companies.find((c) => c.id === assign[i])!;
    const debutYear = 2005 - rng(0, 8);
    const workN = rng(1, 3);
    const works = Array.from({ length: workN }, () => rng(0, MOVIE_COUNT - 1));
    return {
      id: `npc_${i}`,
      name: names[i % names.length] + (i >= names.length ? `·${Math.floor(i / names.length) + 1}` : ""),
      gender: Math.random() < 0.7 ? "女" : "男",
      dir: NPC_DIRECTIONS[rng(0, NPC_DIRECTIONS.length - 1)],
      personality: NPC_PERSONALITIES[rng(0, NPC_PERSONALITIES.length - 1)],
      pref: NPC_PREFS[rng(0, NPC_PREFS.length - 1)],
      // 声望越高的公司，艺人起点名气越高
      fame: clamp(rng(20, 180) + Math.round(co.prestige * 0.8), 10, 320),
      stats,
      companyId: co.id,
      debutYear,
      works,
      partnerId: null,
      exId: null,
    };
  });

  // 圈内情感网络：约四成艺人有现任/前任（异性优先，双向可查）
  const pool = [...npcs].sort(() => Math.random() - 0.5);
  const taken = new Set<string>();
  for (const a of pool) {
    if (taken.has(a.id)) continue;
    if (Math.random() > 0.42) continue;
    const b = pool.find((x) => x.id !== a.id && !taken.has(x.id) && x.gender !== a.gender && !a.partnerId);
    if (!b) continue;
    a.partnerId = b.id; b.partnerId = a.id;
    taken.add(a.id); taken.add(b.id);
    // 其中一部分再补一段过去
    const ex = pool.find((x) => x.id !== a.id && x.id !== b.id && x.gender !== a.gender && !taken.has(x.id));
    if (ex && Math.random() < 0.5) { a.exId = ex.id; }
  }
  return { companies, npcs };
}

export type RankRow = { name: string; fame: number; isPlayer: boolean; tag: string };

export function leaderboard(s: GameState): RankRow[] {
  const rows: RankRow[] = s.npcs.map((n) => ({ name: n.name, fame: n.fame, isPlayer: false, tag: `${n.dir} · ${n.personality}` }));
  rows.push({ name: s.char.name, fame: s.fame, isPlayer: true, tag: "★ 你" });
  return rows.sort((a, b) => b.fame - a.fame);
}

// 娱乐圈榜单：票房 / 代言。引擎只给序号与数值，戏名/品牌名由内容池按 titleIndex 取。
// 每周由名气最高的一批艺人「主演」当红剧目、代言当红品牌；数值确定性派生自名气与周次。
export type BoardEntry = { titleIndex: number; starId: string; starName: string; value: number; companyId: string };

export function industryBoards(s: GameState, movieSlots = 6, adSlots = 5): { movies: BoardEntry[]; ads: BoardEntry[] } {
  const ranked = [...s.npcs].sort((a, b) => b.fame - a.fame);
  const wobble = (seed: number) => ((Math.sin(seed * 12.9898 + s.week * 78.233) * 43758.5453) % 1 + 1) % 1;
  const movies: BoardEntry[] = ranked.slice(0, movieSlots).map((n, i) => ({
    titleIndex: (i + s.week) % 32, // UI 按剧目池长度取模
    starId: n.id,
    starName: n.name,
    // 票房（万元）：名气驱动 + 周次抖动
    value: Math.round((n.fame * 6 + 800) * (0.7 + wobble(i + 1) * 0.9)),
    companyId: n.companyId,
  }));
  const adPool = ranked.filter((n) => n.pref === "冲商业代言" || n.pref === "红毯高奢");
  const adRanked = (adPool.length >= adSlots ? adPool : ranked).slice(0, adSlots);
  const ads: BoardEntry[] = adRanked.map((n, i) => ({
    titleIndex: (i + s.week * 2) % 32,
    starId: n.id,
    starName: n.name,
    // 代言身价（万元/年）
    value: Math.round((n.fame * 2 + 120) * (0.8 + wobble(i + 9) * 0.6)),
    companyId: n.companyId,
  }));
  return { movies, ads };
}

function findOpt(list: Option[], id: string) {
  return list.find((o) => o.id === id);
}

export function computeLooks(s: { stats: Record<StatKey, number>; styling: number; stress: number }) {
  const raw = s.stats.yitai * 0.55 + s.stats.zixin * 0.25 + s.styling * 0.2;
  const penalty = s.stress >= 75 ? 0.9 : 1;
  return Math.round(Math.min(999, raw * penalty));
}

export function looksTier(v: number) {
  if (v >= 700) return "顶级神颜";
  if (v >= 500) return "高端脸孔";
  if (v >= 300) return "镜头上镜";
  return "新人清秀";
}

/* 容貌（NPC）：由已知八维中的仪态/自信派生一条统一的容貌数值，供人物档案展示。
 * 与主角 computeLooks 同源思路（无造型/压力项，纯能力派生），引擎只算数，档次文案在 looksTier。 */
export function npcLooksFromStats(stats: Partial<Record<StatKey, number>>): number {
  const yitai = stats.yitai ?? 0;
  const zixin = stats.zixin ?? 0;
  const geyi = stats.geyi ?? 0;
  return Math.round(Math.min(999, yitai * 0.55 + zixin * 0.3 + geyi * 0.15));
}

/* 心境：由压力/行动力/舆情派生的当前情绪档位（英文键，中文标签在内容池/data 层）。
 * radiant 神采飞扬 · steady 心平气和 · strained 心绪不宁 · frayed 濒临崩溃 */
export type MoodTier = "radiant" | "steady" | "strained" | "frayed";
export function moodTier(s: { stress: number; energy?: number; controversy?: number }): MoodTier {
  const c = s.controversy ?? 0;
  if (s.stress >= 85) return "frayed";
  if (s.stress >= 60 || c >= 60) return "strained";
  if (s.stress <= 30) return "radiant";
  return "steady";
}

export function createGame(char: Character): GameState {
  const stats: Record<StatKey, number> = { ...STATS_BASE };
  let styling = 40;
  let fame = 15;
  let reputation = 35;
  let stress = 20;
  let money = 5000; // 科班出身开局：初始资金固定 5000 元（不随出身/星座浮动）
  const pr = 100;
  const blackFans = 1;

  const opts = [
    findOpt(STYLES, char.styleId),
    findOpt(IDENTITIES, char.identityId),
    findOpt(BACKGROUNDS, char.backgroundId),
    findOpt(DIRECTIONS, char.directionId),
    ...char.traitIds.map((t) => findOpt(TRAITS, t)),
    char.zodiacId ? ZODIACS.find((z) => z.id === char.zodiacId) : undefined,
  ];

  for (const o of opts) {
    if (!o) continue;
    if (o.stats) for (const k of STAT_ORDER) if (o.stats[k]) stats[k] += o.stats[k]!;
    if (o.looksBonus) styling += o.looksBonus;
    // 初始资金固定 5000，出身/星座的资金加成不再计入开局现金
    if (o.fame) fame += o.fame;
    if (o.reputation) reputation += o.reputation;
    if (o.stress) stress += o.stress;
  }

  for (const k of STAT_ORDER) stats[k] = Math.max(0, Math.min(999, stats[k]));

  return {
    char,
    week: 1,
    day: 0,
    clockMin: 8 * 60,
    daySeg: 0,
    stats,
    styling: Math.min(999, styling),
    fame: Math.max(0, fame),
    reputation: Math.max(0, Math.min(100, reputation)),
    stress: Math.max(0, Math.min(100, stress)),
    blackFans,
    pr,
    money,
    energy: 100,
    works: 0,
    awards: 0,
    activeGigId: null,
    gigDaysLeft: 0,
    gigMisses: 0,
    gigStartWeek: 0,
    gigDeadlineWeek: 0,
    activeGigMods: null,
    standby: {},
    offersViewedWeek: 0,
    schedule: [null, null, null, null, null, null, null],
    offers: [],
    usedGigs: [],
    rel: Object.fromEntries(PEOPLE.map((p) => [p.id, p.init])),
    relations: Object.fromEntries(PEOPLE.map((p) => [p.id, { mood: RELATIONS.mood.init, romantic: 0, trust: RELATIONS.trust.init, lastContactDay: 0 }])),
    // 开局只认识自己的经纪人林宜；其余人的 init 只是潜在好感底子，得真正碰面结识后才进人脉
    metPeople: ["linyi"],
    ...(() => { const g = generateIndustry(30, 4); return { npcs: g.npcs, companies: g.companies }; })(),
    titles: [],
    equippedTitle: null,
    safetyNetUsed: false,
    trust: 10,
    defaults: 0,
    bizValue: 40,
    arcStage: {},
    dating: null,
    room: "apartment",
    visited: ["apartment"],
    discoveredAt: { apartment: 0 },
    bag: [],
    cars: [],
    activeCar: null,
    xianyu: [],
    mobs: {},
    tick: 0,
    eventsFired: [],
    projects: [],
    portfolio: [],
    knownFacts: {},
    knownIntel: [],
    lastMeetDay: {},
    persona: null,
    brandMatch: 0,
    audience: 20,
    controversy: 0,
    personaStreak: 0,
    personaSwings: 0,
    crisis: null,
    crisesResolved: 0,
    starBuzz: [],
    lastCheck: null,
    lastBill: null,
    gigDepositPaid: false,
    checks: [],
    breach: null,
    log: ["第 1 周 · 你搬进了天光公寓，出道倒计时 104 周正式开始。"],
  };
}

// 通告要求的能力项（按声明顺序；第一项即参与接取公式的能力）
export function reqStats(g: Gig): { key: StatKey; need: number }[] {
  return (Object.keys(g.statReq) as StatKey[])
    .filter((k) => g.statReq[k])
    .map((k) => ({ key: k, need: g.statReq[k]! }));
}

// 11.1 接取条件（广告/电视剧看名气+第一项能力；唱片/电影只看实际能力，均为严格大于）
export function gigEligible(g: Gig, s: GameState) {
  if (s.fame <= g.fameReq) return false; // 名气必须严格大于要求，等于不能接
  const reqs = reqStats(g);
  if (!reqs.length) return true;
  if (judgeUsesFame(g)) {
    // 名气 + 第一项能力 > 两项能力要求之和 × 80%
    const sum = reqs.reduce((a, r) => a + r.need, 0);
    return s.fame + s.stats[reqs[0].key] > sum * 0.8;
  }
  // 唱片/电影：每项参与判定的实际能力都要 > 要求 × 80%（严格）
  return reqs.every((r) => s.stats[r.key] > r.need * 0.8);
}

// 高风险履约：任一能力 ≤ 要求值 50%
export function isHighRisk(g: Gig, s: GameState): boolean {
  return reqStats(g).some((r) => s.stats[r.key] <= r.need * 0.5);
}

// 11.5 通告类别：广告/电视剧 名气参与判定；唱片/电影 只看实际能力
export type GigCat = "ad" | "tv" | "record" | "film" | "variety";
export function gigCategory(g: Gig): GigCat {
  const t = g.type;
  if (/电影/.test(t)) return "film";
  if (/唱片|音乐|单曲|专辑|演唱会/.test(t)) return "record";
  if (/电视剧|剧/.test(t)) return "tv";
  if (/综艺|采访|直播/.test(t)) return "variety";
  return "ad";
}
// 唱片、电影只看实际能力，不把名气计入能力判定
export function judgeUsesFame(g: Gig): boolean {
  const c = gigCategory(g);
  return c !== "record" && c !== "film";
}
// 11.5 发布时间：广告/电视剧 奇数周周一发布；唱片/电影 偶数周周一发布；综艺常驻
function catPublishesOn(cat: GigCat, week: number): boolean {
  const odd = week % 2 === 1;
  if (cat === "ad" || cat === "tv") return odd;
  if (cat === "record" || cat === "film") return !odd;
  return true; // 综艺常驻
}

// 找对应制作人/制片人「打听」到的通告：按其掌管的类别 + 本周发布节奏 + 名气门槛筛选
export function offersFrom(s: GameState, cats: GigCat[], maxStar?: number): string[] {
  const used = new Set(s.usedGigs ?? []);
  return GIG_POOL.filter(
    (g) =>
      !used.has(g.id) &&
      g.id !== s.activeGigId &&
      cats.includes(gigCategory(g)) &&
      catPublishesOn(gigCategory(g), s.week) &&
      g.fameReq <= s.fame + 120 &&
      (maxStar === undefined || g.star <= maxStar),
  )
    // 大库随机取样：按名气门槛就近，避免每次都是同几条
    .sort((a, b) => Math.abs(a.fameReq - s.fame) - Math.abs(b.fameReq - s.fame))
    .slice(0, 8)
    .map((g) => g.id);
}

export function refreshOffers(fame: number, week = 1): string[] {
  // 按类别发布节奏刷新：本周只展示“本周发布 + 常驻”的通告，制造档期取舍
  const pool = GIG_POOL.filter(
    (g) => g.fameReq <= fame + 120 && catPublishesOn(gigCategory(g), week),
  );
  return pool.slice(0, 5).map((g) => g.id);
}

const rand = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// 9. 资源负责人：通告类型 → 负责人与地点
export function gigManager(g: Gig): { name: string; loc: string } {
  const t = g.type;
  if (/广告|品牌|代言/.test(t)) return { name: "孟晚乔", loc: "璀璨广告中心" };
  if (/电影/.test(t)) return { name: "许砚清", loc: "浮光影视基地" };
  if (/电视剧|剧/.test(t)) return { name: "方知远", loc: "浮光影视基地" };
  if (/综艺|采访|直播/.test(t)) return { name: "秦砚舟", loc: "云台传媒城" };
  if (/唱片|音乐|舞台|单曲|演唱会/.test(t)) return { name: "梁怀音", loc: "迭音音乐工坊" };
  return { name: "林宜", loc: "启星事务所" };
}

// 9.1 通告交涉成功率（先找负责人再交涉；违约/压力降低，好感/名气/口碑/头衔提高）
export function negotiateRate(g: Gig, s: GameState): number {
  let margin = 0;
  for (const k of STAT_ORDER) { const need = g.statReq[k]; if (need) margin += s.stats[k] - need; }
  // 唱片、电影只看实际能力，不把名气计入判定
  const fameMod = judgeUsesFame(g) ? Math.floor(Math.max(0, s.fame - g.fameReq) / 40) * 3 : 0;
  const repMod = g.star >= 4 ? Math.floor(s.reputation / 10) * 2 : Math.floor(s.reputation / 15); // 高级通告更看口碑
  const trustMod = Math.floor(s.trust / 20) * 3; // 负责人好感
  const stressMod = Math.floor(s.stress / 10) * 2;
  const breachMod = s.defaults * (/广告|品牌|电影/.test(g.type) ? 14 : 8); // 违约对广告/品牌/高级影视影响更大
  const titleMod = Math.min(6, s.titles.length * 2); // 拥有头衔提升该类型通告成功率
  const standbyMod = s.standby?.[g.id] ?? 0; // 候补资格：上次交涉留下的加成
  const rate = 55 + margin * 0.12 + fameMod + repMod + trustMod + titleMod + standbyMod - stressMod - breachMod;
  return clamp(Math.round(rate), 15, 96);
}

// 9.1 与负责人交涉：成功锁定档期，失败损失体力/压力/好感，先到先得可能被 NPC 抢走
export function negotiateGig(s: GameState, gigId: string): { next: GameState; ok: boolean; msg: string } {
  const g = GIG_POOL.find((x) => x.id === gigId);
  if (!g) return { next: s, ok: false, msg: "" };
  if (s.activeGigId) return { next: s, ok: false, msg: "你已有通告在身，档期冲突。" };
  if (!gigEligible(g, s)) return { next: s, ok: false, msg: "硬性门槛未达标，负责人不会与你交涉。" };
  const mgr = gigManager(g);
  const N = NEGOTIATION;
  const rate = negotiateRate(g, s);
  const roll = Math.random() * 100;
  const n: GameState = { ...s, offers: [...s.offers], standby: { ...(s.standby ?? {}) } };

  const finish = (ok: boolean, msg: string) => {
    n.log = [...s.log, `【第 ${s.week} 周 · 交涉】${msg}`];
    if (n.log.length > 40) n.log = n.log.slice(-40);
    return { next: n, ok, msg };
  };

  // —— 接取（roll 在成功率内）：再按余量分「正式 / 低价 / 降级」——
  if (roll <= rate) {
    let margin = 0;
    for (const k of STAT_ORDER) { const need = g.statReq[k]; if (need) margin += s.stats[k] - need; }
    let key: string;
    if (roll <= rate - N.formalMargin) key = "formal"; // 大幅富余：正式过
    else if (margin >= 0) key = "lowprice"; // 险过但能力够：压价出演
    else key = "downgrade"; // 险过且能力不足：戏份/角色降级
    const o = N.outcomes[key];
    n.activeGigId = g.id;
    n.gigDaysLeft = g.days;
    n.gigMisses = 0;
    // 档期：普通通告签约后次周一开机；重点通告有固定开机周（档期锁死）
    const start = g.fixedWeek && g.fixedWeek > s.week ? g.fixedWeek : s.week + 1;
    const window = Math.max(2, Math.ceil(g.days / 2) + 1);
    n.gigStartWeek = start;
    n.gigDeadlineWeek = start + window - 1;
    n.gigDepositPaid = false; // 定金将于开机前的周日结算发放
    n.activeGigMods = { payMul: o.payMul, fameMul: o.fameMul };
    n.trust = clamp(n.trust + 2, 0, 100);
    delete n.standby[g.id]; // 兑现候补资格
    const extra = key === "formal" ? "" : `（${o.note}：报酬×${o.payMul}${o.fameMul < 1 ? `、名气×${o.fameMul}` : ""}）`;
    return finish(true, `与${mgr.name}交涉：${o.label}，拿下《${g.name}》（成功率 ${rate}%）。第 ${start} 周一开机，须在第 ${n.gigDeadlineWeek} 周前拍完 ${g.days} 天。回日程安排「拍摄」。${extra}`);
  }

  // —— 未接取 ——
  n.stress = clamp(n.stress + 5, 0, 100);

  // 差之毫厘：给候补资格或让你等通知（留住机会，不失通告）
  if (roll <= rate + N.waitMargin) {
    if (n.trust >= N.standbyTrust) {
      const o = N.outcomes.standby;
      n.standby[g.id] = (n.standby[g.id] ?? 0) + N.standbyBonus;
      return finish(false, `${mgr.name}：${o.label}——${o.note}（下次交涉成功率 +${N.standbyBonus}%）。体力 -6、压力 +5。`);
    }
    const o = N.outcomes.wait;
    return finish(false, `⏳ ${mgr.name}：${o.label}——${o.note}。体力 -6、压力 +5。`);
  }

  // 谈崩：好感受损，通告可能被同期艺人抢走
  n.trust = clamp(n.trust - 3, 0, 100);
  const o = N.outcomes.reject;
  let msg = `${mgr.name}：${o.label}（成功率 ${rate}%）——体力 -6、压力 +5、负责人好感 -3。`;
  if (Math.random() < N.snatchChance) { n.offers = n.offers.filter((x) => x !== g.id); msg += " 该通告被同期艺人抢走了。"; }
  return finish(false, msg);
}

// 通告支票凭证：签约定金（开机前）与拍毕尾款（杀青入账）两种，均生成仿旧支票 HTML。
export type GigCheck = {
  kind: "deposit" | "final";
  amount: number;
  gigName: string;
  week: number; // 出票所属周
  serial: string;
  memo: string;
  drawer: string; // 出票单位（对应制片人/剧组）
};

// 逾期违约事件：越过截止周仍未拍完，责任制片人/制作人上门追责，玩家可回话但须赔付违约金。
export type BreachEvent = {
  gigName: string;
  producer: string; // 负责人姓名
  loc: string; // 其所属公司/基地
  gigType: string;
  fee: number; // 违约金（了结时扣除）
};

// 支票凭证入列：新的排在最前，仅保留近 6 张，避免无限增长。
function pushCheck(list: GigCheck[], c: GigCheck): GigCheck[] {
  return [c, ...(list ?? [])].slice(0, 6);
}

export type WeekCheck = { amount: number };
export type WeekBill = { lines: { label: string; amount: number }[]; total: number; monthEnd: boolean; week: number };
export type WeekResult = { next: GameState; ended: null | "bankrupt" | "finish"; headline: string; check?: WeekCheck; bill?: WeekBill };

/* ═══ 日程活动编码（schedule 槽位存字符串）═══
 * 拍摄        → "gig"
 * 休息        → "rest"
 * 外出/社交   → WEEKEND_ACTS 的 id（freeroam / party / recuperate / meetup）
 * 才艺课程    → "train:<课程id>:<等级id>"（如 train:expr:g2）
 * 打工        → "work:<零工id>"（如 work:sj2）
 * 兼容旧存档   → 裸课程 id（如 "expr"）按初级课程处理 */
export function parseAct(act: string | null): { kind: "gig" | "rest" | "weekend" | "train" | "work" | "none"; trainId?: string; gradeId?: string; jobId?: string; weekendId?: string } {
  if (!act) return { kind: "none" };
  if (act === "gig") return { kind: "gig" };
  if (act === "rest") return { kind: "rest" };
  if (act.startsWith("train:")) { const [, trainId, gradeId] = act.split(":"); return { kind: "train", trainId, gradeId }; }
  if (act.startsWith("work:")) { const [, jobId] = act.split(":"); return { kind: "work", jobId }; }
  if (WEEKEND_ACTS.some((x) => x.id === act)) return { kind: "weekend", weekendId: act };
  if (TRAININGS.some((x) => x.id === act)) return { kind: "train", trainId: act, gradeId: "g1" }; // 旧档裸课程 → 初级
  return { kind: "none" };
}

/* 推进结果档位掷骰：受自信（利好）与压力（不利）牵引。 */
export function rollGrade(s: GameState): DayGrade {
  let r = Math.random() * 100 - (s.stats.zixin / 40 - s.stress / 3);
  if (r < 8) return "perfect";
  if (r < 30) return "great";
  if (r < 78) return "success";
  if (r < 93) return "fail";
  return "bad";
}

export type ActResult = { grade: DayGrade | null; actLabel: string; gains: string[] };

// 单件日程活动的即时结算：推进「一天」时对当天安排的一件事应用效果，并掷出完美/大成功/成功/失败/糟糕。
// 休息/外出社交为确定性效果（不掷档位，grade=null）；训练/打工/拍摄按掷出的档位调整收益。
export function applyAct(n: GameState, act: string | null, deltas: string[]): ActResult {
  const traits = n.char.traitIds;
  const thrift = traits.includes("save") ? 0.85 : 1;
  const p = parseAct(act);

  if (p.kind === "rest") {
    n.stress = clamp(n.stress - 8, 0, 100);
    return { grade: null, actLabel: "休息", gains: ["压力 -8"] };
  }

  if (p.kind === "weekend") {
    const w = WEEKEND_ACTS.find((x) => x.id === p.weekendId)!;
    n.money -= Math.round(w.cost * thrift);
    n.stress = clamp(n.stress + w.stress, 0, 100);
    if (w.trust) n.trust = clamp(n.trust + w.trust, 0, 100);
    if (w.fame) n.fame += w.fame;
    if (w.reputation) n.reputation = clamp(n.reputation + w.reputation, 0, 100);
    return { grade: null, actLabel: w.name, gains: [w.effect] };
  }

  if (p.kind === "gig") {
    if (!n.activeGigId || n.gigDaysLeft <= 0 || n.gigMisses >= 3) return { grade: null, actLabel: "拍摄通告", gains: ["今日无可拍摄的通告"] };
    // 未到开机周（重点通告档期锁死）：不能提前开拍
    if (n.gigStartWeek > 0 && n.week < n.gigStartWeek) {
      return { grade: null, actLabel: "拍摄通告", gains: [`该通告第 ${n.gigStartWeek} 周才开机，尚未进组`] };
    }
    const g = GIG_POOL.find((x) => x.id === n.activeGigId)!;
    n.stress = clamp(n.stress + rand(2, 6), 0, 100);
    n.gigDaysLeft -= 1;
    const grade = rollGrade(n);
    const dayNo = g.days - n.gigDaysLeft;
    if (grade === "fail" || grade === "bad") {
      n.gigMisses += 1;
      n.stress = clamp(n.stress + (grade === "bad" ? 4 : 2), 0, 100);
      if (n.gigMisses >= 3) deltas.push(`《${g.name}》拍摄累计 3 次失误（第 ${dayNo} 天），剧组决定撤换角色……`);
      else deltas.push(`《${g.name}》第 ${dayNo} 天拍摄失误（${n.gigMisses}/3）`);
      return { grade, actLabel: `拍摄《${g.name}》`, gains: [`第 ${dayNo} 天 · NG 不断`] };
    }
    deltas.push(`《${g.name}》第 ${dayNo} 天顺利杀青一场（剩 ${n.gigDaysLeft} 天）`);
    return { grade, actLabel: `拍摄《${g.name}》`, gains: [`第 ${dayNo} 天 · 进度推进`] };
  }

  if (p.kind === "work") {
    const j = SIDE_JOBS.find((x) => x.id === p.jobId);
    if (!j) return { grade: null, actLabel: "打工", gains: [] };
    const grade = rollGrade(n);
    const pay = Math.max(0, Math.round(j.pay * GRADE_MUL[grade]));
    n.money += pay;
    n.stress = clamp(n.stress + j.stress + (grade === "fail" || grade === "bad" ? 3 : 0), 0, 100);
    const gains = pay > 0 ? [`进账 ¥${pay}`] : ["白忙一场，没挣到钱"];
    return { grade, actLabel: j.label, gains };
  }

  if (p.kind === "train") {
    const t = TRAININGS.find((x) => x.id === p.trainId);
    const gr = LESSON_GRADES.find((x) => x.id === p.gradeId) ?? LESSON_GRADES[0];
    if (!t) return { grade: null, actLabel: "才艺课程", gains: [] };
    n.money -= Math.round(t.cost * gr.costMul * thrift);
    const grade = rollGrade(n);
    n.stress = clamp(n.stress + t.stress + gr.stressAdd, 0, 100);
    const mul = GRADE_MUL[grade];
    const gains: string[] = [];
    if (mul <= 0) {
      return { grade, actLabel: `${t.name}·${gr.label}`, gains: ["状态糟糕，这堂课几乎没学进去"] };
    }
    for (const k of STAT_ORDER) {
      const r = t.gain[k];
      if (!r) continue;
      const cur = n.stats[k];
      // 越接近该级课程上限收益越低，越过上限几乎无收益（须升更高级课程）
      const factor = cur >= gr.cap ? 0.12 : clamp(0.4 + 0.6 * (gr.cap - cur) / gr.cap, 0.12, 1);
      const gain = Math.round(rand(r[0], r[1]) * gr.gainMul * mul * factor);
      if (gain > 0) { n.stats[k] = clamp(cur + gain, 0, 999); gains.push(`${STAT_LABELS[k]} +${gain}`); }
      else gains.push(`${STAT_LABELS[k]} 已近${gr.label}瓶颈`);
    }
    return { grade, actLabel: `${t.name}·${gr.label}`, gains };
  }

  return { grade: null, actLabel: "无安排", gains: [] };
}

// 周结算：跨过周日翻页时触发的经济/通告/生态结算（日程活动已在各时段逐段落地，这里不再重排日程）。
export function settleWeek(s: GameState): WeekResult {
  const n: GameState = {
    ...s,
    stats: { ...s.stats },
    npcs: s.npcs.map((x) => ({ ...x, stats: { ...x.stats } })),
    titles: [...s.titles],
    log: [...s.log],
  };
  const deltas: string[] = [];
  const traits = s.char.traitIds;
  let earned = 0; // 本周演艺进账（gig 报酬合计，用于周日支票）

  // 周日：为下周一开机、尚未支付定金的通告发放签约定金支票（片酬 30%）
  if (n.activeGigId && !n.gigDepositPaid && n.gigStartWeek === n.week + 1) {
    const dg = GIG_POOL.find((x) => x.id === n.activeGigId);
    if (dg) {
      const mgr = gigManager(dg);
      const deposit = Math.round(dg.pay * 0.3 * (n.activeGigMods?.payMul ?? 1));
      n.money += deposit;
      n.gigDepositPaid = true;
      n.checks = pushCheck(n.checks, {
        kind: "deposit",
        amount: deposit,
        gigName: dg.name,
        week: n.week + 1,
        serial: `DJ${String(2005000 + n.week * 13 + dg.name.length).slice(-7)}`,
        memo: `《${dg.name}》签约定金（30%）`,
        drawer: mgr.loc,
      });
      deltas.push(`收到《${dg.name}》签约定金支票 ¥${deposit.toLocaleString("zh-CN")}（下周一开机，须于第 ${n.gigDeadlineWeek} 周前拍完）`);
    }
  }

  const terminated = !!n.activeGigId && n.gigMisses >= 3; // 3 层失误撤换
  // 超期撤换：越过截止周仍未拍完约定天数，剧组换人
  const expired = !!n.activeGigId && n.gigDaysLeft > 0 && n.gigDeadlineWeek > 0 && n.week >= n.gigDeadlineWeek;
  // 通告完成判定
  if (n.activeGigId && (n.gigDaysLeft <= 0 || terminated || expired)) {
    const g = GIG_POOL.find((x) => x.id === n.activeGigId)!;
    // 成功率公式（2.1 通告成功率公式）：以拍摄结束时的能力结算
    let margin = 0; // 能力超出幅度（各要求项之和）
    let severe = false; // 任一能力 ≤ 要求值 50%
    let allWellPrepared = true; // 两项核心能力都 ≥ 要求 120%
    let hasReq = false;
    for (const k of STAT_ORDER) {
      const need = g.statReq[k];
      if (need) {
        hasReq = true;
        margin += n.stats[k] - need;
        if (n.stats[k] <= need * 0.5) severe = true;
        if (n.stats[k] < need * 1.2) allWellPrepared = false;
      }
    }
    // 唱片、电影只看实际能力，不把名气计入判定
    const fameMod = judgeUsesFame(g) ? Math.floor(Math.max(0, n.fame - g.fameReq) / 50) * 3 : 0; // 名气每高于要求 50 点 +3%
    const repMod = Math.floor(n.reputation / 10) * 1; // 口碑每 10 点 +1%
    const confMod = Math.floor(n.stats.zixin / 100) * 2; // 自信每 100 点 +2%
    const trustMod = Math.floor(n.trust / 20) * 2; // 负责人信任每 20 点 +2%
    const stressMod = Math.floor(n.stress / 10) * 3; // 压力每 10 点 -3%
    const breachMod = n.defaults * 12; // 每次违约 -12%
    // 高风险履约（任一能力≤50%）：基础失败率 55~75%，仍由自信/口碑/信任/压力修正，保留逆袭
    let rate = severe
      ? 100 - rand(55, 75) + confMod + repMod + trustMod - stressMod - breachMod
      : 50 + margin * 0.25 + fameMod + repMod + confMod + trustMod - stressMod - breachMod;
    if (!severe && hasReq && allWellPrepared && n.stress < 45) rate += 18; // 准备充分
    // 拍摄表现（失误层数）对最终完成率的修正
    if (n.gigMisses === 0) rate += 12; // 零失误：+12%，作品质量 +1 档倾向
    else if (n.gigMisses === 1) rate -= 8; // 轻微失误
    else if (n.gigMisses === 2) rate -= 22; // 多次失误，报酬上限下调
    if (n.dating === "guchen" && g.star >= 5) rate += 8; // 天王恋人线：高级影视资源成功率提升
    if (n.dating === "songshixu" && /广告|投资|品牌/.test(g.type)) rate += 5; // 资本同盟：商务资源成功率提升
    rate = clamp(rate, 5, 98);

    // 崩溃判定：压力≥90 时，高强度拍摄有概率状态失控
    let crashChance = 0;
    if (n.stress >= 90) {
      crashChance = 20;
      if (n.stats.tineng >= 500) crashChance -= 5;
      if ((n.rel["suqing"] ?? 0) >= 60) crashChance -= 5; // 苏晴挚友
      crashChance = Math.max(5, crashChance);
    }
    const crashed = crashChance > 0 && Math.random() * 100 < crashChance;

    const roll = Math.random() * 100;
    // 交涉结果修正（低价出演压报酬、角色降级压名气）——正式接取时均为 1
    const negPayMul = n.activeGigMods?.payMul ?? 1;
    const negFameMul = n.activeGigMods?.fameMul ?? 1;
    const fameMul = (traits.includes("topic") ? 1.15 : 1) * negFameMul;
    const payCap = (n.gigMisses >= 2 ? 0.8 : 1) * negPayMul; // 多次失误：报酬上限 -20%
    // 四档完成状态（撤换直接失败）
    let finalPay = 0; // 拍毕入账的尾款（定金已在开机前发放，这里为剩余部分）
    let status: "perfect" | "smooth" | "barely" | "fail";
    if (terminated || expired || crashed || roll > rate) status = "fail";
    else if (roll <= rate - 30) status = "perfect";
    else if (roll <= rate - 10) status = "smooth";
    else status = "barely";

    if (status === "perfect") {
      const gain = Math.round(g.fame * 1.3 * fameMul);
      const pay = Math.round(g.pay * 1.2 * payCap);
      n.money += pay; earned += pay; finalPay = pay;
      n.fame += gain;
      n.reputation += rand(2, 6);
      n.trust = clamp(n.trust + 8, 0, 100);
      n.works += 1;
      if (g.star >= 4) { n.awards += 1; deltas.push(`《${g.name}》斩获一项大奖`); }
      for (const k of STAT_ORDER) if (g.grow[k]) n.stats[k] = clamp(n.stats[k] + Math.round(g.grow[k]! * 1.2), 0, 999);
      deltas.push(`完美完成《${g.name}》：名气 +${gain}，报酬 ¥${(g.pay * 1.2 / 10000).toFixed(1)}万，负责人信任 +8`);
    } else if (status === "smooth") {
      const gain = Math.round(g.fame * fameMul);
      const pay = Math.round(g.pay * payCap);
      n.money += pay; earned += pay; finalPay = pay;
      n.fame += gain;
      n.reputation += rand(0, 3);
      n.trust = clamp(n.trust + 4, 0, 100);
      n.works += 1;
      for (const k of STAT_ORDER) if (g.grow[k]) n.stats[k] = clamp(n.stats[k] + g.grow[k]!, 0, 999);
      deltas.push(`顺利完成《${g.name}》：名气 +${gain}，报酬 ¥${(g.pay / 10000).toFixed(1)}万`);
    } else if (status === "barely") {
      const gain = Math.round(g.fame * 0.5 * fameMul);
      const pay = Math.round(g.pay * 0.6 * payCap);
      n.money += pay; earned += pay; finalPay = pay;
      n.fame += gain;
      n.reputation -= rand(1, 2);
      n.trust = clamp(n.trust - 3, 0, 100);
      n.stress += 6;
      n.works += 1;
      for (const k of STAT_ORDER) if (g.grow[k]) n.stats[k] = clamp(n.stats[k] + Math.round(g.grow[k]! * 0.5), 0, 999);
      deltas.push(`勉强完成《${g.name}》：作品扑街，报酬 60%，负责人信任 -3`);
    } else {
      const pay = Math.round(g.pay * (rand(0, 30) / 100));
      n.money += pay; earned += pay;
      n.fame = Math.max(0, n.fame - rand(5, 40));
      n.reputation -= rand(3, 8);
      n.trust = clamp(n.trust - 10, 0, 100);
      n.defaults += 1;
      n.stress += 6;
      n.blackFans += rand(1, 3);
      for (const k of STAT_ORDER) if (g.grow[k]) n.stats[k] = clamp(n.stats[k] - rand(1, 4), 0, 999);
      deltas.push(`${expired ? "超过截止日未拍完被撤换，" : terminated ? "累计失误被撤换，" : crashed ? "状态失控，" : ""}《${g.name}》拍摄失败：无作品，负责人信任 -10，违约 +1`);
      // 失败修复与反转机会（同周一次，随机 1 项）
      const repairs: { name: string; apply: () => void }[] = [];
      if (g.star <= 3) repairs.push({ name: "临时替补", apply: () => { n.fame = Math.min(1000, n.fame + 8); } });
      if (n.trust >= 40) repairs.push({ name: "导演复试", apply: () => { n.trust = clamp(n.trust + 3, 0, 100); } });
      if ((n.rel["suqing"] ?? 0) >= 40 || (n.rel["linzhixia"] ?? 0) >= 40) repairs.push({ name: "朋友陪伴", apply: () => { n.stress = clamp(n.stress - 12, 0, 100); } });
      if (n.pr >= 150) repairs.push({ name: "公关补救", apply: () => { n.money -= rand(30000, 120000); n.blackFans = Math.max(0, n.blackFans - rand(1, 3)); } });
      if (n.stats.caizhi >= 300 || n.stats.yanji >= 300) repairs.push({ name: "自费短片", apply: () => { n.money -= 80000; n.reputation = clamp(n.reputation + rand(3, 8), 0, 100); } });
      if (repairs.length) {
        const r = repairs[rand(0, repairs.length - 1)];
        r.apply();
        deltas.push(`触发修复机会「${r.name}」，帮你稳住了局面`);
      }
    }
    // 商业价值成长（广告/综艺/品牌类成功通告） + 恋人加成
    if (/广告|综艺|品牌/.test(g.type) && (status === "perfect" || status === "smooth")) {
      let bg = rand(4, 9);
      if (n.dating === "zhouyan") bg = Math.round(bg * 1.12); // 并肩而立：商业价值 +12%
      n.bizValue = clamp(n.bizValue + bg, 0, 999);
    }
    // 资本同盟：结算额外资金加成
    if (n.dating === "songshixu" && (status === "perfect" || status === "smooth")) { const b = Math.round(g.pay * 0.05); n.money += b; earned += b; }
    const mgr = gigManager(g);
    // 按时完成：拍毕尾款支票入账凭证（定金已于开机前发放）
    if (finalPay > 0) {
      n.checks = pushCheck(n.checks, {
        kind: "final",
        amount: finalPay,
        gigName: g.name,
        week: n.week,
        serial: `WK${String(2005000 + n.week * 17 + g.name.length).slice(-7)}`,
        memo: `《${g.name}》拍毕尾款`,
        drawer: mgr.loc,
      });
    }
    // 逾期/被撤换：责任人上门追责，挂起违约对话（了结时扣违约金）
    if (expired || terminated) {
      const fee = Math.round(g.pay * 0.4 * (n.activeGigMods?.payMul ?? 1));
      n.breach = { gigName: g.name, producer: mgr.name, loc: mgr.loc, gigType: g.type, fee };
      deltas.push(`《${g.name}》${expired ? "逾期未拍完" : "累计失误被撤换"}——${mgr.name}要上门追责了（违约金约 ¥${fee.toLocaleString("zh-CN")}）`);
    }
    // 该通告已用尽：记入 usedGigs，之后不再出现（无论成败，剧组/品牌都已换人或播出）
    if (n.activeGigId && !n.usedGigs.includes(n.activeGigId)) n.usedGigs = [...n.usedGigs, n.activeGigId];
    n.offers = n.offers.filter((x) => x !== n.activeGigId);
    n.activeGigId = null;
    n.gigDaysLeft = 0;
    n.gigMisses = 0;
    n.gigStartWeek = 0;
    n.gigDeadlineWeek = 0;
    n.gigDepositPaid = false;
    n.activeGigMods = null;
  } else if (!n.activeGigId && n.fame > 0) {
    n.fame = Math.max(0, n.fame - rand(0, 3));
  }

  // 固定收支（本周明细逐项列账，供「账单」HTML 呈现）
  const monthEnd = n.week % 4 === 0;
  const living = 12000; // 生活起居
  const food = 6000; // 餐饮美食
  let cost = living + food;
  const billLines: { label: string; amount: number }[] = [
    { label: "生活起居", amount: living },
    { label: "餐饮美食", amount: food },
  ];
  if (monthEnd) {
    cost += 35000 + 15000; // 月末租金 + 宣传
    billLines.push({ label: "公寓房租", amount: 35000 }, { label: "形象宣传", amount: 15000 });
  }
  n.money -= cost;
  const check = { amount: earned };
  const bill = { lines: billLines, total: cost, monthEnd, week: n.week };
  n.lastCheck = check;
  n.lastBill = bill;

  // 周结算
  n.stress -= 3;
  n.stress = clamp(n.stress, 0, 100);
  n.reputation = clamp(n.reputation, 0, 100);
  n.fame = Math.max(0, Math.round(n.fame));

  // 新人保底（第 1~8 周，只出现一次）
  if (!n.safetyNetUsed && n.week <= 8 && n.fame < 30) {
    n.fame = 35;
    n.safetyNetUsed = true;
    deltas.push("启星事务所安排了一次「临时替补」，名气保底提升至 35");
  }

  // 数值封顶（公司公关 0~500、黑粉 0~999）
  n.pr = clamp(n.pr, 0, 500);
  n.blackFans = clamp(n.blackFans, 0, 999);

  // 破产
  if (n.money < -500000) {
    n.log.push(`【第 ${s.week} 周】资金跌破 -50 万，制作方与场地方发来催款函……`);
    return { next: n, ended: "bankrupt", headline: "破产危机", check, bill };
  }

  // NPC 生态：竞争者持续成长——八维缓慢精进，并靠接取通告涨名气
  // 玩家本周未去查看/接取通告（offersViewedWeek 为 0）时，同行更凶，抢走的资源更多
  const rivalsHungry = s.offersViewedWeek === 0;
  for (const npc of n.npcs) {
    for (const k of STAT_ORDER) npc.stats[k] = clamp(npc.stats[k] + rand(0, 3), 0, 999);
    const took = Math.random() < (rivalsHungry ? 0.55 : 0.35); // 接到通告
    npc.fame = clamp(npc.fame + rand(-2, 5) + (took ? rand(2, 10) : 0), 0, 1000);
  }
  if (rivalsHungry) deltas.push("你本周没盯通告，几个同行把资源接走了");

  // 圈内动态：同行彼此之间每周演化出的事件（引擎只挑抽象类别与参与者 + 抽签，中文文案在内容池按 kind 渲染）
  {
    const roster = n.npcs;
    const buzz = [...(n.starBuzz ?? [])];
    const emit = (kind: StarBuzzKind, a: NPC, b: NPC | null) =>
      buzz.push({ week: n.week, kind, aId: a.id, bId: b?.id ?? null, pick: rng(0, 999) });
    // 榜首之争：名气最高的两位互别苗头
    const byFame = [...roster].sort((x, y) => y.fame - x.fame);
    if (byFame.length >= 2 && Math.random() < 0.6) emit("rivalry", byFame[0], byFame[1]);
    // 恋情/绯闻：已成对的一对被拍到
    const paired = roster.filter((x) => x.partnerId && roster.some((y) => y.id === x.partnerId));
    if (paired.length && Math.random() < 0.45) {
      const a = paired[rng(0, paired.length - 1)];
      emit("romance", a, roster.find((y) => y.id === a.partnerId) ?? null);
    }
    // 分手/decouple：有前任记录的一对被翻旧账
    const exed = roster.filter((x) => x.exId && roster.some((y) => y.id === x.exId));
    if (exed.length && Math.random() < 0.3) {
      const a = exed[rng(0, exed.length - 1)];
      emit("breakup", a, roster.find((y) => y.id === a.exId) ?? null);
    }
    // 合作：随机两位不同人搭档新作
    if (roster.length >= 2 && Math.random() < 0.5) {
      const a = roster[rng(0, roster.length - 1)];
      const b = roster[rng(0, roster.length - 1)];
      if (b.id !== a.id) emit("collab", a, b);
    }
    // 黑马崛起：名气尚浅却八维扎实者
    const risers = roster.filter((x) => x.fame < 200 && x.stats.yanji + x.stats.geyi > 400);
    if (risers.length && Math.random() < 0.4) emit("rise", risers[rng(0, risers.length - 1)], null);
    n.starBuzz = buzz.slice(-40); // 只留最近 40 条
  }

  // 头衔达标即获得
  for (const t of TITLES) {
    if (!n.titles.includes(t.id) && t.cond(n)) {
      n.titles.push(t.id);
      deltas.push(`达成头衔「${t.name}」`);
    }
  }

  // 月榜结算（每 4 周）
  if (s.week % 4 === 0) {
    const rank = leaderboard(n).findIndex((r) => r.isPlayer) + 1;
    if (rank === 1) { n.fame += 30; deltas.push(`月榜第 1 名，名气 +30`); }
    else if (rank <= 3) { n.fame += 15; deltas.push(`月榜第 ${rank} 名，名气 +15`); }
    else if (rank <= 10) { n.fame += 5; deltas.push(`月榜第 ${rank} 名，名气 +5`); }
    else deltas.push(`月榜第 ${rank} 名，需要更多曝光`);

    // 逐年成长：随生涯阅历推进，几项「靠时间沉淀」的能力每月自然小幅精进
    const mature: StatKey[] = ["tineng", "caizhi", "yitai", "zixin"];
    for (const k of mature) n.stats[k] = clamp(n.stats[k] + rand(1, 3), 0, 999);
    deltas.push("阅历渐长：体能·才智·仪态·自信各有沉淀");
  }

  n.fame = clamp(Math.round(n.fame), 0, 1000); // 名气上限 1000

  n.week += 1;
  // 新的一周档期清空：通告需重新到对应地点找制作人/制片人当面打听
  n.offers = [];
  n.offersViewedWeek = 0;

  const summary = deltas.length ? deltas.join("；") : "平稳的一周，继续打磨自己。";
  n.log.push(`【第 ${s.week} 周结算】${summary}`);
  if (n.log.length > 40) n.log = n.log.slice(-40);

  if (n.week > 104) {
    return { next: n, ended: "finish", headline: "两年生涯落幕", check, bill };
  }
  return { next: n, ended: null, headline: summary, check, bill };
}

// 地图踩点：推进关系与线索
export function visitLocation(s: GameState, locId: string): { next: GameState; msg: string } {
  const looks = computeLooks(s);
  const n: GameState = { ...s, rel: { ...s.rel }, metPeople: [...s.metPeople], stats: { ...s.stats } };

  const meet = (pid: string, delta: number, extra: string) => {
    if (!n.metPeople.includes(pid)) n.metPeople.push(pid);
    n.rel[pid] = clamp((n.rel[pid] ?? 0) + delta, 0, pid === "guchen" || pid === "songshixu" ? 1000 : 100);
    return extra;
  };

  let msg = "今日无关键安排，只做了常规踩点。";
  switch (locId) {
    case "apartment":
      n.stress = clamp(n.stress - 12, 0, 100);
      if (n.dating === "jiangxu") {
        n.stress = clamp(n.stress - 8, 0, 100);
        msg = "隔壁常亮的灯还亮着，江叙白留了热汤——压力额外 -8。";
      } else {
        msg = "在天光公寓深度休息：紧绷的神经缓了过来。";
      }
      break;
    case "cafe":
      n.stress = clamp(n.stress - 8, 0, 100);
      if (s.week >= 6) msg = "" + meet("suqing", 5, "和苏晴喝了杯咖啡，关系 +5，压力 -8。");
      else msg = "独自在白栀咖啡馆靠窗坐了一下午，看街上人来人往，压力 -8。";
      break;
    case "fuguang":
      // 结识条件总表：第 7 周后 · 演技≥240 · 口碑≥45
      if (s.week >= 7 && s.stats.yanji >= 240 && s.reputation >= 45) msg = "" + meet("shenman", 4, "沈曼在片场指点了你，前辈关系 +4。");
      else { n.stats.yanji = clamp(n.stats.yanji + 3, 0, 999); msg = "在片场角落翻阅剧本库，揣摩前辈的走位与念白，演技 +3。"; }
      break;
    case "dieyin":
      if (s.stats.geyi >= 160) msg = "" + meet("linzhixia", 4, "林知夏和你聊了新歌，合作关系 +4。");
      else { n.stats.geyi = clamp(n.stats.geyi + 3, 0, 999); msg = "在录音棚反复试唱同一段副歌，直到气息稳了下来，歌艺 +3。"; }
      break;
    case "cancan":
      n.styling = Math.min(999, n.styling + 40);
      if (s.week >= 18 && s.fame >= 160 && s.reputation >= 60 && s.works >= 2 && s.money >= 80000 && s.defaults === 0 && !n.metPeople.includes("zhouyan"))
        msg = "" + meet("zhouyan", 5, "品牌共创会上结识「序岸」创始人周砚川，成熟事业线开启，关系 +5。当周造型值 +40。");
      // 6.1 金主线：容貌≥600（硬性）· 名气≥70 · 口碑≥50 · 仪态≥60 或 口才≥70
      else if (looks >= 600 && s.fame >= 70 && s.reputation >= 50 && (s.stats.yitai >= 60 || s.stats.koucai >= 70))
        msg = "" + meet("songshixu", 6, "品牌晚宴上认识了宋时序，资本线开启，好感 +6。当周造型值 +40。");
      else if (looks < 600) msg = "在璨璨做了整套造型咨询，镜中的自己一点点清晰起来，当周造型值 +40。";
      else msg = "品牌晚宴的外围周旋了一圈，递出几张名片，当周造型值 +40。";
      break;
    case "yuntai":
      // 6. 天王线：中后期高阶事件随机触发（名气≥80 · 演技≥55 · 口碑≥40）
      if (s.week >= 40 && s.fame >= 80 && s.stats.yanji >= 55 && s.reputation >= 40 && Math.random() < 0.4)
        msg = "" + meet("guchen", 4, "录制间隙偶遇国民天王顾沉，他淡淡颔首，天王线悄然开启，好感 +4。");
      else if (s.fame >= 150) msg = "" + meet("luyao", 3, "和陆曜同台录制，暗自较劲，关系 +3。");
      else { n.stats.koucai = clamp(n.stats.koucai + 3, 0, 999); msg = "对着云台的镜头试录了几遍开场白，越说越顺，口才 +3。"; }
      break;
    case "agency":
      n.pr += 5;
      msg = "在启星事务所请教林宜，公司公关 +5，拿到几条通告线索。";
      break;
    case "redcarpet":
      // 结识条件总表：闻予安本人需 容貌≥700 · 名气≥180 · 口碑≥75 · 黑粉≤8（第13周后公益晚宴开放）
      if (s.week >= 13 && looks >= 700 && s.fame >= 180 && s.reputation >= 75 && s.blackFans <= 8) {
        const gain = n.dating === "wenyuan" ? 5 : 4; // 长夜灯火：公益/正向活动收益 +30%
        msg = "" + meet("wenyuan", gain, `云岸公益晚宴上与闻予安正式相识，世家线好感 +${gain}。`);
        if (n.dating === "wenyuan") n.reputation = clamp(n.reputation + 2, 0, 100);
      } else if (s.week >= 13 && s.reputation >= 50) {
        n.pr += 4;
        msg = "公益晚宴上结识了几位公益人脉，交换了联络方式（公司公关 +4）。";
      } else msg = "红毯会客厅今晚只走到了外围，隔着一道绒绳望了望里头的觥筹交错。";
      break;
    case "street": {
      const g = rand(5, 12);
      n.fame += g;
      msg = `星桥商业街街拍曝光，名气 +${g}。`;
      break;
    }
    case "gym":
      msg = "练习馆的私教在等你——回到日程里安排训练收益更高。";
      break;
  }
  n.fame = clamp(Math.round(n.fame), 0, 1000);
  n.log = [...s.log, `【第 ${s.week} 周 · 踩点】${msg}`];
  if (n.log.length > 40) n.log = n.log.slice(-40);
  return { next: n, msg };
}

// 居家/在场活动：通用增益应用器。活动语义与数值全在内容池，引擎只按字段增减并夹取边界。
// requiresItem 需先在行囊持有；lockedMsg 为缺物提示。返回 ok=false 时不改状态。
export function doActivity(s: GameState, roomId: string, actId: string): { next: GameState; msg: string; ok: boolean } {
  const act = activitiesOfRoom(roomId).find((a) => a.id === actId);
  if (!act) return { next: s, msg: "此处没有这个活动。", ok: false };
  if (act.requiresItem && !(s.bag ?? []).includes(act.requiresItem)) {
    return { next: s, msg: act.lockedMsg ?? "还差点什么才能做这件事。", ok: false };
  }
  if ((act.money ?? 0) < 0 && s.money + (act.money ?? 0) < 0) {
    return { next: s, msg: `现金不足，这件事得花 ¥${-(act.money ?? 0)}。`, ok: false };
  }
  const n: GameState = { ...s, stats: { ...s.stats } };
  if (act.stress) n.stress = clamp(n.stress + act.stress, 0, 100);
  if (act.fame) n.fame = clamp(Math.round(n.fame + act.fame), 0, 1000);
  if (act.money) n.money = n.money + act.money;
  if (act.stat && act.statDelta) {
    const key = act.stat as StatKey;
    n.stats[key] = clamp((n.stats[key] ?? 0) + act.statDelta, 0, 999);
  }
  n.log = [...s.log, `【第 ${s.week} 周 · 居家】${act.msg}`];
  if (n.log.length > 40) n.log = n.log.slice(-40);
  return { next: n, msg: act.msg, ok: true };
}

// 购买标价物品：扣现金、收入行囊。价格与中文全在内容池，引擎只做够不够/买没买的判定。
export function buyItem(s: GameState, roomId: string, itemId: string): { next: GameState; msg: string; ok: boolean } {
  const it = itemsOfRoom(roomId).find((x) => x.id === itemId);
  if (!it || !it.price) return { next: s, msg: "这件东西不卖。", ok: false };
  if ((s.bag ?? []).includes(itemId)) return { next: s, msg: `${it.name}你已经买过了。`, ok: false };
  if (s.money < it.price) return { next: s, msg: `现金不足，${it.name}要 ¥${it.price}。`, ok: false };
  const n: GameState = { ...s, money: s.money - it.price, bag: [...(s.bag ?? []), itemId] };
  n.log = [...s.log, `【第 ${s.week} 周 · 购物】花 ¥${it.price} 买下${it.name}。`];
  if (n.log.length > 40) n.log = n.log.slice(-40);
  return { next: n, msg: `你花 ¥${it.price} 买下了${it.name}，收进行囊。`, ok: true };
}

// 地点动态状态：今日是否有关键人物/事件（策划案 8. 按目标选点，而非挨个碰运气）
export function locationStatus(s: GameState, locId: string): { ready: boolean; note: string } {
  const looks = computeLooks(s);
  const gap = (have: number, need: number) => (have >= need ? "" : `（差 ${need - have}）`);
  switch (locId) {
    case "fuguang":
      return s.week >= 7 && s.stats.yanji >= 240 && s.reputation >= 45 ? { ready: true, note: "今日可遇 · 沈曼（前辈提携）" } : { ready: false, note: `沈曼需第7周后·演技≥240·口碑≥45 ${gap(s.stats.yanji, 240)}` };
    case "dieyin":
      return s.stats.geyi >= 160 ? { ready: true, note: "今日可遇 · 林知夏（合作）" } : { ready: false, note: `林知夏需歌艺≥160 ${gap(s.stats.geyi, 160)}` };
    case "yuntai":
      if (s.week >= 40 && s.fame >= 80 && s.stats.yanji >= 55 && s.reputation >= 40) return { ready: true, note: "天王线开启中 · 有概率偶遇顾沉" };
      return s.fame >= 150 ? { ready: true, note: "今日可遇 · 陆曜（同台较劲）" } : { ready: false, note: `陆曜需名气≥150 ${gap(Math.round(s.fame), 150)}` };
    case "cancan":
      if (s.week >= 18 && s.fame >= 160 && s.reputation >= 60 && s.works >= 2 && s.money >= 80000 && s.defaults === 0 && !s.metPeople.includes("zhouyan")) return { ready: true, note: "品牌共创会 · 可结识周砚川" };
      if (looks >= 600 && s.fame >= 70 && s.reputation >= 50 && (s.stats.yitai >= 60 || s.stats.koucai >= 70)) return { ready: true, note: "品牌晚宴 · 可结识宋时序" };
      return { ready: false, note: looks < 600 ? `宋时序需容貌≥600 ${gap(looks, 600)}` : "宋时序还需名气≥70 · 口碑≥50" };
    case "redcarpet":
      if (s.week >= 13 && looks >= 700 && s.fame >= 180 && s.reputation >= 75 && s.blackFans <= 8) return { ready: true, note: "云岸公益晚宴 · 可正式结识闻予安" };
      if (s.week >= 13 && s.reputation >= 50) return { ready: false, note: `公益晚宴开放（结识公益人脉）· 闻予安本人需容貌≥700 ${gap(looks, 700)}` };
      return { ready: false, note: `公益晚宴需第13周后 · 口碑≥50 ${gap(s.reputation, 50)}` };
    case "cafe":
      return s.week >= 6 ? { ready: true, note: "今日可遇 · 苏晴（缓压挚友）" } : { ready: false, note: "苏晴第 6 周后出现" };
    case "street":
      return s.week >= 2 ? { ready: true, note: "白衬衫眼镜男子可能出没" } : { ready: false, note: "第 2 周后开放偶遇" };
    case "agency":
      return { ready: true, note: s.week <= 8 && s.fame < 30 ? "林宜在 · 可申请新人临时替补保底" : "林宜常驻 · 公司公关 +5" };
    case "gym":
      return { ready: true, note: "训练导师在 · 回日程安排收益更高" };
    case "apartment":
      return { ready: true, note: s.dating ? `深度休息 · 恋人「${PEOPLE.find((p) => p.id === s.dating)?.name}」私密事件` : "深度休息 · 排日程与私密事件" };
    default:
      return { ready: false, note: "今日无关键安排" };
  }
}

// 两年生涯阶段（策划案 两年闭环）
// 历法设定（起始日/周数/星期名）全部来自 ContentPool.calendar，引擎只做日期运算。
// 惰性求值：content.ts 与本模块存在循环依赖，若在模块初始化时读取 CALENDAR，
// 当 content.ts 先被求值会命中 TDZ（Cannot access 'CALENDAR' before initialization）。
let _startMs: number | null = null;
const startMs = (): number => {
  if (_startMs === null) {
    const [y, m, d] = CALENDAR.startDate.split("-").map(Number);
    _startMs = Date.UTC(y, m - 1, d);
  }
  return _startMs;
};

// 当日时刻：从内容池 travel.dayStartMinute 起算（缺省 08:00）。移动/活动推动 clockMin 流动。
export const dayStartMin = (): number => TRAVEL.dayStartMinute ?? 480;
export const dayEndMin = (): number => TRAVEL.dayEndMinute ?? 1380;
// 把当日分钟数格式化为 时段 HH:MM（跨过 24:00 后按「次日」显示，语义上就是该歇了）
export function clockLabel(min: number): string {
  const total = Math.max(0, Math.round(min));
  const next = total >= 1440;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  const hhmm = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const period = next ? "深夜" : h < 6 ? "凌晨" : h < 11 ? "上午" : h < 13 ? "正午" : h < 18 ? "下午" : h < 23 ? "晚上" : "深夜";
  return `${period} ${hhmm}`;
}

// day：0 基的「生涯第几天」，day 0 = startDate（周一）。week 恒等于 careerWeekOf(day)。
export const careerWeekOf = (day: number): number => Math.floor(day / 7) + 1;
export const weekdayName = (day: number): string => CALENDAR.weekdayNames[((day % 7) + 7) % 7];

export function dayParts(day: number): { y: number; m: number; d: number; dow: number } {
  const dt = new Date(startMs() + day * 86400000);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), dow: ((day % 7) + 7) % 7 };
}

export function dayDateLabel(day: number): string {
  const { y, m, d } = dayParts(day);
  return `${y}.${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")}`;
}

export function weekDate(week: number): string {
  return dayDateLabel((week - 1) * 7);
}

export type DayResult = WeekResult & {
  settled: boolean; // 本次推进是否跨过周日、触发了周结算
  rolledWeek: boolean; // 同 settled，语义别名
  dayText: string; // 当天旁白
  grade: DayGrade | null; // 当天日程的推进档位（休息/社交为 null）
  gradeLabel: string; // 档位中文（完美/大成功/成功/失败/糟糕；无则空）
  actLabel: string; // 当天所做之事
  gains: string[]; // 收益明细
};

// 推进「一天」：结算当天（day % 7）安排的一件事，掷出结果档位，翻页到次日。
// 跨过周日（dow=6）翻页时额外触发本周经济/通告/生态结算，并清空日程供规划下一周。
export function advanceDay(s: GameState): DayResult {
  const dow = s.day % 7; // 0=周一 … 6=周日
  const n: GameState = { ...s, stats: { ...s.stats }, schedule: [...(s.schedule ?? [])], log: [...s.log] };
  const deltas: string[] = [];
  const actId = n.schedule[dow] ?? null;
  const r = applyAct(n, actId, deltas);
  const gradeLabel = r.grade ? GRADE_LABEL[r.grade] : "";
  const doneNote = deltas.length ? "：" + deltas.join("；") : "";

  const nextDay = s.day + 1;
  const rollToNext = (base: GameState, fresh: boolean): GameState => ({
    ...base,
    day: nextDay,
    week: careerWeekOf(nextDay),
    daySeg: 0,
    clockMin: 8 * 60,
    schedule: fresh ? [null, null, null, null, null, null, null] : base.schedule,
  });

  if (dow === 6) {
    const wr = settleWeek(n); // 经济/通告/生态结算、week 推进、生涯终局判定
    const next = rollToNext(wr.next, true); // 新的一周：清空日程重排
    return {
      ...wr, next, settled: true, rolledWeek: true, grade: r.grade, gradeLabel, actLabel: r.actLabel, gains: r.gains,
      dayText: `${weekdayName(s.day)}·${r.actLabel}${gradeLabel ? `（${gradeLabel}）` : ""}${doneNote}。一周落幕，本周结算完成，翻页进入新一周。`,
    };
  }
  const next = rollToNext(n, false);
  const label = `${dayDateLabel(nextDay)} ${weekdayName(nextDay)}`;
  return {
    next, ended: null, headline: `${gradeLabel || r.actLabel} · ${weekdayName(s.day)}`, settled: false, rolledWeek: false,
    grade: r.grade, gradeLabel, actLabel: r.actLabel, gains: r.gains,
    dayText: `${weekdayName(s.day)}·${r.actLabel}${gradeLabel ? `——${gradeLabel}` : ""}${doneNote}，来到 ${label}。`,
  };
}

export function phaseOf(week: number): string {
  if (week <= 13) return "素人期";
  if (week <= 26) return "起步期";
  if (week <= 52) return "上升期";
  if (week <= 78) return "转型期";
  if (week <= 103) return "冲刺期";
  return "终局周";
}

// 破产独立结局（依据名气/口碑/人脉）
export function bankruptEnding(s: GameState): { title: string; body: string } {
  const bonds = Object.values(s.rel).filter((v) => v >= 40).length;
  if (s.fame >= 200 && s.reputation >= 60)
    return { title: "《从欠款开始的第二次出道》", body: "暂别聚光灯，靠一部低成本作品，你还能翻身。" };
  if (bonds >= 2)
    return { title: "《有人替你留了一盏灯》", body: "联系人帮你还清了部分欠款，保留少量重开加成。" };
  return { title: "《最后一班末班车》", body: "合同终止，搬离天光公寓，成为普通人的遗憾结局。" };
}

export function endingText(s: GameState): { title: string; body: string } {
  if (s.fame >= 750 && s.awards >= 1)
    return { title: "国民级女星 · 巅峰结局", body: "聚光灯为你亮起，你站上了这个行业的顶点。" };
  if (s.fame >= 500)
    return { title: "一线女星 · 荣耀结局", body: "你已是华语娱乐圈举足轻重的名字。" };
  if (s.reputation >= 80)
    return { title: "口碑之选 · 长红结局", body: "也许不是最红，但你是最被尊重的那一个。" };
  if (s.fame >= 150)
    return { title: "上升艺人 · 未完待续", body: "两年只是序章，你的故事还在继续。" };
  return { title: "平凡而认真 · 素人结局", body: "没能大红大紫，但这段经历始终闪着光。" };
}

// ============ 多段攻略线（策划案 6.x 世家线 / 邻居线） ============
export type ArcChoice = { label: string; result: string; apply: (n: GameState) => void };
export type ArcStage = { id: number; name: string; unlock: string; cond: (s: GameState) => boolean; choices: ArcChoice[] };
export type RomanceArc = {
  personId: string;
  stages: ArcStage[];
  confirm: { cond: (s: GameState) => boolean; req: string; buff: string; buffDesc: string };
};

const rel = (s: GameState, pid: string) => s.rel[pid] ?? 0;
const bumpRel = (n: GameState, pid: string, d: number) => { n.rel[pid] = clamp((n.rel[pid] ?? 0) + d, 0, 100); };
const bumpStat = (n: GameState, k: StatKey, d: number) => { n.stats[k] = clamp((n.stats[k] ?? 0) + d, 0, 999); };

export const ROMANCE_ARCS: Record<string, RomanceArc> = {
  // 6.2 市长之子 · 世家线（门槛最高）
  wenyuan: {
    personId: "wenyuan",
    stages: [
      {
        id: 1, name: "公益晚宴", unlock: "容貌≥700 · 名气≥180 · 口碑≥75 · 黑粉≤8",
        cond: (s) => computeLooks(s) >= 700 && s.fame >= 180 && s.reputation >= 75 && s.blackFans <= 8,
        choices: [
          { label: "面对记者真诚回应", result: "口碑 +3，好感 +8", apply: (n) => { n.reputation = clamp(n.reputation + 3, 0, 100); bumpRel(n, "wenyuan", 8); } },
          { label: "借机炒作热度", result: "名气 +8，好感 -6", apply: (n) => { n.fame += 8; bumpRel(n, "wenyuan", -6); } },
        ],
      },
      {
        id: 2, name: "雨后探访", unlock: "好感≥20",
        cond: (s) => rel(s, "wenyuan") >= 20,
        choices: [
          { label: "匿名参与社区探访", result: "好感 +8，压力 -4", apply: (n) => { bumpRel(n, "wenyuan", 8); n.stress = clamp(n.stress - 4, 0, 100); } },
          { label: "带媒体高调同行", result: "名气 +5，好感 -5", apply: (n) => { n.fame += 5; bumpRel(n, "wenyuan", -5); } },
        ],
      },
      {
        id: 3, name: "舆论审视", unlock: "口碑≥80 · 黑粉≤8",
        cond: (s) => s.reputation >= 80 && s.blackFans <= 8,
        choices: [
          { label: "拒绝动用关系压新闻", result: "好感 +10，口碑 +3", apply: (n) => { bumpRel(n, "wenyuan", 10); n.reputation = clamp(n.reputation + 3, 0, 100); } },
          { label: "利用关系压下负面", result: "触碰底线：好感 -15", apply: (n) => { bumpRel(n, "wenyuan", -15); } },
        ],
      },
      {
        id: 4, name: "作品答卷", unlock: "至少 1 部高质量作品",
        cond: (s) => s.works >= 1,
        choices: [
          { label: "接下公益短片", result: "好感 +10，口碑 +4", apply: (n) => { bumpRel(n, "wenyuan", 10); n.reputation = clamp(n.reputation + 4, 0, 100); } },
          { label: "优先商业大片", result: "名气 +10，好感 -4", apply: (n) => { n.fame += 10; bumpRel(n, "wenyuan", -4); } },
        ],
      },
      {
        id: 5, name: "家宴名单", unlock: "好感≥55 · 容貌≥750 · 仪态≥700",
        cond: (s) => rel(s, "wenyuan") >= 55 && computeLooks(s) >= 750 && s.stats.yitai >= 700,
        choices: [
          { label: "面对长辈维持真实表达", result: "好感 +10", apply: (n) => bumpRel(n, "wenyuan", 10) },
          { label: "迎合长辈的期待", result: "名气 +3，好感 -6", apply: (n) => { n.fame += 3; bumpRel(n, "wenyuan", -6); } },
        ],
      },
      {
        id: 6, name: "风暴来临", unlock: "名气≥260 · 口碑≥85 · 三大奖提名≥1",
        cond: (s) => s.fame >= 260 && s.reputation >= 85 && s.awards >= 1,
        choices: [
          { label: "和他共同面对曝光危机", result: "好感 +12", apply: (n) => bumpRel(n, "wenyuan", 12) },
          { label: "独自承担全部舆论", result: "好感 +6，压力 +8", apply: (n) => { bumpRel(n, "wenyuan", 6); n.stress = clamp(n.stress + 8, 0, 100); } },
        ],
      },
      {
        id: 7, name: "灯火确认", unlock: "好感≥85 · 前六段全部完成",
        cond: (s) => rel(s, "wenyuan") >= 85,
        choices: [
          { label: "在灯火里说出心意", result: "世家线圆满，可确认交往", apply: (n) => bumpRel(n, "wenyuan", 3) },
        ],
      },
    ],
    confirm: {
      cond: (s) => rel(s, "wenyuan") >= 85 && computeLooks(s) >= 750 && s.reputation >= 85 && s.blackFans <= 5 && s.fame >= 300 && s.awards >= 1,
      req: "好感≥85 · 容貌≥750 · 口碑≥85 · 黑粉≤5 · 名气≥300 · 三大奖≥1",
      buff: "长夜灯火",
      buffDesc: "每月首次舆论危机口碑损失 -50% · 公益活动收益 +30% · 高端人脉结识率 +15%",
    },
  },
  // 6.3 邻居哥哥 · 陪伴线
  jiangxu: {
    personId: "jiangxu",
    stages: [
      {
        id: 1, name: "隔壁的灯", unlock: "入住天光公寓（第 1 周）",
        cond: (s) => s.week >= 1,
        choices: [
          { label: "向他借工具", result: "关系 +4", apply: (n) => bumpRel(n, "jiangxu", 4) },
          { label: "自己动手处理", result: "体能 -2，关系 +2", apply: (n) => { bumpStat(n, "tineng", -2); bumpRel(n, "jiangxu", 2); } },
        ],
      },
      {
        id: 2, name: "深夜便利店", unlock: "关系≥25 · 压力≥35",
        cond: (s) => rel(s, "jiangxu") >= 25 && s.stress >= 35,
        choices: [
          { label: "坦白最近的疲惫", result: "关系 +8，压力 -8", apply: (n) => { bumpRel(n, "jiangxu", 8); n.stress = clamp(n.stress - 8, 0, 100); } },
          { label: "假装一切顺利", result: "关系 +2", apply: (n) => bumpRel(n, "jiangxu", 2) },
        ],
      },
      {
        id: 3, name: "阳台植物", unlock: "关系≥35 · 完成 1 次通告",
        cond: (s) => rel(s, "jiangxu") >= 35 && s.works >= 1,
        choices: [
          { label: "一起布置阳台", result: "关系 +6，压力 -3", apply: (n) => { bumpRel(n, "jiangxu", 6); n.stress = clamp(n.stress - 3, 0, 100); } },
          { label: "拒绝他的帮忙", result: "关系 -3", apply: (n) => bumpRel(n, "jiangxu", -3) },
        ],
      },
      {
        id: 4, name: "被拍到的并肩", unlock: "名气≥120 · 关系≥45",
        cond: (s) => s.fame >= 120 && rel(s, "jiangxu") >= 45,
        choices: [
          { label: "主动澄清是邻居", result: "口碑 +3，关系 +8", apply: (n) => { n.reputation = clamp(n.reputation + 3, 0, 100); bumpRel(n, "jiangxu", 8); } },
          { label: "借绯闻炒作", result: "名气 +8，关系 -10", apply: (n) => { n.fame += 8; bumpRel(n, "jiangxu", -10); } },
        ],
      },
      {
        id: 5, name: "旧城方案", unlock: "才智≥260 或 2 次高质量作品 · 关系≥55",
        cond: (s) => (s.stats.caizhi >= 260 || s.works >= 2) && rel(s, "jiangxu") >= 55,
        choices: [
          { label: "认真听他的创业方案", result: "关系 +10，才智 +5", apply: (n) => { bumpRel(n, "jiangxu", 10); bumpStat(n, "caizhi", 5); } },
          { label: "只索取场地资源", result: "资金 +2 万，关系 -12", apply: (n) => { n.money += 20000; bumpRel(n, "jiangxu", -12); } },
        ],
      },
      {
        id: 6, name: "雨停以前", unlock: "关系≥70 · 压力≥60",
        cond: (s) => rel(s, "jiangxu") >= 70 && s.stress >= 60,
        choices: [
          { label: "允许他陪伴并说出顾虑", result: "关系 +12，压力 -10", apply: (n) => { bumpRel(n, "jiangxu", 12); n.stress = clamp(n.stress - 10, 0, 100); } },
          { label: "继续逞强", result: "自信 +3，关系 +3", apply: (n) => { bumpStat(n, "zixin", 3); bumpRel(n, "jiangxu", 3); } },
        ],
      },
      {
        id: 7, name: "门牌号之后", unlock: "关系≥85 · 前六段完成且未越界",
        cond: (s) => rel(s, "jiangxu") >= 85,
        choices: [
          { label: "确认共同的生活安排", result: "陪伴线圆满，可确认交往", apply: (n) => bumpRel(n, "jiangxu", 3) },
        ],
      },
    ],
    confirm: {
      cond: (s) => rel(s, "jiangxu") >= 85,
      req: "关系≥85 · 七段剧情全部完成",
      buff: "隔壁常亮的灯",
      buffDesc: "每周首次在天光公寓休息压力额外 -8 · 体能恢复 +5 · 过劳时提醒休整",
    },
  },
  // 6.4 离婚创一代 · 成熟事业线
  zhouyan: {
    personId: "zhouyan",
    stages: [
      {
        id: 1, name: "共创会迟到五分钟", unlock: "名气≥160 · 口碑≥60 · 2 次付费通告 · 资金≥8 万 · 无违约",
        cond: (s) => s.fame >= 160 && s.reputation >= 60 && s.works >= 2 && s.money >= 80000 && s.defaults === 0,
        choices: [
          { label: "先谈项目再寒暄", result: "关系 +8", apply: (n) => bumpRel(n, "zhouyan", 8) },
          { label: "只谈私人八卦", result: "关系 -6，黑粉 +1", apply: (n) => { bumpRel(n, "zhouyan", -6); n.blackFans += 1; } },
        ],
      },
      {
        id: 2, name: "旧采访", unlock: "关系≥25 · 口碑≥65",
        cond: (s) => rel(s, "zhouyan") >= 25 && s.reputation >= 65,
        choices: [
          { label: "尊重他的隐私", result: "关系 +10", apply: (n) => bumpRel(n, "zhouyan", 10) },
          { label: "追问离婚原因", result: "关系 -15（路线受挫）", apply: (n) => bumpRel(n, "zhouyan", -15) },
        ],
      },
      {
        id: 3, name: "不合身的代言", unlock: "商业价值≥120 · 口才≥300",
        cond: (s) => s.bizValue >= 120 && s.stats.koucai >= 300,
        choices: [
          { label: "提出修改方案", result: "才智 +6，关系 +10", apply: (n) => { bumpStat(n, "caizhi", 6); bumpRel(n, "zhouyan", 10); } },
          { label: "照单全收", result: "商业价值 +8，关系 +2", apply: (n) => { n.bizValue = clamp(n.bizValue + 8, 0, 999); bumpRel(n, "zhouyan", 2); } },
        ],
      },
      {
        id: 4, name: "共同承担", unlock: "名气≥260 · 完成 1 个 4 星广告或电影",
        cond: (s) => s.fame >= 260 && s.awards >= 1,
        choices: [
          { label: "公开承担项目责任", result: "口碑 +5，关系 +12", apply: (n) => { n.reputation = clamp(n.reputation + 5, 0, 100); bumpRel(n, "zhouyan", 12); } },
          { label: "让他单独背锅", result: "资金 +5 万，关系 -20", apply: (n) => { n.money += 50000; bumpRel(n, "zhouyan", -20); } },
        ],
      },
      {
        id: 5, name: "前段婚姻的回声", unlock: "关系≥55 · 口碑≥70",
        cond: (s) => rel(s, "zhouyan") >= 55 && s.reputation >= 70,
        choices: [
          { label: "倾听但不越界拯救", result: "关系 +12", apply: (n) => bumpRel(n, "zhouyan", 12) },
          { label: "承诺替他解决过去", result: "关系 -8，压力 +8", apply: (n) => { bumpRel(n, "zhouyan", -8); n.stress = clamp(n.stress + 8, 0, 100); } },
        ],
      },
      {
        id: 6, name: "董事会之外", unlock: "才智≥420 · 口才≥420 · 完成 1 个自选事业项目",
        cond: (s) => s.stats.caizhi >= 420 && s.stats.koucai >= 420 && s.works >= 3,
        choices: [
          { label: "讨论双方边界与时间", result: "关系 +12，商业价值 +10", apply: (n) => { bumpRel(n, "zhouyan", 12); n.bizValue = clamp(n.bizValue + 10, 0, 999); } },
          { label: "要求他公开证明", result: "名气 +10，关系 -12", apply: (n) => { n.fame += 10; bumpRel(n, "zhouyan", -12); } },
        ],
      },
      {
        id: 7, name: "新的合伙人", unlock: "关系≥85 · 口碑≥80 · 5 星通告或商业榜前 10",
        cond: (s) => rel(s, "zhouyan") >= 85 && s.reputation >= 80 && (s.awards >= 1 || s.fame >= 500),
        choices: [
          { label: "确认成为彼此的合伙人", result: "成熟事业线圆满，可确认交往", apply: (n) => bumpRel(n, "zhouyan", 3) },
        ],
      },
    ],
    confirm: {
      cond: (s) => rel(s, "zhouyan") >= 85 && s.reputation >= 80 && s.stats.caizhi >= 420 && s.stats.koucai >= 420,
      req: "关系≥85 · 口碑≥80 · 才智与口才均≥420 · 全程未侵犯隐私/让对方背锅",
      buff: "并肩而立",
      buffDesc: "每月首次品牌/商业通告商业价值 +12% · 每季度一次商业情报 · 低资金时可低息周转",
    },
  },
  // 6. 天王线（条件养成，无分段剧本）
  guchen: {
    personId: "guchen",
    stages: [],
    confirm: {
      cond: (s) => rel(s, "guchen") >= 85 && s.reputation >= 70 && s.blackFans <= 5 && (s.awards >= 1 || s.works >= 3),
      req: "好感≥85 · 口碑≥70 · 黑粉≤5 · 至少 1 部高质量代表作",
      buff: "天王恋人线",
      buffDesc: "高级电影资源成功率提升 · 结局池新增天王专属结局",
    },
  },
  // 6.1 金主线（条件养成，无分段剧本）
  songshixu: {
    personId: "songshixu",
    stages: [],
    confirm: {
      cond: (s) => rel(s, "songshixu") >= 85 && s.reputation >= 65 && s.blackFans <= 4 && (s.awards >= 1 || s.works >= 2),
      req: "好感≥85 · 口碑≥65 · 黑粉≤4 · 至少 1 个高质量作品",
      buff: "资本同盟",
      buffDesc: "投资事件成功率提升 · 高级商务与红毯资源解锁 · 结算额外资金加成",
    },
  },
};

export type ArcView = {
  done: number;
  total: number;
  stage: ArcStage | null; // 当前可推进的段
  locked: boolean; // 下一段条件未达成
  reason: string; // 未达成时的提示
  datingReady: boolean; // 七段完成、可确认交往
  isDating: boolean;
  confirmReq: string;
  buff: string;
};

export function arcView(s: GameState, pid: string): ArcView | null {
  const arc = ROMANCE_ARCS[pid];
  if (!arc) return null;
  const total = arc.stages.length;
  const done = s.arcStage?.[pid] ?? 0;
  const isDating = s.dating === pid;
  if (done >= total) {
    return { done, total, stage: null, locked: false, reason: "", datingReady: !isDating && arc.confirm.cond(s), isDating, confirmReq: arc.confirm.req, buff: arc.confirm.buff };
  }
  const stage = arc.stages[done];
  const ok = stage.cond(s);
  return { done, total, stage, locked: !ok, reason: ok ? "" : stage.unlock, datingReady: false, isDating, confirmReq: arc.confirm.req, buff: arc.confirm.buff };
}

export function chooseArc(s: GameState, pid: string, choiceIdx: number): { next: GameState; msg: string } {
  if (s.npcLives?.[pid]?.dead || s.romanceEnabled?.[pid] === false) return { next: s, msg: "该人物已设为不可攻略。" };
  const arc = ROMANCE_ARCS[pid];
  const done = s.arcStage?.[pid] ?? 0;
  if (!arc || done >= arc.stages.length) return { next: s, msg: "" };
  const stage = arc.stages[done];
  if (!stage.cond(s)) return { next: s, msg: `还差一点：${stage.unlock}` };
  const c = stage.choices[choiceIdx];
  if (!c) return { next: s, msg: "" };
  const n: GameState = { ...s, rel: { ...s.rel }, stats: { ...s.stats }, arcStage: { ...s.arcStage } };
  c.apply(n);
  n.arcStage[pid] = done + 1;
  n.fame = clamp(Math.round(n.fame), 0, 1000);
  const who = PEOPLE.find((p) => p.id === pid)?.name ?? "";
  const msg = `【${who}·${stage.name}】${c.label} → ${c.result}`;
  n.log = [...s.log, `【第 ${s.week} 周 · 剧情】${msg}`];
  if (n.log.length > 40) n.log = n.log.slice(-40);
  return { next: n, msg };
}

export function confirmDating(s: GameState, pid: string): { next: GameState; msg: string } {
  if (s.npcLives?.[pid]?.dead || s.romanceEnabled?.[pid] === false) return { next: s, msg: "该人物已设为不可攻略。" };
  const arc = ROMANCE_ARCS[pid];
  const view = arcView(s, pid);
  if (!arc || !view?.datingReady) return { next: s, msg: "尚未满足确认交往的全部条件。" };
  const n: GameState = { ...s, dating: pid };
  const who = PEOPLE.find((p) => p.id === pid)?.name ?? "";
  const msg = `你和${who}确认了关系，获得状态「${arc.confirm.buff}」。`;
  n.log = [...s.log, `【第 ${s.week} 周 · 定情】${msg}`];
  if (n.log.length > 40) n.log = n.log.slice(-40);
  return { next: n, msg };
}

export const _statLabel = STAT_LABELS;

