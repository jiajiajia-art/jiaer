/* ————— 本地持久化（localdb）+ 默认值 + 随机生成 ————— */
import type { AIConfig, GameState, Npc, Player, SignedContract } from "./types";
import { createGame, type Character as SimChar } from "../game/logic";
import { ensureRelations } from "../game/relations";
import { FAMILY_NPC_IDS, familyNpcs } from "../game/family";
import { STAT_ORDER } from "../game/data";
import { PEOPLE } from "../worlds/star2005/content";
import { ALL_ROOMS } from "../game/mud";

// 轻量配置（AI 配置、界面主题）继续用原生 localStorage；
// 大容量游戏存档 / 对话记录 / 角色属性走 storage.ts 的 gameSaveDB（IndexedDB）。
const K_CONFIG = "xh_ai_config";
const K_THEME = "xh_theme";

/* —— AI 配置 —— */
export const defaultConfig: AIConfig = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "",
  models: [],
  temperature: 0.9,
  topP: 0.95,
};

export function loadConfig(): AIConfig {
  try {
    const raw = localStorage.getItem(K_CONFIG);
    if (raw) return { ...defaultConfig, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...defaultConfig };
}
export function saveConfig(c: AIConfig) {
  localStorage.setItem(K_CONFIG, JSON.stringify(c));
}

/* —— 主题 —— */
export type ThemePref = { mode: "auto" | "light" | "dark"; accent: "jade" | "plum" | "ink"; skin?: "paper" | "glass" | "cute" | "dream" | "bloody" | "pixel"; font?: "song" | "round" | "elegant" | "brush"; orient?: "portrait" | "landscape" };
export const defaultTheme: ThemePref = { mode: "auto", accent: "plum", skin: "dream", font: "song" };
export function loadTheme(): ThemePref {
  try {
    const raw = localStorage.getItem(K_THEME);
    if (raw) return { ...defaultTheme, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...defaultTheme };
}
export function saveTheme(t: ThemePref) {
  localStorage.setItem(K_THEME, JSON.stringify(t));
}

/* —— 存档槽已迁移至 storage.ts（gameSaveDB / IndexedDB，大容量、异步）——
 * 存档相关 API 从 "./storage" 导入：
 *   listSaves / listManualSaves / getSlot / saveToSlot / deleteSlot /
 *   renameSlot / writeAutosave / autosaveDebounced / flushAutosave
 */
export type { SaveSlot } from "./storage";
export {
  MAX_SLOTS,
  AUTO_SLOT_ID,
  listSaves,
  listManualSaves,
  getSlot,
  saveToSlot,
  deleteSlot,
  renameSlot,
  writeAutosave,
  autosaveDebounced,
  flushAutosave,
  migrateLegacySaves,
} from "./storage";

/* —— 是否开启自动存档（轻量开关，走原生 localStorage）—— */
const K_AUTOSAVE = "xh_autosave";
export function loadAutosaveOn(): boolean {
  try {
    return localStorage.getItem(K_AUTOSAVE) !== "0";
  } catch {
    return true;
  }
}
export function saveAutosaveOn(on: boolean) {
  try {
    localStorage.setItem(K_AUTOSAVE, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/* —— 随机人物生成 —— */
const SURNAMES = "沈林苏顾陆江宋温周许梁陈叶白秋商裴谢卫云简".split("");
const GIVEN_F = ["星桥", "见月", "知夏", "以澄", "念棠", "初晴", "疏影", "南乔", "宛卿", "听澜", "予安", "语迟"];
const IDENTITIES = ["练习生", "新人演员", "选秀出身歌手", "模特转型艺人", "音乐剧演员", "网络小生", "综艺新面孔"];
const BACKGROUNDS = ["单亲家庭长大", "小城书香门第", "梨园世家", "普通工薪家庭", "海外归国", "隐姓埋名的旧贵族"];
const KLASS = ["草根逆袭", "中产", "殷实之家", "落魄名门"];

const rndOf = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
export const uid = () => Math.random().toString(36).slice(2, 10);

export function randomPlayerSeed(): Partial<Player> {
  const name = rndOf(SURNAMES) + rndOf(GIVEN_F);
  return {
    name,
    age: String(17 + Math.floor(Math.random() * 8)),
    gender: Math.random() < 0.82 ? "女" : "男",
    identity: rndOf(IDENTITIES),
    background: rndOf(BACKGROUNDS),
    klass: rndOf(KLASS),
    description: `${name}，出道倒计时的这一年，带着一身不肯认输的倔强站上舞台。`,
  };
}

export const DEFAULT_ATTRS = [
  { key: "fame", label: "名气", value: 15, max: 1000, icon: "spark" },
  { key: "yanji", label: "演技", value: 40, max: 999, icon: "book" },
  { key: "geyi", label: "歌艺", value: 40, max: 999, icon: "sparkle" },
  { key: "yitai", label: "仪态", value: 45, max: 999, icon: "user" },
  { key: "koucai", label: "口才", value: 40, max: 999, icon: "scroll" },
  { key: "zixin", label: "自信", value: 45, max: 999, icon: "heart" },
  { key: "reputation", label: "口碑", value: 35, max: 100, icon: "flag" },
  { key: "stress", label: "压力", value: 20, max: 100, icon: "flask" },
];

/* 建角时的确定性引擎选择（外形/身份/家庭/方向/特质），缺省给全能新人 */
export const defaultSimChar: SimChar = {
  name: "无名",
  styleId: "sweet",
  identityId: "sr",
  backgroundId: "normal",
  directionId: "all",
  traitIds: [],
};

export function newGame(player: Player, simChar?: SimChar, contract?: SignedContract & { signBonus?: number; trust?: number; reputation?: number }): GameState {
  const now = Date.now();
  const base = createGame({ ...defaultSimChar, ...simChar, name: player.name });
  // 开局全城地点即已知晓（无战争迷雾）：所有房间登记为已探索
  const known = {
    visited: [...ALL_ROOMS],
    discoveredAt: Object.fromEntries(ALL_ROOMS.map((r) => [r, 0])) as Record<string, number>,
  };
  // 合约签署奖励落到开局数值（引擎只读参数，中文条款留在快照里）
  const sim = contract
    ? {
        ...base,
        ...known,
        money: base.money, // 初始资金固定 5000，不叠加签约金
        trust: (base.trust ?? 0) + (contract.trust ?? 0),
        reputation: Math.max(0, Math.min(100, base.reputation + (contract.reputation ?? 0))),
      }
    : { ...base, ...known };
  const signed: SignedContract | undefined = contract
    ? {
        id: contract.id,
        company: contract.company,
        companyStyle: contract.companyStyle,
        focusLabel: contract.focusLabel,
        icon: contract.icon,
        baseSalary: contract.baseSalary,
        revenueShare: contract.revenueShare,
        penalty: contract.penalty,
        exclusive: contract.exclusive,
      }
    : undefined;
  // 双亲与其他 NPC 统一：作为固定花名册条目并直接标记为已结识
  const family = familyNpcs(player);
  const simWithFamily = { ...sim, metPeople: [...sim.metPeople, ...FAMILY_NPC_IDS] };
  const g: GameState = {
    id: uid(),
    player,
    npcs: [...family, ...seedNpcs()],
    story: [],
    options: [],
    world: { time: "第 1 周 · 2005.01.03", location: "天光公寓", weather: "微雨" },
    memory: "",
    turnCount: 0,
    ended: false,
    epilogue: "",
    createdAt: now,
    updatedAt: now,
    sim: simWithFamily,
    contract: signed,
  };
  return syncSimToPlayer(g);
}

/* 老存档兼容：缺 sim 时补一份默认引擎状态 */
export function ensureSim(state: GameState): GameState {
  // 老存档里 world.time 可能带有阶段后缀（如「· 素人期」），阶段不再外显，读档时去除
  const cleanedTime = (state.world?.time ?? "").replace(/\s*·\s*(素人期|起步期|上升期|转型期|冲刺期|终局周)\s*$/, "");
  if (cleanedTime !== state.world?.time) {
    state = { ...state, world: { ...state.world, time: cleanedTime } };
  }
  if (!state.sim) {
    return { ...state, sim: createGame({ ...defaultSimChar, name: state.player.name }) };
  }
  // 老存档字段补齐（交涉多结果 / 候补资格 / 日历日推进）
  const s = state.sim;
  if (
    s.activeGigMods === undefined || s.standby === undefined || s.day === undefined ||
    s.projects === undefined || s.portfolio === undefined || s.relations === undefined ||
    s.knownFacts === undefined || s.lastMeetDay === undefined ||
    s.discoveredAt === undefined || s.bag === undefined || s.knownIntel === undefined ||
    s.persona === undefined || s.brandMatch === undefined || s.controversy === undefined ||
    s.clockMin === undefined || s.starBuzz === undefined ||
    s.lastCheck === undefined || s.lastBill === undefined ||
    s.gigDepositPaid === undefined || s.checks === undefined || s.breach === undefined ||
    s.cars === undefined || s.activeCar === undefined || s.xianyu === undefined ||
    s.gigStartWeek === undefined || s.gigDeadlineWeek === undefined ||
    s.equippedTitle === undefined || s.usedGigs === undefined ||
    s.daySeg === undefined || (s.schedule?.length ?? 0) !== 7
  ) {
    return {
      ...state,
      sim: {
        ...s,
        // 日程回归周一~周日整周制（7 天）：非 7 槽的旧档一律清空重排
        schedule: (s.schedule?.length ?? 0) === 7 ? s.schedule : [null, null, null, null, null, null, null],
        daySeg: 0,
        activeGigMods: s.activeGigMods ?? null,
        standby: s.standby ?? {},
        day: s.day ?? (s.week - 1) * 7, // 周制老档落到该周周一
        clockMin: s.clockMin ?? 8 * 60, // 老档补齐当日时刻起点（上午 08:00）
        projects: s.projects ?? [],
        portfolio: s.portfolio ?? [],
        relations: ensureRelations(s.relations),
        knownFacts: s.knownFacts ?? {},
        knownIntel: s.knownIntel ?? [],
        lastMeetDay: s.lastMeetDay ?? {},
        // 战争迷雾：老档把已到访房间视为首日即发现
        discoveredAt: s.discoveredAt ?? Object.fromEntries((s.visited ?? ["apartment"]).map((r) => [r, 0])),
        bag: s.bag ?? [],
        cars: s.cars ?? [],
        activeCar: s.activeCar ?? null,
        xianyu: s.xianyu ?? [],
        // 人设与危机字段补齐
        persona: s.persona ?? null,
        brandMatch: s.brandMatch ?? 0,
        audience: s.audience ?? 20,
        controversy: s.controversy ?? 0,
        personaStreak: s.personaStreak ?? 0,
        personaSwings: s.personaSwings ?? 0,
        crisis: s.crisis ?? null,
        crisesResolved: s.crisesResolved ?? 0,
        starBuzz: s.starBuzz ?? [],
        lastCheck: s.lastCheck ?? null,
        lastBill: s.lastBill ?? null,
        gigDepositPaid: s.gigDepositPaid ?? false,
        checks: s.checks ?? [],
        breach: s.breach ?? null,
        gigStartWeek: s.gigStartWeek ?? 0,
        gigDeadlineWeek: s.gigDeadlineWeek ?? 0,
        equippedTitle: s.equippedTitle ?? null,
        usedGigs: s.usedGigs ?? [],
      },
    };
  }
  return state;
}

/* 老存档兼容：把双亲补进统一花名册（幂等）——早期存档的双亲是 SimTab 独立档案，
 * 迁移后统一走「人脉」详情面板。 */
export function ensureFamily(state: GameState): GameState {
  const fresh = familyNpcs(state.player);
  const freshById = new Map(fresh.map((n) => [n.id, n]));
  const have = new Set(state.npcs.map((n) => n.id));
  const missing = fresh.filter((n) => !have.has(n.id));

  // 早期版本因负数种子取模，双亲的推导字段可能落成「沈undefined」等脏值。
  // 这些字段本就确定性可复原：命中脏值时用新档案重铸展示字段，
  // 同时保留玩家状态字段（头像 / 好感 / 好感史 / 互动记录）。
  const corrupt = (v: unknown): boolean => typeof v === "string" && v.includes("undefined");
  let repaired = false;
  const npcs = state.npcs.map((n) => {
    const f = freshById.get(n.id);
    if (!f) return n;
    if (!corrupt(n.name) && !corrupt(n.bio) && !n.tags.some(corrupt)) return n;
    repaired = true;
    return { ...n, name: f.name, identity: f.identity, age: f.age, bio: f.bio, tags: f.tags };
  });

  if (missing.length === 0 && !repaired && FAMILY_NPC_IDS.every((id) => state.sim?.metPeople.includes(id))) return state;
  const sim = state.sim
    ? { ...state.sim, metPeople: Array.from(new Set([...state.sim.metPeople, ...FAMILY_NPC_IDS])) }
    : state.sim;
  return { ...state, npcs: [...missing, ...npcs], sim };
}

/* 把确定性引擎的数值同步到人物档案面板（保持单一真相） */
const SIM_ATTR_KEYS = new Set(["fame", "reputation", "stress", ...STAT_ORDER]);
export function syncSimToPlayer(g: GameState): GameState {
  const s = g.sim;
  if (!s) return g;
  const attrs = g.player.attrs.map((a) => {
    if (!SIM_ATTR_KEYS.has(a.key)) return a;
    let v = a.value;
    if (a.key === "fame") v = s.fame;
    else if (a.key === "reputation") v = s.reputation;
    else if (a.key === "stress") v = s.stress;
    else if (a.key in s.stats) v = s.stats[a.key as keyof typeof s.stats];
    return { ...a, value: v };
  });
  // 好感单一真相：展示轴 npc.affinity 镜像自确定性引擎 s.rel（0~100 展示区间）。
  // 引擎侧任一动作（私下联系/表白/情感线）改动 s.rel 后，此处统一回灌，杜绝双轨漂移。
  const npcs = g.npcs.map((n) => {
    const relv = s.rel[n.id];
    return relv === undefined ? n : { ...n, affinity: Math.max(0, Math.min(100, relv)) };
  });
  return { ...g, player: { ...g.player, attrs }, npcs };
}

/* 开局人物档案：唯一真相取自内容池 world.yaml（PEOPLE），引擎不再重复维护中文名册。
 * 这里只挂载「可变的关系存档」——维度/互动从 0 起步，靠玩法一步步经营出来。
 * 好感（affinity）与引擎 s.rel 同源：开局镜像内容池初值 p.init，之后一律由引擎回灌，
 * 不再另立一套 AI 好感轴。名字/身份/关系/简介/标签全部随内容池走，永不再对不上。 */
export function seedNpcs(): Npc[] {
  return PEOPLE.map((p) => ({
    id: p.id,
    name: p.name,
    age: "",
    identity: p.role,
    relation: p.relation ?? "",
    avatar: "",
    bio: p.bio,
    mood: "平静",
    affinity: 0, // 初值由 syncSimToPlayer 从引擎 s.rel 镜像（newGame 末尾统一回灌）
    dims: [
      { label: "信任", value: 0 },
      { label: "爱慕", value: 0 },
      { label: "友善", value: 0 },
      { label: "敌意", value: 0 },
    ],
    tags: p.tags ?? [],
    attrs: [],
    affinityHistory: [],
    interactions: [],
  }));
}
