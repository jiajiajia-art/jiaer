import { affinityCapOf, partnerLocPerksFor, partnerPerksFor } from "../worlds/star2005/content";
import { apMax } from "./mud";
import { shopPrice } from "./factions";
import { randomName } from "./names";
import { looksTiers } from "./data";
import { activeGender } from "./worldRules";
import { rollFertility, tickPregnancy, type Pregnancy, type Child } from "./pregnancy";
import { FAMILY_NPC_IDS } from "./family";
import { orderMods, allowsMultiPartner, maxSpouses, sameSexBlocked, divorceMode, DIVORCE_AGREE_MAX, npcGenderOf } from "./worldRules";
import {
  BACKGROUNDS,
  DIRECTIONS,
  Gig,
  IDENTITIES,
  NPC_DIRECTIONS,
  NPC_NAME_POOL,
  NPC_PERSONALITIES,
  NPC_PREFS,
  billsFor,
  mealOf,
  MEALS,
  unlockLock,
  Option,
  PEOPLE as ROMANCE_PEOPLE,
  STATS_BASE,
  clampStat,
  TITLES,
  STAT_LABELS,
  STAT_ORDER,
  STYLES,
  StatKey,
  TRAININGS,
  WEEKEND_ACTS,
  ZODIACS,
  gradesOf,
  tuning,
  gigRules,
  RAW_CRASH_MODS,
  RAW_GIG_REPAIRS,
  RAW_GIG_MANAGERS,
  RAW_GIG_MANAGER_DEFAULT,
  typeHit,
  RAW_FAIL_FX,
  economy,
  bankruptLineFor,
  reqValue,
  RAW_GRADE_ODDS,
  SIDE_JOBS,
  startMoney,
  GRADE_LABEL,
  GRADE_MUL,
  type DayGrade,
} from "./data";
import { CALENDAR, NEGOTIATION, RELATIONS, TRAVEL, COMPANIES, MOVIE_TITLES, industryGen } from "../worlds/star2005/content";
import { applyIncome, applyGameRules, applyStorylines } from "./fixedEvents";
import { getWorldSlot, LIVE_GIGS, LIVE_PEOPLE, getWorldIncome, getWorldGameRules, getWorldStorylines, getWorldId, feature, getWorldStartMet, getWorldStartRoom, worldActivitiesOfRoom as activitiesOfRoom, worldItemsOfRoom as itemsOfRoom } from "../mods/registry";
import type { ProjectInstance, WorkPiece } from "./projects";
import type { RelExt } from "./relations";
import type { XianyuListing } from "./xianyu";
import { liveTerm as T, slot } from "../mods/live";
import { attrCap, wallet } from "./wallet";

export type Character = {
  name: string;
  styleId: string;
  identityId: string;
  backgroundId: string;
  directionId: string;
  traitIds?: string[]; // 旧存档遗留，已不再使用
  zodiacId?: string; // 星座（由出生月日推算，附带加成）
};

