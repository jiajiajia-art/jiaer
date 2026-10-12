/* ————— 全局数据模型 ————— */
import type { GameState as SimState } from "../game/logic";
import type { PhoneState } from "../game/phone";
export type { SimState };

export type Attr = {
  key: string;
  label: string;
  value: number;
  max: number;
  icon?: string; // 图标名（icons.tsx 的 key）
};

export type Trait = {
  name: string;
  kind: "positive" | "negative" | "neutral";
  desc?: string;
};

export type HistoryItem = {
  turn: number;
  time: string;
  title: string;
  detail: string;
};

export type Player = {
  name: string;
  age: string;
  gender: string;
  identity: string; // 当前身份
  background: string; // 家世背景
  klass: string; // 阶层
  description: string;
  avatar: string; // dataURL 或空
  attrs: Attr[];
  traits: Trait[];
  history: HistoryItem[];
  extra: { label: string; value: string }[]; // 自定义扩展字段
};

export type AffinityDim = { label: string; value: number }; // 信任 / 爱慕 / 敌意 …
export type Interaction = { turn: number; time: string; text: string };
export type AffinityLog = { turn: number; delta: number; reason: string };

export type Npc = {
  id: string;
  name: string;
  age: string;
  identity: string;
  relation: string; // 与玩家关系
  avatar: string;
  bio: string;
  mood: string;
  affinity: number; // 总好感 -100~100
  dims: AffinityDim[];
  tags: string[];
  attrs: Attr[];
  affinityHistory: AffinityLog[];
  interactions: Interaction[];
};

export type Segment =
  | { kind: "narration"; text: string }
  | { kind: "dialogue"; speaker: string; text: string }
  | { kind: "system"; text: string };

export type Turn = {
  id: string;
  role: "player" | "ai";
  segments: Segment[];
  raw?: string;
  ts: number;
};

export type Option = { label: string; value: string };

export type World = {
  time: string;
  location: string;
  weather: string;
  note?: string;
};

export type GameState = {
  id: string;
  player: Player;
  npcs: Npc[];
  story: Turn[];
  options: Option[];
  world: World;
  memory: string; // 压缩后的主线记忆
  turnCount: number;
  ended: boolean;
  epilogue: string;
  endingTitle?: string; // 结局定级标题（依据名气/口碑/奖项或破产）
  endingTag?: string; // 结局定级副标题
  createdAt: number;
  updatedAt: number;
  sim: SimState; // 确定性数值引擎（八维/日程/通告/攻略线）
  contract?: SignedContract; // 开局签署的经纪合约（快照，只读展示）
  phone?: PhoneState; // 手机系统：仿真通讯（微信/短信/电话）持久化
  worldRules?: WorldRules; // 世界·社会规则：玩家可在设置里下拉选择/开关，注入 AI 叙事
  globalSystemPrompt?: string; // 全局 AI 基调：独立于世界书，不作为世界事实展示
  worldBook?: WorldBookEntry[]; // 世界书：按关键词分组的设定片段，命中时注入 AI 提示
  npcAttributeSchema?: { id: string; label: string; enabled: boolean }[];
  npcAttributeValues?: Record<string, Record<string, number>>;
  hiddenCareerIds?: string[];
  careerLibrary?: { id: string; name: string; description: string }[];
  npcCareerIds?: Record<string, string>;
  npcFieldSchema?: { id: string; label: string; enabled: boolean }[];
  npcFieldValues?: Record<string, Record<string, string>>;
  playerAttributeSchema?: import("./playerAttributes").PlayerAttributeField[];
  mapEdits?: MapEdits; // 地图编辑：玩家对各点位的覆写（名称/描述/背景图/自定义物件）
  journal?: JournalEntry[]; // 剧情志：每一次触发的剧情事件独立成篇，可收藏、导出
  mainline?: MainlineConfig;
  mapSignals?: Record<string, number>;
};
export type MainlineBranch = { id: string; title: string; location: string; chance: number; seed: string; enabled: boolean };
export type MainlineConfig = { title: string; synopsis: string; chapters: string[]; branches: MainlineBranch[] };

/* 剧情事件：绑定在地图点位上的一段可触发桥段。
 * annotation 为地图上给玩家看的「这里能做什么/会发生什么」批注；
 * seed 是交给 AI 演绎的场景种子；once 为真则触发一次后隐藏。 */
