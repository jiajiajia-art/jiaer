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

/* 自定义角色属性：创作者定义名称/上限/分档，开局写入 player.attrs，AI 通过 player_changes.attrs 增减 */
export type AttrTier = { min: number; label: string; prompt?: string }; // prompt：升到此档时由作者写的剧情（交 AI 演绎）
export type AttrDef = {
  id: string;
  label: string;
  icon?: string; // emoji
  init: number; // 固定开局值；勾选「固定数值」时用；不勾则开局在 min～max 随机
  /** 开局取值：缺省 / fixed = 用 init；random = 最小～最大随机；dice 为旧稿，开局按 random 处理 */
  initMode?: "fixed" | "random" | "dice";
  /** @deprecated 旧「投骰子」面数；新 UI 已改为范围随机，读档时忽略 */
  dice?: number;
  min?: number; // 下限（缺省 0）
  max?: number; // 上限（不填 = 无上限，适合货币）
  color?: string; // 进度条颜色：jade/coral/gold/danger 或 #hex
  tiers?: AttrTier[]; // 分档（按 min 升序）：达到即显示该档名
  display?: "num" | "tier" | "both"; // 只显示数值 / 只显示档位 / 都显示（缺省 both）
  pin?: boolean; // 显示在顶部状态栏
  /** 功能注释：建角页隐藏（仍写入开局 attrs / 可上状态栏）；创作者在「建角字段」里配 */
  hidden?: boolean;
  tierEvent?: boolean; // 升到新档位时触发一段 AI 剧情
  desc?: string; // 给 AI 的说明：这个属性代表什么、何时增减
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
  traits?: Trait[]; // 旧存档遗留，已不再使用
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
  persona?: NpcPersona; // 固定人物编辑器里的玩家自定义
  birthday?: { m: number; d: number }; // 生日（缺省时按 id 确定性分配）
  agedYear?: number; // 上次过生日长岁的年份（每年仅 +1 一次）
  aliases?: string[]; // 别名 / 曾用称呼（去重匹配用）
  avatarVariant?: string; // 头像取自哪个头像池（池名，须完全一致）
  portrait?: string; // 立绘（玩家上传的抠图，透明底 PNG 最佳）：立绘模式下 TA 说话时站在对话框旁
  home?: string; // 常驻地点（地图房间 id，编辑器里从当前地图已有地点中选）：多数时候待在这里，但照常走动
  edited?: NpcBaseField[]; // 玩家在编辑器里亲手改过的基础资料：资料卡优先显示这些存档值，而非内容池原设定
};

/* 人物基础资料里可由编辑器改写的字段 */
export type NpcBaseField = "name" | "age" | "identity" | "relation" | "bio";

/* 玩家在「固定人物」编辑器里为 NPC 定下的性别 / 人设 / 说话口吻（聊天、通话、主线叙事共用） */
export type NpcPersona = {
  gender?: "男" | "女" | "其他"; text?: string; voice?: string; ttsVoice?: string /* 语音模型音色 */; timeline?: NpcTimelineEntry[];
  rules?: CharRules; // 角色约束规则区：送入该角色的 system
  examples?: CharExample[]; // 示例对话：按场景标签与权重挑选后注入
  blockWords?: string[]; // 单卡屏蔽词：该角色的台词里不得出现（输出时也会被遮掉）
};

/* 角色约束：每项一个独立文本框，留空即不发 */
export type CharRuleKey = "forbid" | "ooc" | "noControl" | "noEnding" | "style";
export type CharRules = Partial<Record<CharRuleKey, string>>;
/* 示例对话：text 推荐 `*动作*「台词」(小声)` 范式；tags 是触发场景（争吵 / 告白 / 日常闲聊 / 自定义）；weight 1~5，缺省 1 */
export type CharExample = { id: string; text: string; tags?: string[]; weight?: number };

/* 人物关系网：人与人之间明确设定过的关系（不含主角——主角的恋人 / 配偶 / 父母 / 子女由恋爱与家庭系统维护）。
 * parent 有方向：a 是 b 的父亲或母亲；partner（现任）/ ex（前任）/ other（其他，如兄妹、师徒）不分方向。
 * 每一对人物最多一条关系；note 是关系说明，noteSide 指只在哪一方的档案里显示（缺省 = 双方都显示）。 */
export type RelKind = "partner" | "ex" | "parent" | "other";
export type RelEdge = { a: string; b: string; kind: RelKind; note?: string; noteSide?: "a" | "b" };
export type RelNet = {
  edges: RelEdge[];
  owned?: string[]; // 关系已由玩家接管的人物：内容池为 TA 写的默认关系不再自动套用（删掉的不会复活）
  noParents?: string[]; // 明确设定「没有父母」的人物（区别于没设定 = 父母未知）
};

/* 人物时间线：when = 「YYYY.MM.DD」（随游戏日期推进：已发生 / 今天 / 近期 / 未来）或自由文字（如「2003年」「童年」，视为过往经历） */
export type NpcTimelineEntry = { id: string; when: string; place?: string; text: string };

export type Segment =
  | { kind: "narration"; text: string }
  | { kind: "dialogue"; speaker: string; text: string }
  | { kind: "system"; text: string };

export type Turn = {
  scene?: string; // 本回合转场到的新地点名（galgame 式转场卡）
  id: string;
  role: "player" | "ai";
  segments: Segment[];
  raw?: string;
  ts: number;
  error?: { title: string; text: string }; // AI 请求失败的提示条（不入 prompt，可重新生成）
  thoughts?: Thought[]; // 回合末尾：在场角色各自没说出口的心事
  newcomers?: string[]; // 本回合剧情里初遇的人物 id：正文底部出名片，由玩家决定结识或暂不结识
};

/* 角色心事：剧情末尾附带的内心独白（只读，偷窥感） */
export type Thought = { name: string; text: string };

/* NPC 视角日记：由心事延伸出的第一人称日记，按人物归档 */
export type DiaryEntry = { id: string; npcId: string; name: string; time: string; turn: number; text: string };

/* CG：新上传只记录图片文件 id；image 仅兼容旧作品中的 URL/data 图片。 */
export type CgDef = {
  _mod?: string;
  id: string;
  title: string;
  imageFileId?: string;
  /** @deprecated 旧作品图片地址；新上传不得再写 data: 到作品配置。 */
  image?: string;
  desc?: string;
  npcId?: string;
  conds: FixedCond[];
  hideBeforeUnlock?: boolean;
  enabled?: boolean;
};

export type Option = { label: string; value: string };

export type World = {
  time: string;
  location: string;
  weather: string;
  note?: string;
};

