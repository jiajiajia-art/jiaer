import type { ThemePref } from "../lib/store";
/* ═══════════════ 模组系统 · 类型契约 ═══════════════
 * 引擎（壳）只认识这些「内容槽」；题材（娱乐圈 / 校园 / 古风…）以模组形式装填。
 * kind=world：世界观包，一局只能选一个；kind=addon：叠加包，可多选，按启用顺序覆盖。
 * 所有字段都是可选的纯数据（可 JSON 序列化），因此用户模组可直接导入 / 导出。 */
import type { LibraryGroup } from "../game/eventLibrary";
import type { CgDef, Faction, FixedCond, FixedEffect, CustomEnding, FixedEvent, WorldBookEntry, IncomeRule, AttrDef, GameRule, Storyline } from "../lib/types";
import type { LookRule } from "../lib/plotLook";
import type { BillsSlot, Car, CreationCopy, FameTier, Gig, MapLocation, NpcPool, Option, SideJob, StatsSlot, TitleDef, Training, WeekendAct, WorldRuleDim, Zodiac } from "../game/data";
import type { GigPriceTable } from "../game/gigLibrary";
import type {
  CalendarContent, ContractsContent, Encounter, HelpContent, ImageCrisisContent, IndustryContent, PersonContent,
  ProjectsContent, QuestRole, RelationsContent, RoomContent, RoomItem, SideQuest, TravelContent,
} from "../worlds/star2005/content";

export type ModKind = "world" | "addon";

export type ModManifest = {
  id: string; // 唯一 id：小写字母 / 数字 / - _
  name: string;
  version: string; // 语义化版本，如 1.0.0
  author?: string;
  description?: string;
  icon?: string; // 模组图标（图片地址 / data URL）
  kind: ModKind;
  dependencies?: string[]; // 依赖的模组 id（addon 常依赖某个 world）
  /* 列表类内容槽（头衔 / 课程 / 打工 / 周末活动 / 建角选项…）的合并方式：
   * replace（缺省）= 整槽替换下层；merge = 按 id 追加 / 替换同 id 条目，保留下层其余条目 */
  slotMerge?: "replace" | "merge";
  /* —— .nmod 扩展包信息（均可缺省，旧模组照常工作） —— */
  category?: ModCategory; // 模板库 / 完整世界 / 功能玩法；缺省按 kind 推断
  cover?: string; // 封面（图片地址 / data:image）
  deps?: ModDep[]; // 带版本要求的依赖；与 dependencies 合并校验
  nativeDeps?: NativeDep[]; // 依赖的原生组件（关闭时阻断启用）
  origin?: ModOrigin; // 安装来源：用于增量更新判断「作者二次修改」
};

export type ModCategory = "template" | "world" | "feature";
export type ModDep = { id: string; min?: string };
export const NATIVE_DEPS = ["phone", "career", "factions", "storylines", "worldBook", "cgs", "pregnancy", "cars", "transport"] as const;
export type NativeDep = (typeof NATIVE_DEPS)[number];
export type ModOrigin = { source?: string; installedAt?: number; version?: string; base?: Record<string, string> };

