/* ————— 稳定的 Context 载体 —————
 * 独立于 GameProvider 组件文件，保证 React Fast Refresh 在编辑 Provider 时
 * 不会重建 Context 对象标识（否则已挂载的 Provider 与刷新后的消费者会读到
 * 不同的 Context，报出误导性的 “useGame outside provider”）。
 */
import { createContext, useContext } from "react";
import type { Player, Segment, AIConfig, GameState } from "../lib/types";
import type { Character as SimChar } from "../game/logic";
import type { SigningContract } from "../worlds/star2005/content";
import type { ThemePref } from "../lib/store";

export type Screen = "cover" | "create" | "opening" | "game" | "ending";
/* 开新局附加项：建角选项的开局效果 · 游玩偏好 · 自选开局日期 */
export type StartOpts = { fx?: import("../game/data").OptFx[]; playPrefs?: import("../lib/types").PlayPrefs; startDate?: string; pathNpcs?: import("../game/data").PathNpc[]; route?: Pick<import("../game/data").CreationPath, "hero" | "room" | "memory" | "event" | "eventId" | "fx">; factions?: import("../game/data").StartFaction[]; joined?: string[] };
/* 弹窗重试参数：弹窗类行动（事件 / 支线 / 询问）演绎失败时存下原请求，供「重新触发」原样重发 */
export type PopupRetry = { input: string; hideInput?: boolean; journalMeta?: Omit<import("../lib/types").JournalEntry, "id" | "ts" | "text">; preSettled?: boolean };
/* 周结算报告：结构化呈现（不再拼成一大段系统文字） */
export type WeekReport = { week: number; weekTo?: number; span?: string; grade?: string; act: string; gains: string[]; events: { tag: string; text: string }[]; settle: string[]; warnings: string[] };
/* 推进手记：时间解析 + 日程 + 属性变化解析 */
export type Diary = {
  date: string; week: number; season: string; span: string; toSettle: number; left?: number; location?: string;
  days: string[]; sources: string[];
  rows: { label: string; from: number; to: number; hint: string }[];
};
export type Popup = { title: string; segments: Segment[]; changes: string[]; scene?: { location?: string; time?: string }; retry?: PopupRetry; report?: WeekReport; diary?: Diary; newcomers?: string[] } | null;