/* —— 音频库（原生资源，与 CG / 立绘 / 道具同级）—— */
export type AudioKind = "bgm" | "sfx" | "amb"; // 背景音乐 / 短音效 / 环境氛围音
export type AudioAsset = {
  id: string; // 全库唯一：作者上传与 MOD 注入统一按 id 区分
  name: string; kind: AudioKind;
  src: string; // https 链接 / data:audio 内嵌 / idb:<key> 本机存储
  tags?: string[]; cover?: string; folder?: string; note?: string;
  loop?: boolean; // 默认循环（BGM 缺省为 true）
  volume?: number; // 单条独立音量 0–1（缺省 1）
  fadeIn?: number; fadeOut?: number; // 毫秒
  _mod?: string; // 由哪个 MOD 注入（关闭 / 卸载即移除）
  override?: boolean; // 导入冲突时选了「覆盖」：启用期间覆盖库里同 id 的音频
};
export type AudioOp = "play" | "stop" | "stopAll" | "switchBgm" | "volume";
export type AudioCmd = { n: number; op: AudioOp; id?: string; volume?: number; fade?: number; from?: string };
export type AudioSignal = "ended" | "fadeIn" | "fadeOut";

export type GameState = {
  id: string; // 存档 saveId：所有存档私有存储 key 均以 `${id}_` 为前缀隔离
  privateData?: Record<string, string>; // 存档私有数据快照（写槽时附带，读档时恢复）
  saveSummary?: string; // 最近一次 AI 给出的存档摘要（读档列表展示）
  tabDigest?: Record<string, { text: string; turn: number }>; // AI「tabs」分发结果：各 Tab 本回合动向（仅展示，事实以状态中枢为准）
  player: Player;
  npcs: Npc[];
  story: Turn[];
  options: Option[];
  world: World;
  memory: string; // 压缩后的主线记忆
  npcKb?: Record<string, import("../game/npcKnowledge").NpcKnowledge>; // 每个 NPC 的私有知识库（严格隔离）
  allowance?: import("../game/npcKnowledge").AllowanceState; // 生活费发放 / 协商记录
  turnCount: number;
  ended: boolean;
  epilogue: string;
  endingTitle?: string; // 结局定级标题（依据名气/口碑/奖项或破产）
  endingTag?: string; // 结局定级副标题
  endingId?: string; // 命中的自定义结局 id
  endingBadge?: string; // 结局类型标签（如「隐藏结局」「真结局」「结局 2/5」）
  endingSubTitle?: string; // 同时获得的副称号（如「超级美」）
  endingQuote?: string; // 结局画框底部寄语金句
  endingComment?: string; // 结局评定专属寄语
  endingImage?: string; // 结局专属插图/CG
  endingHero?: string; // 结局评定界面顶部主视觉
  endingCommentBy?: string; // 结局寄语署名（评定人）
  endingCommentAvatar?: string; // 评定人头像
  endingGrade?: { grade: string; score: number; verdict: string; items: { label: string; score: number; detail: string }[] }; // 人生评级
  endingKind?: "manual" | "ai" | "bankrupt" | "finish"; // 结局来源：手动结束 / AI 判定 / 破产 / 时限
  createdAt: number;
  updatedAt: number;
  sim: SimState; // 确定性数值引擎（八维/日程/通告/攻略线）
  contract?: SignedContract; // 开局签署的经纪合约（快照，只读展示）
  phone?: PhoneState; // 手机系统：仿真通讯（微信/短信/电话）持久化
  navSize?: 4 | 6 | 8; // 底栏格数（2 的倍数，至少 4；中央「推进」不计）
  navTabs?: { id: string; label?: string; on?: boolean }[]; // 编辑器自定义底栏：顺序 / 改名 / 显隐
  worldRules?: WorldRules; // 世界·社会规则：玩家可在设置里下拉选择/开关，注入 AI 叙事
  worldBook?: WorldBookEntry[]; // 世界书：按关键词分组的设定片段，命中时注入 AI 提示
  wbMem?: WorldBookMem; // 世界书运行记录：一次性条目已消耗 / 持续 N 轮的到期轮次
  mapEdits?: MapEdits; // 地图编辑：玩家对各点位的覆写（名称/描述/背景图/自定义物件）
  attrTierSeen?: Record<string, string>; // 各属性已演绎过的档位
  attrDefs?: AttrDef[]; // 本局自定义属性定义（开局从模组拷贝）
  walletAttr?: string; // 手机钱包绑定的货币属性（AttrDef.id）；不填 = 游戏资金（元）
  arrivalsFired?: string[]; // 已触发的条件抵达 id
  branch?: Branch; // 进行中的支线：点事件进入，主线暂停；本支线内行动不扣体力
  journal?: JournalEntry[]; // 剧情志：每一次触发的剧情事件独立成篇，可收藏、导出
  timeLimit?: TimeLimit; // 主线时限：到期即强制进入结局
  customEndings?: CustomEnding[]; // 自定义结局：按顺序判定，首个满足条件者生效
  factions?: Faction[]; // 阵营派系：声望存于 sim.flags["faction:<id>"]
  factionMode?: "full" | "lore"; // full = 声望参与数值（好感波及、商店价格、条件）；lore = 只把阵营标签当世界书关键词，不做数值运算
  timeline?: TimelineEntry[];
  engineRules?: Partial<EngineRules>; // 底层世界规则（判定 / 标记 / 随机 / 叙事权限 / 数值 / NPC / 记忆 / 媒体）；缺省项取默认
  memAt?: number; // 上次压缩主线记忆时的 turnCount（按 token 阈值触发压缩） // 主线复盘时间线：自动记录的关键变动（最近若干条）
  gradeDims?: GradeDim[]; // 结局评定界面「各项等级判定」的维度（不设 = 内置可爱度/美丽度/成长度/故事完成度）
  randomGroups?: string[]; // 事件库中开启「随机触发」的分组 id（缺省 = 全部「NPC 之间」分组）；无需导入，满足条件时随机上演
  fixedEvents?: FixedEvent[]; // 固定事件：创作者预设的剧本桥段，满足条件后由代码判定触发
  worldId?: string; // 模组：本局世界观 id（老存档缺省 = "ent"）
  advancePref?: { unit: "day" | "week" | "month" | "year"; count: number }; // 玩家自选的推进单位（缺省 = 模组设定）
  playerAgedYear?: number; // 主角年龄随日历：上次长岁所在的年份（每年只长一次）
  playPrefs?: PlayPrefs; // 本局游玩偏好：游玩模式 / 叙事视角 / 屏幕方向（开局按模组默认+建角所选，设置里可改）
  startDate?: string; // 本局开局日期（建角时玩家自选；缺省 = 世界观设定）
  addons?: string[]; // 模组：本局启用的叠加包 id（按优先级顺序）
  entSplit?: boolean; // 娱乐圈拆包后创建 / 已迁移的存档（缺省 = 老存档，读档时补上原版玩法扩展包）
  diaries?: DiaryEntry[]; // NPC 视角日记
  cgs?: CgDef[]; // CG 定义（作者编排）
  audio?: AudioAsset[]; // 音频库：作者上传的音频（MOD 注入的不存这里，随 MOD 启用动态合并）
  audioFolders?: string[]; // 音频库分类文件夹
  audioVolume?: number; // 作品音量 0–1（介于平台全局音量与单条音量之间）
  skinBgm?: Record<string, string>; // 皮肤 id → 切到该皮肤时联动播放的 BGM
  cgUnlocked?: Record<string, string>; // 已解锁 CG id → 解锁时的游戏时间
  cgNew?: string[]; // 本存档尚未打开图鉴确认过的新解锁 CG
  cgDialogue?: Record<string, string>; // 当前存档解锁瞬间对应的剧情文字
  relNet?: RelNet; // 人物关系网（人与人之间明确设定的关系；缺省 = 只用内容池里写明对方 id 的默认关系）
  npcIntro?: Record<string, "pending" | "skip">; // 剧情初遇：pending = 名片待决定；skip = 玩家选择暂不结识（结识后移除）
};

