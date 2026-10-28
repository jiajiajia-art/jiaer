import { loadGlobal, saveGlobal } from "./saveScope";
import { randomName, type NameGender, type NameStyle } from "../game/names";
/* ————— 本地持久化（localdb）+ 默认值 + 随机生成 ————— */
import type { AIConfig, GameState, Npc, Player, SignedContract } from "./types";
import type { CoverCgOpts } from "../mods/types";
import { canRomance, createGame, startDateLabel, type Character as SimChar } from "../game/logic";
import { blankRel, ensureRelations } from "../game/relations";
import { romanticCapOf } from "../worlds/star2005/content";
import { FAMILY_NPC_IDS, familyNpcs } from "../game/family";
import { emptyPhone } from "../game/phone";
import { STAT_ORDER, ALL_STAT_KEYS, startWeather, creationCopy } from "../game/data";
import { allRooms, locOf } from "../game/mud";
import { drawAvatar } from "../game/avatarPools";
import { LIVE_PEOPLE as PEOPLE, getWorld, getWorldEndings, getWorldFixedEvents, getWorldGradeDims, getWorldStartRoom, getWorldTimeLimit } from "../mods/registry";

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
  return { ...defaultConfig, ...(loadGlobal<Partial<AIConfig>>(K_CONFIG, {}) || {}) };
}
export function saveConfig(c: AIConfig) {
  saveGlobal(K_CONFIG, c);
}

/* —— 主题 —— */
export type ThemePref = {
  mode: "auto" | "light" | "dark";
  accent: "plum" | "fuchsia" | "jade" | "gold" | "cyan" | "rose" | "coral" | "ink";
  skin?: "paper" | "glass" | "cute" | "dream" | "bloody";
  topbar?: "gradient" | "aurora" | "plain"; // 顶栏美化风格
  topbarText?: string; // 顶栏中部标语（留空不显示）
  font?: "song" | "hei" | "round" | "elegant" | "brush" | "hand" | "cursive" | "pixel";
  orient?: "portrait" | "landscape";
  orientLock?: boolean; // 锁定屏幕方向：锁定后菜单里无法切换横竖屏
  dialogStyle?: "soft" | "avg" | "letter" | "glass" | "minimal"; // 对话·叙事 面板样式
  dialogRadius?: number; // 面板圆角 px
  dialogHeight?: "low" | "std" | "high"; // 面板高度
  bubbleStyle?: "frost" | "solid" | "outline" | "comic" | "plain"; // 台词气泡
  avatarShape?: "rounded" | "circle" | "hidden"; // 对话头像形状
  avatarFrame?: "white" | "accent" | "glow" | "none"; // 头像描边
  sceneBg?: string; // 自定义场景背景（URL / dataURL），留空用地点原图
  sceneDim?: number; // 场景遮罩浓度 0-90（%）
  sceneBlur?: number; // 场景模糊 px
  sceneTone?: "none" | "warm" | "cool" | "mono" | "vintage" | "dusk"; // 场景滤镜
  portrait?: "off" | "side" | "stage"; // 对话显示：off = 纯文字模式，其余 = 立绘模式（"stage" 为旧存档兼容值）
  dialogDiy?: import("./freeStyle").DialogDiy; // 对话框 DIY
  navActive?: NavActiveStyle; // 底栏选中态 DIY
  free?: import("./freeStyle").FreeStyle; // 自由美化：自定义颜色 / 字体 / 贴图
  lookRules?: import("./plotLook").LookRule[]; // 玩家自己的剧情美化规则
  plotLook?: boolean; // 是否接受世界作者设定的剧情美化（缺省 是）
  icons?: IconDiy; // 图标与按钮 DIY（底栏图标另见 navActive）
  cover?: CoverDiy; // 开局封面 DIY（玩家自己的封面，优先于世界作者的封面；留空项沿用）
  gameFrame?: import("../components/FrameDiy").FrameDiy; // 游玩界面边框
  topbarDiy?: import("./topbarDiy").TopbarDiy; // 顶栏自由组合 DIY + 样式正则 + 自定义模板
};
/* 封面画布自由元素：文字标签 / 印章 / 竖排诗句 / 贴纸立绘 / 几何画框光晕，支持在封面上自由拖拽、缩放、旋转 */
export type CoverCanvasItem = {
  id: string;
  kind: "text" | "sticker" | "shape";
  x: number; // 画布横向位置 0~100 (%)
  y: number; // 画布纵向位置 0~100 (%)
  scale?: number; // 缩放 0.3~3（缺省 1）
  rotate?: number; // 旋转角度 -180~180（缺省 0）
  opacity?: number; // 透明度 10~100（缺省 100）
  z?: number; // 图层：0 = 主标题底层，1 = 顶层装饰（缺省 1）
  // 文字元素
  text?: string;
  font?: "default" | NonNullable<ThemePref["font"]>;
  color?: string;
  bg?: string;
  textStyle?: "plain" | "pill" | "seal" | "outline" | "glass" | "glow";
  vertical?: boolean; // 竖排文字
  // 贴纸 / 徽章 / 自定义图片
  sticker?: string; // 内置贴纸 id 或图片 URL / dataURL
  // 几何 / 画框 / 光晕
  shape?: "circle" | "ring" | "arch" | "frame" | "diamond" | "glow" | "line" | "polaroid";
  w?: number; // 宽度 px
  h?: number; // 高度 px
};