/* —— 功能玩法扩展：全部是声明式数据，只能「追加注册」，不能 patch 引擎 —— */
export type ModVarDef = { key: string; label?: string; init?: number; min?: number; max?: number };
export type ModCfgDef = { key: string; label?: string; type: "toggle" | "number" | "choice"; def: number; min?: number; max?: number; options?: { v: number; t: string }[] };
export type ModTable = { id: string; label?: string; columns: string[]; rows: Record<string, string | number>[] };
export type ModBranch = { conds: FixedCond[]; match?: "all" | "any"; effects: FixedEffect[] };
export type ModActionDef = { id: string; label?: string; branches: ModBranch[] };
export type ModCondDef = { id: string; label?: string; match?: "all" | "any"; conds: FixedCond[] };
export type ModComponentDef = { id: string; label?: string; type: "meter" | "counter" | "badge" | "table" | "text"; var?: string; max?: number; table?: string; text?: string };
export type ModPanelDef = { id: string; title: string; components: string[] };
export type ModGrant = { mod: string; access: "read" | "rw" };
export type AnimPreset = "none" | "fade" | "slide" | "pop" | "pulse" | "float" | "glow" | "shimmer";
export type ModSkin = {
  bg?: string; fg?: string; accent?: string; border?: string; radius?: number; font?: "inherit" | "serif" | "sans" | "mono" | "round";
  shadow?: "none" | "soft" | "lift" | "neon"; pattern?: "none" | "dots" | "grid" | "stripes" | "paper";
  panelAnim?: AnimPreset; componentAnim?: AnimPreset; duration?: number; // 动画时长 ms
  css?: string; // 自定义 CSS：自动加 [data-nmod="<id>"] 前缀隔离，禁止 @import / expression / 外链脚本
};
/* —— MOD 间通信：默认隔离；只有 exports 里声明的能力对外可见，且须 imports 申请 + 授权才生效 —— */
export type ModParamType = "number" | "boolean" | "string" | "id" | "list";
export type ModParamDef = { name: string; type: ModParamType; label?: string; optional?: boolean };
export type ModExportField = { key: string; label?: string; access: "read" | "rw" }; // key = 本 MOD 的私有变量 key
export type ModExportAction = { id: string; label?: string; action: string; params?: ModParamDef[] }; // action = 本 MOD 内部动作 id
export type ModExportEvent = { id: string; label?: string; params?: ModParamDef[] };
export type ModImportPerm = "read" | "write" | "call" | "subscribe";
/* 模式 A：数据所有者在包里预设授权给指定 MOD（配套绑定场景） */
export type ModPresetGrant = { mod: string; items: string[]; perms: ModImportPerm[] };
export type ModExports = { fields?: ModExportField[]; actions?: ModExportAction[]; events?: ModExportEvent[]; presets?: ModPresetGrant[]; audio?: { id: string; label?: string }[] }; // audio：对外开放的音频 id（他人需 imports 申请 read）
export type ModImportDef = { mod: string; range?: string; items: { name: string; perms: ModImportPerm[]; kind?: "audio" }[] };
export type ModArg = number | boolean | string | (number | boolean | string)[];
export type ModEventFilter = { param: string; op: "eq" | "ne" | "gt" | "gte" | "lt" | "lte"; value: number | boolean | string };
/* 订阅：收到 mod 的 event（且满足 filter）后，执行本 MOD 内部动作 action；事件参数以 "$参数名" 代入 */
export type ModSubDef = { id: string; mod: string; event: string; action: string; filter?: ModEventFilter[]; priority?: number };
export type ModExt = {
  exports?: ModExports; imports?: ModImportDef[]; subs?: ModSubDef[];
  vars?: ModVarDef[]; config?: ModCfgDef[]; tables?: ModTable[];
  actions?: ModActionDef[]; conds?: ModCondDef[]; components?: ModComponentDef[]; panels?: ModPanelDef[];
  grants?: ModGrant[]; skin?: ModSkin;
  demo?: { note?: string; events?: FixedEvent[] }; // 演示工程：示例触发器 / 事件，教你怎样和原生系统串联
};

/* AI 提示片段：引擎拼系统提示词时按需取用 */
export type PromptFragments = {
  /** 剧本基调（作者只改这一处，整段发给模型）。旧模组无此字段时由 gmIntro+worldIntro+narratorPersona 并入 */
  scriptTone?: string;
  /** @deprecated 已并入 scriptTone；读档仍兼容 */
  gmIntro?: string;
  /** @deprecated 已并入 scriptTone；读档仍兼容 */
  worldIntro?: string;
  /** @deprecated 已并入 scriptTone；读档仍兼容 */
  narratorPersona?: string;
  terminology?: string; // 术语表说明（供模型统一用词；编辑器已下架）
  extraRules?: string; // 创作者自由补充的系统提示（原样追加）
  openingDirective?: string; // 开局序章的导演指令
  npcExample?: { id: string; name: string }; // 输出规范 JSON 示例里的 NPC（缺省=本世界第一个 NPC）
  endingHint?: string; // 何为「自然抵达结局」的举例（如「成名/隐退/婚恋定局/意外」）
  mockEpilogue?: string[]; // 未配置 AI 时的兜底后记段落（占位 {name}）
};