/* 剧情事件：绑定在地图点位上的一段可触发桥段。
 * annotation 为地图上给玩家看的「这里能做什么/会发生什么」批注；
 * seed 是交给 AI 演绎的场景种子；once 为真则触发一次后隐藏。 */
export type SpotEvent = {
  id: string; // 稳定 id（保存时生成，形如 evt_xxx）
  title: string; // 事件名（地图标记 + 剧情志标题）
  annotation?: string; // 点位批注：可做什么 / 会发生什么
  seed: string; // 交给 AI 演绎的场景种子
  once?: boolean; // 是否一次性（触发后不再出现）
  energy?: number; // 进入支线扣的行程点（缺省 1，0~5；每点 = 走一段路的体力；支线内行动不再扣）
};

/* 支线：从地图事件 / 邂逅 / 支线剧情进入的一段独立剧情。入口扣一次体力，之后在支线内的行动免体力。 */
export type Branch = {
  kind: "spot" | "quest";
  srcId: string;
  title: string;
  annotation?: string;
  seed: string; // 入口场景种子（喂给每一回合的 AI）
  location?: string;
  when?: string;
  cost: number; // 入口已扣的体力（= 行程点 × 每段体力，用于失败退回）
  turns: Turn[];
  options: Option[];
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
  prompt?: string; // 拾取或使用时的 AI 剧情提示词（可选）
};

/* 玩家在地图编辑器里为某个点位新增的日常行动（点击后执行并交 AI 演绎） */
export type CustomSpotAct = {
  id: string; // 稳定 id（形如 act_xxx）
  label: string; // 行动名，如「练声」「泡温泉」「翻阅古籍」
  hint?: string; // 副标题/说明，如「声乐小幅提升 · 交 AI 演绎」
  cost?: number; // 消耗行程点（0~5，缺省 1）
  prompt?: string; // 交给 AI 演绎的行动提示词（可选，留空则按 label + hint 演绎）
  effects?: Record<string, number>; // 执行时的固定数值结算：属性键 / stress / mood / energy / money（负数=扣除）
  require?: Record<string, number>; // 执行门槛：各项需 ≥ 该值（属性键 / fame / money / mood / energy 等）
  perWeek?: number; // 每周最多执行次数（缺省 / 0 = 不限）
};

/* 单个点位的玩家覆写：留空的字段回落到世界内容池的默认值 */
/* 地点商店里的一件商品：购买 = 一次 0 行动点的地点行动（扣价 + 结算效果） */
export type ShopGood = {
  id: string; // 稳定 id（形如 good_xxx）
  name: string;
  desc?: string;
  price: number; // 售价（资金）
  effects?: Record<string, number>; // 购买后的数值效果
  require?: Record<string, number>; // 购买门槛
  perWeek?: number; // 每周限购（0 / 缺省 = 不限）
  toBag?: boolean; // 买下后放入行囊（可在行囊里查看、赠送）
  replyPrompt?: string; // 买下后 AI 回复的设定（店员反应、商品细节、后续剧情走向）
};
export type MapSpotEdit = {
  shop?: ShopGood[]; // 地点商店商品
  name?: string; // 覆写点位名称
  desc?: string; // 覆写场景描述（正文旁白）
  background?: string; // 覆写背景图 URL
  x?: number; // 点位在全景/地图上的 X 视角坐标 (%)
  y?: number; // 点位在全景/地图上的 Y 视角坐标 (%)
  items?: CustomSpotItem[]; // 玩家新增的点位物件
  acts?: CustomSpotAct[]; // 玩家新增的地点日常行动
  events?: SpotEvent[]; // 玩家新增的可触发剧情事件（地点备注 → 触发剧情）
  actCost?: Record<string, number>; // 各地点活动消耗的行动点（活动 id → 点数；缺省 1）
  sheet?: string; // 所在底图 id（缺省 = 主地图）
  jumpTo?: string; // 点击跳转：玩家点此地点直接切到另一张底图
  custom?: boolean; // 自建地点（不在世界观房间表里，由地图编辑器添加）
  link?: string; // 自建地点与哪个地点相连（缺省=开局房间），用于移动寻路
  icon?: string; // 地点图标：emoji 或图片（data:/http）
  start?: boolean; // 默认开局起点（全图唯一）
  startFor?: string[]; // 按建角选项开局：选中这些身份/出身（id 或名称）即从此开局
  unlock?: "open" | "story" | "cond"; // 开局即显示 / 叙事揭示（到过才显示）/ 条件解锁
  unlockConds?: FixedCond[]; // unlock=cond 时全部满足才显示
  arrivals?: MapArrival[]; // 条件抵达：满足后自动来到此地，每条只触发一次
};

/* 条件抵达：年龄 / 周数达标即自动前往；同时满足多条取地点列表靠前者 */
export type MapArrival = { id: string; minAge?: number; minWeek?: number; note?: string };

/* 地图底图：多张底图用箭头切换；地点按 MapSpotEdit.sheet 归属 */
export type MapSheet = { id: string; name: string; bgUrl?: string };

export type GlobalMapConfig = {
  mode?: "panorama" | "single"; // 360°全景可平移模式 vs 单屏全貌模式
  bgUrl?: string; // 自定义星城地图背景图 URL（= 主地图底图）
  sheets?: MapSheet[]; // 多底图（按切换顺序）；缺省只有主地图
};

/* 地图覆写表：以点位 id 为键，`_config` 存放全局地图模式与背景配置 */
export type MapEdits = Record<string, MapSpotEdit | any> & { _config?: GlobalMapConfig };

