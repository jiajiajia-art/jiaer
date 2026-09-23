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
export type Popup = { title: string; segments: Segment[]; changes: string[] } | null;

export type Ctx = {
  cfg: AIConfig;
  setCfg: (c: AIConfig) => void;
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
  screen: Screen;
  go: (s: Screen) => void;
  game: GameState | null;
  busy: boolean;
  lastChanges: string[];
  popup: Popup;
  setPopup: (p: Popup) => void;
  startNew: (player: Player, simChar?: SimChar, contract?: SigningContract, worldRules?: import("../lib/types").WorldRules) => void;
  loadState: (s: GameState) => void;
  submit: (input: string, asPopup?: boolean) => Promise<void>;
  setPlayerAvatar: (dataUrl: string) => void;
  setNpcAvatar: (id: string, dataUrl: string) => void;
  setRelValue: (pid: string, dimId: string, value: number) => void; // 手动调节核心关系轴（好感/心动/信任/近况心情）
  setNpcDim: (pid: string, label: string, value: number) => void; // 手动调节情感印象（爱慕/友善/敌意…）
  saveNow: () => Promise<boolean>; // 立即把当前进度刷入自动存档
  regenerate: () => void; // 重新生成上一回合（AI 输出异常时）
  autosaveOn: boolean;
  setAutosaveOn: (on: boolean) => void;
  endManually: (kind?: "bankrupt" | "finish" | "manual") => Promise<void>;
  setWorldRules: (next: import("../lib/types").WorldRules) => void;
  setWorldBook: (next: import("../lib/types").WorldBookEntry[]) => void; // 覆写世界书条目列表并持久化
  setMapEdits: (next: import("../lib/types").MapEdits) => void; // 覆写地图编辑覆写表并持久化
  // —— 剧情事件系统（地图点位事件 / 支线剧情 / 剧情志收藏导出）——
  playSpotEvent: (eventId: string) => void; // 触发地图点位上的剧情事件，交 AI 演绎并存入剧情志
  playQuest: (questId: string) => void; // 演绎一段支线剧情并存入剧情志
  toggleFav: (entryId: string) => void; // 收藏 / 取消收藏一条剧情志
  removeJournal: (entryId: string) => void; // 删除一条剧情志
  exportJournal: (onlyFav?: boolean) => void; // 导出剧情志为 Markdown 下载
  // —— 确定性引擎（养成/日程/通告/攻略）——
  setSchedule: (day: number, actId: string | null) => void;
  runWeekNow: () => void;
  endDayNow: () => void;
  equipTitle: (id: string | null) => void; // 佩戴/更换/摘下头衔（纯确定性）
  simVisit: (locId: string) => string;
  simEvent: (encounterId: string) => void; // 触发条件邂逅：结算数值并交 AI 演绎
  simMove: (roomId: string, companionId?: string, trip?: { fee: number; minutes: number; modeLabel: string }) => string[];
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
  // —— 娱乐圈关系（私下联系 / 表白；每位 NPC 都可攻略）——
  simContact: (pid: string, name?: string) => void;
  simConfess: (pid: string, name?: string) => void;
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
  phoneExchange: (personId: string) => boolean; // 交换联系方式：随机同意/拒绝，同意开通私聊
};

export const GameCtx = createContext<Ctx | null>(null);

export const useGame = () => {
  const c = useContext(GameCtx);
  if (!c) throw new Error("useGame outside provider");
  return c;
};

/* 流式实时文本单独一个轻量 Context：AI 逐帧吐字（~11 次/秒）只应刷新
 * 显示这段文字的小组件，而不该让整棵消费 useGame 的组件树跟着重渲染。 */
export const LiveCtx = createContext<string>("");
export const useLive = () => useContext(LiveCtx);

/* Context 载体不可热替换：一旦 HMR 单独更新本模块，会生成新的 GameCtx 对象，
 * 而已挂载的 Provider 仍持有旧对象，导致消费者读到 null 并误报「useGame outside provider」。
 * 声明 decline() 让 Vite 在本模块变更时执行整页刷新，从根上消除该竞态。 */
if (import.meta.hot) (import.meta.hot as unknown as { decline: () => void }).decline();