/* 功能开关：未提供时取引擎默认（全部开启，即娱乐圈完整玩法） */
export type FeatureFlags = {
  industryTab?: boolean; // 底栏「娱乐圈」主页签（人气榜 / 机遇）
  weeklyPaper?: boolean; // 周报小报
  career?: boolean; // 通告 / 作品 / 项目（演艺事业）
  imageCrisis?: boolean; // 形象 · 舆情危机
  phone?: boolean; // 手机页签
  phoneApps?: string[]; // 手机允许的应用 id 白名单；缺省=全部
  phoneAppsExtra?: string[]; // 追加到白名单的应用（扩展包用；多个包累加）
  pregnancy?: boolean;
  cars?: boolean;
  transport?: boolean; // 交通系统：出行方式 / 车费 / 耗时差异；关闭=点哪去哪，免费
  /** 关系玩法（表白 / 婚礼 / 牵线 / 伴侣加成）；须添加 pack-relations，未声明=关 */
  relationsPlay?: boolean;
};

/* UI 术语：键为引擎内部概念，值为本世界的叫法。
 * 编辑器已不再提供「术语」统一替换表；旧模组 JSON 仍可读。
 * 玩法相关叫法优先走真实配置（属性名 / 通告库 / 成长规则等），见 registry.resolveLiveTerm。 */
export type Terminology = Partial<Record<TermKey, string>>;
export type TermKey =
  | "tabWorld" | "tabIndustry" | "tabNpc" | "tabPhone" | "tabImage" | "tabSim"
  | "hintWorld" | "hintIndustry" | "hintNpc" | "hintImage" | "hintSim" | "hintPhone"
  | "gig" | "fans" | "reputation" | "fame" | "money" | "works" | "advance"
  | "city" | "industry" | "celebrity"; // 城市名 / 行业名 / 「明星」的叫法（不从娱乐圈回退）

/** 手机应用配置（模组编辑器 · 小手机预览写入；缺省=引擎目录默认） */
export type PhoneAppAvail = import("../lib/phoneAppsConfig").PhoneAppAvail;
export type PhoneAppDef = import("../lib/phoneAppsConfig").PhoneAppDef;

/* 地图视觉：底图 / 房间实景照片 / 手摆点位（百分比坐标）。未声明=中性底色 + 自动铺点 */
export type MapHotspot = { x: number; y: number; label?: string };
export type MapVisuals = {
  background?: string; // 舆图底图 URL
  backgroundAlt?: string;
  photos?: Record<string, string>; // 房间 id → 实景照片 URL
  defaultPhoto?: string;
  hotspots?: { panorama?: Record<string, MapHotspot>; single?: Record<string, MapHotspot> };
};

/* 开场白（Opening.tsx）：只渲染作者配置；未声明且无媒体=跳过开幕直接入局。AI 开局剧情在点「开始」后于剧情区生成，与开幕独立 */
export type OpeningCopy = {
  kicker?: string; // 顶部小字
  title?: string;
  subtitle?: string;
  paragraphs?: string[]; // 占位：{name} 主角名 · {school} 母校 · {father}/{mother} 父母职业 · {money} 开局资金 · {parents} 父母态度段
  parents?: Record<string, string>; // 出身 id → 父母态度段（default 兜底），同样支持占位
  waiting?: string; // 全部浮现后的提示语
  cta?: string; // 按钮文案
  /** @deprecated 开幕不再用 AI 写正文；保留字段仅兼容旧模组 */
  mode?: "ai" | "fixed";
  html?: string; // 正文 HTML（填了就替代 paragraphs）；额外占位 {location} 开局地点 · {time} 开局时间
  image?: string; // 开幕头图
  video?: string; // 开幕视频：http(s) 链接或 data: 内嵌
  videoMode?: "header" | "full"; // header=作头图循环播放；full=先全屏播完视频再进文字（无文字则直接开局）
  page?: string; // 自定义开场页（完整 HTML，沙箱全屏运行；数据经 opening 事件注入，见 lib/openingPage.ts）
};