/* ═══════════════ 固定事件（创作者预设的剧本桥段） ═══════════════
 * 由代码判定是否满足触发条件；满足后先由代码结算数值，再把提示词交 AI 演绎。
 * 未触发前对玩家与 AI 完全隐藏——不进任务列表、不上地图、不入记忆、不写剧情志。
 * 所有条件默认「同时满足」。除 prompt/name 外一切字段皆可留空。*/

/* 触发条件：只能引用项目已有的属性 / NPC / 地点 / 物品 / 已发生事件，不能手填字段。 */
/* 数值比较符：属性 / 指标 / 好感 / 规则变量条件通用 */
export type CmpOp = "gte" | "lte" | "eq" | "gt" | "lt";
export const CMP_OPS: { v: CmpOp; t: string }[] = [
  { v: "gte", t: "≥" }, { v: "lte", t: "≤" }, { v: "eq", t: "=" }, { v: "gt", t: ">" }, { v: "lt", t: "<" },
];
export const cmpSym = (op: CmpOp) => CMP_OPS.find((o) => o.v === op)?.t ?? "≥";
export type FixedCond =
  | { kind: "stat"; key: string; op: CmpOp; value: number } // 主角八维属性，如 演技 ≥ 300
  | { kind: "metric"; key: string; op: CmpOp; value: number } // 名气/口碑/压力…
  | { kind: "rel"; key: string; op: CmpOp; value: number } // 与某 NPC 关系，如 与林宜 ≥ 20
  | { kind: "location"; key: string } // 当前地点为…
  | { kind: "item"; key: string } // 持有物品…
  | { kind: "event"; key: string } // 已触发事件…
  | { kind: "time"; unit: "day" | "week" | "month" | "year"; op: "gte" | "lte"; value: number } // 开局后已过时间，如 ≥ 2 年 / ≤ 6 个月
  | { kind: "date"; op: "gte" | "lte"; date: string } // 游戏日期（YYYY.MM.DD）在…之后/之前
  | { kind: "flag"; key: string; op: CmpOp; value: number } // 规则变量（由玩法规则 / 事件写入，未写过视为 0）
  | { kind: "clock"; from: string; to: string } // 当日时段「HH:MM」~「HH:MM」，可跨午夜（如 22:00~06:00）
  | { kind: "quest"; key: string; state: QuestState } // 主线 / 目标进度：key = 主线 id 或节点 id
  | { kind: "side"; key: string; state: SideState } // 支线进度：done = 至少完成过一次
  | { kind: "faction"; key: string; op: CmpOp; value: number } // 阵营声望（flags["faction:<id>"]，-100~100，未写过为 0）
  | { kind: "visited"; key: string } // 去过某地点（含其子地点）
  | { kind: "relSet"; keys: string[]; op: CmpOp; value: number; need?: number } // NPC 好感集合：其中至少 need 人（缺省 = 全部）满足
  | { kind: "memory"; key: string } // 记忆标记：由事件 / 选项写下的「主角记得这件事」（flags["mem:<key>"]）
  | { kind: "flagSet"; key: string; exists: boolean } // 标记是否存在（写过且非 0）
  | { kind: "group"; match: "all" | "any"; not?: boolean; conds: FixedCond[] }
  /* —— 功能 MOD 扩展（只追加，不改原生判定）：私有数据 / 配置分支 / 自定义条件算子 —— */
  | { kind: "modVar"; mod: string; key: string; op: CmpOp; value: number } // MOD 私有变量（sim.modData[mod][key]，与全局 flag 隔离）
  | { kind: "modCfg"; mod: string; key: string; op: CmpOp; value: number } // MOD 配置项（玩家在 MOD 管理里调整的开关 / 档位）
  | { kind: "modCond"; mod: string; id: string }; // 调用 MOD 注册的命名条件算子 // 括号子组：且 / 或，可整体取反（非）；可嵌套

/* 主线与目标：节点按顺序推进；必做节点全部完成 = 主线完成。
 * 进度存于 flags["quest:<id>"]（1 完成 / -1 失败），旧存档无需迁移。 */
export type QuestState = "done" | "failed" | "active" | "pending";
export type QuestNode = {
  id: string;
  name: string;
  desc?: string; // 给玩家 / AI 看的目标说明
  optional?: boolean; // 可选目标：不阻塞主线推进，可与后续节点并行
  conds: FixedCond[]; // 完成条件（节点激活后判定）
  match?: "all" | "any";
  failConds?: FixedCond[]; // 失败条件（任一满足即失败）
  rewards?: FixedEffect[]; // 完成奖励
  unlockIds?: string[]; // 完成后激活的事件 id
  failUnlockIds?: string[]; // 失败分支：失败后激活的事件 id
};
export type Storyline = { _mod?: string; id: string; name: string; desc?: string; enabled?: boolean; nodes: QuestNode[] };

/* 支线：创作者自定义的额外任务，与主线节点、结局互不相干；失败或没接都不打断主线。
 * 进度存于 flags：side:<id>（0 未出现 / 2 进行中 / 1 已完成 / -1 已失败）、
 * sideDone:<id>（累计完成次数）、sideAt:<id>（本次出现的游戏日），旧存档无需迁移。 */
export type SideState = "pending" | "active" | "done" | "failed";
export type Sideline = {
  _mod?: string;
  id: string;
  name: string;
  desc?: string; // 给玩家 / AI 看的任务说明
  enabled?: boolean;
  trigger?: FixedCond[]; // 出现条件（全部满足才出现；留空 = 开局即出现）
  repeat?: boolean; // 可重复：完成 / 失败后条件再满足会再次出现；缺省只触发一次
  hidden?: boolean; // 触发前对玩家隐藏
  conds?: FixedCond[]; // 完成条件；留空 = 不会自动完成
  match?: "all" | "any";
  failConds?: FixedCond[]; // 失败条件（任一满足即失败，可留空）
  limitDays?: number; // 出现后 N 天内未完成即失败（超时）
  rewards?: FixedEffect[]; // 完成奖励（与主线节点同一套效果）
  unlockIds?: string[]; // 完成后激活的事件 id
  failRewards?: FixedEffect[]; // 失败安慰奖，可留空
  failUnlockIds?: string[]; // 失败后激活的事件 id
};

/* 触发后果：所有数值/状态变化由代码结算，AI 不参与判定。 */
/* 周期收入：每次主线推进时间（周结算）时，满足全部条件即向目标数值发放固定或随机数额 */
export type IncomeRule = {
  id: string;
  label: string; // 如「家里生活费」「工资」
  enabled?: boolean; // 缺省开启
  conds?: FixedCond[]; // 全部满足才发放；不填 = 每周都发
  target: { kind: "stat" | "metric"; key: string }; // 发到哪个数值
  min: number; // 固定数额时 min = max
  max: number;
};