export type Ctx = {
  cfg: AIConfig;
  setCfg: (c: AIConfig) => void;
  theme: ThemePref; // 玩家保存的外观设置（美化面板读写这一份）
  setTheme: (t: ThemePref) => void;
  look: ThemePref; // 实际生效外观 = theme + 剧情美化规则 + 试看（界面渲染读这一份）
  activeLooks: import("../lib/plotLook").LookResult["active"]; // 此刻生效的剧情美化规则
  lookCss: string; // 生效规则的条件 CSS
  previewLook: (p: import("../lib/plotLook").LookPatch | null) => void; // 编辑器试看（null = 结束）
  lookPreview: import("../lib/plotLook").LookPatch | null;
  screen: Screen;
  go: (s: Screen) => void;
  game: GameState | null;
  busy: boolean;
  lastChanges: string[];
  popup: Popup;
  setPopup: (p: Popup) => void;
  startNew: (player: Player, simChar?: SimChar, contract?: SigningContract, worldRules?: import("../lib/types").WorldRules, opts?: StartOpts) => void;
  loadState: (s: GameState) => void;
  submit: (input: string, asPopup?: boolean) => Promise<void>;
  setPlayerAvatar: (dataUrl: string) => void;
  setNpcAvatar: (id: string, dataUrl: string) => void;
  setNpcPortrait: (id: string, url: string) => void;
  setRelValue: (pid: string, dimId: string, value: number) => void; // 手动调节核心关系轴（好感/心动/信任/近况心情）
  setRomanceable: (pid: string, on: boolean) => string; // 可攻略开关：返回空串 = 已切换，否则为不能切换的原因
  setNpcDim: (pid: string, label: string, value: number) => void; // 手动调节情感印象（爱慕/友善/敌意…）
  saveNow: () => Promise<boolean>; // 立即把当前进度刷入自动存档
  regenerate: () => void; // 重新生成上一回合（AI 输出异常时）
  saveEpoch: number; // 切档代数：游戏界面以此为 key 整树重挂载
  canRetry: boolean; // 最近一次主线请求失败，可重新生成
  retryPopup: () => void; // 弹窗行动失败后「重新触发」
  autosaveOn: boolean;
  setAutosaveOn: (on: boolean) => void;
  endManually: (kind?: "bankrupt" | "finish" | "manual" | "ai") => Promise<void>;
  setWorldRules: (next: import("../lib/types").WorldRules) => void;
  setWorldBook: (next: import("../lib/types").WorldBookEntry[]) => void; // 覆写世界书条目列表并持久化
  setMapEdits: (next: import("../lib/types").MapEdits) => void; // 覆写地图编辑覆写表并持久化
  // —— 固定事件（创作者预设剧本；满足条件后代码判定触发，玩家仅见已实际触发者）——
  setRandomGroups: (ids: string[]) => void; // 事件库分组「随机触发」开关
  setFixedEvents: (next: import("../lib/types").FixedEvent[]) => void; // 覆写固定事件表并持久化
  previewFixedEvent: (ev: import("../lib/types").FixedEvent) => void; // 编辑器预览：临时演绎，不结算/不触发/不入档
  // —— 剧情事件系统（地图点位事件 / 支线剧情 / 剧情志收藏导出）——
  playSpotEvent: (eventId: string) => void; // 触发地图点位上的剧情事件，交 AI 演绎并存入剧情志
  branchAct: (input: string) => void; // 支线内行动（不扣体力）
  leaveBranch: () => void; // 结束支线，回到主线并落入剧情志
  playQuest: (questId: string) => void; // 演绎一段支线剧情并存入剧情志
  toggleFav: (entryId: string) => void; // 收藏 / 取消收藏一条剧情志
  removeJournal: (entryId: string) => void; // 删除一条剧情志
  exportJournal: (onlyFav?: boolean) => void; // 导出剧情志为 Markdown 下载
  // —— 确定性引擎（养成/日程/通告/攻略）——
  setSchedule: (day: number, actId: string | null) => void;
  runWeekNow: () => void;
  endDayNow: () => void;
  advanceNow: () => void; // 按创作者配置的推进单位（日/周/月/年）推进
  equipTitle: (id: string | null) => void; // 佩戴/更换/摘下头衔（纯确定性）
  simVisit: (locId: string) => string;
  simEvent: (encounterId: string) => void; // 触发条件邂逅：结算数值并交 AI 演绎
  simMove: (roomId: string, companionId?: string, trip?: { fee: number; minutes: number; modeLabel: string; ownCar?: boolean }) => string[];
  simPickup: (itemId: string) => string;
  simUseItem: (itemId: string) => string; // 使用背包物品：记录一次确定性交互，不消耗物品
  simGiftItem: (itemId: string, personId: string) => string; // 赠送物品：消耗物品并提升该联系人的关系
  simActivity: (actId: string) => string; // 居家活动：看电视/休息/看书
  simBuy: (itemId: string) => string; // 购买标价物品（书店买书）
  simAskIntel: (personId: string, intelId: string) => string;
  simNegotiate: (gigId: string) => void;
  simAskOffers: (mobId: string) => string; // 找制作人/制片人打听该类通告，返回可读结果
  simChooseArc: (pid: string, idx: number) => void;
  simConfirmDating: (pid: string) => void;
  // —— 通告全生命周期（投递/试镜/签约/拍摄）——
  projApply: (id: string) => void;
  projSign: (id: string) => void;
  projNegotiate: (id: string) => void;
  projPromote: (projectId: string) => void;
  projWorkday: (id: string, strategyId: string) => void;
  // —— 娱乐圈关系（私下联系 / 表白；默认人人可攻略，可在人物页逐人关闭，家人恒不可攻略）——
  simContact: (pid: string, name?: string) => void;
  simWedding: (pid: string) => void;
  simDivorce: (pid: string) => void;
  simConfess: (pid: string, name?: string) => void;
  /** 牵线两位 NPC；返回空串 = 已执行，否则为不能执行的原因 */
  simBridge: (aId: string, bId: string, mode: import("../game/bridge").BridgeMode) => string;
  // —— 制作人对话接通告（登门洽谈 / 逐步追问解锁项目字段）——
  simMeetProducer: (managerId: string, name?: string) => void;
  simAskProducer: (managerId: string, pid: string, questionId: string) => void;
  // —— 人设与危机 ——
  personaDeclare: (id: string) => string[];
  personaAct: (actId: string) => string[];
  crisisResolve: (responseId: string) => string[];
  // —— 逾期违约：制片人上门追责，按对话后议定的最终金额赔付了结 ——
  resolveBreach: (finalFee?: number) => void;
  // —— 车辆：4S 店购车 / 卖车（残值回收）/ 选定座驾（在「主角」页选） ——
  buyCar: (carId: string) => string;
  sellCar: (carId: string) => string;
  setActiveCar: (carId: string | null) => void;
  // —— 「咸鱼」二手集市：挂卖背包物件 / 下架 / 成交（回款 + 买家评价） ——
  xianyuList: (itemId: string, price: number, blurb?: string) => string;
  xianyuDelist: (listingId: string) => string;
  xianyuSell: (listingId: string, agreed?: { price: number; buyer: string }) => string;
  // —— 手机系统 ——
  commitGame: (next: GameState) => void; // 整档提交并持久化（聊天/通话逐条落库）
  patchGame: (fn: (latest: GameState) => GameState) => void; // 基于最新存档做函数式修改（异步回调里用，避免覆盖期间的进度）
  phoneExchange: (personId: string) => boolean; // 交换联系方式：随机同意/拒绝，同意开通私聊
};

// 把 Context 实例挂在 globalThis 上：模块被 HMR 重新求值时复用同一对象，Provider 与消费者永不失配
const G = globalThis as unknown as { __star2005GameCtx?: React.Context<Ctx | null>; __star2005LiveCtx?: React.Context<string> };
export const GameCtx = (G.__star2005GameCtx ??= createContext<Ctx | null>(null));

export const useGame = () => {
  const c = useContext(GameCtx);
  if (!c) throw new Error("useGame outside provider");
  return c;
};

/* 流式实时文本单独一个轻量 Context：AI 逐帧吐字（~11 次/秒）只应刷新
 * 显示这段文字的小组件，而不该让整棵消费 useGame 的组件树跟着重渲染。 */
export const LiveCtx = (G.__star2005LiveCtx ??= createContext<string>(""));
export const useLive = () => useContext(LiveCtx);

/* Context 载体不可热替换：一旦 HMR 单独更新本模块，会生成新的 GameCtx 对象，
 * 而已挂载的 Provider 仍持有旧对象，导致消费者读到 null 并误报「useGame outside provider」。
 * 声明 decline() 让 Vite 在本模块变更时执行整页刷新，从根上消除该竞态。 */
if (import.meta.hot) (import.meta.hot as unknown as { decline: () => void }).decline();