/* 作品展示封面：列表 / 详情 / 书架用；开局游戏菜单不再套用此图 */
/* 封面背景 CG：固定一张 / 多张轮播 / 视频。作品展示与玩家装扮 DIY 共用背景字段 */
export type CoverCgOpts = {
  cgMode?: "fixed" | "carousel" | "video"; // 缺省：填了视频 = 视频，否则固定 CG
  cgs?: string[]; // 轮播 CG（按顺序播放）
  cgInterval?: number; // 每张停留秒数，缺省 6
  cgFx?: "fade" | "slide" | "zoom"; // 切换效果：淡入淡出 / 滑动 / 缓推（Ken Burns），缺省淡入淡出
  cgShuffle?: boolean; // 随机顺序
  cgHideDots?: boolean; // 隐藏底部页码点
};
export type CoverCopy = CoverCgOpts & {
  kicker?: string; // 标题上方小字（玩家 DIY 仍可用；作者作品封面编辑器不再配）
  title?: string;
  subtitle?: string;
  intro?: string; // 简介段
  image?: string; // 背景图
  video?: string; // 背景视频（静音循环，优先于背景图）
  dim?: number; // 背景压暗 0–80（%），缺省 40
  /** @deprecated 作者作品封面已取消自定义 HTML；旧稿残留忽略 */
  mode?: "default" | "media" | "html";
  /** @deprecated 作者作品封面已取消自定义 HTML；旧稿残留忽略 */
  html?: string;
  /** @deprecated 作者作品封面已取消自定义 HTML；旧稿残留忽略 */
  htmlUI?: boolean;
  style?: import("../lib/store").CoverDiy; // 旧作者样式层；玩家「装扮封面」仍可叠 DIY
};

/* 周报文案 */
export type WeeklyPaperCopy = { masthead?: string; tagline?: string };

/* —— 内容槽（引擎通过 mods/live.ts 的 slot() 读取；见 SLOT_KEYS） ——
 * 基础数值类（stats/trainings/sideJobs/zodiacs/startMoney/startDate/weather/relations/calendar/travel）
 *   未声明 = 沿用引擎默认（娱乐圈原值）；
 * 玩法内容类（encounters/sideQuests/contracts/projects/imageCrisis/industry/help/opening/weeklyPaper/map）
 *   未声明 = 该功能关闭，界面自动隐藏。 */