export type FixedEffect =
  | { kind: "stat"; key: string; delta: number } // 增减主角属性
  | { kind: "metric"; key: string; delta: number } // 增减名气/口碑/压力/现金…
  | { kind: "rel"; key: string; delta: number } // 增减 NPC 关系
  | { kind: "addItem"; key: string } // 获得物品
  | { kind: "removeItem"; key: string } // 移除物品
  | { kind: "unlockLocation"; key: string } // 解锁地点
  | { kind: "flag"; key: string; delta: number; set?: boolean } // 规则变量：set=设为 delta，否则累加
  | { kind: "faction"; key: string; delta: number } // 增减阵营声望（同时按立场波及该阵营成员的好感）
  | { kind: "memory"; key: string; clear?: boolean } // 写下 / 抹去记忆标记
  | { kind: "modVar"; mod: string; key: string; delta: number; set?: boolean } // 改 MOD 私有变量
  | { kind: "modAction"; mod: string; id: string } // 执行 MOD 注册的触发器动作
  | { kind: "modCall"; mod: string; id: string; args?: Record<string, import("../mods/types").ModArg>; then?: string; onError?: string } // 调用别的 MOD 导出的动作；then / onError = 调用方自己的回调动作
  | { kind: "modEmit"; event: string; args?: Record<string, import("../mods/types").ModArg> } // 广播本 MOD 导出的事件（只能由 MOD 内部动作发出）
  | { kind: "audio"; op: AudioOp; id?: string; volume?: number; fade?: number }; // 音频：播放 / 停止 / 停止全部 / 平滑切换 BGM / 调整音量

/* 玩法规则：创作者自由组合的「如果…否则如果…否则」结算规则。
 * 每天结束 / 每周结算时逐条判定；分支按顺序比对，命中第一个即执行；条件为空的分支 = 「否则」兜底。
 * 命中后优先调用事件库 eventId 的效果，再叠加本分支 effects（规则变量等）；flag 角色规则只改变量、不挂事件。 */
export type RuleBranch = {
  conds: FixedCond[];
  match?: "all" | "any"; // 缺省 all
  effects: FixedEffect[];
  eventId?: string; // 命中后调用 content.events 里的可复用事件
  notice?: string; // 命中时给玩家看的一句提示（写进当日 / 本周结算）；缺省可用事件 prompt
};
export type GameRuleRole = "event" | "flag"; // event=挂钩事件库；flag=只做规则变量计数
export type GameRule = {
  id: string;
  name: string;
  enabled?: boolean; // 缺省开启
  when: "day" | "week"; // 每天结束 / 每周结算
  role?: GameRuleRole; // 缺省 event
  branches: RuleBranch[];
  chance?: number; // 触发概率 1~100（缺省 100）
  once?: boolean; // 一局只触发一次
  cooldown?: number; // 触发后至少间隔几天
};

/* 触发时间：固定游戏日期 / 开始后第几天 / 不设时间（仅凭条件）。 */
/* 游玩偏好：game=游戏模式（正文适中、重选项）；novel=剧情模式（长篇连续叙事，内部值仍为 novel）。pov 为叙事人称 */
export type PlayMode = "game" | "novel";
export type Pov = "1" | "2" | "3";
/** 屏幕方向：建角游玩偏好选定；局内主题 theme.orient 同步生效，设置里可随时改（无锁定） */
export type ScreenOrient = "portrait" | "landscape";
export type PlayPrefs = { mode?: PlayMode; pov?: Pov; orient?: ScreenOrient }; // 不填 mode/pov = 游戏模式 / 跟随世界观；orient 缺省按竖屏
/* 头像池开关（按剧本）：pools 以「我的头像池」池名为键；publicRandom = 参与随机抽图的公共分类名 */
export type AvatarPoolToggle = { pick?: boolean; random?: boolean };
/** 剧本级头像匹配优先级：私人/创作者库 vs 公共库；通用性别兜底。手动锁定始终最高，系统库始终最后。 */
export type AvatarMatchPrefer = "private" | "public";
export type AvatarMatchPrefsSlot = {
  prefer?: AvatarMatchPrefer; // 缺省 = public（平台默认：玩家未选时公共库优先）
  allowUniversalFallback?: boolean; // 缺省 = true（平台默认）；剧本写过则以剧本为准
};
export type AvatarSlot = {
  pools?: Record<string, AvatarPoolToggle>;
  publicRandom?: string[];
  /** 匹配优先级：随模组导入/导出；未写则用平台默认，不读也不写平台全局设置 */
  match?: AvatarMatchPrefsSlot;
};

/** 平台默认：公共库优先 + 启用通用兜底（不得覆盖剧本已保存的 match） */
export const DEFAULT_AVATAR_MATCH_PREFER: AvatarMatchPrefer = "public";
export const DEFAULT_AVATAR_ALLOW_UNIVERSAL = true;

/** 功能注释：解析本剧匹配优先级；未配置时回落平台默认（公共库优先），已保存则绝不被平台默认覆盖 */
export function resolveAvatarMatchPrefs(slot?: AvatarSlot | null): {
  prefer: AvatarMatchPrefer;
  allowUniversalFallback: boolean;
  sourceOrder: Array<"private" | "public" | "system">;
} {
  // 功能注释：仅承认显式 private/public；缺省走公共库优先，避免旧「私人优先」默认盖住未配置剧本
  const prefer =
    slot?.match?.prefer === "private" || slot?.match?.prefer === "public"
      ? slot.match.prefer
      : DEFAULT_AVATAR_MATCH_PREFER;
  // 功能注释：仅当剧本显式写过 allowUniversalFallback 才用其值，否则平台默认 true
  const allowUniversalFallback = slot?.match && Object.prototype.hasOwnProperty.call(slot.match, "allowUniversalFallback")
    ? !!slot.match.allowUniversalFallback
    : DEFAULT_AVATAR_ALLOW_UNIVERSAL;
  const sourceOrder: Array<"private" | "public" | "system"> =
    prefer === "public" ? ["public", "private", "system"] : ["private", "public", "system"];
  return { prefer, allowUniversalFallback, sourceOrder };
}
export type PlaySlot = {
  mode?: PlayMode; // 开局默认游玩模式（缺省 游戏模式）
  pov?: Pov; // 开局默认叙事视角（缺省 = 跟随世界观的叙事口吻，不额外要求人称）
  /** @deprecated 已内置开启，创作者界面不再配置；读到即忽略，保存时会剥掉 */
  ageAuto?: boolean;
  /** @deprecated 已下线：建角不再让玩家自选开局日期；旧稿字段读到即忽略 */
  pickStartDate?: boolean;
  /** @deprecated 已随 pickStartDate 下线 */
  startDateMin?: string; startDateMax?: string;
};