/* 开局封面 DIY：背景 / 文字 / 版式 / 按钮 / 画布自由编排 / 氛围特效。所有项留空 = 沿用世界封面或默认封面 */
export type CoverDiy = CoverCgOpts & {
  on?: boolean; // 缺省开启；关闭后完全使用世界封面
  image?: string; video?: string; // 固定 CG / 背景视频（背景类型见 cgMode；轮播 CG 见 cgs）
  bgPreset?: "starlight" | "dawn" | "noir" | "inkwash" | "cyber" | "minimal"; // 无背景图时的艺术画布底景
  bgGrad?: [string, string, number?]; // 自定义双色渐变底景 [色1, 色2, 角度]
  bgPattern?: "none" | "grid" | "dots" | "lines" | "frame" | "astrolabe"; // 画布纹理叠层
  dim?: number; blur?: number; // 压暗 0~80 · 模糊 px
  tint?: "night" | "rose" | "ocean" | "gold" | "none" | "custom"; tintColor?: string; // 叠色
  kicker?: string; title?: string; subtitle?: string; intro?: string;
  hideTitle?: boolean; hideIntro?: boolean; hideKicker?: boolean; hideSubtitle?: boolean;
  logo?: string; // 标题图（替代文字标题）
  titleFont?: "default" | NonNullable<ThemePref["font"]>;
  titleColor?: "white" | "gold" | "pink" | "accent" | "custom"; titleCustom?: string;
  titleSize?: "s" | "m" | "l" | "xl";
  titleDir?: "horizontal" | "vertical"; // 标题方向：横排 / 竖排
  titleEffect?: "none" | "glow" | "stroke" | "gold3d" | "retro"; // 标题艺术字效
  titleTracking?: "tight" | "normal" | "wide" | "ultra"; // 标题字间距
  kickerStyle?: "plain" | "pill" | "line" | "bracket"; // 顶部小字装饰样式
  divider?: "line" | "star" | "floral" | "double" | "none"; // 装饰分割线
  align?: "left" | "center" | "right";
  vpos?: "top" | "center" | "bottom";
  panel?: "none" | "glass" | "dark" | "paper" | "editorial" | "jade"; // 文字区底板
  panelPos?: { x: number; y: number }; // 标题文字区自由拖拽坐标 (%)
  btnsPos?: { x: number; y: number }; // 按钮组自由拖拽坐标 (%)
  canvasItems?: CoverCanvasItem[]; // 画布自由 DIY 元素列表
  btnStyle?: "dream" | "rose" | "gold" | "jade" | "solid" | "glass" | "outline" | "paper" | "text";
  btnShape?: "pill" | "rounded" | "square" | "gem";
  btnLayout?: "grid" | "stack" | "row";
  btnWidth?: "full" | "compact";
  btnColor?: string;
  btnTextColor?: string;
  labels?: Partial<Record<"start" | "continue" | "config", string>>;
  hide?: Partial<Record<"continue" | "config", boolean>>;
  fx?: "none" | "stars" | "petals" | "snow" | "fireflies" | "hearts" | "bubbles" | "ginkgo";
  spotlight?: "none" | "top" | "center" | "vignette"; // 氛围聚光 / 暗角
  frame?: import("../components/FrameDiy").FrameDiy; // 封面边框
  css?: string; // 封面专属 CSS（自动收进 .cover-root，只影响封面）；AI 对话生成或手写
};
/* 图标与按钮 DIY：任意图标位换图片 / 换内置图标；全局图标颜色、线宽、大小；圆按钮外形；场景点位样式 */
export type IconDiy = {
  imgs?: Record<string, string>; // 图标位 id → 图片
  glyphs?: Record<string, string>; // 图标位 id → 内置图标名（见 iconGlyphs.GLYPHS）
  color?: string; // 图标颜色（缺省跟随皮肤）
  stroke?: number; // 线条粗细 1~3
  scale?: number; // 图标大小 %（70~150）
  btnShape?: "rounded" | "circle" | "square" | "petal";
  btnFill?: "glass" | "gradient" | "solid" | "outline";
  btnColor?: string; // 按钮底色（solid / outline 用；缺省主色）
  spot?: "glint" | "dot" | "glow" | "ring" | "star" | "heart" | "diamond" | "sparkle" | "flower" | "img";
  spotImg?: string;
  spotColor?: string; // 点位颜色（缺省按类型着色）
  spotSize?: number; // 点位大小 px（8~28）
  spotLabel?: "dark" | "light" | "accent" | "outline" | "hidden";
};
/* 底栏选中态：底衬形状 / 填充 / 颜色 / 动效 / 底衬贴图 / 各牌位自定义图标（素材库图片） */
export type NavActiveStyle = {
  shape?: "pill" | "circle" | "square" | "underline" | "dot" | "none";
  fill?: "gradient" | "solid" | "outline" | "glass";
  color?: string; // 底衬色（缺省 主色→辅色）
  iconColor?: string; // 选中图标色（缺省 水晶渐变）
  labelColor?: string; // 选中文字色
  anim?: "pop" | "bounce" | "float" | "glow" | "none";
  ripple?: boolean; // 点击光晕（缺省开）
  bgImg?: string; // 底衬贴图
  icons?: Record<string, { on?: string; off?: string }>; // 牌位 id → 选中 / 未选中图标
  iconSize?: number; // 图标尺寸 px
};
export const defaultTheme: ThemePref = { mode: "auto", accent: "plum", skin: "cute", font: "song" };
export function loadTheme(): ThemePref {
  return { ...defaultTheme, ...(loadGlobal<Partial<ThemePref>>(K_THEME, {}) || {}) };
}
export function saveTheme(t: ThemePref) {
  saveGlobal(K_THEME, t);
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
  cancelAutosave,
  migrateLegacySaves,
} from "./storage";