export type ContentSlots = {
  stats?: StatsSlot;
  trainings?: Training[];
  sideJobs?: SideJob[];
  zodiacs?: Zodiac[];
  startMoney?: number;
  /** 功能注释：开局资金货币名称（元 / 灵石 / 星币…）；开局页与局内文案共用，创作者必填 */
  moneyLabel?: string;
  startDate?: string; // 「2005.01.03」（可为一周中任意一天；第 1 周从该日所在周的周一算起）
  /** @deprecated 已下线：不再配置开局时刻；旧稿残留忽略 */
  startTime?: string;
  /** @deprecated 已下线：不再配置每天几点开始；旧稿残留忽略 */
  dayStart?: string;
  /** @deprecated 已下线：不再配置几点算一天结束；旧稿残留忽略 */
  dayEnd?: string;
  weather?: string;
  map?: MapVisuals;
  encounters?: Encounter[];
  sideQuests?: SideQuest[];
  sideQuestCast?: Record<string, QuestRole[]>;
  relations?: RelationsContent;
  calendar?: CalendarContent;
  travel?: TravelContent;
  contracts?: ContractsContent;
  projects?: ProjectsContent;
  imageCrisis?: ImageCrisisContent;
  industry?: IndustryContent;
  help?: HelpContent;
  opening?: OpeningCopy;
  cover?: CoverCopy; // 作品展示封面（列表/详情/书架；开局菜单不用）
  customAttrs?: AttrDef[]; // 自定义角色属性（含分档）
  weeklyPaper?: WeeklyPaperCopy;
  eventGroups?: LibraryGroup[]; // 事件编辑器「事件库」分组；缺省=由 events 自动归为一组
  // —— 建角池（未声明 → 对应下拉隐藏 / 通用兜底） ——
  styles?: Option[]; // 外形风格
  identities?: Option[]; // 出道身份（数值加成；id 对应 creation.paths）
  backgrounds?: Option[]; // 家庭背景
  directions?: Option[]; // 职业方向
  school?: string; // 母校
  parentJobs?: string[]; // 父母职业池
  creation?: CreationCopy; // 建角页文案 / 路径卡片 / 叙事下拉池
  // —— 旧详细设定 / 节日（已并入 worldBook；读档时 fold，新编辑勿再写） ——
  lore?: import("../lib/types").LoreRegion[];
  festivals?: import("../lib/types").Festival[];
  // —— 养成系统 ——
  weekendActs?: WeekendAct[]; // 周末活动（缺省=自由活动 / 彻底休整）
  fameTiers?: FameTier[]; // 名气分档（缺省=通用分档）
  titles?: TitleDef[]; // 头衔（req 阈值全部满足即达成；缺省=无头衔）
  cars?: Car[]; // 座驾 / 交通工具（缺省=无）
  npcPool?: NpcPool; // 随机 NPC 名字 / 方向 / 性格池
  bills?: BillsSlot; // 固定账单：weekly 每周 · monthly 每 4 周
  pregnancy?: import("../game/data").PregnancySlot; // 孕育参数（孕期 / 受孕率 / 察觉时间 / 孩子名字池）
  meals?: import("../game/data").MealPlan[]; // 饮食生活：每周吃什么（周日随账单结算；缺省=无此玩法）
  gigPrices?: GigPriceTable; // 通告库价目表（按星级 1~5）
  allowance?: import("../game/npcKnowledge").AllowanceSlot;
  avatars?: import("../lib/types").AvatarSlot; // 头像库：池开关 + 本剧匹配优先级（私人/公共优先 · 通用兜底）；随模组导入导出
  play?: import("../lib/types").PlaySlot; // 开局游玩偏好（模式 / 叙事视角）· 年龄随日历
  contacts?: import("../game/contacts").ContactsSlot; // 关系档位（嵌人物上方；卡片数值已下线）
  tuning?: import("../game/data").TuningSlot; // 引擎规则：评级概率 / 倍率、休息减压、课程与打工倍率、通用课程等级 // 父母生活费（家境档位 → 金额 / 协商率；未声明=关闭）
};
export const SLOT_KEYS = [
  "stats", "customAttrs", "trainings", "sideJobs", "zodiacs", "startMoney", "moneyLabel", "startDate", "startTime", "dayStart", "dayEnd", "weather", "map",
  "encounters", "sideQuests", "sideQuestCast", "relations", "calendar", "travel", "contracts", "projects",
  "imageCrisis", "industry", "help", "opening", "cover", "weeklyPaper", "eventGroups",
  "styles", "identities", "backgrounds", "directions", "school", "parentJobs", "creation", "lore", "festivals",
  "weekendActs", "fameTiers", "titles", "cars", "npcPool", "bills", "meals", "pregnancy", "gigPrices", "allowance", "tuning", "play", "avatars", "contacts",
] as const satisfies readonly (keyof ContentSlots)[];
export type SlotKey = (typeof SLOT_KEYS)[number];