export type FixedEventTime =
  | { kind: "none" }
  | { kind: "day"; day: number } // 游戏开始后的第几天（sim.day ≥ N）
  | { kind: "date"; date: string } // 固定游戏日期（YYYY.MM.DD，当天及以后）
  /* —— 周期触发（可重复；同一周期只上演一次，条件不满足就等下一周期） —— */
  | { kind: "every"; days: number; start?: number } // 从第 start 天起（缺省 0），每隔 days 天一次
  | { kind: "weekly"; dow: number } // 每周几（0=周一 … 6=周日）
  | { kind: "monthly"; d: number } // 每月几号（超过当月天数则取月末）
  | { kind: "yearly"; md: string }; // 每年某月某日「MM.DD」
export const PERIODIC_TIME = new Set(["every", "weekly", "monthly", "yearly"]);

/* 自定义结局：条件全部满足即命中；auto=达成后立即落幕，否则在「结束人生」时按顺序匹配。 */
/* 主线时限：如「3 年」或指定截止日期（如 2008.01.03）——游戏天数达到上限时强制结束，按自定义结局/默认定级落幕 */
export type TimeLimit = {
  value: number;
  unit: "year" | "month" | "week" | "day";
  endDate?: string; // 可选：固定截止日期 YYYY.MM.DD（设置后优先按该日期与开局日期的差值计算总天数）
};
export const TIME_UNIT_DAYS: Record<TimeLimit["unit"], number> = { year: 365, month: 30, week: 7, day: 1 };
export const TIME_UNIT_LABEL: Record<TimeLimit["unit"], string> = { year: "年", month: "个月", week: "周", day: "天" };
export const parseYmdMs = (s?: string): number | null => {
  const m = /^(\d{4})[-./](\d{2})[-./](\d{2})$/.exec(s?.trim() ?? "");
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(ms) ? ms : null;
};
export const limitDays = (t?: TimeLimit, startDate?: string): number => {
  if (!t) return 0;
  if (t.endDate) {
    const endMs = parseYmdMs(t.endDate);
    const startMs = parseYmdMs(startDate || "2005.01.03");
    if (endMs != null && startMs != null && endMs > startMs) {
      return Math.max(1, Math.round((endMs - startMs) / 86400000));
    }
  }
  return t.value > 0 ? Math.round(t.value * TIME_UNIT_DAYS[t.unit]) : 0;
};

export type CustomEnding = {
  _mod?: string; // 归属标记：由模板库 MOD 装入（卸载时只删带此标记的资源）
  id: string;
  title: string;
  body: string; // 结局概述，也作为 AI 后记基调
  badge?: string; // 结局类型标签，如「真结局」「隐藏结局」「普通结局」
  subTitle?: string; // 同时获得副称号，如「超级美」「传奇新星」（留空则自动计算）
  quote?: string; // 结局副评语/寄语金句，如『即使世界再普通，你依然是独一无二的可爱。』
  comment?: string; // 吉祥物/制作人结局评定寄语（留空则按评级自动生成）
  commentBy?: string; // 寄语署名（评定人）：填 NPC 名字会自动带出其头像；留空 = 见过面且好感最高的人物（没有则为吉祥物）
  commentAvatar?: string; // 评定人头像（可选，覆盖自动匹配的人物头像）
  image?: string; // 结局专属插图/CG（拍立得照片或顶部横幅）
  heroImage?: string; // 结局评定界面顶部主视觉（留空 = 主角头像，再退回结局插图）
  grade?: string; // 可选指定总体评级（如 S+ / SSS / S / A / B / C / D），留空则按六维自动评定
  verdict?: string; // 可选指定总评称号（如「传奇一生 · 无可替代」）
  sceneId?: string; // 可选：结局专属剧情段落（作品内固定事件的 id），结算时作为 AI 后记的收尾场景
  conds: FixedCond[];
  minDay?: number; // 至少游玩到第 N 天
  match?: "all" | "any"; // 条件组合：全部满足（默认）/ 任一满足
  condGroups?: CondGroup[]; // 额外条件组：每组内部「且 / 或」，组与组之间、与上面的条件之间为「且」
  auto?: boolean;
  enabled?: boolean; // 默认启用
};

/* 结局评定维度：结局页「各项等级判定」卡片（最多 4 项）。数值取自主角属性或指标（含自定义属性 c:xxx），
 * 达到满分值记 100 分，映射为 S+ ~ D 与 1~5 枚图标；勾选 lower 表示越低越好（如压力、黑粉）。 */
export type GradeDimIcon = "heart" | "star" | "leaf" | "book" | "crown" | "note";
export type GradeDim = {
  id: string;
  label: string; // 如「可爱度」「学业」
  icon: GradeDimIcon; // 图标与配色
  src: { kind: "stat" | "metric"; key: string };
  full: number; // 满分值
  lower?: boolean;
};
export const GRADE_DIM_MAX = 4;
/* 评定维度图标 → 内置图标库字形（GLYPHS 键）/ 名称 / 主色 */
export const GRADE_DIM_ICONS: Record<GradeDimIcon, { glyph: string; label: string; color: string }> = {
  heart: { glyph: "heart", label: "爱心", color: "#ef6b9c" },
  star: { glyph: "star", label: "星星", color: "#a77ce6" },
  leaf: { glyph: "clover", label: "四叶草", color: "#4fae79" },
  book: { glyph: "book", label: "书本", color: "#5b8fdc" },
  crown: { glyph: "crown", label: "皇冠", color: "#e0952f" },
  note: { glyph: "music", label: "音符", color: "#ee8460" },
};