/* —— 是否开启自动存档（轻量开关，走原生 localStorage）—— */
const K_AUTOSAVE = "xh_autosave";
export function loadAutosaveOn(): boolean {
  return String(loadGlobal<string | number>(K_AUTOSAVE, "1")) !== "0";
}
export function saveAutosaveOn(on: boolean) {
  {
    saveGlobal(K_AUTOSAVE, on ? "1" : "0");
  }
}

/* —— 随机人物生成 —— */
/* 身份 / 家世 / 阶层随机池来自模组槽 creation；未声明 → 通用兜底 */
const pool = (a: string[] | undefined, fb: string[]) => (a?.length ? a : fb);

const rndOf = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
export const uid = () => Math.random().toString(36).slice(2, 10);

export function randomPlayerSeed(gender?: string, style: NameStyle = "any"): Partial<Player> {
  const g = gender ?? (Math.random() < 0.82 ? "女" : "男");
  const name = randomName(g as NameGender, style);
  // 只用创作者配置的选项池 / 模板；没配就留空让玩家填，不塞内置示例
  const cc = creationCopy();
  return {
    name,
    age: String(17 + Math.floor(Math.random() * 8)),
    gender: g,
    identity: rndOf(pool(cc.identityOpts, [""])),
    background: rndOf(pool(cc.backgroundOpts, [""])),
    klass: rndOf(pool(cc.klassOpts, [""])),
    description: (cc.seedDescription ?? "").replace(/\{name\}/g, name),
  };
}

export { syncNameInDescription, syncPlayerNameChange } from "./syncPlayerName";
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

/* 建角时的确定性引擎选择（外形/身份/家庭/方向），缺省给全能新人 */
export const defaultSimChar: SimChar = {
  name: "无名",
  styleId: "sweet",
  identityId: "sr",
  backgroundId: "normal",
  directionId: "all",
};