export type ModContent = ContentSlots & {
  rooms?: Record<string, RoomContent>; // 地图 / 房间
  /** 功能注释：大地图列表；每张下挂一棵地点树（rooms[].mapId） */
  worldMaps?: import("../lib/worldMaps").WorldMapDef[];
  startRoom?: string;
  locations?: MapLocation[]; // 地点名录（地图标签 / 功能说明）；缺省由 rooms[].name 推导
  startMet?: string[]; // 开局即已结识的 NPC id
  /** @deprecated 父母不再开局特例；开局认识/联系人请用人物 metStart / wxStart */
  familyWx?: boolean;
  /** @deprecated 父母专属音色已废；请在人物上配 ttsVoice */
  familyVoices?: { father?: string; mother?: string };
  npcs?: PersonContent[]; // NPC 模板
  items?: RoomItem[]; // 独立物品（房间内物品写在 rooms[].items）
  gigs?: Gig[]; // 通告 / 工作
  events?: FixedEvent[]; // 随机 / 链式事件库
  fixedEvents?: FixedEvent[]; // 预设剧本（新局写入）
  endings?: CustomEnding[];
  timeLimit?: import("../lib/types").TimeLimit; // 主线时限（如 3 年 / 固定截止日期，新局写入存档）
  gradeDims?: import("../lib/types").GradeDim[]; // 结局评定维度（新局写入存档；不设 = 内置四项）
  worldBook?: WorldBookEntry[];
  income?: IncomeRule[]; // 周期收入规则
  gameRules?: GameRule[]; // 玩法规则：如果…否则如果…否则，每天结束 / 每周结算时判定
  storylines?: Storyline[]; // 剧情线 · 主线：有序节点，每天结束判定完成 / 失败
  sidelines?: import("../lib/types").Sideline[]; // 剧情线 · 支线：额外任务，成败不影响主线
  lookRules?: LookRule[]; // 剧情美化：满足条件时临时改变外观（压力爆表变灰、深夜转深色…）
  /** 本作品已安装的玩法 Mod（按游戏独立；开放配置项可调，底层规则只读引用目录版本） */
  playModInstalls?: import("./playModCatalog").PlayModInstallConfig[];
  theme?: ModTheme; // 界面风格：进入本世界时套用的默认皮肤 / 主题色 / 字体 / 深浅色
  worldRules?: WorldRuleDim[];
  prompt?: PromptFragments;
  /** @deprecated 编辑器已移除统一术语表；保留字段以兼容旧模组读取；页签显示名仍可由底栏编辑器同步写入 tab* 键 */
  terms?: Terminology;
  /** 底栏页签：顺序 / 改名 / 显隐（新局写入存档 navTabs；与 terms.tab* 同步） */
  navTabs?: { id: string; label?: string; on?: boolean }[];
  /** 底栏格数（不含中央「日程」；2 的倍数，至少 4） */
  navSize?: 4 | 6 | 8;
  /** 手机各应用：名称 / 图标 / 顺序 / 开局预装（旧 locked/hidden/disabled 读取时归一为商店可下） */
  phoneAppsCfg?: PhoneAppDef[];
  /** 作品默认手机桌面背景（图片 data URL 或 background CSS）；玩家设置里换过则用玩家的 */
  phoneHomeWallpaper?: string;
  features?: FeatureFlags;
  /** 养成页模块勾选：课程 / 打工 / 账单 / 玩法规则；没勾不显示也不套用娱乐圈默认（分档在建角属性，头衔在玩法 Mod） */
  growModules?: import("../game/growModules").GrowModulesFlag;
  bgm?: ModTrack[]; // 内嵌 / 本机 / 链接。启用时并入音频库，关闭或卸载后消失
  audio?: import("../lib/types").AudioAsset[]; // 方式 A：MOD 自带音频，启用时并入全局音频库，关闭 / 卸载即移除
  audioRefs?: string[]; // 作品音频库引用：只记 id，不打包文件（体检时校验是否存在）
  platformAudioRefs?: string[]; // 平台曲库引用：只记 platform: 前缀 id，不写入 bgm，也不进 audioRefs
  platformAutoplay?: string; // 开局自动播放的平台曲目 id，与 bgm[].autoplay 互斥
  musicOrder?: string[]; // 音乐列表的显示顺序键（b: / a: / platform:），不合并曲目本体
  cgs?: CgDef[]; // 模板库 MOD：装入存档的 CG
  factions?: Faction[]; // 模板库 MOD：装入存档的阵营
};

/** src：http(s) 链接 / data: 内嵌音频 / local:<id> 引用本机音乐库 */
export type ModTrack = { id: string; name: string; src: string; autoplay?: boolean };

export type Mod = ModManifest & { content: ModContent; ext?: ModExt; builtin?: boolean };

/* 模组界面风格：留空的项不改玩家当前设置；玩家进游戏后仍可在设置里自行更换 */
export type ModTheme = Partial<Pick<ThemePref, "skin" | "accent" | "font" | "mode">>;

/* 合并后的「当前生效世界」 */
export type ResolvedWorld = {
  worldId: string;
  addonIds: string[];
  chain: Mod[]; // 合并顺序：world → addons
  content: Required<Pick<ModContent, "rooms" | "npcs" | "items" | "gigs" | "events" | "fixedEvents" | "endings" | "worldBook" | "worldRules" | "income" | "gameRules" | "storylines" | "sidelines" | "lookRules">> & {
    startRoom?: string;
    worldMaps?: import("../lib/worldMaps").WorldMapDef[];
    timeLimit?: import("../lib/types").TimeLimit;
    gradeDims?: import("../lib/types").GradeDim[];
    locations: MapLocation[];
    startMet?: string[];
    prompt: PromptFragments;
    terms: Terminology;
    navTabs?: { id: string; label?: string; on?: boolean }[];
    navSize?: 4 | 6 | 8;
    phoneAppsCfg?: PhoneAppDef[];
    phoneHomeWallpaper?: string;
    features: FeatureFlags;
    theme: ModTheme;
  };
};