export type FixedEvent = {
  _mod?: string; // 归属标记：由模板库 MOD 装入（卸载时只删带此标记的资源）
  id: string; // 稳定 id（形如 fx_xxx）
  name: string; // 事件名称
  bgm?: string; // 剧情节点 BGM：上演时平滑切换到这首（音频库 id）
  time?: FixedEventTime; // 触发时间，可不填
  conds?: FixedCond[]; // 属性条件，可不填（默认全部满足）
  prompt: string; // 事件提示词（交 AI 演绎）
  effects?: FixedEffect[]; // 触发后的属性变化，可不填
  nextIds?: string[]; // 后续事件（触发后激活），可不填
  once?: boolean; // 是否只触发一次
  locked?: boolean; // 需由前置事件激活后才可触发（默认否）
  random?: boolean; // 随机触发：不按顺序必触发，而是满足条件时按概率随机上演（NPC 之间事件默认开）
  keywords?: string[]; // 关键词触发：玩家发言 / 近两回合剧情出现任一词即触发（仍需满足时间与条件）；填了就不再按顺序自动上演
  endKeywords?: string[]; // 结束关键词：触发后事件设定每回合持续发给 AI，直到 AI 正文出现任一结束词才结束
  cooldown?: number; // 冷却天数：可重复事件两次上演之间至少间隔几天（不填 = 无冷却）
  choices?: EventChoice[]; // 事件选项：上演后替换 AI 给的选项，玩家选中由代码结算对应效果（最多 3 个）
  /** 功能注释：勾选后开局用本条 prompt 参与第一场剧情生成 */
  openingPrompt?: boolean;
  /* —— 细化设定（均可缺省，旧事件行为不变）—— */
  trigger?: EventTrigger; // 触发类型；缺省 = 时间 / 条件自动触发（按顺序）
  condMatch?: "all" | "any"; // 属性条件组合：全部满足（缺省）/ 任一满足
  condGroups?: CondGroup[]; // 额外的「且 / 或」条件组：每组都要成立
  chain?: string; // 所属事件链 id：同链事件共享 暂停 / 中断 / 永久失败 状态（flags["chain:<id>"]）
  chainBreaks?: ChainBreak[]; // 事件链断点：条件满足时把整条链置为对应状态
  inline?: boolean; // 插入对话流：上演时直接写进主剧情（酒馆式），而非弹出剧情幕
};

/* 触发类型：除 auto 外，都在「那一刻」判定一次（同时仍需满足时间 / 条件 / 前置激活），不满足就错过 */
export type EventTrigger =
  | { kind: "auto" } // 时间自动触发：到点且条件满足，按顺序上演（旧行为）
  | { kind: "enter"; room: string } // 地点进入：主角进入该地点（或其子地点）
  | { kind: "action"; text: string } // 行动完成：主角的一次行动（主线输入）落地成功，且内容包含这段文字
  | { kind: "choice"; event: string; choice: string } // 对话分支：玩家在某事件里选了某个选项
  | { kind: "rel"; npc: string; delta: number } // 好感变化：与某人的关系累计变化达到 delta（正数 = 上升至少，负数 = 下降至少）
  | { kind: "item"; item: string } // 道具获得：背包里新出现该物品
  | { kind: "round"; every?: number; at?: number } // 轮次：主线会话第 at 轮，或每 every 轮一次
  | { kind: "modEvent"; mod: string; event: string; filter?: import("../mods/types").ModEventFilter[] } // MOD 事件：某 MOD 广播了它导出的事件
  | { kind: "audio"; on: AudioSignal; id?: string }; // 音频信号：播放结束 / 淡入完成 / 淡出完成（id 缺省 = 任意音频）

/* 条件组：match = all（且）/ any（或） */
export type CondGroup = { match: "all" | "any"; conds: FixedCond[] };
/* 事件链断点：paused = 条件成立期间暂停、不成立自动恢复；interrupted = 中断（效果把 chain:<id> 设回 0 即恢复）；failed = 永久失败 */
export type ChainState = "paused" | "interrupted" | "failed";
export type ChainBreak = { state: ChainState; group: CondGroup; note?: string };

/* 事件选项：可带出现条件；选中后结算效果、激活后续事件，并把 prompt 交给 AI 续写 */
export type EventChoice = {
  id: string;
  label: string; // 玩家看到的选项文案
  prompt?: string; // 选中后交给 AI 的续写指引（不填 = 用文案）
  conds?: FixedCond[]; // 出现条件（不满足则不显示）
  effects?: FixedEffect[];
  nextIds?: string[]; // 选中后激活的事件 id（事件链分支）
  condMatch?: "all" | "any"; // 出现条件组合：全部（缺省）/ 任一
  condGroups?: CondGroup[]; // 额外的「且 / 或」条件组
  hidden?: boolean; // 隐藏分支：不显示为选项；事件上演时条件满足就自动走这条分支
  check?: CondGroup; // 成功判定：选中后不满足即走失败分支
  failPrompt?: string; failEffects?: FixedEffect[]; failNextIds?: string[]; // 失败分支
};

/* 世界书条目：名称 · 正文 · 关键词 · 必须挂本作品地点或人物。
 * 注入时机：玩家在挂靠地点、挂靠人物在场、或正文提到关键词（OR）。
 * 旧条目可无依赖（constant / 全局），兼容内置世界；创作者新写必须有 bindRooms / bindNpcs。 */
export type WorldBookEntry = {
  _mod?: string; // 归属标记：由模板库 MOD 装入（卸载时只删带此标记的资源）
  id: string;
  title: string; // 条目名（便于管理，也会随正文注入）
  keywords: string[]; // 触发关键词（子串命中即算）
  content: string; // 设定正文
  enabled: boolean; // 单条开关
  constant?: boolean; // 蓝灯：每回合常驻注入（无需关键词命中）；兼容旧档时以「关键词为空」视为常驻
  order?: number; // 插入顺序/优先级（越小越靠前、越受重视），缺省 100
  probability?: number; // 绿灯触发概率 0~100（命中关键词后仍按此概率决定是否注入），缺省 100 必触发
  /* —— 细化设定（均可缺省，旧条目行为不变）—— */
  mode?: WorldBookMode; // 注入模式；缺省时按 constant / 关键词为空 推断
  duration?: number; // 有效期：触发后持续注入 N 轮（含触发这一轮），到期自动失效；缺省 / 0 = 只在命中的这一轮
  scope?: "global" | "npc" | "room"; // 旧绑定：全局 / 单角色 / 单房间（新条目请用 bindRooms / bindNpcs）
  scopeId?: string; // scope 为 npc / room 时绑定的人物 id / 地点 id
  bindRooms?: string[]; // 依赖地点（本作品 rooms id，可多选）
  bindNpcs?: string[]; // 依赖人物（本作品 npcs id，可多选）
  group?: string; // 互斥组：同组只注入一条（已在有效期内的优先，其次检索得分最高的）
  weight?: number; // 检索权重（缺省 100）：得分 = 命中关键词长度 × 权重 / 100，长词优先
};
export type WorldBookMode = "keyword" | "constant" | "once";
export type WorldBookMem = { used?: string[]; until?: Record<string, number> };

/* —— 详细设定：地区 → 势力 → 角色 三层嵌套 ——
 * 每个节点至少有 名称 / 简介 / 完整设定。主角所在地区发完整设定（含下属势力与角色）；
 * 其他地区只发名称 + 简介组成速查表；剧情里提到别处的地区 / 势力 / 角色时，单独补发其完整设定。 */
export type LoreNode = {
  id: string;
  name: string;
  brief: string; // 简介：一两句话，进速查表
  detail: string; // 完整设定：只在「身处此地」或「被提及」时发送
  keywords?: string[]; // 别名 / 关键词：提及判定除名称外也认这些
};
export type LoreChar = LoreNode & { npcId?: string }; // 可关联地图上的 NPC
export type LoreFaction = LoreNode & { chars?: LoreChar[] };
export type LoreRegion = LoreNode & {
  rooms?: string[]; // 属于本地区的地图地点 id（主角在这些地点 = 身处本地区）
  factions?: LoreFaction[];
  chars?: LoreChar[]; // 不属于任何势力、直属本地区的角色
};