export type SpotEvent = {
  id: string; // 稳定 id（保存时生成，形如 evt_xxx）
  title: string; // 事件名（地图标记 + 剧情志标题）
  annotation?: string; // 点位批注：可做什么 / 会发生什么
  seed: string; // 交给 AI 演绎的场景种子
  once?: boolean; // 是否一次性（触发后不再出现）
  autoTrigger?: boolean; // 抵达地点时由规则引擎自动抽取
  probability?: number; // 每次抵达的触发概率 0~100
  requiredStat?: string; // 达标属性键；留空表示无属性门槛
  requiredMin?: number; // 属性最低值
};

/* 剧情志条目：一次被演绎过的剧情桥段的独立留存，可收藏 / 导出。 */
export type JournalEntry = {
  id: string;
  kind: "spot" | "quest" | "note"; // 点位事件 / 支线剧情 / 地点备注
  srcId?: string; // 来源事件/支线 id（用于一次性事件的去重）
  title: string;
  annotation?: string;
  seed: string;
  text?: string; // AI 演绎出的正文（触发时落库）
  location?: string; // 触发时所在地点名
  when?: string; // 触发时的世界时间（第几周 · 周几）
  ts: number;
  fav?: boolean; // 是否收藏
};

/* 玩家在地图编辑器里为某个点位新增的物件（可被拾取入行囊，并供 AI 演绎） */
export type CustomSpotItem = {
  id: string; // 稳定 id（保存时生成，形如 usr_xxx）
  name: string;
  desc: string;
  icon?: string; // 展示图标，缺省 ◇
};

/* 单个点位的玩家覆写：留空的字段回落到世界内容池的默认值 */
export type MapSpotEdit = {
  name?: string; // 覆写点位名称
  desc?: string; // 覆写场景描述（正文旁白）
  background?: string; // 覆写背景图 URL
  items?: CustomSpotItem[]; // 玩家新增的点位物件
  events?: SpotEvent[]; // 玩家新增的可触发剧情事件（地点备注 → 触发剧情）
};

/* 地图覆写表：以点位 id 为键 */
export type MapEdits = Record<string, MapSpotEdit>;

/* 世界书条目：为世界设定写的一段规则/背景片段，按关键词分组，方便模型查阅。
 * 当玩家输入或近况文本命中 keywords 中任一词时，content 会作为参考资料注入提示词。
 * keywords 为空表示常驻注入（始终生效）。 */
export type WorldBookEntry = {
  id: string;
  title: string; // 条目名（便于管理，也会随正文注入）
  keywords: string[]; // 触发关键词（子串命中即算）
  content: string; // 设定正文
  enabled: boolean; // 单条开关
  constant?: boolean; // 蓝灯：每回合常驻注入（无需关键词命中）；兼容旧档时以「关键词为空」视为常驻
  order?: number; // 插入顺序/优先级（越小越靠前、越受重视），缺省 100
  probability?: number; // 绿灯触发概率 0~100（命中关键词后仍按此概率决定是否注入），缺省 100 必触发
};

/* 世界·社会规则：玩家自定的世界观设定（婚姻制度 / 冠姓权 / 社会秩序…）。
 * enabled 为总开关；关闭时 AI 沿用现实默认，不受这些选择约束。
 * choices 以规则维度 id → 选项 id 记录（维度与选项定义见 game/data.ts）。 */
export type WorldRules = {
  enabled: boolean;
  choices: Record<string, string>;
};

/* 开局签署的经纪合约快照（内容取自 content-pool，签署后固化到存档） */
export type SignedContract = {
  id: string;
  company: string;
  companyStyle: string;
  focusLabel: string;
  icon: string;
  baseSalary: number;
  revenueShare: number;
  penalty: number;
  exclusive: string;
};

export type AIConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  models: string[];
  temperature: number;
  topP: number;
};

/* AI 结构化返回（剧情推进） */
export type AIStep = {
  narration?: string;
  dialogue?: { speaker: string; text: string }[];
  system?: string;
  options?: Option[];
  world?: Partial<World>;
  player_changes?: {
    attrs?: { key: string; label?: string; delta?: number; value?: number; max?: number; icon?: string }[];
    traits_add?: Trait[];
    identity?: string;
    history_add?: { title: string; detail: string };
    extra?: { label: string; value: string }[];
  };
  npc_changes?: {
    id?: string;
    name: string;
    identity?: string;
    relation?: string;
    bio?: string;
    mood?: string;
    tags?: string[];
    affinity_delta?: number;
    dims?: { label: string; delta?: number; value?: number }[];
    reason?: string;
    interaction?: string;
  }[];
  game_end?: boolean;
  epilogue?: string;
};