export function newGame(player: Player, simChar?: SimChar, contract?: SignedContract & { signBonus?: number; trust?: number; reputation?: number }): GameState {
  const now = Date.now();
  const base = createGame({ ...defaultSimChar, ...simChar, name: player.name });
  // 开局全城地点即已知晓（无战争迷雾）：所有房间登记为已探索
  const known = {
    visited: [...allRooms()],
    discoveredAt: Object.fromEntries(allRooms().map((r) => [r, 0])) as Record<string, number>,
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
  // 开局微信好友：父母（世界观可关）+ 编辑器里勾了「开局在微信」的人物；加了微信自然也算已结识
  const wxStart = [...(getWorld().content.familyWx === false ? [] : FAMILY_NPC_IDS), ...PEOPLE.filter((p) => p.wxStart).map((p) => p.id)];
  const simWithFamily = { ...sim, metPeople: Array.from(new Set([...sim.metPeople, ...FAMILY_NPC_IDS, ...wxStart])) };
  const worldNav = getWorld().content;
  const g: GameState = {
    id: uid(),
    player,
    npcs: [...family, ...seedNpcs()],
    story: [],
    options: [],
    world: { time: `第 1 周 · ${startDateLabel()}`, location: locOf(getWorldStartRoom())?.name ?? "天光公寓", weather: startWeather() },
    memory: "",
    turnCount: 0,
    ended: false,
    epilogue: "",
    createdAt: now,
    updatedAt: now,
    sim: simWithFamily,
    phone: { ...emptyPhone(), contacts: wxStart },
    contract: signed,
    worldId: getWorld().worldId,
    addons: [...getWorld().addonIds],
    entSplit: true,
    // 功能注释：开局带入模组底栏顺序 / 显隐 / 格数（玩家仍可在设置里再改）
    ...(worldNav.navTabs?.length ? { navTabs: worldNav.navTabs.map((t) => ({ ...t })) } : {}),
    ...(worldNav.navSize ? { navSize: worldNav.navSize } : {}),
    ...(() => {
      const fe = getWorldFixedEvents();
      const en = getWorldEndings();
      const tl = getWorldTimeLimit();
      const gd = getWorldGradeDims();
      return {
        ...(fe.length ? { fixedEvents: fe.map((e) => ({ ...e })) } : {}),
        ...(en.length ? { customEndings: en.map((e) => ({ ...e })) } : {}),
        ...(tl ? { timeLimit: { ...tl } } : {}),
        ...(gd?.length ? { gradeDims: gd.map((d) => ({ ...d, src: { ...d.src } })) } : {}),
      };
    })(),
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
        room: s.room === "tianguang" ? "apartment" : s.room,
        visited: (s.visited ?? []).map((r: string) => (r === "tianguang" ? "apartment" : r)),
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

/* 老存档兼容：早期主线把「爱慕」记在 npc.dims 自由轴（界面与提示词都不读，等于丢失），
 * 与关系轴 sim.relations[pid].romantic 错位。现一律并入关系轴：取两者较大值、按角色上限钳制，
 * 家人不计；并入后删掉自由轴里的「爱慕 / 心动」项，只留一份真相（幂等）。 */
const LEGACY_LOVE = new Set(["爱慕", "心动"]);
export function ensureLoveAxis(state: GameState): GameState {
  const sim = state.sim;
  if (!sim || !state.npcs.some((n) => n.dims?.some((d) => LEGACY_LOVE.has(d.label)))) return state;
  let relations = ensureRelations(sim.relations);
  const npcs = state.npcs.map((n) => {
    const legacy = (n.dims ?? []).filter((d) => LEGACY_LOVE.has(d.label));
    if (!legacy.length) return n;
    const v = Math.round(Math.max(...legacy.map((d) => Number(d.value) || 0)));
    if (v > 0 && canRomance(sim, n.id)) {
      const r = relations[n.id] ?? blankRel();
      const romantic = Math.min(romanticCapOf(n.id), Math.max(r.romantic, v));
      if (romantic !== r.romantic) relations = { ...relations, [n.id]: { ...r, romantic } };
    }
    return { ...n, dims: n.dims.filter((d) => !LEGACY_LOVE.has(d.label)) };
  });
  return { ...state, npcs, sim: { ...sim, relations } };
}

/* 把确定性引擎的数值同步到人物档案面板（保持单一真相） */
const SIM_ATTR_KEYS = new Set<string>(["fame", "reputation", "stress", ...ALL_STAT_KEYS]);
export function syncSimToPlayer(g: GameState): GameState {
  const s = g.sim;
  if (!s) return g;
  const attrs = g.player.attrs.map((a) => {
    if (s.cattrs && a.key in s.cattrs) return { ...a, value: s.cattrs[a.key] };
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
    // 人物填了 avatarVariant：开局从本剧已开放的同名头像池抽一张（找不到同名池则留空，不乱抽）
    ...(p.avatarVariant ? { avatar: drawAvatar(p.id, p.avatarVariant, true).url, avatarVariant: p.avatarVariant } : { avatar: "" }),
    bio: p.bio,
    mood: "平静",
    affinity: 0, // 初值由 syncSimToPlayer 从引擎 s.rel 镜像（newGame 末尾统一回灌）
    dims: [
      { label: "信任", value: 0 },
      { label: "友善", value: 0 },
      { label: "敌意", value: 0 },
    ],
    tags: p.tags ?? [],
    attrs: [],
    affinityHistory: [],
    interactions: [],
  }));
}