/* 节日：平时只发名称与日期；临近（提前 lead 天）到结束期间、或剧情提到关键词时，发送完整设定 */
export type Festival = {
  id: string;
  name: string;
  date: string; // 「MM-DD」每年这天
  days?: number; // 持续天数，缺省 1
  lead?: number; // 提前几天开始发送完整设定，缺省 3
  brief?: string;
  detail: string;
  keywords?: string[];
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
  // 流式输出（默认关闭：整段生成完再显示）
  stream?: boolean;
  // 思考强度：none 关闭思考（默认）
  reasoningEffort?: "none" | "low" | "high" | "max";
  // 生图模型（OpenAI 兼容 /images/generations）；URL/Key 留空则沿用上方文本模型的
  imgBaseUrl?: string;
  imgApiKey?: string;
  imgModel?: string;
  imgSize?: string;
  // 语音合成（OpenAI 兼容 /audio/speech）；未配置模型则用浏览器自带朗读
  ttsBaseUrl?: string;
  ttsApiKey?: string;
  ttsModel?: string;
  ttsVoiceFemale?: string; // 女声音色
  ttsVoiceMale?: string; // 男声音色
  ttsSpeed?: number; // 语速 0.5~2
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
    identity?: string;
    history_add?: { title: string; detail: string };
    extra?: { label: string; value: string }[];
  };
  npc_changes?: {
    id?: string;
    name: string;
    aliases?: string[]; // 称谓/昵称（如「二姨」），用于后续同人识别
    age?: string;
    identity?: string;
    relation?: string;
    bio?: string;
    mood?: string;
    tags?: string[];
    affinity_delta?: number;
    dims?: { label: string; delta?: number; value?: number }[];
    reason?: string;
    interaction?: string;
    self_event?: string; // NPC 自身发生的事 → 私有 selfMemory
    avatar_variant?: string; // 新人物的头像池名（须与池名一字不差）
    links?: { id?: string; name?: string; kind?: string; note?: string }[]; // 仅新人物：剧情明确交代的、与已有人物（按 id；只给全名时按名字 / 别名精确匹配）的关系；kind 指对方是 TA 的什么人
  }[];
  thoughts?: { name: string; text: string; diary?: string }[]; // 在场角色心事；diary 为可选的第一人称日记
  intimate?: string[]; // 本回合与主角发生亲密关系的 NPC 名字（用于隐藏生育判定）
  phone?: import("../game/phoneLink").PhoneStep; // 线下剧情让角色主动上线：发绿信 / 拉群 / 来电 / 邮件 / 好友申请
  game_end?: boolean;
  epilogue?: string;
  // —— 统一状态中枢协议（结构化输出六字段）——
  narrative?: string; // 本回合剧情文本（= narration）
  state_diff?: { world?: Partial<World>; player_changes?: AIStep["player_changes"]; npc_changes?: AIStep["npc_changes"]; intimate?: string[]; game_end?: boolean };
  tabs?: Record<string, unknown>; // 分发给各 Tab 的数据（仅作展示提示，事实以状态中枢为准）
  memory_updates?: { scope?: "main" | "npc"; npc?: string; text: string }[] | string[];
  save_summary?: string;
  need_clarification?: string[];
};

/* —— 阵营派系 —— */
export type FactionStance = "core" | "member" | "ally"; // 核心 / 成员 / 亲近
export type Faction = {
  _mod?: string; // 归属标记：由模板库 MOD 装入（卸载时只删带此标记的资源）
  id: string;
  name: string;
  desc?: string; // 阵营设定（作为世界书正文注入）
  tags?: string[]; // 阵营标签 / 别称：作为世界书关键词
  members?: { npc: string; stance: FactionStance }[];
  rooms?: string[]; // 阵营控制的地点：在这些地点购物按声望调价
};

/* —— 主线复盘时间线 —— */
export type TimelineKind = "time" | "place" | "rel" | "stat" | "event" | "quest" | "faction";
export type TimelineEntry = {
  id: string;
  turn: number;
  time: string; // 当时的游戏时间
  location: string; // 当时所在地点名
  items: { kind: TimelineKind; text: string }[];
  cp?: string; // 检查点 id：可回到此刻 / 从这里开平行分支
};

/* ——— 底层世界规则（双模式共享的引擎约束；酒馆 = 世界书 / 会话模式） ——— */
export type FlagLife = "perm" | "temp" | "once"; // 永久 / 临时（对局结束清除）/ 一次性（下一回合清除）
export type CdState = "reply" | "named" | "silent"; // 冷却中：照常回应 / 仅点名才回应 / 完全沉默
export type EngineRules = {
  flags: { life: Record<string, FlagLife>; shareModes: boolean; clearTempOnEnd: boolean };
  random: { seed: number; perRoom: boolean };
  narrative: { aiControlPlayer: boolean; aiForceEnding: boolean; tagNarration: boolean; oocMarks: string[] };
  affinity: { min: number; max: number; decay: boolean; decayRate: number; noDecay: string[]; overflow: "cap" | "flag" };
  attrs: { numeric: boolean; step: number; stressLimit: number; stressFlag: string }; // numeric = false：酒馆式，只把数值当文本提示，不做结算
  faction: { spread: boolean };
  npc: { chatCd: number; cdOverride: Record<string, number>; cdState: CdState; npcTalk: boolean; approach: boolean; writeMemory: boolean; roamCost: number; roamEvery: number; roamCrossRoot: boolean };
  memory: { loreMax: number; loreSort: "keyword" | "priority"; loreCrossMode: boolean; summaryTokens: number; keepHistory: boolean };
  text: { blocked: BlockWord[]; regex: StoryRegex[]; order: TextStage[] };
  ai: { summaryModel: string; tokenWarn: number; maxSpeakers: number; placeholders: boolean };
  interact: { freeInput: boolean; rpMarks: boolean };
  save: { tavernIsolated: boolean };
  media: { maxKB: number; imgFormats: string[]; audioFormats: string[]; preload: boolean; fadeMs: number; volume: number; overlap: boolean; spriteAuto: boolean; spriteMatch: "exact" | "emotion" };
};
export type TextStage = "card" | "global" | "regex"; // 单卡屏蔽词 / 全局屏蔽词 / 正则脚本
export type BlockWord = { word: string; replace?: string; priority: number }; // priority 越大越先处理
export type StoryRegex = { id: string; name?: string; find: string; replace: string; flags?: string; on: boolean };