export type EventSnap = { room: string; bag: string[]; rel: Record<string, number>; turn: number; story: number };
export type GameState = {
  actUses?: Record<string, { week: number; n: number }>; // 自定义地点行动本周已执行次数（键 = 行动 id）
  cattrs?: Record<string, number>; // 自定义角色属性当前值（键=AttrDef.id）
  trainCounts?: Record<string, number>; // 课程各等级完成次数（键 = "课程id:等级id"），用于等级解锁
  char: Character;
  week: number; // 生涯第几周（恒 = careerWeekOf(day)，随日推进派生同步）
  day: number; // 生涯第几天（0 基，day 0 = calendar.startDate 周一）
  clockMin: number; // 当日时刻（0 基分钟，从内容池 dayStartMinute 起算；移动/活动令其流动）
  daySeg: number; // 保留字段（旧时段模型遗留，恒 0）；日程已改回周一~周日整周制
  stats: Record<StatKey, number>;
  styling: number; // 造型值 → 容貌构成
  looksBonus?: number; // 容貌永久加成（开局选项 fx.metrics.looks）
  fame: number;
  reputation: number; // 口碑 0-100
  stress: number; // 0-100
  blackFans: number;
  pr: number; // 公司公关
  money: number; // 元
  energy: number; // 行动力 0-100
  ap?: number; // 本回合剩余行动点（每次推进回满；缺省视为满）
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
  meal?: string | null; // 饮食生活：玩家选定的每周伙食 id（生活开销包；沿用到改为止，未选=默认档）
  offers: string[]; // gig ids on offer
  usedGigs: string[]; // 已接取/拍过的通告 id：结算后记入，之后不再出现在通告库与打听结果中
  rel: Record<string, number>; // 人物关系值（好感主轴）
  relations: Record<string, RelExt>; // 多维私人关系：心情/心动/私人信任 + 冷落衰减
  metPeople: string[]; // 已结识人物
  hero?: string; // 人物线路选中的预设主角（固定人物 id）：本局由玩家操控，不再作为 NPC 出现
  npcs: NPC[]; // 随机娱乐圈艺人
  companies: Company[]; // 经纪公司生态（开局生成，含声望数值）
  titles: string[]; // 已获得头衔 id
  equippedTitle: string | null; // 当前佩戴展示的头衔 id（可自由更换/摘下）
  safetyNetUsed: boolean; // 新人保底是否已用（只出现一次）
  trust: number; // 负责人信任 0~100
  defaults: number; // 违约记录累计
  bizValue: number; // 商业价值 0~999（品牌/商业线）
  arcStage: Record<string, number>; // 各攻略线已完成段数
  arcDay?: Record<string, number>; // 各攻略线最近一段发生在第几天（同一人一天只推进一段）
  dating: string | null; // 已确认交往对象 id（主恋人）
  spouses?: string[]; // 已举办婚礼的配偶 id
  partners?: string[]; // 世界规则允许多伴侣时，其余已确认关系的对象
  noRomance?: string[]; // 玩家在人物页设为「不可攻略」的人物 id（缺省 = 人人可攻略）
  familyRomance?: string[]; // 玩家手动设为「可攻略」的家人 id（家人缺省为亲情线）
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
  perkFired?: Record<string, { n: number; last: number; wk: number; wn: number }>; // 地点伴侣加成触发记录：总次数 / 上次天 / 所在周 / 本周次数
  eventsAt?: Record<string, string>; // 周期事件：上次上演所在的周期（同一周期只上演一次）
  eventsUnlocked?: string[]; // 已被前置固定事件「激活」的后续事件 id（供 locked 事件解锁）
  eventsActive?: string[]; // 进行中的事件 id：其设定每回合发给 AI，直到出现结束关键词（无结束词的只发当回合）
  flags?: Record<string, number>; // 规则变量：玩法规则 / 事件写入，供条件读取（未写过 = 0）
  modData?: Record<string, Record<string, number>>; // 功能 MOD 私有数据域：按 MOD id 分表，与 flags / 好感 / 原生状态隔离
  modAuth?: Record<string, "allow" | "deny">; // 本工程（存档）的 MOD 间授权记录；键见 mods/comm.ts authKey。不随 MOD 包走
  modSubPrio?: Record<string, number>; // 本工程调整过的订阅优先级（订阅键 → 数值，越小越先收到）
  audioQ?: import("../lib/types").AudioCmd[]; audioSeq?: number; // 待播放器执行的音频指令（按序号去重，不会重放）
  modEvents?: { mod: string; event: string; args?: Record<string, import("../mods/types").ModArg> }[]; // 本轮 MOD 广播、待原生触发器（modEvent）消费的事件
  evSnap?: EventSnap; // 事件触发快照：上次检查时的地点 / 物品 / 关系 / 回合，用来判定「进入、获得、变化、轮次」类触发
  evQueue?: string[]; // 已被触发、等待上演的事件 id（一次只上演一桩，其余排队）
  rulesFired?: Record<string, number>; // 玩法规则触发记录：规则 id → 最近触发的生涯天数
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
  relColdNoted?: Record<string, number>; // 冷落播报去重：人物 id → 已播报时的 lastContactDay
  crisesResolved: number; // 已处理危机数
  starBuzz: StarBuzz[]; // 圈内动态：同行之间每周演化的事件（引擎只存抽象类别+参与者+抽签，文案在内容池）
  lastCheck: WeekCheck | null; // 最近一次周日进账支票
  lastBill: WeekBill | null; // 最近一次账单明细（供「人物」页查看）
  gigDepositPaid: boolean; // 当前通告是否已发放签约定金（避免重复入账）
  checks: GigCheck[]; // 通告签约定金 / 拍毕尾款支票凭证（近期若干张，供「财务」查看）
  breachQueue?: BreachEvent[]; // 排队待了结的后续违约（breach 了结后依次顶上）
  breach: BreachEvent | null; // 逾期违约：制片人上门追责的对话事件（未了结前挂起）
  fertility?: number; // 隐藏世界数值「生育率」0~100（开局随机，常规界面不展示）
  pregnancy?: Pregnancy | null; // 孕期状态（known=false 时主角尚不知情）
  children?: Child[]; // 子女
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


// 生成 5~8 家公司 + 至少 count 名艺人，每家至少 minPerCompany 人；公司声望在基线上下浮动
function generateIndustry(count = 30, minPerCompany = 4): { companies: Company[]; npcs: NPC[] } {
  const g = industryGen();
  count = Math.max(1, Math.round(g.npcCount ?? count));
  minPerCompany = Math.max(0, Math.round(g.minPerCompany ?? minPerCompany));
  // 公司数量与内容池对齐（避免序号越界显示成「自由艺人」）；内容池为空时退回随机 5~8 家
  const companyCount = COMPANIES.length > 0 ? COMPANIES.length : rng(5, 8);
  const companies: Company[] = Array.from({ length: companyCount }, (_, i) => ({
    id: `co_${i}`,
    prestige: COMPANIES[i]?.prestige != null ? clamp(COMPANIES[i].prestige + rng(-6, 6), 5, 99) : clamp(rng(30, 88) - i * 3, 15, 95),
  }));
  const total = Math.max(count, companyCount * minPerCompany);
  const names = [...NPC_NAME_POOL].sort(() => Math.random() - 0.5);
  const usedNames = new Set<string>();
  // 先按最小配额铺满每家公司，其余随机分配
  const assign: string[] = [];
  for (const c of companies) for (let k = 0; k < minPerCompany; k++) assign.push(c.id);
  for (let k = assign.length; k < total; k++) assign.push(companies[rng(0, companyCount - 1)].id);
  assign.sort(() => Math.random() - 0.5);

  const MOVIE_COUNT = Math.max(1, MOVIE_TITLES.length);
  const startYear = Number(/^(\d{4})/.exec(String(CALENDAR.startDate ?? ""))?.[1]) || 2005;
  const baseYear = g.debutBaseYear ?? startYear;
  const span = Math.max(0, g.debutSpan ?? 8);
  const [sMin, sMax] = [g.statMin ?? 80, g.statMax ?? 520];
  const [fMin, fMax] = [g.fameMin ?? 20, g.fameMax ?? 180];
  const npcs: NPC[] = Array.from({ length: total }, (_, i) => {
    const stats = {} as Record<StatKey, number>;
    for (const k of STAT_ORDER) stats[k] = rng(sMin, Math.max(sMin, sMax));
    const co = companies.find((c) => c.id === assign[i])!;
    const debutYear = baseYear - rng(0, span);
    const workN = rng(1, 3);
    const works = Array.from({ length: workN }, () => rng(0, MOVIE_COUNT - 1));
  return {
      id: `npc_${i}`,
      ...npcNameGender(names, usedNames),
      dir: NPC_DIRECTIONS[rng(0, NPC_DIRECTIONS.length - 1)],
      personality: NPC_PERSONALITIES[rng(0, NPC_PERSONALITIES.length - 1)],
      pref: NPC_PREFS[rng(0, NPC_PREFS.length - 1)],
      // 声望越高的公司，艺人起点名气越高
      fame: clamp(rng(fMin, Math.max(fMin, fMax)) + Math.round(co.prestige * 0.8), 10, 320),
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
    if (Math.random() > (g.coupleRate ?? 0.42)) continue;
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

/* NPC 性别先定，再按性别取名：女性优先用世界观精选名池，用尽或男性则走分性别字库 */
function npcNameGender(curated: string[], used: Set<string>): { name: string; gender: string } {
  const gender = Math.random() < 0.7 ? "女" : "男";
  if (gender === "女") {
    const n = curated.find((x) => !used.has(x));
    if (n) { used.add(n); return { name: n, gender }; }
  }
  return { name: randomName(gender, "modern", used), gender };
}

function findOpt(list: Option[], id: string) {
  return list.find((o) => o.id === id);
}

import { computeLooks } from "./looks";
export { computeLooks }; // 纯函数已拆到无依赖的叶子模块，避免 content ↔ logic 运行时循环引用

export function looksTier(v: number) {
  const t = [...looksTiers()].sort((a, b) => a.min - b.min);
  return ([...t].reverse().find((x) => v >= x.min) ?? t[0]).label;
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
  let money = startMoney(); // 开局资金固定（模组槽 startMoney，娱乐圈=5000），不随出身/星座浮动
  let pr = 100;
  let blackFans = 1;

  // 建角选项（外形 / 身份 / 家庭 / 方向 / 星座）只是文字设定；开局数值由作者在选项 fx 里配置，经 StartOpts.fx 统一结算
  for (const k of STAT_ORDER) stats[k] = clampStat(k, stats[k]);

  return {
    char,
    week: careerWeekOf(0),
    day: 0,
    clockMin: startClockMin(),
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
    rel: Object.fromEntries(relRoster().map((p) => [p.id, p.init])),
    relations: Object.fromEntries(relRoster().map((p) => [p.id, { mood: RELATIONS.mood.init, romantic: 0, trust: RELATIONS.trust.init, lastContactDay: 0 }])),
    // 开局只认识自己的经纪人林宜（娱乐圈）；其余人的 init 只是潜在好感底子，得真正碰面结识后才进人脉
    metPeople: [...getWorldStartMet()],
    ...(() => { const g = generateIndustry(30, 4); return { npcs: g.npcs, companies: g.companies }; })(),
    titles: [],
    equippedTitle: null,
    safetyNetUsed: false,
    trust: 10,
    defaults: 0,
    bizValue: 40,
    arcStage: {},
    dating: null,
    room: getWorldStartRoom(),
    visited: [getWorldStartRoom()],
    discoveredAt: { [getWorldStartRoom()]: 0 },
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
    fertility: rollFertility(),
    pregnancy: null,
    children: [],
    log: ["第 1 周 · 你搬进了天光小区，出道倒计时 104 周正式开始。"],
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
  return LIVE_GIGS.filter(
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
  const pool = LIVE_GIGS.filter(
    (g) => g.fameReq <= fame + 120 && catPublishesOn(gigCategory(g), week),
  );
  return pool.slice(0, 5).map((g) => g.id);
}

const rand = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** 内置娱乐圈世界才回落引擎原表；其它作品未写则不套用娱乐圈人名/地点 */
const entGigFallback = <T,>(authored: T | undefined, raw: T): T => (getWorldId() === "ent" ? (authored ?? raw) : (authored ?? ([] as unknown as T)));

// 9. 资源负责人：通告类型 → 负责人与地点
export function gigManager(g: Gig): { name: string; loc: string } {
  // 对接表由世界观 tuning.gigRules.managers 配置；非娱乐圈且未写 = 通用占位
  const gr = gigRules();
  const table = entGigFallback(gr.managers, RAW_GIG_MANAGERS);
  const m = (Array.isArray(table) ? table : []).find((x) => typeHit(g.type, x.types));
  const def = getWorldId() === "ent" ? (gr.managerDefault ?? RAW_GIG_MANAGER_DEFAULT) : (gr.managerDefault ?? { name: "对接人", loc: "约定地点" });
  return m ? { name: m.name, loc: m.loc } : def;
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
  const br = gigRules();
  const breachMod = s.defaults * (typeHit(g.type, br.breachHiTypes ?? "广告|品牌|电影") ? (br.breachHi ?? 14) : (br.breachBase ?? 8)); // 违约惩罚由 tuning.gigRules 配置；缺省 广告/品牌/电影 14，其余 8
  const titleMod = Math.min(6, s.titles.length * 2); // 拥有头衔提升该类型通告成功率
  const standbyMod = s.standby?.[g.id] ?? 0; // 候补资格：上次交涉留下的加成
  const rate = 55 + margin * 0.12 + fameMod + repMod + trustMod + titleMod + standbyMod - stressMod - breachMod;
  return clamp(Math.round(rate), 15, 96);
}

// 9.1 与负责人交涉：成功锁定档期，失败损失体力/压力/好感，先到先得可能被 NPC 抢走
export function negotiateGig(s: GameState, gigId: string): { next: GameState; ok: boolean; msg: string } {
  if (!feature("career")) return { next: s, ok: false, msg: `本局未启用「演艺事业包」，没有${T("gig")}可接。` };
  const g = LIVE_GIGS.find((x) => x.id === gigId);
  if (!g) return { next: s, ok: false, msg: "" };
  if (s.activeGigId) return { next: s, ok: false, msg: `你已有${T("gig")}在身，档期冲突。` };
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
  if (Math.random() < N.snatchChance) { n.offers = n.offers.filter((x) => x !== g.id); msg += ` 该${T("gig")}被同期艺人抢走了。`; }
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

/* 推进结果档位掷骰：受自信（利好）与压力（不利）牵引。非娱乐圈且未写概率 = 固定「成功」。 */
export function rollGrade(s: GameState): DayGrade {
  const tu = tuning();
  if (getWorldId() !== "ent" && !tu.gradeOdds) return "success";
  const odds = { ...RAW_GRADE_ODDS, ...(tu.gradeOdds ?? {}) };
  const order: DayGrade[] = ["perfect", "great", "success", "fail", "bad"];
  const total = order.reduce((a, k) => a + Math.max(0, odds[k]), 0) || 100;
  const luckDiv = tu.luckDiv ?? (getWorldId() === "ent" ? 40 : 0);
  const stressDiv = tu.stressDiv ?? (getWorldId() === "ent" ? 3 : 0);
  const luck = luckDiv > 0 ? reqValue(s, tu.luckStat ?? "stat:zixin") / luckDiv : 0;
  const drag = stressDiv > 0 ? s.stress / stressDiv : 0;
  // 掷 0~100：属性越高越靠前（好评级），压力越大越靠后
  const r = Math.random() * 100 - (luck - drag);
  let acc = 0;
  for (const k of order) { acc += (Math.max(0, odds[k]) / total) * 100; if (r < acc) return k; }
  return "bad";
}

export type ActResult = { grade: DayGrade | null; actLabel: string; gains: string[] };

// 单件日程活动的即时结算：推进「一天」时对当天安排的一件事应用效果，并掷出完美/大成功/成功/失败/糟糕。
// 休息/外出社交为确定性效果（不掷档位，grade=null）；训练/打工/拍摄按掷出的档位调整收益。
// 无通告体系的世界观（如校园）：名气/口碑没有通告来源，改由日常表现出彩时小幅积累，保证头衔与结局可达
function noGigFame(n: GameState, grade: DayGrade, gains: string[]) {
  if (LIVE_GIGS.length > 0) return;
  // 主要名气来源交给模组内容（校园社团活动 / 学年大事），这里只是日常出彩的小幅积累
  if (grade === "perfect") { n.fame += 2; n.reputation = clamp(n.reputation + 1, 0, 100); gains.push(`表现亮眼 · ${T("fame", "名气")} +2 · 口碑 +1`); }
  else if (grade === "great") { n.fame += 1; gains.push(`小有表现 · ${T("fame", "名气")} +1`); }
}

export function applyAct(n: GameState, act: string | null, deltas: string[]): ActResult {
  const p = parseAct(act);

  if (p.kind === "rest") {
    const rs = tuning().restStress ?? 8;
    n.stress = clamp(n.stress - rs, 0, 100);
    return { grade: null, actLabel: "休息", gains: [`压力 ${rs >= 0 ? "-" : "+"}${Math.abs(rs)}`] };
  }

  if (p.kind === "weekend") {
    const w = WEEKEND_ACTS.find((x) => x.id === p.weekendId)!;
    bumpCount(n, `wk:${w.id}`);
    const wc = w.cost;
    if (!canPay(n, wc)) return { grade: null, actLabel: w.name, gains: [shortOf(n, wc, w.name)] };
    wallet.addIn(n, -(wc));
    n.stress = clamp(n.stress + w.stress, 0, 100);
    if (w.trust) n.trust = clamp(n.trust + w.trust, 0, 100);
    if (w.fame) n.fame += w.fame;
    if (w.reputation) n.reputation = clamp(n.reputation + w.reputation, 0, 100);
    const wg = [w.effect];
    applyCgain(n, w.cgain, 1, wg);
    return { grade: null, actLabel: w.name, gains: wg };
  }

  if (p.kind === "gig") {
    if (!n.activeGigId || n.gigDaysLeft <= 0 || n.gigMisses >= 3) return { grade: null, actLabel: `拍摄${T("gig")}`, gains: [`今日无可拍摄的${T("gig")}`] };
    // 未到开机周（重点通告档期锁死）：不能提前开拍
    if (n.gigStartWeek > 0 && n.week < n.gigStartWeek) {
      return { grade: null, actLabel: `拍摄${T("gig")}`, gains: [`该${T("gig")}第 ${n.gigStartWeek} 周才开机，尚未进组`] };
    }
    const g = LIVE_GIGS.find((x) => x.id === n.activeGigId)!;
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
    bumpCount(n, `work:${j.id}`);
    const grade = rollGrade(n);
    const pay = Math.max(0, Math.round(j.pay * GRADE_MUL[grade] * (tuning().jobPayMul ?? 1)));
    wallet.addIn(n, pay);
    n.stress = clamp(n.stress + j.stress + (grade === "fail" || grade === "bad" ? 3 : 0), 0, 100);
    const gains = pay > 0 ? [`进账 ${wallet.fmt(pay)}`] : ["白忙一场，没挣到钱"];
    noGigFame(n, grade, gains);
    applyCgain(n, j.cgain, GRADE_MUL[grade], gains);
    return { grade, actLabel: j.label, gains };
  }

  if (p.kind === "train") {
    const t = TRAININGS.find((x) => x.id === p.trainId);
    if (!t) return { grade: null, actLabel: "才艺课程", gains: [] };
    const grs = gradesOf(t);
    const gr = grs.find((x) => x.id === p.gradeId) ?? grs[0];
    const fee = Math.round(t.cost * gr.costMul * (tuning().trainFeeMul ?? 1));
    if (!canPay(n, fee)) return { grade: null, actLabel: `${t.name}·${gr.label}`, gains: [shortOf(n, fee, "学费")] };
    bumpCount(n, `${t.id}:${gr.id}`);
    wallet.addIn(n, -(fee));
    const grade = rollGrade(n);
    n.stress = clamp(n.stress + t.stress + gr.stressAdd, 0, 100);
    const mul = GRADE_MUL[grade] * (tuning().trainGainMul ?? 1);
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
      if (gain > 0) { n.stats[k] = clampStat(k, cur + gain); gains.push(`${STAT_LABELS[k]} +${gain}`); }
      else gains.push(`${STAT_LABELS[k]} 已近${gr.label}瓶颈`);
    }
    // 自定义属性收益：与八维同样受课程档位 / 状态倍率影响，按属性自身上下限截断
    applyCgain(n, t.cgain, gr.gainMul * mul, gains);
    // 模组可为课程/活动声明名气、口碑收益（如校园社团活动）：完美档位额外 +1
    if (t.fame) { const f = t.fame + (grade === "perfect" ? 1 : 0); n.fame += f; gains.push(`${T("fame", "名气")} +${f}`); }
    if (t.reputation) { const r = t.reputation; n.reputation = clamp(n.reputation + r, 0, 100); gains.push(`口碑 +${r}`); }
    noGigFame(n, grade, gains);
    return { grade, actLabel: `${t.name}·${gr.label}`, gains };
  }

  return { grade: null, actLabel: "无安排", gains: [] };
}

// 周结算：跨过周日翻页时触发的经济/通告/生态结算（日程活动已在各时段逐段落地，这里不再重排日程）。
// customTimeLimit：若玩家/模组自定义了主线时限（如 3 年 = 1095 天），则不再按默认 104 周（2 年）提前强制落幕，交由 advanceDay 的 limitDay 判定。
export function settleWeek(s: GameState, customTimeLimit = false): WeekResult {
  const n: GameState = {
    ...s,
    stats: { ...s.stats },
    npcs: s.npcs.map((x) => ({ ...x, stats: { ...x.stats } })),
    titles: [...s.titles],
    log: [...s.log],
  };
  const deltas: string[] = [];
  let earned = 0; // 本周演艺进账（gig 报酬合计，用于周日支票）

  // 周日：为下周一开机、尚未支付定金的通告发放签约定金支票（片酬 30%）
  if (n.activeGigId && !n.gigDepositPaid && n.gigStartWeek === n.week + 1) {
    const dg = LIVE_GIGS.find((x) => x.id === n.activeGigId);
    if (dg) {
      const mgr = gigManager(dg);
      const deposit = Math.round(dg.pay * 0.3 * (n.activeGigMods?.payMul ?? 1));
      wallet.addIn(n, deposit);
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
      deltas.push(`收到《${dg.name}》签约定金支票 ${wallet.fmt(deposit)}（下周一开机，须于第 ${n.gigDeadlineWeek} 周前拍完）`);
    }
  }

  const terminated = !!n.activeGigId && n.gigMisses >= 3; // 3 层失误撤换
  // 超期撤换：越过截止周仍未拍完约定天数，剧组换人
  const expired = !!n.activeGigId && n.gigDaysLeft > 0 && n.gigDeadlineWeek > 0 && n.week >= n.gigDeadlineWeek;
  // 通告完成判定
  if (n.activeGigId && (n.gigDaysLeft <= 0 || terminated || expired)) {
    const g = LIVE_GIGS.find((x) => x.id === n.activeGigId)!;
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
    const perks = partnerPerksFor((pid) => hasPartner(n, pid), g).filter((p) => perkWhenOk(s, p)); // 恋人加成（世界观 relations.partnerPerks 配置；when 条件与地点加成同一套）
    for (const p of perks) rate += p.rate ?? 0;
    rate += orderMods().rate; // 世界规则·社会秩序
    rate = clamp(rate, 5, 98);

    // 崩溃判定：规则由世界观 tuning.gigRules 配置；非娱乐圈未写则不崩溃
    const gr = gigRules();
    const ent = getWorldId() === "ent";
    const crashOn = ent ? gr.crashOn !== false : gr.crashOn === true;
    let crashChance = 0;
    if (crashOn && n.stress >= (gr.crashStress ?? (ent ? 90 : Number.POSITIVE_INFINITY))) {
      crashChance = gr.crashBase ?? (ent ? 20 : 0);
      for (const m of (gr.crashMods ?? (ent ? RAW_CRASH_MODS : []))) {
        const v = perkRead(n, m.key, m.pid ?? "");
        if (m.op === "<=" ? v <= m.value : v >= m.value) crashChance += m.delta;
      }
      crashChance = Math.max(gr.crashMin ?? (ent ? 5 : 0), crashChance);
    }
    const crashed = crashChance > 0 && Math.random() * 100 < crashChance;

    const roll = Math.random() * 100;
    // 交涉结果修正（低价出演压报酬、角色降级压名气）——正式接取时均为 1
    const negPayMul = n.activeGigMods?.payMul ?? 1;
    const negFameMul = n.activeGigMods?.fameMul ?? 1;
    const fameMul = negFameMul;
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
      wallet.addIn(n, pay); earned += pay; finalPay = pay;
      n.fame += gain;
      n.reputation += rand(2, 6);
      n.trust = clamp(n.trust + 8, 0, 100);
      n.works += 1;
      if (g.star >= 4) { n.awards += 1; deltas.push(`《${g.name}》斩获一项大奖`); }
      for (const k of STAT_ORDER) if (g.grow[k]) n.stats[k] = clampStat(k, n.stats[k] + Math.round(g.grow[k]! * 1.2));
      deltas.push(`完美完成《${g.name}》：名气 +${gain}，报酬 ${wallet.short(g.pay * 1.2)}，负责人信任 +8`);
    } else if (status === "smooth") {
      const gain = Math.round(g.fame * fameMul);
      const pay = Math.round(g.pay * payCap);
      wallet.addIn(n, pay); earned += pay; finalPay = pay;
      n.fame += gain;
      n.reputation += rand(0, 3);
      n.trust = clamp(n.trust + 4, 0, 100);
      n.works += 1;
      for (const k of STAT_ORDER) if (g.grow[k]) n.stats[k] = clampStat(k, n.stats[k] + g.grow[k]!);
      deltas.push(`顺利完成《${g.name}》：名气 +${gain}，报酬 ${wallet.short(g.pay)}`);
    } else if (status === "barely") {
      const gain = Math.round(g.fame * 0.5 * fameMul);
      const pay = Math.round(g.pay * 0.6 * payCap);
      wallet.addIn(n, pay); earned += pay; finalPay = pay;
      n.fame += gain;
      n.reputation -= rand(1, 2);
      n.trust = clamp(n.trust - 3, 0, 100);
      n.stress += 6;
      n.works += 1;
      for (const k of STAT_ORDER) if (g.grow[k]) n.stats[k] = clampStat(k, n.stats[k] + Math.round(g.grow[k]! * 0.5));
      deltas.push(`勉强完成《${g.name}》：作品扑街，报酬 60%，负责人信任 -3`);
    } else {
      // 失败惩罚由 tuning.gigRules 配置；缺省 = 名气 -5~40、口碑 -3~8、信任 -10、违约 +1、压力 +6、黑粉 +1~3、相关能力 -1~4
      const pay = Math.round(g.pay * (rand(0, Math.max(0, gr.failPayMax ?? 30)) / 100));
      wallet.addIn(n, pay); earned += pay;
      const failNotes: string[] = [];
      for (const x of (gr.failFx ?? (ent ? RAW_FAIL_FX : []))) {
        const d = rand(Math.min(x.min, x.max), Math.max(x.min, x.max));
        if (!d) continue;
        if (x.key === "money") wallet.addIn(n, d); else perkWrite(n, x.key, "", d);
        failNotes.push(`${perkFxName(x.key)} ${d > 0 ? "+" : ""}${d}`);
      }
      const lossPair = gr.failStatLoss ?? (ent ? [1, 4] as const : null);
      if (lossPair) {
        const [sl0, sl1] = lossPair;
        for (const k of STAT_ORDER) if (g.grow[k]) { const d = rand(Math.min(sl0, sl1), Math.max(sl0, sl1)); if (d) n.stats[k] = clampStat(k, n.stats[k] - d); }
      }
      deltas.push(`${expired ? "超过截止日未拍完被撤换，" : terminated ? "累计失误被撤换，" : crashed ? "状态失控，" : ""}《${g.name}》拍摄失败：无作品${failNotes.length ? `，${failNotes.join("，")}` : ""}`);
      // 失败修复与反转机会（同周一次，随机 1 项）；非娱乐圈未写补救 = 不触发
      const condOk = (c: { key: string; pid?: string; op: string; value: number }) => { const v = perkRead(n, c.key, c.pid ?? ""); return c.op === "<=" ? v <= c.value : v >= c.value; };
      const repairs = (gr.repairs ?? (ent ? RAW_GIG_REPAIRS : []))
        .filter((r) => (r.maxStar == null || g.star <= r.maxStar) && (!r.conds?.length || (r.any ? r.conds.some(condOk) : r.conds.every(condOk))))
        .map((r) => ({ name: r.name, apply: () => { for (const x of r.fx) { const lo = Math.min(x.min, x.max), hi = Math.max(x.min, x.max); const d = rand(lo, hi); if (!d) continue; if (x.key === "money") wallet.addIn(n, d); else perkWrite(n, x.key, "", d); } } }));
      if (repairs.length) {
        const r = repairs[rand(0, repairs.length - 1)];
        r.apply();
        deltas.push(`触发修复机会「${r.name}」，帮你稳住了局面`);
      }
    }
    // 商业价值成长：非娱乐圈须显式开启；娱乐圈缺省广告/综艺/品牌
    const bizOn = ent ? gr.bizOn !== false : gr.bizOn === true;
    if (bizOn && typeHit(g.type, gr.bizTypes ?? (ent ? "广告|综艺|品牌" : "")) && (status === "perfect" || status === "smooth")) {
      const lo = gr.bizMin ?? 4, hi = Math.max(lo, gr.bizMax ?? 9);
      let bg = rand(lo, hi);
      for (const p of perks) if (p.bizMult) bg = Math.round(bg * p.bizMult);
      const key = gr.bizKey || "bizValue";
      if (key === "bizValue") n.bizValue = clamp(n.bizValue + bg, 0, 999);
      else perkWrite(n, key, "", bg);
    }
    // 资本同盟：结算额外资金加成
    if (status === "perfect" || status === "smooth") for (const p of perks) if (p.payBonus) { const b = Math.round(g.pay * p.payBonus); wallet.addIn(n, b); earned += b; }
    // 恋人加成 · 通用数值增减（fx：本世界观任意属性），工作成功才生效
    if (status !== "fail") for (const p of perks) {
      const fx = perkFxList(p);
      if (!fx.length) continue;
      for (const x of fx) perkWrite(n, x.key, p.pid, x.delta);
      const k = perkKey(p), r = n.perkFired?.[k];
      n.perkFired = { ...n.perkFired, [k]: { n: (r?.n ?? 0) + 1, last: n.day, wk: n.week, wn: r && r.wk === n.week ? r.wn + 1 : 1 } };
      deltas.push(`${p.label || "恋人加成"}：${fx.map((x) => `${perkFxName(x.key)} ${x.delta > 0 ? "+" : ""}${x.delta}`).join("，")}`);
    }
    // 世界规则·社会秩序：片酬修正
    { const om = orderMods().pay; if (om && finalPay > 0) { const b = Math.round(finalPay * om); wallet.addIn(n, b); earned += b; } }
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
      const be: BreachEvent = { gigName: g.name, producer: mgr.name, loc: mgr.loc, gigType: g.type, fee };
      if (n.breach) n.breachQueue = [...(n.breachQueue ?? []), be];
      else n.breach = be;
      deltas.push(`《${g.name}》${expired ? "逾期未拍完" : "累计失误被撤换"}——${mgr.name}要上门追责了（违约金约 ${wallet.fmt(fee)}）`);
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
  } else if (!n.activeGigId && n.fame > 0 && LIVE_GIGS.length > 0) {
    n.fame = Math.max(0, n.fame - rand(0, 3));
  }

  // 截止前预警：下周即截止仍未拍完，提前告知（避免逾期违约毫无征兆）
  if (n.activeGigId && n.gigDaysLeft > 0 && n.gigDeadlineWeek > 0 && n.week + 1 === n.gigDeadlineWeek) {
    const wg = LIVE_GIGS.find((x) => x.id === n.activeGigId);
    deltas.push(`⚠《${wg?.name ?? `当前${T("gig")}`}》下周（第 ${n.gigDeadlineWeek} 周）截止，还差 ${n.gigDaysLeft} 天拍摄——请在日程里排满「拍摄」，否则将被追责违约`);
  }

  // 固定收支（本周明细逐项列账，供「账单」HTML 呈现）
  const monthEnd = n.week % 4 === 0;
  // 账单条目来自模组槽 bills，按本周名气取档（娱乐圈：新人普通开销 → 越红开销越高）
  const bills = billsFor(n.fame);
  const billLines: { label: string; amount: number }[] = [
    ...(bills.weekly ?? []).map((b) => ({ label: b.label, amount: b.amount })),
    ...(monthEnd ? (bills.monthly ?? []).map((b) => ({ label: b.label, amount: b.amount })) : []),
  ];
  // 本周伙食（生活开销包）：钱不够或已不满足门槛 → 当周降到付得起的最便宜一档；效果随伙食结算
  let meal = mealOf(n.meal);
  if (meal) {
    const ok = (m: typeof meal) => !!m && !unlockLock(n, m.reqs, (x) => x);
    if (!ok(meal) || !wallet.can(n, meal.cost)) {
      const fallback = [...MEALS].filter((m) => ok(m) && m.cost <= Math.max(0, wallet.balance(n))).sort((a, b) => b.cost - a.cost)[0]
        ?? [...MEALS].filter((m) => ok(m)).sort((a, b) => a.cost - b.cost)[0];
      if (fallback && fallback.id !== meal.id) deltas.push(`钱不够吃「${meal.name}」，这周只能改吃「${fallback.name}」`);
      meal = fallback ?? meal;
    }
    billLines.push({ label: `伙食 · ${meal.name}`, amount: meal.cost });
    if (meal.stress) n.stress = clamp(n.stress + meal.stress, 0, 100);
    for (const [k, v] of Object.entries(meal.gain ?? {})) if (v && k in n.stats) n.stats[k as StatKey] = clampStat(k as StatKey, n.stats[k as StatKey] + v);
    if (meal.styling) n.styling = clamp(n.styling + meal.styling, 0, 999);
  }
  const eco = economy();
  const grace = (eco.graceWeeks ?? 0) > 0 && n.week <= (eco.graceWeeks ?? 0);
  if (grace) { const mul = eco.graceBillMul ?? 0.5; for (const l of billLines) l.amount = Math.round(l.amount * mul); }
  const cost = billLines.reduce((a, b) => a + b.amount, 0);
  wallet.addIn(n, -(cost)); // 被动扣费：允许透支
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
  if (getWorldId() === "ent" && feature("career") && !n.safetyNetUsed && n.week <= 8 && n.fame < 30) {
    n.fame = 35;
    n.safetyNetUsed = true;
    deltas.push("启星事务所安排了一次「临时替补」，名气保底提升至 35");
  }

  // 数值封顶（公司公关 0~500、黑粉 0~999）
  n.pr = clamp(n.pr, 0, 500);
  n.blackFans = clamp(n.blackFans, 0, 999);

  // 破产：阈值按本世界周开销（住行 + 伙食）缩放（娱乐圈 ≈ -50 万；校园等小额世界相应收紧），负债期间每周预警
  // 没有任何生活开销的世界按每周 ¥1,000 折算（≈ ¥2.8 万），只有违约金 / 事件扣费会让人透支
  const weeklyBase = Math.max(0, (bills.weekly ?? []).reduce((a, b) => a + b.amount, 0) + (meal?.cost ?? 0)) || 1000;
  const bankruptLine = bankruptLineFor(weeklyBase, eco);
  const moneyWord = "资金";
  if (eco.bankrupt !== false && wallet.balance(n) < bankruptLine) {
    n.log.push(`【第 ${s.week} 周】${moneyWord}透支超过 ${wallet.fmt(-bankruptLine)}，债主找上门来……`);
    return { next: n, ended: "bankrupt", headline: "破产危机", check, bill };
  }
  if (wallet.balance(n) < 0) {
    const os = eco.overdraftStress ?? 4;
    n.stress = clamp(n.stress + os, 0, 100);
    deltas.push(`⚠ ${moneyWord}已透支 ${wallet.fmt(-wallet.balance(n))}（压力 +${os}）${eco.bankrupt !== false ? `，透支超过 ${wallet.fmt(-bankruptLine)} 即告破产` : ""}——多安排打工/接活回血`);
  }

  // NPC 生态：竞争者持续成长——八维缓慢精进，并靠接取通告涨名气
  // 玩家本周未去查看/接取通告（offersViewedWeek 为 0）时，同行更凶，抢走的资源更多
  const rivalsHungry = s.offersViewedWeek === 0;
  for (const npc of n.npcs) {
    for (const k of STAT_ORDER) npc.stats[k] = clamp(npc.stats[k] + rand(0, 3), 0, 999);
    const took = Math.random() < (rivalsHungry ? 0.55 : 0.35); // 接到通告
    npc.fame = clamp(npc.fame + rand(-2, 5) + (took ? rand(2, 10) : 0), 0, 1000);
  }
  if (rivalsHungry && feature("career")) deltas.push(`你本周没盯${T("gig")}，几个同行把资源接走了`);

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
    // 月榜只属于有行业榜单的世界观（娱乐圈）；其他世界观不出现「月榜第 N 名」
    const rank = feature("industryTab") ? leaderboard(n).findIndex((r) => r.isPlayer) + 1 : 0;
    if (!rank) { /* 非演艺世界观：无月榜 */ }
    else if (rank === 1) { n.fame += 30; deltas.push(`月榜第 1 名，名气 +30`); }
    else if (rank <= 3) { n.fame += 15; deltas.push(`月榜第 ${rank} 名，名气 +15`); }
    else if (rank <= 10) { n.fame += 5; deltas.push(`月榜第 ${rank} 名，名气 +5`); }
    else deltas.push(`月榜第 ${rank} 名，需要更多曝光`);

    // 逐年成长：随生涯阅历推进，几项「靠时间沉淀」的能力每月自然小幅精进
    const mature: StatKey[] = ["tineng", "caizhi", "yitai", "zixin"];
    for (const k of mature) n.stats[k] = clampStat(k, n.stats[k] + rand(1, 3));
    deltas.push(`阅历渐长：${mature.map((k) => STAT_LABELS[k]).join("·")}各有沉淀`);
  }

  // 周期收入（模组「周期收入」规则）：每周结算发放
  { const inc = applyIncome(n, getWorldIncome()); Object.assign(n, inc.next); deltas.push(...inc.changes); }
  // 玩法规则（模组「玩法规则」· 每周结算）
  { const gr = applyGameRules(n, "week", getWorldGameRules()); Object.assign(n, gr.next); deltas.push(...gr.changes); }

  n.fame = clamp(Math.round(n.fame), 0, 1000); // 名气上限 1000

  n.week += 1;
  // 新的一周档期清空：通告需重新到对应地点找制作人/制片人当面打听
  n.offers = [];
  n.offersViewedWeek = 0;

  const summary = deltas.length ? deltas.join("；") : "平稳的一周，继续打磨自己。";
  n.log.push(`【第 ${s.week} 周结算】${summary}`);
  if (n.log.length > 40) n.log = n.log.slice(-40);

  const maxWeeks = CALENDAR.careerWeeks || 104;
  if (!customTimeLimit && maxWeeks > 0 && n.week > maxWeeks) {
    return { next: n, ended: "finish", headline: "生涯期满落幕", check, bill };
  }
  return { next: n, ended: null, headline: summary, check, bill };
}

// 地图踩点：推进关系与线索
/** 地点触发的伴侣加成：数值已由引擎结算，effects 是可读的结算明细，seed 交给 AI 演绎（未接 AI 时并入 msg） */
/** 伴侣加成的附加条件（relations.partnerPerks[].when，编辑器可配；不填的项不限制） */
function perkWhenOk(s: GameState, p: { id?: string; pid: string; loc?: string; label?: string; when?: import("../worlds/star2005/content").PerkWhen }): boolean {
  const w = p.when;
  if (!w) return true;
  for (const r of w.req ?? []) {
    if (!r?.key) continue;
    const v = perkRead(s, r.key, p.pid);
    if (r.op === "<=" ? v > r.value : v < r.value) return false;
  }
  if (w.minWeek != null && s.week < w.minWeek) return false;
  if (w.minFame != null && s.fame < w.minFame) return false;
  if (w.minReputation != null && s.reputation < w.minReputation) return false;
  if (w.minLooks != null && computeLooks(s) < w.minLooks) return false;
  if (w.maxBlackFans != null && (s.blackFans ?? 0) > w.maxBlackFans) return false;
  if (w.minAffinity != null && (s.rel?.[p.pid] ?? 0) < w.minAffinity) return false;
  if (w.maxStress != null && s.stress > w.maxStress) return false;
  // 次数类限制：读存档里的触发记录
  const rec = s.perkFired?.[perkKey(p)];
  if (w.maxTimes != null && (rec?.n ?? 0) >= w.maxTimes) return false;
  if (w.cooldownDays != null && rec && s.day - rec.last < w.cooldownDays) return false;
  if (w.perWeek != null && rec && rec.wk === s.week && rec.wn >= w.perWeek) return false;
  if (w.chance != null && Math.random() * 100 >= w.chance) return false;
  return true;
}
/** 读取通用属性键（见 content.ts PerkReq 说明） */
export function perkRead(s: GameState, key: string, pid: string): number {
  if (key.startsWith("stat:")) return (s.stats as Record<string, number>)[key.slice(5)] ?? 0;
  if (key.startsWith("attr:")) return s.cattrs?.[key.slice(5)] ?? 0;
  switch (key) {
    case "affinity": return s.rel?.[pid] ?? 0;
    case "looks": return computeLooks(s);
    case "week": return s.week;
    default: { const v = (s as unknown as Record<string, unknown>)[key]; return typeof v === "number" ? v : 0; }
  }
}
/** 写入通用属性键（就地修改 n；n 须是本次结算的新副本） */
function perkWrite(n: GameState, key: string, pid: string, delta: number) {
  if (key.startsWith("stat:")) { const k = key.slice(5) as StatKey; if (k in n.stats) n.stats = { ...n.stats, [k]: clampStat(k, n.stats[k] + delta) }; return; }
  if (key.startsWith("attr:")) { const k = key.slice(5); n.cattrs = { ...n.cattrs, [k]: Math.max(0, (n.cattrs?.[k] ?? 0) + delta) }; return; }
  if (key === "affinity") { n.rel = { ...n.rel, [pid]: clamp((n.rel?.[pid] ?? 0) + delta, 0, affinityCapOf(pid)) }; return; }
  if (key === "looks" || key === "week") return; // 派生 / 只读
  const o = n as unknown as Record<string, unknown>;
  if (typeof o[key] !== "number") return;
  const pct = key === "stress" || key === "reputation" || key === "trust"; // 百分制项
  o[key] = pct ? clamp((o[key] as number) + delta, 0, 100) : Math.max(0, (o[key] as number) + delta);
}
/** 一条加成的全部数值增减：新写法 fx + 旧字段兼容 */
export function perkFxList(p: { fx?: { key: string; delta: number }[]; stress?: number; reputation?: number; fame?: number; affinity?: number }) {
  const out = (p.fx ?? []).filter((x) => x?.key && x.delta);
  for (const k of ["stress", "reputation", "fame", "affinity"] as const) if (p[k] && !out.some((x) => x.key === k)) out.push({ key: k, delta: p[k]! });
  return out;
}
/** 属性键的显示名（引擎内用；编辑器 / AI 说明用 perkKeys.ts） */
function perkFxName(key: string): string {
  if (key.startsWith("stat:")) return (STAT_LABELS as Record<string, string>)[key.slice(5)] ?? key.slice(5);
  if (key.startsWith("attr:")) { const id = key.slice(5); return (getWorldSlot("customAttrs") ?? []).find((a) => a.id === id)?.label ?? id; }
  const base: Record<string, string> = { affinity: "好感", stress: "压力", energy: "行动力", fame: T("fame", "名气"), reputation: T("reputation", "口碑"), blackFans: "黑粉", trust: "负责人信任", defaults: "违约", money: "资金", pr: "公关值", bizValue: "商业价值" };
  return base[key] ?? key;
}
/** 加成的稳定键：优先用作者填的 id，否则由 恋人@地点@名称 组成 */
export const perkKey = (p: { id?: string; pid: string; loc?: string; label?: string }) => p.id || `${p.pid}@${p.loc ?? ""}@${p.label ?? ""}`;
export type VisitPerk = { pid: string; label?: string; fx: { key: string; delta: number }[]; seed?: string };
export function visitLocation(s: GameState, locId: string): { next: GameState; msg: string; perks: VisitPerk[] } {
  const looks = computeLooks(s);
  const n: GameState = { ...s, rel: { ...s.rel }, metPeople: [...s.metPeople], stats: { ...s.stats } };

  const meet = (pid: string, delta: number, extra: string) => {
    if (!n.metPeople.includes(pid)) n.metPeople.push(pid);
    n.rel[pid] = clamp((n.rel[pid] ?? 0) + delta, 0, affinityCapOf(pid));
    return extra;
  };

  let msg = "今日无关键安排，只做了常规踩点。";
  switch (locId) {
    case "apartment":
      n.stress = clamp(n.stress - 12, 0, 100);
      msg = "在天光小区深度休息：紧绷的神经缓了过来。";
      break;
    case "cafe":
      n.stress = clamp(n.stress - 8, 0, 100);
      if (s.week >= 6) msg = "" + meet("suqing", 5, "和苏晴喝了杯咖啡，关系 +5，压力 -8。");
      else msg = "独自在白栀咖啡馆靠窗坐了一下午，看街上人来人往，压力 -8。";
      break;
    case "fuguang":
      // 结识条件总表：第 7 周后 · 演技≥240 · 口碑≥45
      if (s.week >= 7 && s.stats.yanji >= 240 && s.reputation >= 45) msg = "" + meet("shenman", 4, "沈曼在片场指点了你，前辈关系 +4。");
      else { n.stats.yanji = clampStat("yanji", n.stats.yanji + 3); msg = "在片场角落翻阅剧本库，揣摩前辈的走位与念白，演技 +3。"; }
      break;
    case "dieyin":
      if (s.stats.geyi >= 160) msg = "" + meet("linzhixia", 4, "林知夏和你聊了新歌，合作关系 +4。");
      else { n.stats.geyi = clampStat("geyi", n.stats.geyi + 3); msg = "在录音棚反复试唱同一段副歌，直到气息稳了下来，歌艺 +3。"; }
      break;
    case "cancan":
      n.styling = Math.min(999, n.styling + 40);
      if (s.week >= 18 && s.fame >= 160 && s.reputation >= 60 && s.works >= 2 && wallet.balance(s) >= 80000 && s.defaults === 0 && !n.metPeople.includes("zhouyan"))
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
      else { n.stats.koucai = clampStat("koucai", n.stats.koucai + 3); msg = "对着云台的镜头试录了几遍开场白，越说越顺，口才 +3。"; }
      break;
    case "agency":
      n.pr += 5;
      msg = "在启星事务所请教林宜，公司公关 +5，拿到几条通告线索。";
      break;
    case "redcarpet":
      // 结识条件总表：闻予安本人需 容貌≥700 · 名气≥180 · 口碑≥75 · 黑粉≤8（第13周后公益晚宴开放）
      if (s.week >= 13 && looks >= 700 && s.fame >= 180 && s.reputation >= 75 && s.blackFans <= 8) {
        msg = "" + meet("wenyuan", 4, "云岸公益晚宴上与闻予安正式相识，世家线好感 +4。");
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
  // 伴侣加成 · 地点触发（relations.partnerPerks 里填了 loc 的条目，各世界观自行配置）
  const perks: VisitPerk[] = [];
  for (const p of partnerLocPerksFor((pid) => hasPartner(n, pid), locId)) {
    if (!perkWhenOk(s, p)) continue;
    const fx = perkFxList(p);
    for (const x of fx) perkWrite(n, x.key, p.pid, x.delta);
    if (p.msg) msg = p.msgMode === "replace" ? p.msg : `${msg}${p.msg}`;
    const k = perkKey(p), r = n.perkFired?.[k];
    n.perkFired = { ...n.perkFired, [k]: { n: (r?.n ?? 0) + 1, last: n.day, wk: n.week, wn: r && r.wk === n.week ? r.wn + 1 : 1 } };
    perks.push({ pid: p.pid, label: p.label, fx, seed: p.msg });
  }
  n.log = [...s.log, `【第 ${s.week} 周 · 踩点】${msg}`];
  if (n.log.length > 40) n.log = n.log.slice(-40);
  return { next: n, msg, perks };
}

// 居家/在场活动：通用增益应用器。活动语义与数值全在内容池，引擎只按字段增减并夹取边界。
// requiresItem 需先在行囊持有；lockedMsg 为缺物提示。返回 ok=false 时不改状态。
export function doActivity(s: GameState, roomId: string, actId: string): { next: GameState; msg: string; ok: boolean } {
  const act = activitiesOfRoom(roomId).find((a) => a.id === actId);
  if (!act) return { next: s, msg: "此处没有这个活动。", ok: false };
  if (act.requiresItem && !(s.bag ?? []).includes(act.requiresItem)) {
    return { next: s, msg: act.lockedMsg ?? "还差点什么才能做这件事。", ok: false };
  }
  if ((act.money ?? 0) < 0 && wallet.balance(s) + (act.money ?? 0) < 0) {
    return { next: s, msg: `现金不足，这件事得花 ${wallet.fmt(-(act.money ?? 0))}。`, ok: false };
  }
  const n: GameState = { ...s, stats: { ...s.stats } };
  if (act.stress) n.stress = clamp(n.stress + act.stress, 0, 100);
  if (act.fame) n.fame = clamp(Math.round(n.fame + act.fame), 0, 1000);
  if (act.money) wallet.addIn(n, act.money);
  if (act.stat && act.statDelta) {
    const key = act.stat as StatKey;
    n.stats[key] = clampStat(key, (n.stats[key] ?? 0) + act.statDelta);
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
  const price = shopPrice({ ...s, room: roomId }, it.price); // 店铺所属阵营的声望会调价
  if (!wallet.can(s, price)) return { next: s, msg: `${wallet.name()}不足，${it.name}要 ${wallet.fmt(price)}。`, ok: false };
  const n: GameState = { ...wallet.add(s, -price), bag: [...(s.bag ?? []), itemId] };
  n.log = [...s.log, `【第 ${s.week} 周 · 购物】花 ${wallet.fmt(price)} 买下${it.name}。`];
  if (n.log.length > 40) n.log = n.log.slice(-40);
  return { next: n, msg: `你花 ${wallet.fmt(price)} 买下了${it.name}，收进行囊。${price !== it.price ? `（原价 ${wallet.fmt(it.price)}，按阵营声望调价）` : ""}`, ok: true };
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
      if (s.week >= 18 && s.fame >= 160 && s.reputation >= 60 && s.works >= 2 && wallet.balance(s) >= 80000 && s.defaults === 0 && !s.metPeople.includes("zhouyan")) return { ready: true, note: "品牌共创会 · 可结识周砚川" };
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
      return { ready: true, note: s.dating ? `深度休息 · 恋人「${rosterFind((p) => p.id === s.dating)?.name}」私密事件` : "深度休息 · 排日程与私密事件" };
    default:
      return { ready: false, note: "今日无关键安排" };
  }
}

// 两年生涯阶段（策划案 两年闭环）
// 历法设定（起始日/周数/星期名）全部来自 ContentPool.calendar，引擎只做日期运算。
// 惰性求值：content.ts 与本模块存在循环依赖，若在模块初始化时读取 CALENDAR，
// 当 content.ts 先被求值会命中 TDZ（Cannot access 'CALENDAR' before initialization）。
// 按起始日期字符串缓存：切换世界观（模组槽 calendar / startDate）后自动重算
let _startKey = "";
let _startMs = 0;
const startMs = (): number => {
  const key = CALENDAR.startDate;
  if (key !== _startKey) {
    const [y, m, d] = key.split("-").map(Number);
    _startKey = key;
    _startMs = Date.UTC(y, m - 1, d);
  }
  return _startMs;
};
/* 开局日期展示：「2005.01.03」 */
export function startDateLabel(): string {
  const { y, m, d } = dayParts(0);
  return `${y}.${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")}`;
}
/* 第 N 周第 k 天（0=周一）对应的本地 Date（展示用） */
export function weekLocalDate(week: number, k = 0): Date {
  const { y, m, d } = dayParts((week - 1) * 7 + k - startDow());
  return new Date(y, m - 1, d);
}

// 当日时刻：从内容池 travel.dayStartMinute 起算（缺省 08:00）。移动/活动推动 clockMin 流动。
/* 「HH:MM」→ 当日分钟数；格式不对返回 undefined（允许 24:00 以后表示次日凌晨，如 26:00） */
const hhmm = (v?: string): number | undefined => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v?.trim() ?? "");
  return m && Number(m[2]) < 60 ? Number(m[1]) * 60 + Number(m[2]) : undefined;
};
const slotTime = (k: "startTime" | "dayStart" | "dayEnd") => hhmm(slot<string | undefined>(k, () => undefined));
// 每日起止：模组槽 dayStart / dayEnd（「HH:MM」）优先，其次 travel.dayStartMinute / dayEndMinute
export const dayStartMin = (): number => slotTime("dayStart") ?? TRAVEL.dayStartMinute ?? 480;
export const dayEndMin = (): number => slotTime("dayEnd") ?? TRAVEL.dayEndMinute ?? 1380;
/* 开局时刻：模组槽 startTime；缺省 = 每日起始时刻 */
export const startClockMin = (): number => Math.min(47 * 60, slotTime("startTime") ?? dayStartMin());
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

// day：0 基的「生涯第几天」，day 0 = startDate（可以是一周中任意一天）。week 恒等于 careerWeekOf(day)。
/* 开局日期是星期几（0=周一 … 6=周日）；日历按自然周排，第 1 周从开局日所在周的周一算起 */
export const startDow = (): number => (new Date(startMs()).getUTCDay() + 6) % 7;
/* 第 day 天是星期几（0=周一 … 6=周日）——日程表下标、周末判定、周结算都用它 */
export const dowOf = (day: number): number => (((day + startDow()) % 7) + 7) % 7;
export const careerWeekOf = (day: number): number => Math.floor((day + startDow()) / 7) + 1;
export const weekdayName = (day: number): string => CALENDAR.weekdayNames[dowOf(day)];

export function dayParts(day: number): { y: number; m: number; d: number; dow: number } {
  const dt = new Date(startMs() + day * 86400000);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), dow: dowOf(day) };
}

export function dayDateLabel(day: number): string {
  const { y, m, d } = dayParts(day);
  return `${y}.${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")}`;
}

export function weekDate(week: number): string {
  return dayDateLabel(Math.max(0, (week - 1) * 7 - startDow())); // 第 1 周从开局当天起显示
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
// limitDay：主线时限（游戏天数上限，0=不限）。在翻页这一层判定，任何推进入口都不会漏判。
export function advanceDay(s: GameState, limitDay = 0): DayResult {
  const raw = advanceDayRaw(s, limitDay > 0);
  const r0 = { ...raw, next: { ...raw.next, ap: apMax() } }; // 新回合：行动点回满
  if (limitDay > 0 && !r0.ended && (r0.next.day ?? 0) >= limitDay) {
    return { ...r0, ended: "finish", headline: "主线时限已到", dayText: `${r0.dayText}\n主线时限已到，故事在此落幕。` };
  }
  return r0;
}
function advanceDayRaw(s: GameState, customTimeLimit = false): DayResult {
  const dow = dowOf(s.day); // 0=周一 … 6=周日
  const n: GameState = { ...s, stats: { ...s.stats }, schedule: [...(s.schedule ?? [])], log: [...s.log] };
  const deltas: string[] = [];
  const actId = n.schedule[dow] ?? null;
  const r = applyAct(n, actId, deltas);
  // 玩法规则（模组「玩法规则」· 每天结束）：结果并入当日旁白
  { const gr = applyGameRules(n, "day", getWorldGameRules()); Object.assign(n, gr.next); deltas.push(...gr.changes); }
  // 主线与目标：每天结束判定节点完成 / 失败
  { const sr = applyStorylines(n, getWorldStorylines()); Object.assign(n, sr.next); deltas.push(...sr.changes); }
  const gradeLabel = r.grade ? GRADE_LABEL[r.grade] : "";
  const doneNote = deltas.length ? "：" + deltas.join("；") : "";

  const nextDay = s.day + 1;
  const pgNotes: string[] = [];
  const rollToNext = (base0: GameState, fresh: boolean): GameState => {
    // 孕期每日推进：征兆知晓 / 行动力上限 / 分娩
    const pg = tickPregnancy({ ...base0, day: nextDay }, base0.char.name, activeGender());
    const base = { ...pg.next, day: base0.day, log: pg.notes.length ? [...pg.next.log, ...pg.notes] : pg.next.log };
    if (pg.notes.length) pgNotes.push(...pg.notes); // 孕期状态变化：写入日志一次，并在当天旁白里播报
    return {
    ...base,
    day: nextDay,
    week: careerWeekOf(nextDay),
    daySeg: 0,
    clockMin: dayStartMin(),
    schedule: fresh ? [null, null, null, null, null, null, null] : base.schedule,
  };
  };

  if (dow === 6) {
    const wr = settleWeek(n, customTimeLimit); // 经济/通告/生态结算、week 推进、生涯终局判定
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
    dayText: `${weekdayName(s.day)}·${r.actLabel}${gradeLabel ? `——${gradeLabel}` : ""}${doneNote}，来到 ${label}。${pgNotes.length ? "\n" + pgNotes.join("\n") : ""}`,
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
  if (getWorldId() !== "ent") {
    if (bonds >= 2) return { title: "《有人替你留了一盏灯》", body: "朋友们凑钱帮你渡过难关，你学会了量入为出。" };
    return { title: "《入不敷出》", body: "账单越堆越高，你不得不中止这段生活，回到原点重新开始。" };
  }
  if (s.fame >= 200 && s.reputation >= 60)
    return { title: "《从欠款开始的第二次出道》", body: "暂别聚光灯，靠一部低成本作品，你还能翻身。" };
  if (bonds >= 2)
    return { title: "《有人替你留了一盏灯》", body: "联系人帮你还清了部分欠款，保留少量重开加成。" };
  return { title: "《最后一班末班车》", body: "合同终止，搬离天光小区，成为普通人的遗憾结局。" };
}

export function endingText(s: GameState): { title: string; body: string } {
  if (getWorldId() !== "ent") {
    // 非演艺世界观：按「知名度/口碑/羁绊」通用分档，避免出现女星/行业措辞
    const fameW = T("fame", "名气");
    const bonds = Object.values(s.rel).filter((v) => v >= 60).length;
    if (s.fame >= 300 && s.reputation >= 70) return { title: "众望所归 · 圆满结局", body: `${fameW}与口碑兼得，这段日子你活成了大家口中的传说。` };
    if (s.reputation >= 80) return { title: "口碑之选 · 温暖结局", body: "也许不是最耀眼的那个，却是最被信赖的那个。" };
    if (bonds >= 2) return { title: "羁绊满满 · 友情结局", body: "回头看，最珍贵的是身边那几个一直陪着你的人。" };
    if (s.fame >= 150) return { title: "崭露头角 · 未完待续", body: "你已经被很多人记住，故事还在继续。" };
    return { title: "平凡而认真 · 日常结局", body: "没有轰轰烈烈，但每一天都认真地活过。" };
  }
  if (s.fame >= 750 && s.awards >= 1)
    return { title: "国民级女星 · 巅峰结局", body: "聚光灯为你亮起，你站上了这个行业的顶点。" };
  if (s.fame >= 500)
    return { title: "一线女星 · 荣耀结局", body: `你已是华语${T("industry")}举足轻重的名字。` };
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
const bumpStat = (n: GameState, k: StatKey, d: number) => { n.stats[k] = clampStat(k, (n.stats[k] ?? 0) + d); };

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
        id: 1, name: "隔壁的灯", unlock: "入住天光小区（第 1 周）",
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
          { label: "只索取场地资源", result: "资金 +2 万，关系 -12", apply: (n) => { wallet.addIn(n, 20000); bumpRel(n, "jiangxu", -12); } },
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
      buffDesc: "每周首次在天光小区休息压力额外 -8 · 体能恢复 +5 · 过劳时提醒休整",
    },
  },
  // 6.4 离婚创一代 · 成熟事业线
  zhouyan: {
    personId: "zhouyan",
    stages: [
      {
        id: 1, name: "共创会迟到五分钟", unlock: "名气≥160 · 口碑≥60 · 2 次付费通告 · 资金≥8 万 · 无违约",
        cond: (s) => s.fame >= 160 && s.reputation >= 60 && s.works >= 2 && wallet.balance(s) >= 80000 && s.defaults === 0,
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
          { label: "让他单独背锅", result: "资金 +5 万，关系 -20", apply: (n) => { wallet.addIn(n, 50000); bumpRel(n, "zhouyan", -20); } },
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
  today: boolean; // 今天已和 TA 经历过一段，下一段改天再说
  confirmReq: string;
  buff: string;
};

export function arcView(s: GameState, pid: string): ArcView | null {
  const arc = ROMANCE_ARCS[pid];
  if (!arc) return null;
  const total = arc.stages.length;
  const done = s.arcStage?.[pid] ?? 0;
  const isDating = s.dating === pid;
  const today = s.arcDay?.[pid] === s.day;
  if (done >= total) {
    return { done, total, stage: null, locked: false, reason: "", datingReady: !isDating && arc.confirm.cond(s), isDating, today, confirmReq: arc.confirm.req, buff: arc.confirm.buff };
  }
  const stage = arc.stages[done];
  const ok = stage.cond(s);
  return { done, total, stage, locked: !ok, reason: ok ? "" : stage.unlock, datingReady: false, isDating, today, confirmReq: arc.confirm.req, buff: arc.confirm.buff };
}

export function chooseArc(s: GameState, pid: string, choiceIdx: number): { next: GameState; msg: string } {
  const arc = ROMANCE_ARCS[pid];
  const done = s.arcStage?.[pid] ?? 0;
  if (!arc || done >= arc.stages.length) return { next: s, msg: "" };
  if (!canRomance(s, pid)) return { next: s, msg: "TA 已设为「不可攻略」，情感线暂停；重新开启后从当前进度继续。" };
  const stage = arc.stages[done];
  if (!stage.cond(s)) return { next: s, msg: `还差一点：${stage.unlock}` };
  if (s.arcDay?.[pid] === s.day) return { next: s, msg: "今天你们已经经历过一段了，留点余味，改天再说。" };
  const c = stage.choices[choiceIdx];
  if (!c) return { next: s, msg: "" };
  const n: GameState = { ...s, rel: { ...s.rel }, stats: { ...s.stats }, arcStage: { ...s.arcStage }, arcDay: { ...s.arcDay, [pid]: s.day } };
  c.apply(n);
  n.arcStage[pid] = done + 1;
  n.fame = clamp(Math.round(n.fame), 0, 1000);
  const who = rosterFind((p) => p.id === pid)?.name ?? "";
  const msg = `【${who}·${stage.name}】${c.label} → ${c.result}`;
  n.log = [...s.log, `【第 ${s.week} 周 · 剧情】${msg}`];
  if (n.log.length > 40) n.log = n.log.slice(-40);
  return { next: n, msg };
}

export function confirmDating(s: GameState, pid: string): { next: GameState; msg: string } {
  const arc = ROMANCE_ARCS[pid];
  const view = arcView(s, pid);
  if (!arc || !view?.datingReady) return { next: s, msg: "尚未满足确认交往的全部条件。" };
  const blocked = datingBlocked(s, pid);
  if (blocked) return { next: s, msg: blocked };
  const n: GameState = withPartner(s, pid);
  const who = rosterFind((p) => p.id === pid)?.name ?? "";
  const msg = `你和${who}确认了关系，获得状态「${arc.confirm.buff}」。`;
  n.log = [...s.log, `【第 ${s.week} 周 · 定情】${msg}`];
  if (n.log.length > 40) n.log = n.log.slice(-40);
  return { next: n, msg };
}


/* 世界规则·婚姻制度：恋人判定 / 是否允许新恋情 / 写入伴侣 */
export function hasPartner(s: GameState, pid: string): boolean {
  return s.dating === pid || !!s.partners?.includes(pid);
}
/* 可攻略开关：默认人人可攻略，玩家可在人物页逐人关闭（s.noRomance）。
 * 家人缺省为亲情线（不可攻略），玩家可在人物页手动开启（s.familyRomance）；子女恒不可攻略。
 * 不可攻略 = 爱慕冻结不涨、不能表白 / 推进情感线 / 确认交往；好感、信任、心情照常发展。 */
export function isFamilyNpc(pid: string): boolean {
  return (FAMILY_NPC_IDS as readonly string[]).includes(pid);
}
export function romanceFixedOff(s: GameState, pid: string): boolean {
  return (isFamilyNpc(pid) && !s.familyRomance?.includes(pid)) || !!s.children?.some((k) => k.id === pid);
}
export function canRomance(s: GameState, pid: string): boolean {
  return !romanceFixedOff(s, pid) && !s.noRomance?.includes(pid);
}
const personGender = (pid: string): string | undefined =>
  npcGenderOf(pid) ?? (rosterFind((p) => p.id === pid) as { gender?: string } | undefined)?.gender ?? LIVE_PEOPLE.find((p) => p.id === pid)?.gender;
export function datingBlocked(s: GameState, pid: string): string {
  if (!canRomance(s, pid) && !hasPartner(s, pid)) return romanceFixedOff(s, pid) ? (isFamilyNpc(pid) ? "TA 是你的家人，目前是亲情线；可在人物页把 TA 设为「可攻略」。" : "子女之间只有亲情，没有恋爱线。") : "TA 已设为「不可攻略」，你们之间不会发展恋爱关系。";
  const ss = sameSexBlocked(personGender(pid));
  if (ss && !hasPartner(s, pid)) return ss;
  if (!s.dating || hasPartner(s, pid) || allowsMultiPartner()) return "";
  const cur = rosterFind((p) => p.id === s.dating)?.name ?? "现任";
  return `恋爱模式「专一」：你已与${cur}确认关系，不能再同时与别人交往。`;
}
export function withPartner(s: GameState, pid: string): GameState {
  if (!s.dating) return { ...s, dating: pid };
  if (hasPartner(s, pid)) return s;
  // 海王代价：开始新恋情时，现有恋人都会吃醋
  const rel = { ...(s.rel ?? {}) };
  for (const id of [s.dating, ...(s.partners ?? [])]) if (id) rel[id] = Math.max(0, (rel[id] ?? 0) - 8);
  return { ...s, rel, partners: [...(s.partners ?? []), pid] };
}
/** 婚礼条件：返回空串表示可以成婚，否则为原因 */
/* 婚礼参数：世界观「关系设定」槽 relations.wedding 可覆盖，缺省 30000 / 80 */
export const weddingCost = (): number => Math.max(0, Math.round(RELATIONS.wedding?.cost ?? 30000));
export const weddingMinAffinity = (): number => RELATIONS.wedding?.minAffinity ?? 80;
/** funds：当前钱包余额（绑定自定义货币时由调用方传入）；fmt：金额文案 */
export function weddingBlocked(s: GameState, pid: string, affinity: number, funds: number = wallet.balance(s), fmt: (n: number) => string = (n) => wallet.fmt(n)): string {
  const max = maxSpouses();
  if (!max) return "这个世界没有婚姻制度（自由伴侣），无法举办婚礼。";
  if (s.spouses?.includes(pid)) return "你们已经是夫妻了。";
  if (!hasPartner(s, pid)) return "需要先确认恋爱关系，才能谈婚论嫁。";
  { const ss = sameSexBlocked(personGender(pid)); if (ss) return ss; }
  if ((s.spouses?.length ?? 0) >= max) return max === 1 ? "婚姻制度为单偶制，你已有配偶。" : `你的配偶已达上限（${max} 位）。`;
  if (affinity < weddingMinAffinity()) return `好感需达到 ${weddingMinAffinity()} 才能求婚（当前 ${affinity}）。`;
  if (funds < weddingCost()) return `婚礼需要 ${fmt(weddingCost())}，余额不足。`;
  return "";
}


/** 离婚：按「离婚权限」判定；返回空串表示可以离 */
export function divorceBlocked(s: GameState, pid: string): string {
  if (!s.spouses?.includes(pid)) return "你们不是夫妻。";
  const m = divorceMode();
  if (m === "forbid") return "离婚权限「禁止离异」：婚姻一经缔结不可解除。";
  const aff = s.rel?.[pid] ?? 0;
  if (m === "mutual" && aff > DIVORCE_AGREE_MAX) return `离婚需双方同意：对方还不愿分开（好感 ${aff}，需 ≤ ${DIVORCE_AGREE_MAX}）。`;
  return "";
}
export function divorce(s: GameState, pid: string): { next: GameState; msg: string } {
  const why = divorceBlocked(s, pid);
  if (why) return { next: s, msg: why };
  const hard = divorceMode() === "unilateral";
  const rel = { ...(s.rel ?? {}), [pid]: Math.max(0, (s.rel?.[pid] ?? 0) - (hard ? 30 : 15)) };
  const partners = (s.partners ?? []).filter((x) => x !== pid);
  const dating = s.dating === pid ? (partners.shift() ?? null) : s.dating;
  const who = rosterFind((p) => p.id === pid)?.name ?? "对方";
  const msg = hard ? `你单方面提出离婚，与${who}的婚姻就此解除。（好感 -30，压力 +10）` : `你与${who}协议离婚，和平分开。（好感 -15，压力 +6）`;
  const n: GameState = { ...s, rel, partners, dating, spouses: s.spouses!.filter((x) => x !== pid), stress: clamp(s.stress + (hard ? 10 : 6), 0, 100), log: [...s.log, `【第 ${s.week} 周 · 婚姻】${msg}`].slice(-40) };
  return { next: n, msg };
}

/* ============ 统一扣费规则 ============
 * 主动消费（课程 / 社交 / 出行 / 购物 / 场景行动 / 购车 / 婚礼）：余额不足即拒绝，不会把钱扣成负数。
 * 被动扣费（周账单 / 违约金 / 事件后果）：照常扣除，允许透支，透支按经济规则计压力与破产。 */
export const canPay = (s: GameState, cost: number): boolean => wallet.can(s, cost);
export const shortOf = (s: { money: number }, cost: number, what: string): string =>
  `现金不足：${what}需 ${wallet.fmt(cost)}，现有 ${wallet.fmt(Math.max(0, wallet.balance(s)))}，没有扣费`;

/* ============ 待办 / 悬而未决的事件（供主页「待办」条呈现，确保每条事件线都有可见的后续入口） ============
 * 只列已经找上门、必须了结的事。情感线不在这里催：什么时候去找 TA、推不推进由玩家自己决定（人物页「关系经营」） */
export type PendingTodo = { id: string; tone: "danger" | "gold" | "jade"; text: string };
export function pendingTodos(s: GameState): PendingTodo[] {
  const out: PendingTodo[] = [];
  const career = feature("career"); // 非演艺世界（如校园）不出现通告/违约类待办
  if (career && s.breach) {
    const more = (s.breachQueue ?? []).length;
    out.push({ id: "breach", tone: "danger", text: `${s.breach.producer}登门追责《${s.breach.gigName}》违约，待了结${more ? `（另有 ${more} 起排队，共 ${more + 1} 起）` : ""}` });
  }
  if (feature("imageCrisis") && s.crisis) out.push({ id: "crisis", tone: "danger", text: `舆论危机进行中（已 ${Math.max(0, s.day - s.crisis.day)} 天）——到「形象」页选择应对，拖延会持续掉口碑` });
  if (career && s.activeGigId && s.gigDaysLeft > 0) {
    const g = LIVE_GIGS.find((x) => x.id === s.activeGigId);
    const wk = s.gigDeadlineWeek ? `，须在第 ${s.gigDeadlineWeek} 周前拍完` : "";
    out.push({ id: "gig", tone: s.gigDeadlineWeek && s.gigDeadlineWeek - s.week <= 1 ? "danger" : "gold", text: `《${g?.name ?? T("gig")}》还差 ${s.gigDaysLeft} 天拍摄${wk}` });
  }
  // 透支兜底：只给出路建议，不改动余额
  if (wallet.balance(s) < 0) {
    if (feature("career") && !s.activeGigId) {
      const pick = LIVE_GIGS
        .filter((g) => g.star <= 2 && !(s.usedGigs ?? []).includes(g.id) && gigEligible(g, s))
        .sort((a, b) => b.pay - a.pay)[0];
      const where = pick ? gigManager(pick) : null;
      out.push({
        id: "overdraft", tone: "danger",
        text: pick && where
          ? `账户透支 ${wallet.fmt(-wallet.balance(s))}——经纪公司可为你争取低星${T("gig")}《${pick.name}》（约 ${wallet.fmt(pick.pay)}），到${where.loc}找${where.name}洽谈；只靠打工很难填平房租`
          : `账户透支 ${wallet.fmt(-wallet.balance(s))}——只靠打工很难填平房租，去经纪公司问问保底的低星${T("gig")}，或减少付费课程`,
      });
    } else if (getWorldId() !== "ent") {
      const job = [...SIDE_JOBS].filter((j) => j.fameReq <= s.fame).sort((a, b) => b.pay - a.pay)[0];
      out.push({ id: "overdraft", tone: "danger", text: `${T("money", "资金")}透支 ${wallet.fmt(-wallet.balance(s))}——${job ? `可以在日程里安排「${job.label}」补贴，` : ""}少安排付费活动` });
    }
  }
  if (s.pregnancy?.known) {
    const d = Math.max(0, s.day - s.pregnancy.startDay);
    out.push({ id: "preg", tone: "gold", text: `孕期第 ${Math.floor(d / 7) + 1} 周（${s.pregnancy.fatherName}）——注意休息，避免高强度${career ? T("gig") : "活动"}` });
  }
  return out;
}

/* 好感名册：娱乐圈沿用 data.PEOPLE（核心人物 + 可攻略角色）；其它世界取模组 NPC（init 缺省 0） */
function relRoster(): { id: string; init: number }[] {
  if (getWorldId() === "ent") return ROMANCE_PEOPLE;
  return LIVE_PEOPLE.map((p) => ({ id: p.id, init: p.init ?? 0 }));
}
const rosterFind = (pred: (p: { id: string; name: string }) => boolean) =>
  getWorldId() === "ent" ? ROMANCE_PEOPLE.find(pred) : LIVE_PEOPLE.find(pred);

/* 日程项完成次数（键见 unlockLock），用于等级 / 前置解锁 */
function bumpCount(n: GameState, key: string) {
  n.trainCounts = { ...(n.trainCounts ?? {}), [key]: (n.trainCounts?.[key] ?? 0) + 1 };
}
/* 自定义属性收益：区间随机 × 倍率，按属性自身上下限截断，并写入收益说明 */
function applyCgain(n: GameState, cgain: Record<string, [number, number]> | undefined, mul: number, gains: string[]) {
  if (!cgain) return;
  const defs = getWorldSlot("customAttrs") ?? [];
  for (const [id, r] of Object.entries(cgain)) {
    const d = defs.find((x) => x.id === id);
    if (!d || !r) continue;
    const cur = n.cattrs?.[id] ?? d.init;
    const gain = Math.round(rand(r[0], r[1]) * mul);
    if (!gain) continue;
    n.cattrs = { ...(n.cattrs ?? {}), [id]: Math.max(d.min ?? 0, Math.min(attrCap(d.max), cur + gain)) };
    gains.push(`${d.label} ${gain > 0 ? "+" : ""}${gain}`);
  }
}

/** 本周周日账单预估（只读，镜像周结算的固定开销 + 伙食 + 前期减免），供日程面板提前展示扣款明细 */
export function previewWeekBill(s: GameState): WeekBill {
  const monthEnd = s.week % 4 === 0;
  const bills = billsFor(s.fame);
  const lines: { label: string; amount: number }[] = [
    ...(bills.weekly ?? []).map((b) => ({ label: b.label, amount: b.amount })),
    ...(monthEnd ? (bills.monthly ?? []).map((b) => ({ label: `${b.label}（月末）`, amount: b.amount })) : []),
  ];
  const meal = mealOf(s.meal);
  if (meal) lines.push({ label: `伙食 · ${meal.name}`, amount: meal.cost });
  const eco = economy();
  if ((eco.graceWeeks ?? 0) > 0 && s.week <= (eco.graceWeeks ?? 0)) {
    const mul = eco.graceBillMul ?? 0.5;
    for (const l of lines) l.amount = Math.round(l.amount * mul);
  }
  return { lines, total: lines.reduce((a, b) => a + b.amount, 0), monthEnd, week: s.week };
}

/** 主线「下一步」：按当前状态给出一条具体、可执行的指引（首页常驻 + 任务日志「本章目标」） */
export function nextStep(s: GameState): { title: string; hint: string } {
  const urgent = pendingTodos(s).find((t) => t.tone === "danger");
  if (urgent) return { title: "先处理紧急事项", hint: urgent.text };
  const career = feature("career");
  const today = dowOf(s.day ?? 0);
  const planned = (s.schedule ?? []).slice(today).filter(Boolean).length;
  if (career && s.activeGigId && s.gigDaysLeft > 0 && !(s.schedule ?? []).slice(today).includes("gig"))
    return { title: `把「拍摄」排进日程`, hint: `在拍${T("gig")}还差 ${s.gigDaysLeft} 天，打开「本周日程」排上拍摄，完工领片酬。` };
  if (planned === 0) return { title: "排好本周日程", hint: "打开「本周日程」，给剩下的每一天安排上课、打工或休息，再推进时间。" };
  if (career && !s.activeGigId) return { title: `争取第一份${T("gig")}`, hint: `去经纪公司或片场看看有哪些${T("gig")}可接——接到活才有收入和名气。` };
  return { title: "推进日子", hint: "日程已排好，推进时间看看这一周会发生什么；也可以四处走走结识人脉。" };
}
