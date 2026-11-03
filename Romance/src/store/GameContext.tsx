import { perkKeyLabel, perkKeyOptions } from "../game/perkKeys";
import { affinityCapOf } from "../worlds/star2005/content";
import { getCurrentSaveId, purgeSaveData, switchSave } from "../lib/saveScope";
import { onAudioSignal, runAudioCmds } from "../game/audioEngine";
import { maskStorySegments } from "../game/charCard";
import { friendlyAIError } from "../lib/aiError";
import { applyBonus } from "../game/data";
import { carShopId, allRooms } from "../game/mud";
import { syncChildNpcs } from "../game/pregnancy";
import { getWorldStartRoom } from "../mods/registry";
import {
  DEFAULT_WORLD, activateWorld, saveAddons, feature, getWorldEventGroups, getOpeningDirective, getWorld, getWorldId, term, getWorldLookRules,
  beginAuthorPreviewMod, endAuthorPreviewMod,
} from "../mods/registry";
import {
  AUTHOR_PREVIEW_CLEAR, AUTHOR_PREVIEW_END, AUTHOR_PREVIEW_GAME_ID, AUTHOR_PREVIEW_RESTART, AUTHOR_PREVIEW_START,
  isAuthorPreview, reportAuthorPreviewFatal, type AuthorPreviewSession,
} from "../lib/authorPreview";
import { markAuthorPreviewReady, resetAuthorPreviewBoot } from "../lib/authorPreviewBoot.ts";
import { clearAuthorPreviewSave } from "../lib/storage";
import { activeLookKey, resolveLook, type LookPatch } from "../lib/plotLook";
import { pickArrival, resolveStart, startPreset } from "../game/mapStart";
import { spotName } from "../game/mapedits";
import { LIVE_LOCATIONS, getWorldSlot, setRuntimeSpots, setStartDateOverride } from "../mods/registry";
import type { StartOpts } from "./gameCtx";
import type { MapSpotEdit } from "../lib/types";
import { tierOf } from "../game/data";
import { dimsGrade, lifeGrade } from "../game/grade";
import { localEpilogue } from "../lib/epilogue";
import { castOf, castPrompt } from "../game/questCast";
import { syncWorldRules, ruleOf } from "../game/worldRules";
import { worldRuleLabel } from "../game/data";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { tickBirthdays, tickPlayerAge } from "../lib/npcIdentity";
import { canPay, shortOf } from "../game/logic";
import {
  applyStep,
  buildMessages,
  worldBookPickFor,
  complete,
  compressMemory,
  displayText,
  extractStep,
  isConfigured,
  mockEpilogue,
  proseToSegments,
  streamChat,
  isRepeatNarrative,
} from "../lib/ai";
import {
  defaultConfig,
  defaultTheme,
  ensureLoveAxis,
  ensureSim,
  loadConfig,
  loadTheme,
  newGame,
  saveConfig,
  saveTheme,
  syncSimToPlayer,
  uid,
  autosaveDebounced,
  cancelAutosave,
  flushAutosave,
  writeAutosave,
  migrateLegacySaves,
  loadAutosaveOn,
  saveAutosaveOn,
  type ThemePref,
} from "../lib/store";
import {
  advanceDay,
  bankruptEnding,
  buyItem,
  chooseArc,
  confirmDating,
  dayDateLabel,
  doActivity,
  endingText,
  startDateLabel,
  hasPartner,
  negotiateGig,
  offersFrom,
  romanceFixedOff,
  isFamilyNpc,
  visitLocation,
  type VisitPerk,
  weekDate,
  dowOf,
  weekdayName,
  weddingBlocked,
  divorce,
  weddingCost,
  type GameState as SimState,
  type GigCat,
} from "../game/logic";
import { gossipTick } from "../game/npcKnowledge";
import { withNewcomers } from "../game/npcIntro";
import { commitWorldBook } from "../game/worldbookPick";
import { recordTimeline } from "../game/timeline";
import { syncFactions, setFactionRoomPath, factionFlag, REP_MIN, REP_MAX } from "../game/factions";
import { dropFlags, estTokens, filterSegments, oocText, rulesOf, syncEngineRules } from "../game/engineRules";
import { pathOf as factionPathOf } from "../game/roomTree";
import { getWorldRooms as factionRooms, worldActivitiesOfRoom } from "../mods/registry";
setFactionRoomPath((id) => factionPathOf(factionRooms(), id));
import { writeCheckpoint } from "../lib/storage";
import { defaultWorldBook } from "../game/worldbook";
import { advanceUnit, advanceCount, advanceStoryOn, advanceWords, hopEnergy, tripPoints, apPerMove, encountersHere, fireEncounter, insideTree, introOf, itemsOfRoom, learnIntel, locOf, presentHere, tickWorld, travelPlan } from "../game/mud";
import { activityApCost, customActsOf, customItemsOf, findCustomItem, findShopGood, findSpotEvent, firedKey, firedOf, withApNote } from "../game/mapedits";
import { scanTriggers, queueChoiceTriggers, takeQueued } from "../game/eventTriggers";
import { pickFixedEvent, pickRandomEvent, applyFixedEffects, applyHiddenBranches, applyChainBreaks, eventChoiceOptions, parseChoice, applyChoice, matchCustomEnding, evalFixedCond, applyEffectList, FIXED_METRICS } from "../game/fixedEvents";
import { normRouteFx } from "../game/routeFx";
import { activateEvents, keepIfOngoing, keywordEventHits, settleActiveEvents } from "../game/loreContext";
import type { FixedEffect, FixedEvent } from "../lib/types";
import { limitDays } from "../lib/types";
import { openThread } from "../game/phone";
import { declarePersona, doPublicAct, personaWeekly, resolveCrisis } from "../game/persona";
import { applyProject, doWorkday, negotiateOffer, processAuditions, processReleases, promoteWork, signContract } from "../game/projects";
import { blankRel, confessTo, contactPerson, decayRelations, ensureRelations, relDecayNotes } from "../game/relations";
import { askProducer, meetProducer } from "../game/producer";
import { bridgeEnabled, bridgeModes, bridgePerDay, fillPair, type BridgeMode } from "../game/bridge";
import { RELATIONS, SIDEQUEST_BY_ID, SIDEQUESTS, evalRequires, romanticCapOf, type SigningContract } from "../worlds/star2005/content";
import { LIVE_PERSON_BY_ID as PERSON_BY_ID, worldItemById as itemById } from "../mods/registry";
import { GIG_POOL, STAT_LABELS, STAT_ORDER, carById, resaleValue, statMetaLabels } from "../game/data";
import { settleSale, reviewFor, type XianyuListing } from "../game/xianyu";
import type { AIConfig, Branch, GameState, Player, Segment, Turn, WorldRules } from "../lib/types";
import type { Character as SimChar } from "../game/logic";

export const BRANCH_POINTS = 0; // 地点内的事件 / 拾取 / 活动都不扣行动点（只有换地点扣）
import { GameCtx, LiveCtx, type Ctx, type Screen, type Popup, type WeekReport, type Diary } from "./gameCtx";
import { attrCap, setWalletSource, setContentMoneyLabelSource, wallet, walletDef, setCustomAttr, customAttrValue } from "../game/wallet";
import { getWorldSlot } from "../mods/registry";
import { playerAttrsFromCreatorDefs } from "../lib/creationOpening";
import { clampStat } from "../game/data";
import { applyPhoneStep, markActsSent, pendingActs, type PhoneInterrupt } from "../game/phoneLink";
import { addIncomingReq } from "../components/phone/wxFeatures";

/* 日历推进时结算到期作品：并入名气/口碑/作品数，返回发行播报 */
function applyReleases(s: SimState): { s: SimState; events: string[] } {
  // 先结算到公布日的试镜结果（§19.6），再结算作品发行
  const au = processAuditions(s);
  const r = processReleases(au.next);
  const next: SimState = {
    ...au.next,
    portfolio: r.portfolio,
    fame: au.next.fame + r.fame,
    reputation: Math.min(100, au.next.reputation + r.rep),
    works: au.next.works + r.works,
  };
  return { s: next, events: [...au.events, ...r.events] };
}


/* —— 推进 · 共用的纯函数 —— */
/** 每过一天的日历后处理：发行/试镜、关系衰减、周结算时叠加人设周结算 */
function postDay(res: ReturnType<typeof advanceDay>): { next: SimState; relEvents: string[] } {
  const rel = applyReleases(res.next);
  const decayed = decayRelations(rel.s);
  const cold = relDecayNotes(rel.s, rel.s.relations, decayed, rel.s.relColdNoted);
  let next: SimState = {
    ...rel.s, relations: decayed, relColdNoted: cold.noted,
    ...(cold.notes.length ? { log: [...rel.s.log, ...cold.notes].slice(-40) } : {}),
  };
  if (res.settled) next = personaWeekly(next);
  return { next, relEvents: [...rel.events, ...cold.notes] };
}
/** 由日志构建结构化周报（可跨多周：weekFrom~weekTo） */
function buildReport(log: string[], weekFrom: number, weekTo: number, relEvents: string[], base: { grade?: string; act: string; gains: string[]; span?: string }): WeekReport {
  const events: { tag: string; text: string }[] = [];
  const settle: string[] = [];
  const multi = weekTo > weekFrom;
  for (const line of log) {
    const m = line.match(/^【第 (\d+) 周\s*(?:·\s*)?(.*?)】(.*)$/);
    if (!m) continue;
    const w = Number(m[1]);
    if (w < weekFrom || w > weekTo) continue;
    const tag = m[2]?.trim() || "纪事", body = (m[3] ?? "").trim();
    if (tag === "结算") settle.push(...body.split(/[；;]/).map((x) => x.trim()).filter(Boolean).map((x) => (multi ? `第 ${w} 周 · ${x}` : x)));
    else events.push({ tag: multi ? `第${w}周·${tag}` : tag, text: body });
  }
  for (const e of relEvents) events.push({ tag: "人脉", text: e });
  const isWarn = (x: string) => /⚠|破产|透支|债主|违约/.test(x);
  const warnings = [...new Set([...settle.filter(isWarn), ...events.filter((e) => isWarn(e.text)).map((e) => e.text)].map((x) => x.replace(/^(第 \d+ 周 · )?⚠\s*/, "")))];
  // 跨多周时纪事只保留最近 12 条，避免报告过长
  const ev = events.filter((e) => !isWarn(e.text));
  return { week: weekFrom, weekTo: multi ? weekTo : undefined, span: base.span, grade: base.grade, act: base.act, gains: base.gains, events: multi ? ev.slice(-12) : ev, settle: settle.filter((x) => !isWarn(x)), warnings: multi ? warnings.slice(-3) : warnings };
}

/* —— 数值锁（所有世界观通用）——
 * 系统先确定性结算，再交给 AI 演绎；AI 回写时，本次已结算的字段一律恢复为结算值，
 * 保证「剧情听 AI，数值听配置」。只锁本次真正变动过的字段，AI 对其他项的合理改动不受影响。 */
type SimLock = { keys: string[]; rel: string[]; cattrs: string[]; stats: string[] };
function lockOf(a: SimState, b: SimState): SimLock {
  const A = a as unknown as Record<string, unknown>, B = b as unknown as Record<string, unknown>;
  const keys = Object.keys(B).filter((k) => typeof B[k] === "number" && A[k] !== B[k]);
  const rel = Object.keys({ ...a.rel, ...b.rel }).filter((p) => (a.rel?.[p] ?? 0) !== (b.rel?.[p] ?? 0));
  const ca = a.cattrs ?? {}, cb = b.cattrs ?? {};
  const cattrs = Object.keys({ ...ca, ...cb }).filter((k) => ca[k] !== cb[k]);
  const sa = (a.stats ?? {}) as Record<string, number>, sb = (b.stats ?? {}) as Record<string, number>;
  const stats = Object.keys(sb).filter((k) => sa[k] !== sb[k]);
  return { keys, rel, cattrs, stats };
}
function applyLock(next: GameState, settled: GameState, lock: SimLock): GameState {
  if (!lock.keys.length && !lock.rel.length && !lock.cattrs.length && !lock.stats.length) return next;
  const sim = { ...next.sim } as unknown as Record<string, unknown>;
  const src = settled.sim as unknown as Record<string, unknown>;
  for (const k of lock.keys) sim[k] = src[k];
  const out = sim as unknown as SimState;
  if (lock.rel.length) out.rel = { ...next.sim.rel, ...Object.fromEntries(lock.rel.map((p) => [p, settled.sim.rel?.[p] ?? 0])) };
  if (lock.cattrs.length) out.cattrs = { ...next.sim.cattrs, ...Object.fromEntries(lock.cattrs.map((k) => [k, settled.sim.cattrs?.[k] ?? 0])) };
  if (lock.stats.length) out.stats = { ...next.sim.stats, ...Object.fromEntries(lock.stats.map((k) => [k, (settled.sim.stats as Record<string, number>)[k]])) } as SimState["stats"];
  // 人物卡上的好感同样以系统结算为准
  const npcs = lock.rel.length ? next.npcs.map((n) => { const o = settled.npcs.find((x) => x.id === n.id); return lock.rel.includes(n.id) && o ? { ...n, affinity: o.affinity } : n; }) : next.npcs;
  return { ...next, sim: out, npcs };
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [cfg, setCfgState] = useState<AIConfig>(defaultConfig);
  const [theme, setThemeState] = useState<ThemePref>(defaultTheme);
  const [screen, setScreen] = useState<Screen>("cover");
  const [game, setGame] = useState<GameState | null>(null);
  const npcGender = useMemo(() => Object.fromEntries((game?.npcs ?? []).flatMap((n) => { const g = n.persona?.gender; return g ? [[n.id, g]] : []; })), [game?.npcs]);
  syncWorldRules(game?.worldRules, game?.player.gender, npcGender); // 世界规则 → 引擎同步
  const [live, setLive] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastChanges, setLastChanges] = useState<string[]>([]);
  const [popup, setPopup] = useState<Popup>(null);
  const [autosaveOn, setAutosaveOnState] = useState<boolean>(true);
  const autosaveOnRef = useRef(true);
  autosaveOnRef.current = autosaveOn;
  const gameRef = useRef<GameState | null>(null);
  // 数值锁：系统已结算的字段（下一次 preSettled 的 AI 回合里，AI 的 JSON 不得再改动这些项）
  const simLockRef = useRef<SimLock | null>(null);
  // 统一钱包接口：引擎层（只拿得到 sim）也能据此知道当前对局绑定的货币
  setWalletSource(() => gameRef.current);
  // 功能注释：未绑钱包属性时，局内资金文案用建角配置的货币名称（元 / 灵石…）
  setContentMoneyLabelSource(() => {
    const v = getWorldSlot("moneyLabel");
    return typeof v === "string" ? v : "";
  });
  gameRef.current = game;
  const screenRef = useRef(screen);
  screenRef.current = screen;
  // 固定事件：正在演绎中的守卫（避免结算 → commit → 重入自触发），与「已挂载的检查器」引用
  const fixedFiringRef = useRef(false);
  const runFixedRef = useRef<(() => void) | null>(null);
  const commitSimRef = useRef<((s: SimState) => GameState | null) | null>(null); // submit 先于 commitSim 定义，经 ref 调用
  const playQuestRef = useRef<((id: string) => void) | null>(null);
  // 上一回合的输入与前置状态，供「重新生成」在 AI 输出异常时原样重跑
  const lastTurnRef = useRef<{ base: GameState; input: string; hideInput?: boolean } | null>(null);
  const [canRetry, setCanRetry] = useState(false);

  useEffect(() => {
    setCfgState(loadConfig());
    setThemeState(loadTheme());
    setAutosaveOnState(loadAutosaveOn());
    // 把旧版 localStorage 存档迁移进 localforage（一次性，静默）
    void migrateLegacySaves();
    // 关闭/刷新页面前，把尚在防抖等待中的自动存档立刻落库
    const onLeave = () => { void flushAutosave(); };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  const setAutosaveOn = useCallback((on: boolean) => {
    setAutosaveOnState(on);
    autosaveOnRef.current = on;
    saveAutosaveOn(on);
  }, []);

  const setCfg = useCallback((c: AIConfig) => {
    setCfgState(c);
    saveConfig(c);
  }, []);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const setTheme = useCallback((t: ThemePref) => {
    // 功能注释：方向可随时切换，不再尊重历史 orientLock（建角选定后局内设置直接改）
    const next = { ...t, orientLock: false };
    themeRef.current = next;
    setThemeState(next);
    saveTheme(next);
  }, []);
  // 剧情美化：玩家设置 + 满足条件的外观规则 → 实际生效外观（不回写玩家设置）
  const [lookPreview, previewLook] = useState<LookPatch | null>(null);
  const lookSim = game && (screen === "game" || screen === "opening") ? game.sim : null;
  const worldLooks = game ? getWorldLookRules() : undefined;
  const lookKey = activeLookKey(theme, lookSim, worldLooks);
  const lookRes = useMemo(
    () => resolveLook(theme, lookSim, worldLooks, lookPreview),
    [theme, lookKey, worldLooks, lookPreview], // eslint-disable-line react-hooks/exhaustive-deps
  );

  /** 功能注释：建角完成后先播编辑器开场白；正式 AI 开局剧情延到点「开始」入局后再生成 */
  const pendingOpeningPromptRef = useRef<string | null>(null);
  const flushOpeningPlotRef = useRef<() => void>(() => {});
  const go = useCallback((s: Screen) => {
    setScreen(s);
    if (s === "game") queueMicrotask(() => flushOpeningPlotRef.current());
  }, []);
  // 局中世界观固定为存档记录的组合（建角页预览过别的世界观后返回旧局时复原）；作者预览由叠加层接管，勿覆盖
  useEffect(() => {
    if (isAuthorPreview()) return;
    if (game && (screen === "game" || screen === "opening")) { setStartDateOverride(game.startDate); activateWorld(game.worldId ?? DEFAULT_WORLD, saveAddons(game)); }
  }, [screen, game?.id, game?.startDate, game?.worldId, game?.addons?.join("|")]);

  /** 功能注释：作者预览进出——暂存正式局、切独立测试存档；退出还原，编辑器状态由 UI 层保持挂载 */
  const previewStashRef = useRef<{ screen: Screen; game: GameState | null; saveId: string } | null>(null);
  useEffect(() => {
    const onStart = (ev: Event) => {
      const detail = (ev as CustomEvent<AuthorPreviewSession>).detail;
      if (!detail?.mod) {
        reportAuthorPreviewFatal(["预览数据无效"]);
        return;
      }
      const boot = beginAuthorPreviewMod(detail.mod);
      if (!boot.ok) {
        // 功能注释：失败须在预览壳展示原因；禁止只派事件给已 hidden 的编辑器后静默空屏
        reportAuthorPreviewFatal(boot.errors);
        return;
      }
      previewStashRef.current = {
        screen: screenRef.current,
        game: gameRef.current,
        saveId: getCurrentSaveId(),
      };
      // 功能注释：每次预览清掉上次测试档，避免「继续游戏」读到旧世界内容；用当前草稿重新开局
      void clearAuthorPreviewSave(AUTHOR_PREVIEW_GAME_ID);
      purgeSaveData(AUTHOR_PREVIEW_GAME_ID);
      switchSave(AUTHOR_PREVIEW_GAME_ID, {
        flushCurrent: flushAutosave,
        render: () => {
          resetTransient();
          gameRef.current = null;
          setGame(null);
          setSaveEpoch((n) => n + 1);
          setScreen("cover");
          markAuthorPreviewReady();
        },
      });
    };
    const onEnd = () => {
      endAuthorPreviewMod();
      resetAuthorPreviewBoot();
      const stash = previewStashRef.current;
      previewStashRef.current = null;
      const backId = stash?.saveId || "";
      // 功能注释：有正式档则切回；否则 currentSaveId 置空，避免测试档残留为「当前档」
      switchSave(backId, {
        flushCurrent: flushAutosave,
        existing: !!backId,
        render: () => {
          resetTransient();
          gameRef.current = stash?.game ?? null;
          setGame(stash?.game ?? null);
          setSaveEpoch((n) => n + 1);
          setScreen(stash?.screen ?? "cover");
        },
      });
    };
    const onClear = () => {
      void clearAuthorPreviewSave(AUTHOR_PREVIEW_GAME_ID);
      purgeSaveData(AUTHOR_PREVIEW_GAME_ID);
      if (isAuthorPreview()) {
        resetTransient();
        gameRef.current = null;
        setGame(null);
        setSaveEpoch((n) => n + 1);
        setScreen("cover");
        markAuthorPreviewReady();
      }
    };
    const onRestart = () => {
      void clearAuthorPreviewSave(AUTHOR_PREVIEW_GAME_ID);
      purgeSaveData(AUTHOR_PREVIEW_GAME_ID);
      resetTransient();
      gameRef.current = null;
      setGame(null);
      setSaveEpoch((n) => n + 1);
      setScreen("cover");
      markAuthorPreviewReady();
    };
    window.addEventListener(AUTHOR_PREVIEW_START, onStart);
    window.addEventListener(AUTHOR_PREVIEW_END, onEnd);
    window.addEventListener(AUTHOR_PREVIEW_CLEAR, onClear);
    window.addEventListener(AUTHOR_PREVIEW_RESTART, onRestart);
    return () => {
      window.removeEventListener(AUTHOR_PREVIEW_START, onStart);
      window.removeEventListener(AUTHOR_PREVIEW_END, onEnd);
      window.removeEventListener(AUTHOR_PREVIEW_CLEAR, onClear);
      window.removeEventListener(AUTHOR_PREVIEW_RESTART, onRestart);
    };
  }, []);
  // 读档 / 开新局：清空上一局遗留的瞬时状态，并丢弃尚未落库的旧局自动存档
  const resetTransient = () => {
    cancelAutosave();
    lastTurnRef.current = null;
    fixedFiringRef.current = false;
    pendingOpeningPromptRef.current = null;
    setBusy(false);
    setLive("");
    setPopup(null);
    setLastChanges([]);
  };
  // 切档 UI 代数：每次切换存档 +1，作为游戏界面根节点 key，强制整树重挂载、清空旧 DOM 与组件内状态
  const [saveEpoch, setSaveEpoch] = useState(0);
  const loadState = useCallback((s: GameState) => {
    // 先激活存档的世界观组合（老存档缺省=娱乐圈），再做兼容补齐与渲染
    setStartDateOverride(s.startDate); // 本局自选的开局日期（老存档无 = 世界观日期）
    activateWorld(s.worldId ?? DEFAULT_WORLD, saveAddons(s));
    const snapshot = s.privateData;
    s = { ...s, worldId: getWorld().worldId, addons: [...getWorld().addonIds], entSplit: true, privateData: undefined };
    const g = syncSimToPlayer(ensureLoveAxis(ensureSim(s)));
    syncFactions(g);
    syncEngineRules(g);
    // 切档 5 步：① 保存当前档 ② 清内存 ③ 换 saveId ④ 读新档私有数据（快照恢复）⑤ 重渲染
    switchSave(g.id, {
      snapshot,
      existing: true, // 读取已有存档：允许认领旧版无前缀私有数据（新开局不传，保证全新空白）
      flushCurrent: flushAutosave,
      render: () => {
        resetTransient();
        gameRef.current = g;
        setGame(g);
        setSaveEpoch((n) => n + 1);
        // 已落幕的存档回到结局页：读进游戏里会变成过了时限也无法再落幕的局。
        // AI 已判定收场、但后记没写完就被关掉的存档，接着把结局补完。
        setScreen(g.endingGrade ? "ending" : "game");
        if (g.ended && !g.endingGrade) queueMicrotask(() => void endManuallyRef.current?.("ai"));
      },
    });
  }, []);

  // 持久化：立即更新内存态，并（若开启自动存档）以 300ms 防抖异步写入 localforage。
  // localforage 写入是异步且带全局异常兜底的，因此这里同步返回 true 表示「已受理」。
  const persist = useCallback((g0: GameState): boolean => {
    // 音频指令：正式游玩时交给播放器（按存档 + 序号去重，只执行一次），然后从状态里摘掉，不写进存档
    let s0 = g0;
    if (s0.sim.audioQ?.length) {
      if (screenRef.current === "game") runAudioCmds(s0.id, s0.sim.audioQ);
      s0 = { ...s0, sim: { ...s0.sim, audioQ: undefined } };
    }
    // 主线复盘：与上一次落盘比较，自动记下关键变动；每回合第一条附带检查点（可回溯 / 开平行分支）
    syncEngineRules(s0);
    const s1 = applyFlagLife(gameRef.current, s0);
    const { state: s, cp } = recordTimeline(gameRef.current, s1);
    syncFactions(s);
    gameRef.current = s;
    setGame(s);
    if (autosaveOnRef.current) autosaveDebounced(s);
    if (cp) void writeCheckpoint(cp, s);
    return true;
  }, []);

  // 核心：推进一回合
  const runTurn = useCallback(
    async (base: GameState, input: string, asPopup: boolean, hideInput = false, journalMeta?: Omit<import("../lib/types").JournalEntry, "id" | "ts" | "text">, preSettled = false, popupTitle?: string) => {
      const lock = simLockRef.current; // 只由「先结算后演绎」的入口在调用前设置
      simLockRef.current = null;
      // 未配置 AI：剧情演绎需要模型，绝不凭空编造旁白/台词或偷偷改动好感数值。
      // 地图移动、通告、养成等确定性玩法无需 AI，仍照常运行。
      if (!isConfigured(cfg)) {
        setPopup({
          title: "还没接入 AI",
          segments: [
            {
              kind: "system",
              text: `让主持人为你叙写剧情、演绎人物对话，需要先接入一个 AI 模型。点右上角的齿轮填入接口即可。\n\n（地图走动、洽谈${term("gig")}、养成数值这些玩法不依赖 AI，随时都能玩。）`,
            },
          ],
          changes: [],
        });
        return;
      }

      setBusy(true);
      setLive("");
      if (!asPopup) setCanRetry(false);
      // 记录玩家指令（弹窗类行动不入主剧情流，仅作为一次询问）
      let working = base;
      if (!asPopup) {
        // 记住本回合的前置状态与输入，供「重新生成」在输出异常时原样重跑
        lastTurnRef.current = { base, input, hideInput };
        // hideInput：开场序章等「幕后导演指令」只驱动 AI 生成，不作为玩家气泡显示给玩家
        if (!hideInput) {
          const playerTurn: Turn = { id: uid(), role: "player", segments: [{ kind: "narration", text: input }], ts: Date.now() };
          working = { ...base, story: [...base.story, playerTurn] };
          setGame(working);
        }
      }

      // 关键词触发的事件：本回合输入 / 近两回合剧情出现关键词即激活，设定随本回合一起发给 AI
      working = activateEvents(working, keywordEventHits(working, input));
      // 本回合随提示词发给 AI 的手机流水（落地后标记为已同步；生成期间新增的留到下回合）
      const sentActs = new Set(pendingActs(working).map((a) => a.id));

      // 世界书：本回合注入的条目先选定，落地成功后据此记账（一次性消耗 / 有效期）
      const wbPick = worldBookPickFor(working, input);
      let full = "";
      let promptTokens = 0;
      // 流式渲染节流：AI 每吐一个 token 都刷新会导致整棵树（六个常驻页签）逐字重渲染，
      // 且 displayText 每次重解析全量字符串（O(n²)）。改为最多每 ~90ms 落一帧。
      let latest = "";
      let lastFlush = 0;
      let flushTimer: ReturnType<typeof setTimeout> | null = null;
      const flush = () => { flushTimer = null; lastFlush = Date.now(); setLive(displayText(latest)); };
      // 正文出来前显示当前阶段与已等待秒数，卡住时可看出停在哪一步
      const t0 = Date.now();
      let stage = "正在整理上下文";
      let thinking = false;
      const showStage = () => { if (!latest && !thinking) setLive(`（${stage}…… ${Math.round((Date.now() - t0) / 1000)}s）`); };
      const ticker = setInterval(showStage, 1000);
      showStage();
      try {
        const msgs = buildMessages(working, input, wbPick);
        // 底层规则 · Token 上限告警：估算本回合提示长度，超线时在本回合末尾提示
        promptTokens = estTokens(msgs.map((m) => m.content).join(""));
        full = await streamChat({ ...cfg, stream: true }, msgs, (_d, f) => {
          latest = f;
          const dt = Date.now() - lastFlush;
          if (dt >= 90) flush();
          else if (!flushTimer) flushTimer = setTimeout(flush, 90 - dt);
        }, undefined, (think) => {
          // 思考型模型：正文出来前先展示构思过程，避免长时间只有「演绎中」
          thinking = true;
          if (!latest) setLive(`（构思中…… ${Math.round((Date.now() - t0) / 1000)}s）\n${think.slice(-400)}`);
        }, (st) => { stage = st; showStage(); });
      } catch (e) {
        clearInterval(ticker);
        if (flushTimer) clearTimeout(flushTimer);
        setBusy(false);
        setLive("");
        // 数值已先行结算的事件（固定事件/邂逅）：演绎失败也要留档，避免「数值变了却无迹可查」
        if (preSettled && journalMeta) {
          const entry: import("../lib/types").JournalEntry = { ...journalMeta, id: uid(), ts: Date.now(), text: `（AI 演绎失败，仅留梗概；本事件数值已结算）\n${journalMeta.seed}` };
          persist({ ...base, journal: [entry, ...(base.journal ?? [])] });
        }
        const fe = friendlyAIError(e);
        if (!asPopup && !preSettled) {
          // 主剧情失败：落一条错误提示条（带「重新生成」），基础功能不受影响；重试时从 base 快照原样重跑
          const errTurn: Turn = { id: uid(), role: "ai", segments: [], error: fe, ts: Date.now() };
          setGame({ ...working, story: [...working.story, errTurn] });
          setCanRetry(true);
        } else setPopup({ title: fe.title, segments: [{ kind: "system", text: fe.text }], changes: [], retry: { input, hideInput, journalMeta, preSettled } });
        return;
      }
      clearInterval(ticker);
      if (flushTimer) clearTimeout(flushTimer);

      const step = extractStep(full);
      const prose = displayText(full);
      // 优先解析【剧情正文】：它把旁白按自然段拆开、把「角色名」：台词识别成对话，
      // 从而保留旁白与对话的交织顺序、让每句台词落进各自的对话框，而不是把整段旁白
      // 与所有台词各堆成一大块。仅当正文为空时，才退回 JSON 里的 narration/dialogue 字段。
      let segments: Segment[] = proseToSegments(prose);
      if (!segments.length && (step?.narration || step?.dialogue)) {
        if (step.narration) segments.push(...proseToSegments(step.narration));
        for (const d of step.dialogue ?? []) segments.push({ kind: "dialogue", speaker: d.speaker, text: d.text });
      }
      if (step?.system && !segments.some((s) => s.kind === "system" && s.text === step.system)) {
        segments.push({ kind: "system", text: step.system });
      }

      // 信息不足：AI 列出的追问以系统提示呈现，玩家补充后再推进
      // 文本管线（底层规则可调顺序）：单卡屏蔽词 / 全局屏蔽词（按优先级）/ 正则脚本（按列表顺序）
      segments = filterSegments(segments, (x) => maskStorySegments(working, x));
      { const warn = rulesOf(working).ai.tokenWarn; if (warn > 0 && promptTokens > warn) segments.push({ kind: "system", text: `提示词约 ${promptTokens} tokens，已超过告警线 ${warn}：可在「底层规则」调低世界书条数或摘要阈值。` }); }
      if (step?.need_clarification?.length) segments.push({ kind: "system", text: `需要你补充：\n${step.need_clarification.map((q, i) => `${i + 1}. ${q}`).join("\n")}` });

      // 禁止剧情重复：与上一条 AI 叙事高度雷同则不落地、不结算，转为可重新生成的错误条
      if (!asPopup) {
        const prevAi = [...working.story].reverse().find((t) => t.role === "ai" && !t.error && t.segments.length);
        const curText = segments.filter((sg) => sg.kind !== "system").map((sg) => sg.text).join("");
        if (prevAi && isRepeatNarrative(prevAi.segments.map((sg) => sg.text).join(""), curText)) {
          setBusy(false);
          setLive("");
          const errTurn: Turn = { id: uid(), role: "ai", segments: [], error: { title: "剧情重复", text: "AI 这次复述了上一回合的内容，已拦截、未结算任何数值。点「重新生成」换一版。" }, ts: Date.now() };
          setGame({ ...working, story: [...working.story, errTurn] });
          setCanRetry(true);
          return;
        }
      }

      // 底层规则 · OOC 场外话：只回答、不推进——不结算数值 / 时间 / 地点 / 世界书消耗，沿用原有选项
      const isOoc = !asPopup && !preSettled && !!oocText(input, rulesOf(working).narrative.oocMarks);
      const effectiveStep = isOoc ? { options: working.options } : step ?? { options: [], narration: prose };
      const applied = isOoc ? { next: working, changes: [] as string[] } : applyStep(working, effectiveStep);
      const changes = applied.changes;
      // working 是回合开始时的快照；AI 生成期间玩家可能在小手机里聊了天，落地时沿用最新的手机数据，避免把聊天记录覆盖回旧版
      const cur0 = gameRef.current;
      let next = cur0 && cur0.id === working.id && cur0.phone ? { ...applied.next, phone: cur0.phone } : applied.next;
      if (lock) next = applyLock(next, working, lock);
      // 进行中的事件：AI 正文出现结束关键词即结束；没写结束词的事件只发这一回合
      next = settleActiveEvents(next, prose);
      if (!isOoc) next = commitWorldBook(next, wbPick, next.worldBook ?? defaultWorldBook());
      // 线上联动：手机流水已同步；AI 让角色主动上线（发绿信 / 拉群 / 来电 / 邮件 / 好友申请）写进手机
      next = markActsSent(next, sentActs);
      const linked = applyPhoneStep(next, effectiveStep.phone, { addReq: addIncomingReq });
      next = linked.g;
      changes.push(...linked.notes);
      // 转场：AI 把 world.location 改成了另一个地点 → 解析成地图房间，主角真的移过去
      let movedTo: string | undefined;
      if (next.world.location && next.world.location !== working.world.location) {
        const rid = roomByName(next, next.world.location);
        if (rid && rid !== next.sim.room) {
          next = { ...next, sim: { ...next.sim, room: rid, visited: (next.sim.visited ?? []).includes(rid) ? next.sim.visited : [...(next.sim.visited ?? []), rid] } };
        }
        movedTo = (rid && (spotName(next, rid) || locOf(rid)?.name)) || next.world.location;
        next = { ...next, world: { ...next.world, location: movedTo } };
      }
      // 剧情初遇：本回合第一次登场、还没结识的人物 → 正文底部出人物名片，由玩家决定是否结识
      const intro = withNewcomers(working, next, segments, effectiveStep);
      next = intro.g;
      const newcomers = intro.ids.length ? { newcomers: intro.ids } : {};

      if (asPopup) {
        setPopup({ title: journalMeta?.title ?? popupTitle ?? "行动结果", segments, changes, scene: { location: next.world.location, time: next.world.time }, ...newcomers });
        // 弹窗行动也同步数值，但不写入主剧情
        // 剧情事件：把这次演绎出的正文独立成篇，存进剧情志（可收藏/导出）
        let landed = next;
        if (journalMeta) {
          const text = segments.map((sg) => (sg.kind === "dialogue" ? `${sg.speaker}：${sg.text}` : sg.text)).join("\n");
          const entry: import("../lib/types").JournalEntry = { ...journalMeta, id: uid(), ts: Date.now(), text };
          landed = { ...next, journal: [entry, ...(next.journal ?? [])] };
          // 点位事件 / 支线：持久记入 eventsFired，删剧情志也不会复活
          if ((journalMeta.kind === "spot" || journalMeta.kind === "quest") && journalMeta.srcId) {
            const key = firedKey(journalMeta.kind, journalMeta.srcId);
            if (!(landed.sim.eventsFired ?? []).includes(key)) landed = { ...landed, sim: { ...landed.sim, eventsFired: [...(landed.sim.eventsFired ?? []), key] } };
          }
        }
        persist(landed);
        setLastChanges(changes);
        setLive("");
        setBusy(false);
        return;
      }

      const thoughts = (step?.thoughts ?? []).filter((t) => t?.name && t?.text).map((t) => ({ name: t.name, text: t.text }));
      const aiTurn: Turn = { id: uid(), role: "ai", ...(movedTo ? { scene: movedTo } : {}), segments, raw: full, ts: Date.now(), ...(thoughts.length ? { thoughts } : {}), ...newcomers };
      const withStory = { ...next, story: [...next.story, aiTurn] };
      persist(withStory);
      setLastChanges(changes);
      setLive("");
      setBusy(false);

      // 异步压缩主线记忆：自上次压缩以来的对话累计超过底层规则的 token 阈值（缺省约 3000）才触发
      const MR = { ...rulesOf(withStory).memory, summaryModel: rulesOf(withStory).ai.summaryModel };
      const since = withStory.story.slice(-Math.max(1, withStory.turnCount - (withStory.memAt ?? 0)) * 2);
      const tokens = estTokens(since.map((t) => t.segments.map((x) => x.text).join("")).join(""));
      if (withStory.turnCount > (withStory.memAt ?? 0) && tokens >= Math.max(200, MR.summaryTokens)) {
        const at = withStory.turnCount;
        compressMemory(MR.summaryModel.trim() ? { ...cfg, model: MR.summaryModel.trim() } : cfg, withStory)
          .then((mem) => {
            const cur = gameRef.current;
            if (!cur || cur.id !== withStory.id) return;
            // 不保留完整历史：只留最近 8 个回合原文，更早的靠摘要
            persist({ ...cur, memory: mem, memAt: at, ...(MR.keepHistory ? {} : { story: cur.story.slice(-16) }) });
          })
          .catch(() => undefined);
      }

      if (withStory.ended) {
        // AI 判定收场：若模型没有随手附上后记，则走统一的后记生成（AI 或本地兜底），
        // 否则 Ending 页会永远停在「后记正在生成……」。
        // 统一走后记生成：补齐人生评级与 ≥1000 字的生平后记（模型随手写的收场话作为素材）
        void endManuallyRef.current?.("ai");
      } else if (!isOoc) {
        // AI 回合可能推进了日期或改变了属性：检查是否触发主线时限到期或「达成即落幕」结局
        queueMicrotask(() => runFixedRef.current?.());
      }
    },
    [cfg, persist],
  );

  const startNew = useCallback(
    (player: Player, simChar?: SimChar, contract?: SigningContract, worldRules?: WorldRules, opts?: StartOpts) => {
      // 开局日期：选项效果里改日期的以最后一个为准，其次是玩家自选，再次世界观默认；必须在建档之前生效（日历全靠它推算）
      const startDate = [...(opts?.fx ?? [])].reverse().find((f) => f.startDate)?.startDate ?? opts?.startDate;
      setStartDateOverride(startDate);
      let g = newGame(player, simChar, contract);
      // 功能注释：作者预览强制固定局 id，所有测试进度写入独立槽，不进正式自动存档
      if (isAuthorPreview()) {
        g = { ...g, id: AUTHOR_PREVIEW_GAME_ID, worldId: getWorldId() };
      }
      if (startDate) g.startDate = startDate;
      if (opts?.playPrefs) {
        g.playPrefs = opts.playPrefs;
        // 功能注释：建角游玩偏好的屏幕方向写入主题，开局即生效、不再弹首次方向窗
        const orient = opts.playPrefs.orient === "landscape" ? "landscape" : "portrait";
        setTheme({ ...themeRef.current, orient, orientLock: false });
      }
      g = tickPlayerAge(g, 0).g; // 年龄随日历：开局当天定基准年，免得第一次推进恰好跨过生日时漏长一岁
      if (worldRules) g.worldRules = worldRules;
      // 自定义角色属性：只来自创作者「建角」列表；开局值固定或代码掷骰（只掷一次，不交给 AI）；不预填八维
      const defs = getWorldSlot("customAttrs") ?? [];
      if (defs.length) {
        g.attrDefs = defs.map((d) => ({ ...d }));
        const fromCreator = playerAttrsFromCreatorDefs(defs);
        const starts = Object.fromEntries(fromCreator.map((a) => [a.key, a.value]));
        const creatorKeys = new Set(fromCreator.map((a) => a.key));
        g.sim = { ...g.sim, cattrs: starts };
        // 功能注释：创作者列表在前并覆盖同 key；其它非建角 attrs 仍保留在后
        g.player = {
          ...g.player,
          attrs: [...fromCreator, ...g.player.attrs.filter((a) => !creatorKeys.has(a.key))],
        };
      }
      // 建角选项的开局效果：能力 / 资金等指标 / 自定义属性 / NPC 初始好感（文本设定已在建角页写进档案）
      for (const fx of opts?.fx ?? []) {
        const sim = { ...g.sim, stats: { ...g.sim.stats }, rel: { ...g.sim.rel } };
        for (const [k, v] of Object.entries(fx.stats ?? {})) if (v) sim.stats[k as keyof typeof sim.stats] = clampStat(k as keyof typeof sim.stats, (sim.stats[k as keyof typeof sim.stats] ?? 0) + v);
        const m = fx.metrics ?? {};
        if (m.fame) sim.fame = Math.max(0, sim.fame + m.fame);
        if (m.reputation) sim.reputation = Math.max(0, Math.min(100, sim.reputation + m.reputation));
        if (m.looks) sim.looksBonus = (sim.looksBonus ?? 0) + m.looks;
        if (m.stress) sim.stress = Math.max(0, Math.min(100, sim.stress + m.stress));
        for (const [id, v] of Object.entries(fx.rel ?? {})) if (v) sim.rel[id] = (sim.rel[id] ?? 0) + v;
        g = { ...g, sim };
        if (m.money) g = wallet.add(g, Math.max(-wallet.balance(g), m.money)); // 资金不扣成负数；绑了自定义货币时记到该属性
        for (const [id, v] of Object.entries(fx.attrs ?? {})) { const d = g.attrDefs?.find((x) => x.id === id); if (d && v) g = setCustomAttr(g, d, customAttrValue(g, d) + v); }
      }
      // 人物线路的开局人际：关系写进人物档案，好感直接设值，可设为开局即相识
      const pn = (opts?.pathNpcs ?? []).filter((n) => n.id);
      if (pn.length) {
        const rel = { ...g.sim.rel };
        const met = new Set(g.sim.metPeople ?? []);
        for (const n of pn) {
          if (typeof n.rel === "number" && Number.isFinite(n.rel)) rel[n.id] = Math.max(-100, Math.min(affinityCapOf(n.id), Math.round(n.rel)));
          if (n.met) met.add(n.id);
        }
        const byId = new Map(pn.map((n) => [n.id, n]));
        g = {
          ...g,
          sim: { ...g.sim, rel, metPeople: [...met] },
          npcs: g.npcs.map((x) => { const r = byId.get(x.id)?.relation?.trim(); return r ? { ...x, relation: r } : x; }),
        };
      }
      if (opts?.fx?.length || pn.length) g = syncSimToPlayer(g);
      // 开局势力：创作者自设的势力全部装入阵营系统；玩家勾选加入的写入初始声望与「所属势力」档案
      const sf = (opts?.factions ?? []).filter((f) => f.id && f.name.trim());
      if (sf.length) {
        const joined = new Set(opts?.joined ?? []);
        const have = new Set((g.factions ?? []).map((f) => f.id));
        const flags = { ...(g.sim.flags ?? {}) };
        for (const f of sf) if (joined.has(f.id)) flags[factionFlag(f.id)] = Math.max(REP_MIN, Math.min(REP_MAX, Math.round(f.rep ?? 20)));
        const names = sf.filter((f) => joined.has(f.id)).map((f) => f.name.trim());
        g = {
          ...g,
          factions: [...(g.factions ?? []), ...sf.filter((f) => !have.has(f.id)).map((f) => ({ id: f.id, name: f.name.trim(), desc: f.desc, tags: f.tags }))],
          sim: { ...g.sim, flags },
          player: { ...g.player, extra: [...g.player.extra.filter((e) => e.label !== "所属势力"), ...(names.length ? [{ label: "所属势力", value: names.join("、") }] : [])] },
        };
        syncFactions(g);
      }
      // 人物线路 · 预设主角：玩家接管这名固定人物（其余预设角色照常作为 NPC 生活）
      const route = opts?.route;
      const heroNpc = route?.hero ? g.npcs.find((n) => n.id === route.hero) : undefined;
      if (heroNpc) {
        const hid = heroNpc.id;
        const rel = { ...g.sim.rel };
        delete rel[hid];
        // TA 在关系网里与他人的关系，转成那些人「与你」的关系（玩家没在线路人际里另行设定时）
        const edges = g.relNet?.edges ?? [];
        const KIND_LABEL = { partner: "恋人", ex: "前任", parent: "亲人", other: "旧识" } as const;
        const toYou = new Map<string, string>();
        for (const e of edges) {
          const other = e.a === hid ? e.b : e.b === hid ? e.a : "";
          if (other) toYou.set(other, e.note?.trim() || (e.kind === "parent" ? (e.a === hid ? "子女" : "父母") : KIND_LABEL[e.kind]));
        }
        const set = new Set(pn.filter((n) => n.relation?.trim()).map((n) => n.id));
        g = {
          ...g,
          player: {
            ...g.player,
            avatar: g.player.avatar || heroNpc.avatar,
            extra: [...g.player.extra.filter((e) => e.label !== "预设主角"), { label: "预设主角", value: heroNpc.name }],
          },
          sim: { ...g.sim, hero: hid, rel, metPeople: (g.sim.metPeople ?? []).filter((id) => id !== hid), mobs: Object.fromEntries(Object.entries(g.sim.mobs ?? {}).filter(([id]) => id !== hid)) },
          npcs: g.npcs.filter((n) => n.id !== hid).map((n) => (toYou.has(n.id) && !set.has(n.id) ? { ...n, relation: toYou.get(n.id)! } : n)),
          ...(g.relNet ? { relNet: { ...g.relNet, edges: edges.filter((e) => e.a !== hid && e.b !== hid) } } : {}),
        };
      }
      const memory = route?.memory?.trim();
      if (memory) g = { ...g, player: { ...g.player, extra: [...g.player.extra, { label: "前置记忆", value: memory }] } };
      // 人物线路 · 开局数值：只结算挂到已有属性/人物的依赖行；未选中或野名不生效、不自动新建属性
      const rfx = normRouteFx(route?.fx);
      if (rfx) {
        const statKey = (name: string) => (Object.keys(STAT_LABELS) as (keyof typeof STAT_LABELS)[]).find((k) => STAT_LABELS[k] === name || k === name);
        const metricKey = (name: string) => FIXED_METRICS.find((m) => !m.key.startsWith("c:") && m.key !== "week" && (m.label === name || m.key === name))?.key;
        const effects: FixedEffect[] = [];
        for (const { name, val } of [...(rfx.attr ?? []), ...(rfx.reputation ?? [])]) {
          if (!val) continue;
          const sk = statKey(name);
          const mk = sk ? undefined : metricKey(name);
          if (sk) { effects.push({ kind: "stat", key: sk, delta: val }); continue; }
          if (mk) { effects.push({ kind: "metric", key: mk, delta: val }); continue; }
          const d = (g.attrDefs ?? []).find((x) => x.label === name || x.id === name);
          // 功能注释：必须命中作品已有自定义属性；禁止再 routeAttrId 自动开洞
          if (!d) continue;
          g = setCustomAttr(g, d, customAttrValue(g, d) + val);
        }
        for (const { target, val } of rfx.favor ?? []) {
          const n = g.npcs.find((x) => x.name === target || x.id === target || x.aliases?.includes(target));
          if (n && val) effects.push({ kind: "rel", key: n.id, delta: val });
        }
        if (effects.length) g = { ...g, sim: applyEffectList(g.sim, effects).next };
        g = syncSimToPlayer(g);
      }
      // 地图库里标了「开局使用」的地图：套用到新存档，并按身份/出身或默认起点决定开局地点
      // 没有「开局使用」地图时，沿用上一局在地图编辑器里改过的地图（含设定的开局地点），同一世界观才继承
      const prev = gameRef.current;
      const inherited = prev?.mapEdits && (prev.worldId ?? DEFAULT_WORLD) === (g.worldId ?? DEFAULT_WORLD) ? prev.mapEdits : undefined;
      const preset = startPreset();
      const edits = preset?.edits ?? inherited;
      if (edits) {
        g.mapEdits = JSON.parse(JSON.stringify(edits));
        const r = resolveStart(g.mapEdits, player);
        if (r) {
          g.sim = { ...g.sim, room: r, visited: [r], discoveredAt: { [r]: 0 } };
          g.world = { ...g.world, location: spotName(g, r) || LIVE_LOCATIONS.find((l) => l.id === r)?.name || g.world.location };
        }
      }
      if (route?.room) {
        const loc = spotName(g, route.room) || LIVE_LOCATIONS.find((l) => l.id === route.room)?.name;
        if (loc) {
          g.sim = { ...g.sim, room: route.room, visited: [route.room], discoveredAt: { [route.room]: 0 } };
          g.world = { ...g.world, location: loc };
        }
      }
      const boundEv = route?.eventId ? (getWorld().content.fixedEvents ?? []).find((e) => e.id === route.eventId) : undefined;
      const routeEvent = [
        route?.event?.trim() ? `【开局专属小事件】序章里必须自然发生这件事：${route.event.trim()}\n` : "",
        boundEv ? `【开局绑定事件 · ${boundEv.name}】序章里必须自然发生：${boundEv.prompt.trim()}\n` : "",
      ].join("");
      // 新局 = 新 saveId：按切档 5 步进入，私有数据为全新空白，绝不继承上一局
      switchSave(g.id, {
        flushCurrent: flushAutosave,
        render: () => {
          resetTransient();
          gameRef.current = g;
          setGame(g);
          setSaveEpoch((n) => n + 1);
        },
      });
      if (autosaveOnRef.current) autosaveDebounced(g); // 新局立即覆盖自动存档，避免刷新后读回已结局的旧局
      // 功能注释：开幕页只播编辑器开场白；此处只登记开局剧情提示，等 go("game") 后再 runTurn
      pendingOpeningPromptRef.current =
        routeEvent +
        `【开局地点】主角此刻身处「${g.world.location}」，序章收束时她必须就在这里，world.location 保持为「${g.world.location}」。\n【序章篇幅与文风】正文约 450~550 字（不含 JSON），写成自然连贯的开场白；严禁写章节标题、时间标题。文风追求生活化、烟火气与真实人情味——严禁拿父母的职业硬凑生硬隐喻（例如严禁写「我修桥铺路，桥塌了有人查」「那地方能有根么」这类说教比喻），严禁「把这话说得很轻，轻得像怕惊着她」「摔得没个数」「舞台上的那口气，只有站上去的人才懂」之类矫揉造作的 AI 腔调。\n` +
        getOpeningDirective(
          "游戏开始，请写主角的开局序幕。用自然平实、有生活细节的笔触，简要把她的家境与成长底色带出：父母若有劝阻或牵挂，应当是日常餐桌、收拾行李或电话里的朴素家常话（如心疼她作息不规律、怕她受委屈、关心房租够不够），绝对不要用父母的职业去生造比喻或说大道理。随后将画面自然落回此刻——她已经在当前住处安顿下来。结尾停在一个具体的画面或小钩子上（例如手机刚弹出的一条消息、桌上没拆的快递、楼下传来的动静、今天约好要见的人），由人物动作或台词自然收住；严禁用旁白对玩家总结或喊话，如「今天没什么硬性的事」「这一天怎么过，全看你自己」「新的一天开始了」「属于她的故事才刚刚开始」「接下来会发生什么呢」。最后给出 3~4 个具体可玩的行动选项。",
        );
      setScreen("opening");
    },
    [],
  );

  const flushOpeningPlot = useCallback(() => {
    const g = gameRef.current;
    const prompt = pendingOpeningPromptRef.current;
    if (!g || !prompt) return;
    pendingOpeningPromptRef.current = null;
    if (g.story.some((t) => t.role === "ai" && !t.error)) return;
    void runTurn(g, prompt, false, true);
  }, [runTurn]);
  flushOpeningPlotRef.current = flushOpeningPlot;

  // 当面却在用手机找对方 → 对方打断主角玩手机：以幕后指令推进一回合，转入线下当面交谈
  const busyRef = useRef(busy);
  busyRef.current = busy;
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<PhoneInterrupt>).detail;
      const g = gameRef.current;
      if (!d || !g || busyRef.current) return;
      void runTurn(g, `【手机被打断 · 幕后指令，不是主角的台词】主角此刻和${d.name}当面待在一起，却低头用手机给 TA ${d.what}。${d.name}觉得明明可以直接说话，于是打断了主角玩手机。请从${d.name}的反应写起（调侃、不满、好奇或撒娇都行，贴合 TA 的性格与好感），把场景自然转入当面交谈，并给出可选行动。`, false, true);
    };
    window.addEventListener("phone:interrupt", h);
    return () => window.removeEventListener("phone:interrupt", h);
  }, [runTurn]);

  const submit = useCallback(
    async (input: string, asPopup = false) => {
      let g = gameRef.current;
      if (!g || busy) return;
      // 事件选项：代码先结算选项效果 / 分支，再把续写指引交给 AI
      const picked = parseChoice(input, [...(g.fixedEvents ?? []), ...getWorldEventGroups().flatMap((x) => x.events)]);
      if (picked) {
        const { ev, choice } = picked;
        const { next: chosen, changes, failed, prompt } = applyChoice(g.sim, ev, choice);
        // 对话分支触发：选了这个选项的后续事件入队，本回合结束后上演
        const next = queueChoiceTriggers(chosen, g.fixedEvents ?? [], ev.id, choice.id);
        g = commitSimRef.current?.(next) ?? g;
        const note = changes.length ? `（已由代码结算：${changes.join("、")}）` : "";
        await runTurn(g, `【事件抉择：${ev.name}】玩家选择了「${choice.label}」。${failed ? "（判定失败：这条路没走通，按失败结果演绎，不要写成成功）" : ""}${prompt}${note}`, asPopup, false, undefined, true);
        return;
      }
      input = input.replace(/^⟦选项:[^⟧]*⟧/, ""); // 失效的选项标记（事件已删除）按普通文本处理
      await runTurn(g, input, asPopup);
      if (oocText(input, rulesOf(g).narrative.oocMarks)) return; // OOC 场外话不触发支线
      // 支线·关键词触发：玩家的行动/台词提到某支线的关键词，本回合结束后自动展开
      const done = firedOf(gameRef.current ?? g, "quest");
      const hit = SIDEQUESTS.find((q) => !done.includes(q.id) && (q.keywords ?? []).some((k) => k && input.includes(k)));
      if (hit) setTimeout(() => playQuestRef.current?.(hit.id), 120);
    },
    [busy, runTurn],
  );

  const setPlayerAvatar = useCallback(
    (dataUrl: string) => {
      const g = gameRef.current;
      if (!g) return;
      persist({ ...g, player: { ...g.player, avatar: dataUrl } });
    },
    [persist],
  );
  const setNpcAvatar = useCallback(
    (id: string, dataUrl: string) => {
      const g = gameRef.current;
      if (!g) return;
      persist({ ...g, npcs: g.npcs.map((n) => (n.id === id ? { ...n, avatar: dataUrl } : n)) });
    },
    [persist],
  );
  // 立绘：空字符串 = 移除
  const setNpcPortrait = useCallback(
    (id: string, url: string) => {
      const g = gameRef.current;
      if (!g) return;
      persist({ ...g, npcs: g.npcs.map((n) => (n.id === id ? { ...n, portrait: url || undefined } : n)) });
    },
    [persist],
  );

  // 手动调节核心关系轴（好感 s.rel / 心动·信任·近况心情 s.relations），钳制到各自区间后回灌镜像
  const setRelValue = useCallback(
    (pid: string, dimId: string, value: number) => {
      const g = gameRef.current;
      if (!g?.sim) return;
      const s = g.sim;
      const v = Math.round(value);
      if (dimId === "friendship") {
        const cap = affinityCapOf(pid);
        const rel = { ...s.rel, [pid]: Math.max(-100, Math.min(cap, v)) };
        persist(syncSimToPlayer({ ...g, sim: { ...s, rel } }));
        return;
      }
      const relations = ensureRelations(s.relations);
      const cur = relations[pid] ?? blankRel();
      const M = RELATIONS.mood;
      const next = { ...cur };
      if (dimId === "romantic") next.romantic = Math.max(0, Math.min(romanticCapOf(pid), v));
      else if (dimId === "trust") next.trust = Math.max(RELATIONS.trust.min, Math.min(RELATIONS.trust.max, v));
      else if (dimId === "mood") next.mood = Math.max(M.min, Math.min(M.max, v));
      else return;
      persist({ ...g, sim: { ...s, relations: { ...relations, [pid]: next } } });
    },
    [persist],
  );

  // 可攻略开关：默认人人可攻略，玩家可逐人关闭；家人缺省亲情线、可手动开启，子女恒不可攻略，已确认关系的人不能关。返回空串 = 已切换，否则为原因
  const setRomanceable = useCallback(
    (pid: string, on: boolean): string => {
      const g = gameRef.current;
      if (!g?.sim) return "";
      const s = g.sim;
      if (!on && (hasPartner(s, pid) || s.spouses?.includes(pid))) return "你们已经确认关系，不能设为不可攻略。";
      if (isFamilyNpc(pid)) {
        // 家人：缺省亲情线，玩家手动开启 / 关闭恋爱线
        const fam = new Set(s.familyRomance ?? []);
        const off0 = new Set(s.noRomance ?? []);
        if (on) { fam.add(pid); off0.delete(pid); } else fam.delete(pid);
        persist({ ...g, sim: { ...s, familyRomance: [...fam], noRomance: [...off0] } });
        return "";
      }
      if (romanceFixedOff(s, pid)) return "子女之间只有亲情，恒不可攻略。";
      const off = new Set(s.noRomance ?? []);
      if (on) off.delete(pid);
      else off.add(pid);
      persist({ ...g, sim: { ...s, noRomance: [...off] } });
      return "";
    },
    [persist],
  );

  // 手动调节情感印象（爱慕/友善/敌意…）——存于 npc.dims 自由轴，缺失则新增
  const setNpcDim = useCallback(
    (pid: string, label: string, value: number) => {
      const g = gameRef.current;
      if (!g) return;
      const v = Math.max(-100, Math.min(100, Math.round(value)));
      persist({
        ...g,
        npcs: g.npcs.map((n) => {
          if (n.id !== pid) return n;
          const dims = n.dims.some((d) => d.label === label)
            ? n.dims.map((d) => (d.label === label ? { ...d, value: v } : d))
            : [...n.dims, { label, value: v }];
          return { ...n, dims };
        }),
      });
    },
    [persist],
  );

  // 立即存档：把当前进度直接写入自动存档槽并等待落库（异步，带异常兜底）
  const saveNow = useCallback(async (): Promise<boolean> => {
    const g = gameRef.current;
    if (!g) return false;
    cancelAutosave();
    return writeAutosave(g);
  }, []);

  // 重新生成：AI 输出异常（乱码）时，从上一回合的前置状态用同样的输入重跑
  // 失败重试：剥掉末尾错误条；若紧邻的玩家气泡与本次请求相同也一并剥掉（runTurn 会重新插入），
  // 从「当前状态」重发——行动点等前置结算已在首次提交时扣过，不会重复扣除，也不丢失期间的其它操作。
  // 非错误场景（如乱码回合已结算）仍回退到上一回合前置快照重跑。
  const regenerate = useCallback(() => {
    const last = lastTurnRef.current;
    const cur = gameRef.current;
    if (!last || busy) return;
    setCanRetry(false);
    const story = cur?.story ?? [];
    const tail = story[story.length - 1];
    if (cur && tail?.role === "ai" && tail.error) {
      let cut = story.length - 1;
      const prev = story[cut - 1];
      if (prev?.role === "player" && prev.segments[0]?.text === last.input) cut -= 1;
      // 回滚：世界时间 / 回合数 / 生涯日回到失败前快照，buildMessages 读到的是失败那回合的原始上下文
      const snap = last.base;
      const rolled: GameState = {
        ...cur,
        story: story.slice(0, cut),
        world: { ...cur.world, time: snap.world.time },
        turnCount: snap.turnCount,
        ...(cur.sim && snap.sim ? { sim: { ...cur.sim, day: snap.sim.day, week: snap.sim.week } } : {}),
      };
      void runTurn(rolled, last.input, false, last.hideInput);
      // runTurn 在首个 await 前已把 lastTurnRef 改写为 rolled；恢复为原快照，保证「快照 = 回滚点」不被覆盖
      lastTurnRef.current = last;
      return;
    }
    void runTurn(last.base, last.input, false, last.hideInput);
  }, [busy, runTurn]);

  // 弹窗行动失败后「重新触发」：用弹窗里存下的原参数重发；已先行结算的事件剔除失败留档，避免重复
  const retryPopup = useCallback(() => {
    const r = popup?.retry;
    const cur = gameRef.current;
    if (!r || !cur || busy) return;
    setPopup(null);
    let base = cur;
    if (r.preSettled && r.journalMeta) {
      const j = cur.journal ?? [];
      const idx = j.findIndex((e) => e.title === r.journalMeta!.title && (e.text ?? "").startsWith("（AI 演绎失败"));
      if (idx >= 0) base = { ...cur, journal: j.filter((_, i) => i !== idx) };
    }
    void runTurn(base, r.input, true, r.hideInput, r.journalMeta, r.preSettled);
  }, [busy, popup, runTurn]);

  const setWorldRules = useCallback(
    (next: WorldRules) => {
      const g = gameRef.current;
      if (!g) return;
      persist({ ...g, worldRules: next });
    },
    [persist],
  );

  const setWorldBook = useCallback(
    (next: import("../lib/types").WorldBookEntry[]) => {
      const g = gameRef.current;
      if (!g) return;
      persist({ ...g, worldBook: next });
    },
    [persist],
  );

  // 存档里的自建地点同步进世界房间表（地图、移动、AI 都能看见）
  // 渲染期同步（幂等），保证同一帧内地图就能看到新地点
  useMemo(() => {
    const m = game?.mapEdits ?? {};
    setRuntimeSpots(Object.entries(m).filter(([k, v]) => k !== "_config" && (v as MapSpotEdit)?.custom)
      .map(([id, v]) => ({ id, name: (v as MapSpotEdit).name?.trim() || "新地点", desc: (v as MapSpotEdit).desc, link: (v as MapSpotEdit).link })));
  }, [game?.mapEdits]);

  const setMapEdits = useCallback(
    (next: import("../lib/types").MapEdits) => {
      const g = gameRef.current;
      if (!g) return;
      persist({ ...g, mapEdits: next });
    },
    [persist],
  );

  /* 地名 → 房间 id：先精确匹配，再取被地名包含（或包含地名）的最长房间名；查内置地点与地图编辑器自建地点 */
  const roomByName = (g: GameState, name: string): string | undefined => {
    const ids = Array.from(new Set([...allRooms(), ...Object.keys(g.mapEdits ?? {}).filter((k) => k !== "_config")]));
    const named = ids.map((id) => ({ id, n: (spotName(g, id) || locOf(id)?.name || "").trim() })).filter((x) => x.n);
    const q = name.trim();
    return named.find((x) => x.n === q)?.id
      ?? named.filter((x) => q.includes(x.n) || (x.n.length >= 2 && x.n.includes(q))).sort((a, b) => b.n.length - a.n.length)[0]?.id;
  };

  /* 回到开局地点：地图编辑器里绑定身份/出身的起点 → 默认起点 → 世界观起点 */
  const goHome = (s: SimState): SimState => {
    const g = gameRef.current;
    const home = (g && resolveStart(g.mapEdits, g.player)) || getWorldStartRoom();
    if (!home || s.room === home) return s;
    return { ...s, room: home, visited: (s.visited ?? []).includes(home) ? s.visited : [...(s.visited ?? []), home] };
  };

  /* 推进手记：时间解析 + 日程 + 属性变化解析 */
  const makeDiary = (a: SimState, b: SimState, days: string[], gains: string[], g: GameState | null): Diary => {
    const lim = g ? limitDays(g.timeLimit, g.startDate || startDateLabel()) : 0;
    const date = dayDateLabel(b.day);
    const m = parseInt(date.slice(5, 7), 10);
    const season = m >= 3 && m <= 5 ? "春" : m >= 6 && m <= 8 ? "夏" : m >= 9 && m <= 11 ? "秋" : "冬";
    const rows: Diary["rows"] = [];
    const add = (label: string, from: number, to: number, hint: string) => { if (to !== from) rows.push({ label, from, to, hint }); };
    add("名气", a.fame, b.fame, b.fame > a.fame ? "有人开始记住你了" : "热度在退");
    add("口碑", a.reputation, b.reputation, b.reputation > a.reputation ? "风评变好" : "风评下滑，留意言行");
    add("压力", a.stress, b.stress, b.stress >= 80 ? "已近临界，尽快安排休息" : b.stress > a.stress ? "日程偏满" : "身心放松了些");
    { const wa = wallet.balance(a), wb = wallet.balance(b); add(wallet.name(), wa, wb, wb < 0 ? "已经透支" : wb > wa ? "有进账" : "课程与生活开销"); }
    for (const k of STAT_ORDER) add(STAT_LABELS[k], a.stats[k], b.stats[k], b.stats[k] > a.stats[k] ? "练习见效" : "疏于练习而生疏");
    const n = Math.max(1, b.day - a.day);
    return {
      date: `${date} ${weekdayName(b.day)}`,
      week: b.week,
      season,
      span: `第 ${a.day + 1} 天 → 第 ${b.day} 天，共 ${n} 天`,
      toSettle: 7 - dowOf(b.day),
      left: lim > 0 ? Math.max(0, lim - b.day) : undefined,
      location: (g && (spotName(g, b.room) || locOf(b.room)?.name)) || undefined,
      days: days.filter((t) => t.trim()).slice(-14),
      sources: Array.from(new Set(gains.filter(Boolean))).slice(0, 10),
      rows,
    };
  };

  /* —— 确定性引擎接线 —— */
  // 比较前后 sim，产出玩家可读的数值变化提示
  const simDiff = (a: SimState, b: SimState): string[] => {
    const out: string[] = [];
    const push = (label: string, d: number, suffix = "") => { if (d) out.push(`${label} ${d > 0 ? "+" : ""}${d}${suffix}`); };
    push("名气", b.fame - a.fame);
    push("口碑", b.reputation - a.reputation);
    push("压力", b.stress - a.stress);
    if (wallet.bound()) push(wallet.name(), wallet.balance(b) - wallet.balance(a));
    else { const money = Math.round((b.money - a.money) / 1000) / 10; if (money) out.push(`资金 ${money > 0 ? "+" : ""}${money}万`); }
    for (const k of STAT_ORDER) push(STAT_LABELS[k], b.stats[k] - a.stats[k]);
    if (b.works !== a.works) out.push("作品 +" + (b.works - a.works));
    if (b.awards !== a.awards) out.push("奖项 +" + (b.awards - a.awards));
    return out;
  };

  // 把新的 sim 落地：同步档案、更新世界时间、存档
  const commitSim = useCallback((nextSim: SimState, narration?: string): GameState | null => {
    const g = gameRef.current;
    if (!g) return null;
    // 绑定了自定义货币（灵石 / 金币…）时，引擎对游戏资金的增减（片酬、项目款、开销…）统一转记到钱包属性
    if (walletDef(g) && nextSim.money !== g.sim.money) {
      nextSim = wallet.add({ ...nextSim, money: g.sim.money }, nextSim.money - g.sim.money);
    }
    // 确定性动作的叙事结果直接落进下半部分的对话框（故事线），不再另开绿色小字。
    const storyOf = (nar?: string) => nar
      ? [...g.story, { id: uid(), role: "ai" as const, segments: [{ kind: "system" as const, text: nar }], ts: Date.now() }]
      : g.story;
    // 日历进入 NPC 生日月：年龄 +1（每年一次），并在旁白里播报
    const bd = nextSim.day !== g.sim.day ? tickBirthdays(g.npcs, nextSim.day) : { npcs: g.npcs, notes: [] as string[] };
    if (bd.notes.length) {
      narration = [narration, ...bd.notes].filter(Boolean).join("\n");
    }
    // 主角年龄随日历：内置开启（创作者界面不再暴露开关），过生日 / 元旦 +1 岁
    const aged = tickPlayerAge(g, nextSim.day);
    if (aged.note) narration = [narration, aged.note].filter(Boolean).join("\n");
    const merged = syncSimToPlayer({
      ...g,
      player: aged.g.player,
      playerAgedYear: aged.g.playerAgedYear,
      npcs: bd.npcs,
      sim: nextSim,
      story: storyOf(narration),
      world: {
        ...g.world,
        time: `第 ${nextSim.week} 周 · ${dayDateLabel(nextSim.day)} ${weekdayName(nextSim.day)}`,
        location: spotName(g, nextSim.room) || locOf(nextSim.room)?.name || g.world.location,
      },
    });
    // 世界走了一拍：同处一地的 NPC 互相交换听闻（NPC↔NPC 知识流动）
    const final = nextSim.tick !== g.sim.tick && nextSim.mobs ? gossipTick(merged, nextSim.mobs, nextSim.tick ?? 0, merged.world.time).g : merged;
    persist(syncChildNpcs(final));
    // 每次确定性状态落地后，检查是否有固定事件恰好满足触发条件（时间/属性/地点/物品/关系）。
    // 微任务延后执行，避免在本次结算尚未完成时重入。
    queueMicrotask(() => runFixedRef.current?.());
    return final;
  }, [persist]);

  // —— 固定事件：代码判定 → 代码结算数值 → 提示词交 AI 演绎（AI 不参与是否触发的判定）——
  const runFixedCheck = useCallback(() => {
    if (fixedFiringRef.current) return; // 正在演绎一桩，先不叠加
    if (screenRef.current !== "game") return; // 仅在正式游玩时触发
    const g0 = gameRef.current;
    // 自定义结局：勾选「达成即落幕」的结局一旦满足，立即进入结局
    // 主线时限到期：无论条件，强制落幕
    const lim0 = g0 ? limitDays(g0.timeLimit, g0.startDate || startDateLabel()) : 0;
    if (g0 && !g0.ended && lim0 > 0 && (g0.sim.day ?? 0) >= lim0) { void endManuallyRef.current?.("finish"); return; }
    if (g0 && !g0.ended && matchCustomEnding(g0.customEndings, g0.sim, true)) { void endManuallyRef.current?.("finish"); return; }
    if (!g0 || !isConfigured(cfg)) return; // 未接入 AI 时静默等待，不弹「条件不足」
    let g: NonNullable<typeof g0> = g0;
    // 事件触发类型（进入地点 / 获得道具 / 好感变化 / 轮次 / 行动完成）入队；事件链断点（暂停 / 中断 / 永久失败）写进全局标记
    {
      const evs = g.fixedEvents ?? [];
      const brk = applyChainBreaks(scanTriggers(g, evs), evs);
      if (brk.next !== g.sim) { g = { ...g, sim: brk.next }; persist(g); }
      if (brk.changes.length) setLastChanges(brk.changes);
    }
    // 属性升档：勾选「升档时触发剧情」的属性升到新档位，演绎一段突破剧情（每档一次）
    const seen = { ...(g.attrTierSeen ?? {}) };
    let upTo: { d: import("../lib/types").AttrDef; t: string; v: number } | null = null;
    for (const d of g.attrDefs ?? []) {
      if (!d.tierEvent || !d.tiers?.length) continue;
      const v = g.player.attrs.find((a) => a.key === d.id)?.value ?? d.init;
      const sorted = [...d.tiers].sort((a, b) => a.min - b.min);
      const t = tierOf(v, sorted)!;
      if (seen[d.id] === t) continue;
      const up = seen[d.id] !== undefined && sorted.findIndex((x) => x.label === t) > sorted.findIndex((x) => x.label === seen[d.id]);
      seen[d.id] = t; // 首次/降档只记下
      if (up && !upTo) upTo = { d, t, v };
    }
    if (JSON.stringify(seen) !== JSON.stringify(g.attrTierSeen ?? {})) {
      const marked = { ...g, attrTierSeen: seen };
      persist(marked);
      if (upTo) {
        const { d, t, v } = upTo;
        fixedFiringRef.current = true;
        const story = d.tiers?.find((x) => x.label === t)?.prompt?.trim();
        void runTurn(marked, `【属性升档：${d.label}】主角的${d.label}达到「${t}」（${v}）。${story ? `请严格按作者设定演绎：\n${story}` : `请演绎这一突破/蜕变的时刻，写出旁人可感的变化。`}${d.desc ? `（${d.label}：${d.desc}）` : ""}`, true, false, { kind: "spot", srcId: `attr-${d.label}`, title: `${d.label} · 蜕变`, seed: d.label, location: marked.world.location, when: `第 ${marked.sim.week} 周` })
          .finally(() => { fixedFiringRef.current = false; });
        return;
      }
    }
    // 条件抵达：年龄/周数达标，自动来到某地并展开剧情（每条只触发一次）
    const arr = pickArrival(g, LIVE_LOCATIONS.map((l) => l.id));
    if (arr) {
      fixedFiringRef.current = true;
      const name = spotName(g, arr.room) || LIVE_LOCATIONS.find((l) => l.id === arr.room)?.name || arr.room;
      const sim = { ...g.sim, room: arr.room, visited: [...new Set([...(g.sim.visited ?? []), arr.room])] };
      const moved = { ...(commitSim(sim) ?? g), arrivalsFired: [...(g.arrivalsFired ?? []), arr.a.id] };
      moved.world = { ...moved.world, location: name };
      persist(moved);
      void runTurn(moved, `【条件抵达：${name}】主角此刻来到了「${name}」。${arr.a.note ?? "请以此地为舞台展开一段剧情。"}`, true, false, { kind: "spot", srcId: `arrive-${name}`, title: name, seed: arr.a.note ?? name, location: name, when: `第 ${moved.sim.week} 周` })
        .finally(() => { fixedFiringRef.current = false; });
      return;
    }
    // 支线·条件触发：内容里声明了 conds 且全部满足的支线，自动展开（每段一次）
    {
      const done = firedOf(g, "quest");
      const sq = SIDEQUESTS.find((q) => q.conds?.length && !done.includes(q.id) && q.conds.every((c) => evalFixedCond(c, g.sim)));
      if (sq) { playQuestRef.current?.(sq.id); return; }
    }
    // 先按创作者排序的固定事件；没有可触发的，再按概率从「随机触发」分组（默认 NPC 之间）抽一桩
    // 先演已被触发、排队中的事件；再按创作者排序的固定事件；最后随机
    const queued = takeQueued(g.fixedEvents ?? [], g.sim);
    if (queued.sim !== g.sim) { g = { ...g, sim: queued.sim }; persist(g); }
    const ev = queued.ev ?? pickFixedEvent(g.fixedEvents ?? [], g.sim)
      ?? pickRandomEvent(getWorldEventGroups(), g.randomGroups, g.fixedEvents ?? [], g.sim);
    if (!ev) return; // 条件未满足：什么也不显示，游戏照常自由运行
    fixedFiringRef.current = true;
    const hidden = applyHiddenBranches(applyFixedEffects(g.sim, ev).next, ev); // 先由代码结算所有数值/状态变化；条件已满足的隐藏分支自动走
    const next = hidden.next;
    // 带结束关键词的事件：上演后转为进行中，之后每回合继续发送设定，直到 AI 写出结束词
    const merged = keepIfOngoing(commitSim(next) ?? g, ev);
    const opts = eventChoiceOptions(ev, next);
    const choiceHint = opts.length ? `\n（本幕结尾停在抉择前：玩家将从「${opts.map((o) => o.label).join("」「")}」中选择，不要替玩家做决定）` : "";
    const hiddenHint = hidden.prompts.length ? `\n（暗线已触发，须自然写进本幕，不要点明是「隐藏分支」：${hidden.prompts.join("；")}）` : "";
    const evText = `【固定事件：${ev.name}】\n${ev.prompt}${hiddenHint}${choiceHint}`;
    // 插入对话流（酒馆式）：直接写进主剧情，作为幕后指令不显示成玩家气泡；否则弹出剧情幕并写剧情志
    void (ev.inline
      ? runTurn(merged, evText, false, true, undefined, true)
      : runTurn(
      merged,
      evText,
      true,
      false,
      { kind: "spot", srcId: ev.id, title: ev.name, seed: ev.prompt, location: merged.world.location, when: `第 ${merged.sim.week} 周 · ${weekdayName(merged.sim.day)}` },
      true,
    )).then(() => {
      // 事件选项：替换 AI 给的选项，玩家点击后由代码结算（见 submit）
      const cur = gameRef.current;
      if (opts.length && cur && cur.id === merged.id) persist({ ...cur, options: opts });
    }).finally(() => { fixedFiringRef.current = false; });
  }, [cfg, commitSim, persist, runTurn]);
  runFixedRef.current = runFixedCheck;
  // 音频信号（播放结束 / 淡入完成 / 淡出完成）到来时立即检查一次触发器
  useEffect(() => onAudioSignal(() => runFixedRef.current?.()), []);
  commitSimRef.current = commitSim;

  // 创作者在编辑器里预览某个固定事件：临时演绎其提示词，但不结算数值、不登记触发、不写剧情志。
  const previewFixedEvent = useCallback((ev: FixedEvent) => {
    const g = gameRef.current;
    if (!g) return;
    void runTurn(g, `【预览·固定事件：${ev.name}】\n${ev.prompt}`, true);
  }, [runTurn]);

  // 事件库分组的「随机触发」开关
  const setRandomGroups = useCallback((ids: string[]) => {
    const g = gameRef.current;
    if (g) persist({ ...g, randomGroups: ids });
  }, [persist]);

  // 覆写固定事件表并持久化（创作者编辑，玩家不可见）
  const setFixedEvents = useCallback((next: FixedEvent[]) => {
    const g = gameRef.current;
    if (!g) return;
    persist({ ...g, fixedEvents: next });
  }, [persist]);

  // 安排本周某一天（0=周一 … 6=周日）要做的一件事
  const setSchedule = useCallback((day: number, actId: string | null) => {
    const g = gameRef.current;
    if (!g) return;
    const schedule = [...(g.sim.schedule ?? [null, null, null, null, null, null, null])];
    while (schedule.length < 7) schedule.push(null);
    schedule[day] = actId;
    commitSim({ ...g.sim, schedule });
  }, [commitSim]);

  // 佩戴/更换/摘下头衔：仅在已获得的头衔间切换，纯确定性、不叙事
  const equipTitle = useCallback((id: string | null) => {
    const g = gameRef.current;
    if (!g) return;
    if (id !== null && !g.sim.titles.includes(id)) return;
    commitSim({ ...g.sim, equippedTitle: g.sim.equippedTitle === id ? null : id });
  }, [commitSim]);

  // 违约了结：制片人上门追责后，赔付违约金并结束该事件（fee 已在引擎按片酬 40% 算好）。
  const resolveBreach = useCallback((finalFee?: number) => {
    const g = gameRef.current;
    if (!g || !g.sim.breach) return;
    const b = g.sim.breach;
    const fee = Math.max(0, Math.round(finalFee ?? b.fee));
    // 态度诚恳把违约金谈低时，负责人信任折损也随之缓和；顶撞加重则折损更多
    const trustHit = fee <= b.fee ? 6 : 10;
    const money = (n: number) => wallet.fmt(n, g);
    const merged = commitSim({
      ...wallet.add(g.sim, -fee),
      trust: Math.max(0, g.sim.trust - trustHit),
      // 多起违约排队：了结一起后，下一起接上
      breach: g.sim.breachQueue?.[0] ?? null,
      breachQueue: (g.sim.breachQueue ?? []).slice(1),
      log: [...g.sim.log, `【第 ${g.sim.week} 周 · 违约了结】赔付${b.producer}《${b.gigName}》违约金 ${money(fee)}，负责人信任 -${trustHit}`].slice(-40),
    });
    const sysMsg = `你向${b.producer}赔付了《${b.gigName}》的违约金 ${money(fee)}，此事告一段落。\n违约记录会影响之后的${term("gig", "工作")}洽谈成功率，好好经营${term("reputation", "口碑")}。`;
    const changes = [`${wallet.name(g, "零钱")} -${fee}`, `负责人信任 -${trustHit}`];
    if (merged) narrateSettled(g, merged, { tag: "违约了结", title: "违约了结", sysMsg, changes, brief: `主角与${b.producer}就《${b.gigName}》的违约当面了结。` });
    else setPopup({ title: "违约了结", segments: [{ kind: "system", text: sysMsg }], changes });
  }, [commitSim, cfg, runTurn]);

  // 一天推进结果落地：每天跑发行/关系衰减，周结算时叠加人设周结算，并弹出当天结果（含档位与收益）。
  const applyDayResult = useCallback((prevSim: SimState, res: ReturnType<typeof advanceDay>) => {
    // 发行/试镜/关系衰减按日历日推进，每天翻页都结算一次
    const post = postDay(res);
    const relEvents = post.relEvents;
    const next = goHome(post.next); // 推进完一段日子，回到开局地点（住处）
    const diary = makeDiary(prevSim, next, res.dayText.split(/\n\n+/), res.gains, gameRef.current);
    const changes = simDiff(prevSim, next);
    const merged = commitSim(next);
    setLastChanges(changes);
    const relText = relEvents.length ? "\n\n" + relEvents.join("\n") : "";
    const gainText = res.gains.length ? "\n" + res.gains.join(" · ") : "";
    if (res.settled) {
      const tailLines = next.log.slice(-3);
      const tail = tailLines.join("\n");
      setPopup({
        report: buildReport(next.log, prevSim.week, prevSim.week, relEvents, { grade: res.gradeLabel || undefined, act: res.actLabel, gains: res.gains }),
        diary,
        title: `${res.gradeLabel ? res.gradeLabel + " · " : ""}第 ${prevSim.week} 周结算`,
        segments: [{ kind: "system", text: `${res.dayText}${gainText}\n\n${next.log.length ? tail : ""}${relEvents.filter((e) => !tailLines.includes(e)).map((e) => "\n\n" + e).join("")}` }],
        changes,
      });
    } else {
      setPopup({
        diary,
        title: res.gradeLabel ? `${res.gradeLabel} · ${res.actLabel}` : res.actLabel,
        segments: [{ kind: "system", text: res.dayText + gainText + relText }],
        changes,
      });
    }
    // 终局（两年期满 / 主线时限）由引擎翻页判定；endManually 自带防重入
    if (res.ended && merged) void endManuallyRef.current?.(res.ended);
  }, [commitSim]);

  // 过完本周：从今天一路快进到跨过周日、完成周结算（或触发终局）
  const runWeekNow = useCallback(() => {
    const g = gameRef.current;
    if (!g || busy) return;
    let cur: SimState = g.sim;
    const lim = limitDays(g.timeLimit, g.startDate || startDateLabel());
    let res = advanceDay(cur, lim);
    while (!res.rolledWeek && !res.ended) {
      cur = res.next;
      res = advanceDay(cur, lim);
    }
    applyDayResult(g.sim, res);
  }, [busy, applyDayResult]);

  // 推进后的 AI 日程叙事（数值已结算，只演绎）；跨度长时只取最近的日程摘要
  const narrateAdvance = useCallback((fromDay: number, texts0: string[], span?: string) => {
    if (!advanceStoryOn() || !isConfigured(cfg)) return;
    const texts = texts0.length > 14 ? [`（前略 ${texts0.length - 14} 天）`, ...texts0.slice(-14)] : texts0;
    const g = { sim: { day: fromDay } };
    // 结算已落地后，基于最新状态请求 AI 写本次推进的日程叙事（幕后指令，不显示为玩家气泡）
    setTimeout(() => {
      const now = gameRef.current;
      if (!now) return;
      const w = now.world;
      const directive = [
        `【推进日程叙事】主角刚刚度过了${span ? `${span}（` : " "}${now.sim.day - g.sim.day} 天${span ? "）" : ""}（游戏第 ${g.sim.day + 1}～${now.sim.day} 天）。请写一段约 ${advanceWords()} 字的日程叙事，串起这段时间的生活。`,
        `· 时间：${w.time || `第 ${now.sim.week} 周`}；地点：${w.location || "住处"}；天气：${w.weather || "请按季节与时间自拟并写入 world.weather"}。`,
        `· 本次日程结算（数值已由系统结算完毕，只需演绎，不得改动或复述数字）：\n${texts.join("\n")}`,
        "· 必须结合【已知记忆（前情摘要）】与各人物近况记忆，让前情自然延续；时间流逝、天气与光线要写进画面。",
        "· 只写这段时间里发生的事，不得重复上一回合已写过的情节；结尾停在新的一天开始的时刻，并给出 3~4 个可选行动。",
        "· 本回合 player_changes / npc_changes 只记录叙事中新发生的变化，不得重复结算日程收益。",
      ].join("\n");
      void runTurn(now, directive, false, true);
    }, 0);
  }, [cfg, runTurn]);

  // 推进一天：结算当天安排的一件事，翻页到次日
  // 推进：按创作台设定的天数逐日结算（遇周结算 / 终局即停），随后由 AI 结合时间、天气与记忆写日程叙事
  // 逐日推进 n 天（遇周结算 / 终局即停）
  const runDays = useCallback((days: number) => {
    const g = gameRef.current;
    if (!g || busy) return;
    const lim = limitDays(g.timeLimit, g.startDate || startDateLabel());
    let cur: SimState = g.sim;
    let res = advanceDay(cur, lim);
    const texts = [res.dayText];
    const gains = [...res.gains];
    for (let i = 1; i < days && !res.ended && !res.settled; i++) {
      cur = res.next;
      res = advanceDay(cur, lim);
      texts.push(res.dayText);
      gains.push(...res.gains);
    }
    const merged = days > 1 ? { ...res, dayText: texts.join("\n\n"), gains } : res;
    applyDayResult(g.sim, merged);
    if (merged.ended) return;
    narrateAdvance(g.sim.day, texts);
  }, [busy, applyDayResult, narrateAdvance]);
  // 「推进一天」按钮：固定只过一天
  const endDayNow = useCallback(() => runDays(1), [runDays]);


  // 推进（按创作者配置的单位）：日 → 逐日；周 / 月 / 年 → 逐日结算直到跨过该周期，每周照常周结算，最后弹一张汇总报告
  const advanceNow = useCallback(() => {
    const g = gameRef.current;
    if (!g || busy) return;
    const pref = g.advancePref;
    const unit = advanceUnit(pref);
    const n = advanceCount(pref);
    if (unit === "day") { runDays(n); return; }
    const lim = limitDays(g.timeLimit, g.startDate || startDateLabel());
    const monthOf = (d: number) => dayDateLabel(d).slice(0, 7); // YYYY.MM
    const yearOf = (d: number) => dayDateLabel(d).slice(0, 4);
    let cur: SimState = g.sim;
    let left = n, guard = 0;
    const texts: string[] = [], gains: string[] = [], relAll: string[] = [];
    let last: ReturnType<typeof advanceDay> | null = null;
    while (left > 0 && guard++ < 400 * n) {
      const before = cur.day;
      const res = advanceDay(cur, lim);
      const { next, relEvents } = postDay(res);
      cur = next; last = res;
      texts.push(res.dayText); gains.push(...res.gains); relAll.push(...relEvents);
      if (res.ended) break;
      const crossed = unit === "week" ? res.rolledWeek
        : unit === "month" ? monthOf(cur.day) !== monthOf(before)
        : yearOf(cur.day) !== yearOf(before);
      if (crossed) left--;
    }
    if (!last) return;
    cur = goHome(cur);
    const changes = simDiff(g.sim, cur);
    const merged = commitSim(cur);
    setLastChanges(changes);
    const UN = { week: "周", month: "个月", year: "年" }[unit];
    const span = `${n === 1 ? "一" : n}${UN}`;
    const weekTo = Math.max(g.sim.week, cur.week - (last.rolledWeek ? 1 : 0));
    const multi = weekTo > g.sim.week;
    setPopup({
      title: multi ? `${span}结算 · 第 ${g.sim.week}～${weekTo} 周` : `第 ${g.sim.week} 周结算`,
      diary: makeDiary(g.sim, cur, texts, gains, g),
      report: buildReport(cur.log, g.sim.week, weekTo, relAll.slice(-6), { grade: multi ? undefined : last.gradeLabel || undefined, act: last.actLabel, gains: multi ? [] : last.gains, span: multi ? span : undefined }),
      segments: [{ kind: "system", text: texts.slice(-3).join("\n") }],
      changes,
    });
    if (last.ended && merged) { void endManuallyRef.current?.(last.ended); return; }
    narrateAdvance(g.sim.day, texts, span);
  }, [busy, runDays, commitSim, narrateAdvance]);

  // 通告动作统一入口：执行纯引擎动作 → 提交 → 弹窗播报
  const runProjAction = useCallback((fn: (s: SimState, ...a: string[]) => { next: SimState; ok: boolean; msg: string }, title: string, ...args: string[]) => {
    const g = gameRef.current;
    if (!g || busy) return;
    const { next, msg } = fn(g.sim, ...args);
    const changes = simDiff(g.sim, next);
    commitSim(next);
    setLastChanges(changes);
    if (msg) setPopup({ title, segments: [{ kind: "system", text: msg }], changes });
  }, [busy, commitSim]);

  const projApply = useCallback((id: string) => runProjAction(applyProject, "投递资料", id), [runProjAction]);
  const projSign = useCallback((id: string) => runProjAction(signContract, "签约", id), [runProjAction]);
  const projNegotiate = useCallback((id: string) => runProjAction(negotiateOffer, "协商报酬", id), [runProjAction]);
  const projPromote = useCallback((projectId: string) => runProjAction(promoteWork, "宣传造势", projectId), [runProjAction]);
  const projWorkday = useCallback((id: string, strategyId: string) => runProjAction(doWorkday, "拍摄现场", id, strategyId), [runProjAction]);

  // 制作人对话接通告：登门洽谈 / 逐步追问解锁项目字段（section 十八）
  const simMeetProducer = useCallback((managerId: string, name?: string) => runProjAction(meetProducer, "登门洽谈", managerId, name ?? ""), [runProjAction]);
  const simAskProducer = useCallback((managerId: string, pid: string, questionId: string) => runProjAction(askProducer, "洽谈通告", managerId, pid, questionId), [runProjAction]);

  // 私下联系：回暖心情、推进好感/私人信任/心动（不可攻略的人只涨好感、信任与心情）
  /* 通用「先结算、后演绎」：所有世界观、所有玩法动作共用。
   * 接入 AI → 锁定已结算数值，交给 AI 写成剧情（弹窗呈现）；未接入 → 显示系统结算文字。 */
  const narrateSettled = (before: GameState, settled: GameState, o: { tag: string; title: string; sysMsg: string; changes: string[]; focus?: string[]; brief?: string }) => {
    if (!isConfigured(cfg)) {
      if (o.sysMsg) setPopup({ title: o.title, segments: [{ kind: "system", text: o.sysMsg }], changes: o.changes });
      return;
    }
    simLockRef.current = lockOf(before.sim, settled.sim);
    const who = (o.focus ?? []).map((id) => settled.npcs.find((n) => n.id === id)?.name ?? id).filter(Boolean);
    const loc = spotName(settled, settled.sim.room) || locOf(settled.sim.room)?.name || settled.world.location;
    void runTurn(
      settled,
      `【${o.tag}】${o.brief ? `${o.brief}\n` : ""}系统结算结果：${o.sysMsg}\n已结算数值：${o.changes.length ? o.changes.join("，") : "无"}。\n` +
        `${who.length ? `本段以${who.join("、")}为中心，言行须贴合其性格、身份与既有关系（以人物关系网为准）。` : ""}` +
        `地点：${loc}。请把这件事写成一段自然的剧情正文，贴合当前世界观、场景与在场人物，情节须与上述数值变化相符；正文里不要出现「系统」「数值」「结算」等字眼。给出 2~3 个后续行动选项。` +
        `以上数值已由系统锁定，JSON 中不得再改动这些项（改了也不会生效）。`,
      true,
      true,
      undefined,
      true,
      o.title,
    );
  };

  const simContact = useCallback((pid: string, name?: string) => {
    const g = gameRef.current;
    if (!g || busy) return;
    const { next, msg } = contactPerson(g.sim, pid, name);
    const changes = simDiff(g.sim, next);
    const merged = commitSim(next) ?? { ...g, sim: next };
    setLastChanges(changes);
    if (msg) narrateSettled(g, merged, { tag: "私下联系", title: "私下联系", sysMsg: msg, changes, focus: [pid], brief: "主角私下联系了对方（消息、电话或见面，按当前世界观的方式）。" });
  }, [busy, commitSim, cfg, runTurn]);

  // 表白：普通 NPC 的轻量攻略；固定角色需走七段情感线
  const simConfess = useCallback((pid: string, name?: string) => {
    const g = gameRef.current;
    if (!g || busy) return;
    const { next, msg, ok } = confessTo(g.sim, pid, name);
    const changes = simDiff(g.sim, next);
    const merged = commitSim(next) ?? g;
    setLastChanges(changes);
    const who = name ?? merged.npcs.find((n) => n.id === pid)?.name ?? pid;
    // 表白成功且已接入 AI：以场景演绎告白与确认关系的一幕（数值已由系统结算）
    if (ok && isConfigured(cfg)) {
      const loc = merged.world.location;
      simLockRef.current = lockOf(g.sim, merged.sim); // 已结算数值锁定，AI 不得重复改动
      void runTurn(merged, `【表白】主角在${loc}向${who}表白心意，${who}答应了，两人正式确认恋爱关系。请演绎这一幕：开口前的犹豫、说出口的那句话、${who}的反应与回应（贴合 TA 的性格与你们的过往），以及确认关系后两人之间微妙的变化。关系已由系统结算，不要改动数值；给 ${who} 写 npc_changes（relation 改为「恋人」）。`, true, false, { kind: "spot", srcId: `confess-${pid}`, title: `向${who}表白`, seed: `与${who}确认关系`, location: loc, when: `第 ${merged.sim.week} 周 · ${weekdayName(merged.sim.day)}` }, true);
      return;
    }
    if (msg) setPopup({ title: "表白心意", segments: [{ kind: "system", text: msg }], changes });
  }, [busy, cfg, commitSim, runTurn]);

  // —— 牵线：主角主动促成两位 NPC 之间的往来（仅创作者配置的方式；无预置）——
  const simBridge = useCallback((aId: string, bId: string, mode: BridgeMode): string => {
    const g = gameRef.current;
    if (!g || busy) return "正忙，稍后再试。";
    const A = g.npcs.find((n) => n.id === aId), B = g.npcs.find((n) => n.id === bId);
    if (!A || !B || aId === bId) return "请选择另一位人物。";
    if (!bridgeEnabled()) return "这个世界观没有开放牵线。";
    const spec = bridgeModes()[mode];
    if (!spec) return "这种方式在当前世界观里不可用。";
    const ra = g.sim.rel?.[aId] ?? 0, rb = g.sim.rel?.[bId] ?? 0;
    if (Math.min(ra, rb) < spec.need) return `需要你与两人的好感都达到 ${spec.need}（${A.name} ${ra} · ${B.name} ${rb}）。`;
    const key = `bridge_d${g.sim.day}`;
    const used = g.sim.flags?.[key] ?? 0;
    if (used >= bridgePerDay()) return `今天已经牵线 ${used} 次了，明天再说吧。`;
    const [da, db] = spec.fx;
    const clampRel = (id: string, v: number) => Math.max(-100, Math.min(affinityCapOf(id), v));
    const next = {
      ...g.sim,
      flags: { ...(g.sim.flags ?? {}), [key]: used + 1 },
      rel: { ...(g.sim.rel ?? {}), [aId]: clampRel(aId, ra + da), [bId]: clampRel(bId, rb + db) },
      log: [...g.sim.log, `【第 ${g.sim.week} 周 · 牵线】${spec.label}：${A.name} × ${B.name}`].slice(-40),
    };
    const changes = simDiff(g.sim, next);
    const merged = commitSim(next) ?? { ...g, sim: next };
    const stamp = (other: string) => ({ turn: g.turnCount, time: g.world.time, text: `${spec.label}：你让 TA 与${other}${spec.verb}。` });
    const hist = (d: number) => ({ turn: g.turnCount, delta: d, reason: `牵线 · ${spec.label}` });
    const npcs = merged.npcs.map((n) => {
      if (n.id !== aId && n.id !== bId) return n;
      const d = n.id === aId ? da : db, other = n.id === aId ? B.name : A.name;
      return { ...n, affinity: clampRel(n.id, n.affinity + d), interactions: [...n.interactions, stamp(other)].slice(-30), affinityHistory: d ? [...n.affinityHistory, hist(d)].slice(-40) : n.affinityHistory };
    });
    const withNpcs = { ...merged, npcs };
    persist(withNpcs);
    setLastChanges(changes);
    if (!isConfigured(cfg)) {
      setPopup({ title: `${spec.label} · ${A.name} × ${B.name}`, segments: [{ kind: "system", text: fillPair(spec.offline, A.name, B.name) }], changes });
      return "";
    }
    const loc = withNpcs.world.location;
    simLockRef.current = lockOf(g.sim, withNpcs.sim); // 已结算数值锁定，AI 不得重复改动
    void runTurn(withNpcs, `【牵线 · ${spec.label}】${fillPair(spec.prompt, A.name, B.name)}地点：${loc}。两人的言行要贴合各自性格、身份与既有关系（以人物关系网为准，不得凭空认亲）；这是他们两人之间的事，主角是促成者而非主角光环。请写出两人之间关系的变化，并给出至少一个继续推动与一个就此收手的选择。主角与两人的好感已由系统结算（${A.name} ${da >= 0 ? "+" : ""}${da}，${B.name} ${db >= 0 ? "+" : ""}${db}），不要重复改动；可为两人各写 npc_changes 的 interaction 与 memory。`, true, false, { kind: "spot", srcId: `bridge-${mode}-${aId}-${bId}`, title: `${spec.label} · ${A.name} × ${B.name}`, seed: spec.label, location: loc, when: `第 ${withNpcs.sim.week} 周 · ${weekdayName(withNpcs.sim.day)}` }, true);
    return "";
  }, [busy, cfg, commitSim, persist, runTurn]);

  // 地点伴侣加成的结算明细（按世界观术语显示）
  const perkFx = (fx: VisitPerk["fx"]) => {
    const sg = (v: number) => (v > 0 ? `+${v}` : `${v}`);
    const g = gameRef.current;
    const opts = perkKeyOptions({ statLabels: STAT_LABELS, statOrder: STAT_ORDER, attrs: g?.attrDefs, metaLabels: statMetaLabels(), term });
    return fx.map((x) => `${perkKeyLabel(opts, x.key)} ${sg(x.delta)}`).join("，") || "无数值变化";
  };
  const simVisit = useCallback((locId: string): string => {
    const g = gameRef.current;
    if (!g || busy) return "正忙，稍后再试。";
    const { next, msg, perks } = visitLocation(g.sim, locId);
    const changes = simDiff(g.sim, next);
    if (isConfigured(cfg)) {
      const merged = commitSim(next) ?? { ...g, sim: next };
      setLastChanges(changes);
      simLockRef.current = lockOf(g.sim, merged.sim);
      const locName = spotName(g, locId) || locOf(locId)?.name || g.world.location;
      void runTurn(
        merged,
        `【场景探索 · 踩点】主角在「${locName}」四处走动观察。系统基础结算：${msg}。\n${perks.length ? `【伴侣加成 · 已结算】${perks.map((p) => { const nm = g.npcs.find((x) => x.id === p.pid)?.name ?? p.pid; return `恋人${nm}${p.label ? `（${p.label}）` : ""}：${perkFx(p.fx)}${p.seed ? `；剧情要点：${p.seed}` : ""}`; }).join("；")}。以上恋人必须在本段剧情中真实出场或留下可感知的痕迹，按剧情要点演绎，情节须与这些数值变化相符（例如压力下降就写出被照顾、放松的过程）；这些数值已由系统结算，严禁在 JSON 中再改动同项数值或该恋人的好感。\n` : ""}请结合「${locName}」的场景环境、可见物件与在场人物，把这次探索写成一段细腻自然的剧情正文，并给出 3~4 个后续可玩的行动选项。（基础数值已由系统结算，切勿在 JSON 中重复累加）`,
        false,
        true,
        undefined,
        true,
      );
      return "";
    }
    commitSim(next, msg);
    setLastChanges(changes);
    return "";
  }, [busy, cfg, commitSim, runTurn]);

  // —— 支线：点事件进入，入口扣一次体力；支线内继续行动不再扣体力，结束后整段落入剧情志 ——
  const segText = (t: Turn) => t.segments.map((sg) => (sg.kind === "dialogue" ? `${sg.speaker}：${sg.text}` : sg.text)).join("\n");
  const runBranchTurn = useCallback(async (base: GameState, input: string, showInput: boolean) => {
    const br = base.branch;
    if (!br) return;
    const playerTurn: Turn | null = showInput ? { id: uid(), role: "player", segments: [{ kind: "narration", text: input }], ts: Date.now() } : null;
    const working: GameState = { ...base, branch: { ...br, options: [], turns: playerTurn ? [...br.turns, playerTurn] : br.turns } };
    setGame(working);
    setBusy(true);
    setLive("");
    const prompt = `【支线进行中：${br.title}｜场景：${br.location ?? base.world.location}】\n${br.annotation ? br.annotation + "\n" : ""}${br.seed}\n\n（这是一段独立支线，请只演绎本支线内的情节并给出 2~4 个可选行动；不要推进主线日程，不要改动体力。）${showInput ? `\n\n玩家行动：${input}` : ""}`;
    let full = "";
    try {
      full = await streamChat({ ...cfg, stream: true }, buildMessages({ ...working, story: working.branch!.turns }, prompt), (_d, f) => setLive(displayText(f)));
    } catch (e) {
      setBusy(false);
      setLive("");
      // 开场就失败：退回入口体力、撤销支线，免得白扣；支线中途失败则撤回这次输入，可原样重试
      if (!br.turns.length) persist({ ...base, branch: undefined, sim: { ...base.sim, ap: tripPoints(base.sim) + br.cost } });
      else persist(base);
      setPopup({ title: friendlyAIError(e).title, segments: [{ kind: "system", text: `${friendlyAIError(e).text}${br.turns.length ? "" : `\n\n已退回进入支线扣的 ${br.cost} 个行动点。`}` }], changes: [] });
      return;
    }
    const step = extractStep(full);
    let segments: Segment[] = proseToSegments(displayText(full));
    if (!segments.length && step?.narration) segments = proseToSegments(step.narration);
    if (step?.system) segments.push({ kind: "system", text: step.system });
    const appliedB = applyStep(working, step ?? { options: [], narration: displayText(full) });
    const changes = appliedB.changes;
    const curB = gameRef.current; // 同主线：沿用生成期间最新的手机数据
    const synced = curB && curB.id === working.id && curB.phone ? { ...appliedB.next, phone: curB.phone } : appliedB.next;
    const intro = withNewcomers(working, synced, segments, step); // 支线里初遇的人物同样出名片
    const next = intro.g;
    const aiTurn: Turn = { id: uid(), role: "ai", segments, raw: full, ts: Date.now(), ...(intro.ids.length ? { newcomers: intro.ids } : {}) };
    // 支线内免体力：体力锁定在入口扣除后的数值；主线选项保持不变
    persist({
      ...next,
      options: working.options,
      sim: { ...next.sim, ap: working.sim.ap },
      branch: { ...working.branch!, turns: [...working.branch!.turns, aiTurn], options: next.options ?? [] },
    });
    setLastChanges(changes);
    setLive("");
    setBusy(false);
  }, [cfg, persist]);

  const enterBranch = useCallback((g: GameState, b: Omit<Branch, "turns" | "options" | "cost">, points = BRANCH_POINTS) => {
    const cost = points;
    if (g.branch) { setPopup({ title: "支线进行中", segments: [{ kind: "system", text: `你正在「${g.branch.title}」里，先把这段支线走完或结束它。` }], changes: [] }); return; }
    if (tripPoints(g.sim) < cost) { setPopup({ title: "行动点不足", segments: [{ kind: "system", text: `进入这段支线要 ${points} 个行动点，你只剩 ${tripPoints(g.sim)} 点了。推进到下一回合就会回满。` }], changes: [] }); return; }
    const entered: GameState = { ...g, sim: { ...g.sim, ap: tripPoints(g.sim) - cost }, branch: { ...b, cost, turns: [], options: [] } };
    if (points) setLastChanges([`行动点 -${points}（进入支线）`]);
    void runBranchTurn(entered, "", false);
  }, [runBranchTurn]);

  const branchAct = useCallback((input: string) => {
    const g = gameRef.current;
    if (!g?.branch || busy || !input.trim()) return;
    void runBranchTurn(g, input.trim(), true);
  }, [busy, runBranchTurn]);

  // 结束支线：整段对话落入剧情志，一次性事件记入 eventsFired
  const leaveBranch = useCallback(() => {
    const g = gameRef.current;
    if (!g?.branch || busy) return;
    const b = g.branch;
    const text = b.turns.map((t) => (t.role === "player" ? `▶ ${segText(t)}` : segText(t))).join("\n\n");
    const entry: import("../lib/types").JournalEntry = { id: uid(), ts: Date.now(), kind: b.kind, srcId: b.srcId, title: b.title, annotation: b.annotation, seed: b.seed, location: b.location, when: b.when, text };
    const key = firedKey(b.kind, b.srcId);
    const fired = g.sim.eventsFired ?? [];
    persist({ ...g, branch: undefined, journal: b.turns.length ? [entry, ...(g.journal ?? [])] : g.journal, sim: { ...g.sim, eventsFired: fired.includes(key) ? fired : [...fired, key] } });
  }, [busy, persist]);

  // 条件邂逅：先确定性结算数值，再把叙事种子交给 AI 演绎（落入对话框）
  const simEvent = useCallback((id: string) => {
    const g = gameRef.current;
    if (!g || busy) return;
    // 邂逅需要 AI 演绎叙事；未接入时不要提前消耗一次性事件（否则数值扣了、旗标烧了却看不到剧情）。
    if (!isConfigured(cfg)) {
      setPopup({ title: "还差一步", segments: [{ kind: "system", text: "这段邂逅要由 AI 来演绎。请先在右上角接入 AI，再来触发。" }], changes: [] });
      return;
    }
    // 支线占用 / 体力不足：交给 enterBranch 统一提示，且不提前结算邂逅
    if (g.branch || tripPoints(g.sim) < BRANCH_POINTS) { enterBranch(g, { kind: "spot", srcId: "", title: "", seed: "" }); return; }
    const { next, seed } = fireEncounter(g.sim, id);
    if (!seed) return;
    const changes = simDiff(g.sim, next);
    const merged = commitSim(next);
    setLastChanges(changes);
    const enc = encountersHere(g.sim, g.sim.room, g.npcs).find((x) => x.id === id);
    const locName = spotName(g, next.room) || locOf(next.room)?.name || merged?.world.location;
    if (merged) enterBranch(merged, { kind: "spot", srcId: `enc:${id}`, title: `邂逅 · ${enc?.label ?? id}`, seed, location: locName, when: `第 ${merged.sim.week} 周 · ${weekdayName(merged.sim.day)}` });
  }, [busy, cfg, commitSim, enterBranch]);

  // —— 剧情事件系统：地图点位事件 / 支线剧情 / 剧情志收藏导出 ——
  // —— 剧情事件系统：地图点位事件 / 支线剧情 / 剧情志收藏导出 ——
  const whenLabel = (g: GameState) => `第 ${g.sim.week} 周 · ${weekdayName(g.sim.day)}`;

  // 触发地图上某个玩家自建的剧情事件（地点备注 → 对应剧情）：交 AI 演绎并独立存进剧情志
  const playSpotEvent = useCallback((eventId: string) => {
    const g = gameRef.current;
    if (!g || busy) return;
    const hit = findSpotEvent(g, eventId);
    if (!hit) return;
    if (!isConfigured(cfg)) {
      setPopup({ title: "还差一步", segments: [{ kind: "system", text: "这段剧情要交给 AI 来演绎。请先在右上角接入 AI，再来触发。" }], changes: [] });
      return;
    }
    const { event } = hit;
    if (event.once && firedOf(g, "spot").includes(event.id)) return;
    const locName = locOf(hit.roomId)?.name ?? g.world.location;
    enterBranch(g, { kind: "spot", srcId: event.id, title: event.title, annotation: event.annotation, seed: event.seed, location: locName, when: whenLabel(g) }, BRANCH_POINTS);
  }, [busy, cfg, enterBranch]);

  // 演绎一段支线剧情（内容池 SIDEQUESTS）：把场景 + 续接约束交给 AI，独立存进剧情志
  const playQuest = useCallback((questId: string) => {
    const g = gameRef.current;
    if (!g || busy) return;
    const q = SIDEQUEST_BY_ID[questId];
    if (!q) return;
    if (firedOf(g, "quest").includes(q.id)) {
      setPopup({ title: "支线已完成", segments: [{ kind: "system", text: `「${q.title}」已经演绎过了，可在剧情志里回看。` }], changes: [] });
      return;
    }
    if (!isConfigured(cfg)) {
      setPopup({ title: "还差一步", segments: [{ kind: "system", text: "这段支线要交给 AI 来演绎。请先在右上角接入 AI，再来触发。" }], changes: [] });
      return;
    }
    const cast = castOf(q.id, g.npcs);
    const seed = `${q.scene.join("\n")}\n\n【续接方向｜${q.continuationKind}】${q.continuation}`;
    enterBranch(g, { kind: "quest", srcId: q.id, title: `${q.code} · ${q.title}`, annotation: `${q.condition}｜出场：${cast.map((c) => `${c.role}·${c.npc?.name ?? c.stranger}`).join("、")}`, seed: `${castPrompt(cast, g.player.name)}\n\n${seed}`, location: g.world.location, when: whenLabel(g) });
  }, [busy, cfg, enterBranch]);
  playQuestRef.current = playQuest;

  // 收藏 / 取消收藏一条剧情志
  const toggleFav = useCallback((entryId: string) => {
    const g = gameRef.current;
    if (!g) return;
    persist({ ...g, journal: (g.journal ?? []).map((e) => (e.id === entryId ? { ...e, fav: !e.fav } : e)) });
  }, [persist]);

  // 删除一条剧情志
  const removeJournal = useCallback((entryId: string) => {
    const g = gameRef.current;
    if (!g) return;
    persist({ ...g, journal: (g.journal ?? []).filter((e) => e.id !== entryId) });
  }, [persist]);

  // 导出剧情志（默认仅收藏；无收藏则导出全部）为 Markdown 文本文件，浏览器直接下载
  const exportJournal = useCallback((onlyFav = true) => {
    const g = gameRef.current;
    if (!g) return;
    const all = g.journal ?? [];
    const picks = onlyFav && all.some((e) => e.fav) ? all.filter((e) => e.fav) : all;
    if (!picks.length) {
      setPopup({ title: "剧情志空空如也", segments: [{ kind: "system", text: "还没有可导出的剧情。先在地图点位或支线里触发几段剧情吧。" }], changes: [] });
      return;
    }
    const kindLabel = (k: string) => (k === "quest" ? "支线" : k === "note" ? "地点备注" : "点位事件");
    const md = [
      `# ${g.player.name} · 剧情志`,
      `导出时间：${new Date().toLocaleString("zh-CN")} ｜ 共 ${picks.length} 篇`,
      "",
      ...picks
        .slice()
        .sort((a, b) => a.ts - b.ts)
        .map((e) =>
          [
            `## ${e.title}`,
            `> ${kindLabel(e.kind)}${e.location ? ` · ${e.location}` : ""}${e.when ? ` · ${e.when}` : ""}${e.fav ? " · ★收藏" : ""}`,
            e.annotation ? `\n*${e.annotation}*` : "",
            "",
            e.text || e.seed,
            "",
          ].join("\n"),
        ),
    ].join("\n");
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `剧情志_${g.player.name}_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  // —— 人设与危机 ——
  const personaDeclare = useCallback((id: string): string[] => {
    const g = gameRef.current;
    if (!g || busy) return [];
    const { s: next, lines } = declarePersona(g.sim, id);
    const changes = simDiff(g.sim, next);
    commitSim(next);
    setLastChanges(changes);
    return lines;
  }, [busy, commitSim]);

  const personaAct = useCallback((actId: string): string[] => {
    const g = gameRef.current;
    if (!g || busy) return [];
    const { s: next, lines, ok } = doPublicAct(g.sim, actId);
    if (!ok) return lines;
    const changes = simDiff(g.sim, next);
    const merged = commitSim(next) ?? { ...g, sim: next };
    setLastChanges(changes);
    const crisis = !!next.crisis && !g.sim.crisis;
    if (isConfigured(cfg) || crisis)
      narrateSettled(g, merged, { tag: crisis ? "舆情预警" : "公开行动", title: crisis ? "舆情预警" : "公开行动", sysMsg: lines.join("\n"), changes, brief: crisis ? "主角的公开行动引发了舆情危机，写出事态如何发酵与各方反应。" : "主角在公众面前做了一件事，写出现场与外界的反应。" });
    return lines;
  }, [busy, commitSim, cfg, runTurn]);

  const crisisResolve = useCallback((responseId: string): string[] => {
    const g = gameRef.current;
    if (!g || busy || !g.sim.crisis) return [];
    const res = resolveCrisis(g.sim, responseId);
    if (!res) return [];
    const changes = simDiff(g.sim, res.s);
    const merged = commitSim(res.s) ?? { ...g, sim: res.s };
    setLastChanges(changes);
    narrateSettled(g, merged, { tag: "危机应对", title: "危机应对", sysMsg: res.lines.join("\n"), changes, brief: "主角选择了应对眼下危机的方式，写出应对过程与事态走向。" });
    return res.lines;
  }, [busy, commitSim, cfg, runTurn]);

  // MUD 世界移动：确认前往后执行——扣交通费、登记战争迷雾、推进一次世界心跳（NPC 走动 + 环境事件）
  const simMove = useCallback((roomId: string, companionId?: string, trip?: { fee: number; minutes: number; modeLabel: string; ownCar?: boolean }): string[] => {
    const g = gameRef.current;
    if (!g) return [];
    const plan = travelPlan(g.sim, roomId);
    if (!plan.reachable) return [plan.reason ?? "去不了那里。"];
    // 同一棵地点树里逐层进出（如 正殿 → 禅房）：只是走几步路，不收路费、不扣行动点、不受日程限制
    const local = insideTree(g.sim.room ?? "", roomId);
    const fee = local ? 0 : trip?.fee ?? plan.fee;
    const minutes = 0; // 出行不按分钟推进时钟（只消耗行程点）
    const apCost = local ? 0 : apPerMove();
    if (!canPay(g.sim, fee)) return [shortOf(g.sim, fee, "路费")]; // 统一扣费规则：主动消费不透支
    if (tripPoints(g.sim) < apCost) return [`行动点不够了：换地点要 ${apCost} 点，你只剩 ${tripPoints(g.sim)} 点。推进到下一回合就会回满。`];
    // 踩地图（探索新地点）需当前时段安排的是「自由活动」；已知地点随时可回访
    const firstArrival = !(g.sim.visited ?? []).includes(roomId);
    const dow = dowOf(g.sim.day ?? 0);
    const roamingNow = (g.sim.schedule ?? [])[dow] === "freeroam";
    if (plan.explore && !roamingNow && !local) {
      return [`今天（${weekdayName(g.sim.day)}）手头另有安排——把当天日程排成「自由活动」，才能出门踩点探索新地方。`];
    }
    const visited = firstArrival ? [...(g.sim.visited ?? []), roomId] : g.sim.visited;
    const discoveredAt = firstArrival ? { ...(g.sim.discoveredAt ?? {}), [roomId]: g.sim.day } : g.sim.discoveredAt;
    const moved: SimState = {
      ...wallet.add(g.sim, -fee),
      room: roomId,
      visited,
      discoveredAt,
      ap: tripPoints(g.sim) - apCost, // 换一次地点扣固定行动点（不论远近）
      clockMin: (g.sim.clockMin ?? 480) + minutes, // 移动令当日时刻流动
    };
    const beat = tickWorld(moved, g.npcs);
    const via = trip?.modeLabel ? `${trip.modeLabel} · ` : "";
    const cost = local ? "走几步就到" : `${fee > 0 ? `交通费 ${wallet.fmt(fee, g)}` : "免费"} · 行动点 -${apCost}`;
    const head = `${plan.explore ? "你摸索着来到" : "你来到"}${locOf(roomId)?.name ?? roomId}（${via}${cost}）。${plan.explore ? "这处地方在地图上点亮了。" : ""}`;
    // 首次踏入触发一次性场景剧情（内容池提供），随抵达一并呈现
    const intro = firstArrival ? introOf(roomId) : undefined;
    const lines = [head, ...(intro ? ["" + intro] : []), ...beat.events.map((e) => e.text)];
    // —— 同行：邀约成立时，同行者随你一并抵达，路上相处升温 ——
    let mobs = beat.mobs;
    const merge: Partial<SimState> = {};
    if (companionId && (g.sim.rel?.[companionId] ?? 0) >= 20 && (g.sim.mobs?.[companionId] ?? "") === g.sim.room) {
      mobs = { ...mobs, [companionId]: roomId };
      const name = g.npcs.find((n) => n.id === companionId)?.name ?? PERSON_BY_ID[companionId]?.name ?? companionId;
      const cap = affinityCapOf(companionId);
      merge.rel = { ...moved.rel, [companionId]: Math.min(cap, (moved.rel?.[companionId] ?? 0) + 2) };
      merge.stress = Math.max(0, (moved.stress ?? 0) - 4);
      lines.push(`${name}与你结伴同行，一路相谈甚欢（关系 +2，压力 -4）。`);
    }
    // 自己驾驶：按座驾配置的每次出行增益结算
    let arrived: SimState = { ...moved, ...merge, mobs, tick: beat.tick };
    const car = trip?.ownCar ? carById(g.sim.activeCar) : null;
    if (car?.tripBonus) {
      const r = applyBonus(arrived, car.tripBonus);
      arrived = r.next;
      if (r.notes.length) lines.push(`驾驶「${car.name}」一路顺心（${r.notes.join("，")}）。`);
    }
    // 移动结果同样落进对话框（故事线）
    commitSim(arrived, lines.join("\n"));
    return lines;
  }, [commitSim]);

  // 拾取/收纳地点物品（收入行囊记录到存档，若已接入 AI 则同步交由 AI 演绎拾取细节与后续选项）
  const simPickup = useCallback((itemId: string): string => {
    const g = gameRef.current;
    if (!g || busy) return "";
    // 先查内容池物件，未命中再查玩家在地图编辑器里为该点位新增的自定义物件
    const it = itemsOfRoom(g.sim.room).find((x) => x.id === itemId)
      ?? customItemsOf(g, g.sim.room).find((x) => x.id === itemId);
    if (!it) return "";
    if ((g.sim.bag ?? []).includes(itemId)) return `${it.name}已经在你的行囊里了。`;
    const nextSim = {
      ...g.sim,
      bag: [...(g.sim.bag ?? []), itemId],
      log: [...g.sim.log, `【第 ${g.sim.week} 周 · 物件】在${g.world.location}拾取了「${it.name}」。`].slice(-40),
    };
    if (isConfigured(cfg)) {
      const merged = commitSim(nextSim) ?? { ...g, sim: nextSim };
      const locName = spotName(g, g.sim.room) || locOf(g.sim.room)?.name || g.world.location;
      const customHint = "prompt" in it && it.prompt?.trim() ? `\n【作者物件剧情提示】${it.prompt.trim()}` : "";
      simLockRef.current = lockOf(g.sim, merged.sim); // 已结算数值锁定，AI 不得重复改动
      void runTurn(
        merged,
        `【场景物件互动 · 拾取】主角在「${locName}」查看并收起了物件「${it.name}」（描述：${it.desc || "场景物件"}），已收入随身行囊。${customHint}\n请贴合当前场景与物件细节，自然写出主角发现、触碰或收起「${it.name}」时的细节与感受（若在场有其他人物，可写出对方的反应或搭话），并给出 3~4 个承接此事的后续行动选项。（物品已由系统收入行囊，切勿重复扣除行动点）`,
        false,
        true,
        undefined,
        true,
      );
      return "";
    }
    commitSim(nextSim, `你把${it.name}收进了行囊。`);
    return "";
  }, [busy, cfg, commitSim, runTurn]);

  // 背包互动：使用不消耗物品，记录到日志；若已接入 AI 则交 AI 演绎使用/端详过程；赠送会消耗物品并结算固定关系收益。
  const simUseItem = useCallback((itemId: string): string => {
    const g = gameRef.current;
    if (!g || busy) return "";
    if (!(g.sim.bag ?? []).includes(itemId)) return "这件物品不在你的背包里。";
    const it = itemById(itemId) ?? findCustomItem(g, itemId);
    if (!it) return "找不到这件物品。";
    const msg = `你取出「${it.name}」细细端详。${it.desc}`;
    const next = { ...g.sim, log: [...g.sim.log, `【第 ${g.sim.week} 周 · 行囊】使用了${it.name}。`].slice(-40) };
    if (isConfigured(cfg)) {
      const merged = commitSim(next) ?? { ...g, sim: next };
      const customHint = "prompt" in it && it.prompt?.trim() ? `\n【作者物件剧情提示】${it.prompt.trim()}` : "";
      simLockRef.current = lockOf(g.sim, merged.sim); // 已结算数值锁定，AI 不得重复改动
      void runTurn(
        merged,
        `【随身物品使用】主角在「${g.world.location}」取出了随身行囊中的「${it.name}」（描述：${it.desc || "随身物品"}）并使用/细看。${customHint}\n请结合当前场景与处境，生动演绎主角使用或细看「${it.name}」的过程与带来的变化，并给出 3~4 个后续可玩的行动选项。`,
        false,
        true,
        undefined,
        true,
      );
      return "";
    }
    commitSim(next, msg);
    return "";
  }, [busy, cfg, commitSim, runTurn]);

  const simGiftItem = useCallback((itemId: string, personId: string): string => {
    const g = gameRef.current;
    if (!g || busy) return "";
    if (!(g.sim.bag ?? []).includes(itemId)) return "这件物品不在你的背包里。";
    if (!(g.sim.metPeople ?? []).includes(personId)) return "要先和对方认识，才能送出礼物。";
    const it = itemById(itemId) ?? findCustomItem(g, itemId);
    const person = g.npcs.find((n) => n.id === personId);
    if (!it || !person) return "找不到这件物品或联系人。";
    const cap = affinityCapOf(personId);
    const next = {
      ...g.sim,
      bag: g.sim.bag.filter((id) => id !== itemId),
      rel: { ...g.sim.rel, [personId]: Math.min(cap, (g.sim.rel?.[personId] ?? 0) + 5) },
      log: [...g.sim.log, `【第 ${g.sim.week} 周 · 行囊】把${it.name}赠予${person.name}（关系 +5）。`].slice(-40),
    };
    const stamp = { turn: g.turnCount, time: g.world.time, text: `送给你一件「${it.name}」。` };
    const history = { turn: g.turnCount, delta: 5, reason: `赠礼 · ${it.name}` };
    const npcs = g.npcs.map((n) => n.id === personId ? {
      ...n,
      affinity: Math.min(100, n.affinity + 5),
      interactions: [...n.interactions, stamp].slice(-30),
      affinityHistory: [...n.affinityHistory, history].slice(-40),
    } : n);
    const msg = `你把「${it.name}」赠给了${person.name}。${person.name}收下礼物，关系 +5。`;
    const changes = simDiff(g.sim, next);
    if (isConfigured(cfg)) {
      const merged = commitSim(next);
      if (merged) {
        const full = { ...merged, npcs };
        persist(full);
        setLastChanges(changes);
        narrateSettled(g, full, { tag: "赠礼", title: `赠礼 · ${person.name}`, sysMsg: msg, changes, focus: [personId], brief: `主角把「${it.name}」送给了${person.name}${it.desc ? `（物品：${it.desc}）` : ""}。` });
      }
      return "";
    }
    const merged = commitSim(next, msg);
    if (merged) persist({ ...merged, npcs });
    return "";
  }, [busy, commitSim, persist, cfg, runTurn]);

  // 居家/在场活动：支持内容池活动与玩家在地图编辑器新增的点位专属行动，均接入 AI 演绎。
  const simActivity = useCallback((actId: string): string => {
    const g = gameRef.current;
    if (!g || busy) return "正忙，稍后再试。";
    const cost = activityApCost(g, g.sim.room, actId);
    if (tripPoints(g.sim) < cost) return `行动点不足：这件事需要 ${cost} 点，当前只剩 ${tripPoints(g.sim)} 点。推进到下一回合即可回满。`;

    // 先检查是否为玩家在地图编辑器里自定义的地点行动
    const customAct = customActsOf(g, g.sim.room).find((a) => a.id === actId);
    if (customAct) {
      const lbl = (k: string) => (STAT_LABELS as Record<string, string>)[k] ?? ({ fame: "名气", looks: "容貌", stress: "压力", mood: "心情", energy: "体力", money: "资金" } as Record<string, string>)[k] ?? k;
      const valOf = (k: string) => Number((g.sim.stats as Record<string, number>)[k] ?? (g.sim as unknown as Record<string, unknown>)[k] ?? g.sim.cattrs?.[k] ?? 0) || 0;
      const lack = Object.entries(customAct.require ?? {}).filter(([k, v]) => valOf(k) < v);
      if (lack.length) return `「${customAct.label}」还不能进行：需要${lack.map(([k, v]) => `${lbl(k)} ≥ ${v}（当前 ${valOf(k)}）`).join("、")}。`;
      const used = g.sim.actUses?.[customAct.id];
      const usedN = used && used.week === g.sim.week ? used.n : 0;
      if (customAct.perWeek && usedN >= customAct.perWeek) return `「${customAct.label}」每周最多 ${customAct.perWeek} 次，本周已用完，下周再来吧。`;
      const pay = -(customAct.effects?.money ?? 0);
      const bal = wallet.balance(g);
      const wfmt = (n: number) => wallet.fmt(n, g);
      if (pay > 0 && bal < pay) return `${wallet.name(g, "零钱")}不足：「${customAct.label}」需要 ${wfmt(pay)}，还差 ${wfmt(pay - bal)}。`;
      const good = customAct.id.startsWith("good_") ? findShopGood(g, customAct.id) : undefined;
      if (good?.toBag && (g.sim.bag ?? []).includes(good.id)) return `「${good.name}」已经在你的行囊里了。`;
      const baseSim = {
        ...g.sim,
        ...(cost > 0 ? { ap: tripPoints(g.sim) - cost } : {}),
        log: [...g.sim.log, good
          ? `【第 ${g.sim.week} 周 · 购物】在${g.world.location}买下「${good.name}」（${wfmt(good.price)}）。`
          : `【第 ${g.sim.week} 周 · 行动】在${g.world.location}进行了「${customAct.label}」。`].slice(-40),
        ...(customAct.perWeek ? { actUses: { ...(g.sim.actUses ?? {}), [customAct.id]: { week: g.sim.week, n: usedN + 1 } } } : {}),
        ...(good?.toBag ? { bag: [...(g.sim.bag ?? []), good.id] } : {}),
      };
      // 作者设定的固定数值：先由系统结算，AI 只负责演绎
      // 金额走钱包（绑定自定义货币的世界观扣对应属性），其余效果照常结算
      const { money: fxMoney, ...fxRest } = customAct.effects ?? {};
      const fx = walletDef(g)
        ? applyBonus(fxMoney ? wallet.add(baseSim, fxMoney) : baseSim, fxRest)
        : applyBonus(baseSim, customAct.effects);
      const nextSim = fx.next;
      const changes = simDiff(g.sim, nextSim);
      const fxNote = fx.notes.length ? `（${fx.notes.join("，")}）` : "";
      const fallbackMsg = good
        ? `你在${g.world.location}买下了「${good.name}」${good.toBag ? "，已放进行囊" : ""}。${fxNote}`
        : withApNote(`你在${g.world.location}进行了「${customAct.label}」${customAct.hint ? `（${customAct.hint}）` : ""}。${fxNote}`, cost);
      if (isConfigured(cfg)) {
        const merged = commitSim(nextSim) ?? { ...g, sim: nextSim };
        setLastChanges(changes);
        const locName = spotName(g, g.sim.room) || locOf(g.sim.room)?.name || g.world.location;
        const actHint = customAct.prompt?.trim() ? `\n【作者行动设定】${customAct.prompt.trim()}` : "";
        const settled = fx.notes.length ? `\n【系统已结算】${fx.notes.join("，")}——请勿在 JSON 中重复结算这些数值。` : "";
        const input = good
          ? `【购物：${good.name}】主角在「${locName}」花 ${wallet.fmt(good.price)} 买下了「${good.name}」${good.desc ? `（${good.desc}）` : ""}${good.toBag ? "，已放进行囊" : ""}。${good.replyPrompt?.trim() ? `\n【作者购买设定】${good.replyPrompt.trim()}` : ""}${settled}\n请生动演绎这次购买：店员或在场人物的反应与对白、商品拿到手的质感与细节、主角的心情，以及它可能带来的后续（如送人、使用、被谁看见）。资金已由系统扣除，不要再改动资金；可酌情微调好感等其他项。给出 3~4 个后续可玩的行动选项。`
          : `【地点行动：${customAct.label}】主角在「${locName}」进行了行动「${customAct.label}」${customAct.hint ? `（${customAct.hint}）` : ""}。${actHint}${settled}\n请结合当前场景环境与在场人物，生动演绎主角进行「${customAct.label}」的过程、细节与收获（${fx.notes.length ? "数值已由系统结算，可酌情微调好感等其他项" : "可根据作者设定在 JSON 中合理微调相关能力/心情/好感"}，行动点已由系统扣除 ${cost} 点），并给出 3~4 个后续可玩的行动选项。`;
        simLockRef.current = lockOf(g.sim, merged.sim); // 已结算数值锁定，AI 不得重复改动
        void runTurn(
          merged,
          input,
          false,
          true,
          undefined,
          true,
        );
        return "";
      }
      commitSim(nextSim, fallbackMsg);
      setLastChanges(changes);
      return "";
    }

    const r = doActivity(g.sim, g.sim.room, actId);
    if (!r.ok) return r.msg;
    const next = cost > 0 ? { ...r.next, ap: tripPoints(g.sim) - cost } : r.next;
    const msg = withApNote(r.msg, cost);
    const changes = simDiff(g.sim, next);
    if (isConfigured(cfg)) {
      const actObj = worldActivitiesOfRoom(g.sim.room).find((a) => a.id === actId);
      const merged = commitSim(next) ?? { ...g, sim: next };
      setLastChanges(changes);
      const locName = spotName(g, g.sim.room) || locOf(g.sim.room)?.name || g.world.location;
      simLockRef.current = lockOf(g.sim, merged.sim); // 已结算数值锁定，AI 不得重复改动
      void runTurn(
        merged,
        `【地点行动：${actObj?.name ?? actId}】主角在「${locName}」进行了「${actObj?.name ?? actId}」（${actObj?.desc ?? ""}）。系统已完成基础数值结算：${msg}。\n请结合当前场景细节与氛围，把这次行动写成一段有画面感与生活气息的剧情正文（若在场有 NPC 可自然互动），并给出 3~4 个后续可玩的行动选项。（基础数值与行动点已由系统结算，切勿在 JSON 中重复扣除金钱或行动点）`,
        false,
        true,
        undefined,
        true,
      );
      return "";
    }
    commitSim(next, msg);
    setLastChanges(changes);
    return "";
  }, [busy, cfg, commitSim, runTurn]);

  // 购买标价物品（书店买书等）：扣现金、收入行囊，若已接入 AI 则同步演绎购买场景
  const simBuy = useCallback((itemId: string): string => {
    const g = gameRef.current;
    if (!g || busy) return "正忙，稍后再试。";
    const { next, msg, ok } = buyItem(g.sim, g.sim.room, itemId);
    if (!ok) return msg;
    const changes = simDiff(g.sim, next);
    if (isConfigured(cfg)) {
      const it = itemsOfRoom(g.sim.room).find((x) => x.id === itemId);
      const merged = commitSim(next) ?? { ...g, sim: next };
      setLastChanges(changes);
      const locName = spotName(g, g.sim.room) || locOf(g.sim.room)?.name || g.world.location;
      simLockRef.current = lockOf(g.sim, merged.sim); // 已结算数值锁定，AI 不得重复改动
      void runTurn(
        merged,
        `【场景物件互动 · 购买】主角在「${locName}」买下了「${it?.name ?? itemId}」（${it?.desc ?? ""}），已收入行囊（系统已结算：${msg}）。\n请结合当前场景细节，自然写出买下这件物品时的过程与心情，并给出 3~4 个后续可玩的行动选项。（金钱与物品已由系统结算，切勿在 JSON 中重复扣费）`,
        false,
        true,
        undefined,
        true,
      );
      return "";
    }
    commitSim(next, msg);
    setLastChanges(changes);
    return "";
  }, [busy, cfg, commitSim, runTurn]);

  // —— 车辆：4S 店购车 / 卖车（残值回收）/ 选定座驾 ——
  const buyCar = useCallback((carId: string): string => {
    const g = gameRef.current;
    if (!g || busy) return "正忙，稍后再试。";
    const c = carById(carId);
    if (!c) return "没有这款车。";
    if ((g.sim.cars ?? []).includes(carId)) return "这款车你已经拥有了。";
    const money = (n: number) => wallet.fmt(n, g);
    const bal = wallet.balance(g);
    if (bal < c.price) return `${wallet.name(g, "零钱")}不足，还差 ${money(c.price - bal)}。`;
    const cars = [...(g.sim.cars ?? []), carId];
    const shop = spotName(g, carShopId() ?? "") ?? locOf(carShopId() ?? "")?.name;
    const bought = applyBonus({ ...wallet.add(g.sim, -c.price), cars, activeCar: g.sim.activeCar ?? carId }, c.buyBonus);
    commitSim(bought.next, `你${shop ? `在「${shop}」` : ""}购入了「${c.name}」（${money(c.price)}）。往后出行可以自己驾驶了。${bought.notes.length ? `（${bought.notes.join("，")}）` : ""}`);
    setLastChanges([`${wallet.name(g, "零钱")} -${c.price}`, ...bought.notes]);
    return "";
  }, [busy, commitSim]);

  const sellCar = useCallback((carId: string): string => {
    const g = gameRef.current;
    if (!g || busy) return "正忙，稍后再试。";
    const c = carById(carId);
    if (!c || !(g.sim.cars ?? []).includes(carId)) return "你并未拥有这辆车。";
    const gain = resaleValue(c);
    const loss = c.price - gain;
    const cars = (g.sim.cars ?? []).filter((x) => x !== carId);
    const activeCar = g.sim.activeCar === carId ? (cars[0] ?? null) : g.sim.activeCar;
    const money = (n: number) => wallet.fmt(n, g);
    const next = { ...wallet.add(g.sim, gain), cars, activeCar };
    commitSim(next, `你把「${c.name}」转卖，回收 ${money(gain)}（折旧 ${money(loss)}）。`);
    setLastChanges([`${wallet.name(g, "零钱")} +${gain}`]);
    return "";
  }, [busy, commitSim]);

  const setActiveCar = useCallback((carId: string | null) => {
    const g = gameRef.current;
    if (!g) return;
    if (carId && !(g.sim.cars ?? []).includes(carId)) return;
    commitSim({ ...g.sim, activeCar: carId });
  }, [commitSim]);

  // —— 「咸鱼」二手集市 ——
  // 挂卖：把背包里的物件挂出（从背包移除，落入挂单），玩家自定价
  const xianyuList = useCallback((itemId: string, price: number, blurb?: string): string => {
    const g = gameRef.current;
    if (!g) return "";
    if (!(g.sim.bag ?? []).includes(itemId)) return "这件物品不在你的背包里。";
    const it = itemById(itemId);
    if (!it) return "找不到这件物品。";
    const p = Math.max(1, Math.round(price));
    const listing: XianyuListing = {
      id: `xy_${itemId}_${Date.now().toString(36)}`,
      itemId, name: it.name, icon: it.icon, price: p,
      blurb: blurb?.trim() || undefined,
      listedDay: g.sim.day, status: "active",
    };
    const bag = (g.sim.bag ?? []).filter((x) => x !== itemId);
    commitSim({ ...g.sim, bag, xianyu: [listing, ...(g.sim.xianyu ?? [])] });
    return "";
  }, [commitSim]);

  // 下架：撤回在售挂单，物件退回背包
  const xianyuDelist = useCallback((listingId: string): string => {
    const g = gameRef.current;
    if (!g) return "";
    const l = (g.sim.xianyu ?? []).find((x) => x.id === listingId);
    if (!l || l.status !== "active") return "该挂单已不在售。";
    const xianyu = (g.sim.xianyu ?? []).filter((x) => x.id !== listingId);
    commitSim({ ...g.sim, bag: [...(g.sim.bag ?? []), l.itemId], xianyu });
    return "";
  }, [commitSim]);

  // 成交：确认卖出 —— 回款、挂单转已售、生成买家评价。
  // 传入 agreed 时用砍价谈成的价格与买家（AI 私聊），否则买家按心理价位一口价拿下。
  const xianyuSell = useCallback((listingId: string, agreed?: { price: number; buyer: string }): string => {
    const g = gameRef.current;
    if (!g) return "";
    const l = (g.sim.xianyu ?? []).find((x) => x.id === listingId);
    if (!l || l.status !== "active") return "该挂单已不在售。";
    const soldPrice = agreed ? Math.max(1, Math.round(agreed.price)) : settleSale(l).soldPrice;
    const review = agreed ? reviewFor(l, soldPrice, agreed.buyer) : settleSale(l).review;
    const xianyu = (g.sim.xianyu ?? []).map((x) =>
      x.id === listingId ? { ...x, status: "sold" as const, soldPrice, review } : x,
    );
    // 货款记入手机钱包（绑定了自定义货币时记在该属性上）
    const paid = wallet.add(g, soldPrice).sim;
    const amt = wallet.fmt(soldPrice, g);
    commitSim(
      { ...paid, xianyu },
      `你在咸鱼卖出了「${l.name}」，到账 ${amt}。买家「${review.buyer}」给了 ${review.rating} 星好评。`,
    );
    setLastChanges([`${walletDef(g)?.label ?? "资金"} +${soldPrice}`]);
    return "";
  }, [commitSim]);

  // 向已结识人物打听情报（每人只知与自己相关的；一次性解锁并记入存档）
  const simAskIntel = useCallback((personId: string, intelId: string): string => {
    const g = gameRef.current;
    if (!g) return "";
    const { next, msg } = learnIntel(g.sim, personId, intelId);
    if (next !== g.sim) commitSim(next, msg);
    return "";
  }, [commitSim]);

  const simNegotiate = useCallback((gigId: string) => {
    const g = gameRef.current;
    if (!g || busy) return;
    const { next, msg } = negotiateGig(g.sim, gigId);
    const changes = simDiff(g.sim, next);
    commitSim(next);
    setLastChanges(changes);
    setPopup({ title: "通告交涉", segments: [{ kind: "system", text: msg }], changes });
  }, [busy, commitSim]);

  // 找对应制作人/制片人当面打听：把 TA 掌管的这一类通告并入本周档期
  const simAskOffers = useCallback((mobId: string): string => {
    const g = gameRef.current;
    if (!g || busy) return "";
    const mob = PERSON_BY_ID[mobId];
    if (!mob?.offers) return "";
    if (!evalRequires(mob.requires, g.sim).ok) return `${mob.name}此刻还不愿把资源交给你。`;
    const got = offersFrom(g.sim, mob.offers.cats as GigCat[], mob.offers.maxStar);
    const union = Array.from(new Set([...(g.sim.offers ?? []), ...got]));
    const pr = Math.min(500, g.sim.pr + (g.sim.offersViewedWeek ? 0 : 5));
    commitSim({ ...g.sim, offers: union, offersViewedWeek: 1, pr });
    const names = got.map((id) => GIG_POOL.find((x) => x.id === id)?.name).filter(Boolean);
    return names.length
      ? `${mob.name}翻出本周的${mob.offers.label}：${names.join("、")}。（到「养成」通告公告交涉）`
      : `${mob.name}说这几天没有适合你的${mob.offers.label}，过阵子再来。`;
  }, [busy, commitSim]);

  const simChooseArc = useCallback((pid: string, idx: number) => {
    const g = gameRef.current;
    if (!g || busy) return;
    // 情感线当面发生：TA 不在身边时不推进（入口只出现在线下见面的行动条里）
    if (!presentHere(g.sim, g.sim.room ?? getWorldStartRoom(), pid, g.npcs)) {
      setPopup({ title: "情感线", segments: [{ kind: "system", text: "这一段要当面经历——去 TA 常在的地方，见到 TA 再说。" }], changes: [] });
      return;
    }
    const { next, msg } = chooseArc(g.sim, pid, idx);
    const changes = simDiff(g.sim, next);
    const merged = commitSim(next) ?? { ...g, sim: next };
    setLastChanges(changes);
    if (msg) narrateSettled(g, merged, { tag: "情感线推进", title: "情感线推进", sysMsg: msg, changes, focus: [pid], brief: "主角在情感线的关键节点上做出了选择，这一段当面发生。" });
  }, [busy, commitSim, cfg, runTurn]);

  const simConfirmDating = useCallback((pid: string) => {
    const g = gameRef.current;
    if (!g || busy) return;
    if (!presentHere(g.sim, g.sim.room ?? getWorldStartRoom(), pid, g.npcs)) {
      setPopup({ title: "定情", segments: [{ kind: "system", text: "这句话要当面说——去 TA 常在的地方，见到 TA 再说。" }], changes: [] });
      return;
    }
    const { next, msg } = confirmDating(g.sim, pid);
    const changes = simDiff(g.sim, next);
    const merged = commitSim(next) ?? { ...g, sim: next };
    setLastChanges(changes);
    if (msg) narrateSettled(g, merged, { tag: "定情", title: "定情", sysMsg: msg, changes, focus: [pid], brief: "主角与对方当面确认了恋爱关系。" });
  }, [busy, commitSim, cfg, runTurn]);

  // —— 婚礼：满足婚姻制度与好感后举办仪式，结为夫妻；仪式以场景弹窗演绎 ——
  const simWedding = useCallback((pid: string) => {
    const g = gameRef.current;
    if (!g || busy) return;
    const name = g.npcs.find((n) => n.id === pid)?.name ?? pid;
    const cost = weddingCost();
    const fmt = (n: number) => wallet.fmt(n, g);
    const why = weddingBlocked(g.sim, pid, g.sim.rel?.[pid] ?? 0, wallet.balance(g), fmt);
    if (why) { setPopup({ title: "婚礼", segments: [{ kind: "system", text: why }], changes: [] }); return; }
    // 婚礼费用走钱包：绑定了自定义货币（灵石 / 金币…）的世界观扣对应属性
    const paid = wallet.add(g, -cost);
    const sim = { ...paid.sim, spouses: [...(g.sim.spouses ?? []), pid], stress: Math.max(0, g.sim.stress - 10) };
    const merged = commitSim(sim) ?? g;
    if (paid.player !== g.player) persist({ ...merged, player: paid.player });
    const loc = merged.world.location;
    const when = `第 ${merged.sim.week} 周 · ${weekdayName(merged.sim.day)}`;
    if (!isConfigured(cfg)) {
      setPopup({ title: `与${name}的婚礼`, segments: [{ kind: "system", text: `你与${name}交换誓言，正式结为夫妻。` }], changes: [`${fmt(cost)} 已支出`, `与${name}结为夫妻`], scene: { location: loc } });
      return;
    }
    simLockRef.current = lockOf(g.sim, merged.sim); // 已结算数值锁定，AI 不得重复改动
    void runTurn(merged, `【婚礼仪式】主角与${name}今天举行婚礼，正式结为夫妻（本世界婚姻制度：${worldRuleLabel("marriage", ruleOf("marriage"))}）。请完整演绎仪式：场地布置、宾客与亲友到场、誓词交换、交换戒指、亲吻与祝酒，写出两人的心绪与在场亲友的反应；${name}的台词要贴合 TA 的性格与你们的过往。数值已由系统结算，不要改动金钱；给 ${name} 写 npc_changes（relation 改为「配偶」，affinity_delta 可 +5~10）。`, true, false, { kind: "spot", srcId: `wedding-${pid}`, title: `与${name}的婚礼`, seed: `与${name}结为夫妻`, location: loc, when }, true);
  }, [busy, cfg, commitSim, persist, runTurn]);

  // —— 离婚：按「离婚权限」判定，结算由引擎完成，AI 只演绎 ——
  const simDivorce = useCallback((pid: string) => {
    const g = gameRef.current;
    if (!g || busy) return;
    const { next, msg } = divorce(g.sim, pid);
    if (next === g.sim) { setPopup({ title: "离婚", segments: [{ kind: "system", text: msg }], changes: [] }); return; }
    const merged = commitSim(next) ?? g;
    const name = merged.npcs.find((n) => n.id === pid)?.name ?? pid;
    if (!isConfigured(cfg)) { setPopup({ title: `与${name}离婚`, segments: [{ kind: "system", text: msg }], changes: [] }); return; }
    simLockRef.current = lockOf(g.sim, merged.sim); // 已结算数值锁定，AI 不得重复改动
    void runTurn(merged, `【离婚】${msg}（本世界离婚权限：${worldRuleLabel("divorce", ruleOf("divorce"))}）。请演绎两人摊牌与签字分开的场景，${name}的反应贴合 TA 的性格与你们的过往。数值已由系统结算，不要改动；给 ${name} 写 npc_changes（relation 改为「前配偶」）。`, true, false, { kind: "spot", srcId: `divorce-${pid}`, title: `与${name}离婚`, seed: msg, location: merged.world.location, when: `第 ${merged.sim.week} 周 · ${weekdayName(merged.sim.day)}` }, true);
  }, [busy, cfg, commitSim, runTurn]);

  // —— 手机系统：整档提交（聊天/通话逐条落库并持久化）——
  const commitGame = useCallback((next: GameState) => {
    persist(next);
    queueMicrotask(() => runFixedRef.current?.());
  }, [persist]);
  const patchGame = useCallback((fn: (latest: GameState) => GameState) => {
    const g = gameRef.current;
    if (g) {
      persist(fn(g));
      queueMicrotask(() => runFixedRef.current?.());
    }
  }, [persist]);

  // —— 交换联系方式：随机同意/拒绝；同意则开通私聊通道 ——
  const phoneExchange = useCallback((personId: string): boolean => {
    const g = gameRef.current;
    if (!g) return false;
    const rel = g.sim.rel[personId] ?? 0;
    // 好感越高越可能同意；基础 45% + 好感加成，封顶 92%
    const chance = Math.max(0.25, Math.min(0.92, 0.45 + rel / 200));
    const ok = Math.random() < chance;
    if (ok) commitGame(openThread(g, personId));
    return ok;
  }, [commitGame]);

  const endingRef = useRef(false);
  const endManuallyRef = useRef<((kind?: "bankrupt" | "finish" | "manual" | "ai") => Promise<void>) | null>(null);

  // 结局本体：定级 → 后记 → 落盘 → 进结局页。防重入锁与「落笔中」状态由下方 endManually 统一收放
  const writeEnding = useCallback(async (g: GameState, kind: "bankrupt" | "finish" | "manual" | "ai") => {
    // 依据结局类型给出定级：破产走破产结局，其余按自定义结局或名气/口碑/奖项分档
    const custom = kind === "bankrupt" ? null : matchCustomEnding(g.customEndings, g.sim);
    const rank = kind === "bankrupt" ? bankruptEnding(g.sim) : custom ? { title: custom.title, body: custom.body } : endingText(g.sim);
    const rawGrade = g.gradeDims?.length ? dimsGrade(g.sim, g.gradeDims) : lifeGrade(g.sim);
    const grade = custom && (custom.grade || custom.verdict)
      ? { ...rawGrade, grade: custom.grade || rawGrade.grade, verdict: custom.verdict || rawGrade.verdict }
      : rawGrade;
    const enabledEndings = (g.customEndings ?? []).filter((e) => e.enabled !== false);
    const customIdx = custom ? enabledEndings.findIndex((e) => e.id === custom.id) : -1;
    const defaultBadge = custom
      ? (custom.badge?.trim() || (enabledEndings.length > 0 && customIdx >= 0 ? `结局 ${customIdx + 1}/${enabledEndings.length}` : "专属结局"))
      : kind === "bankrupt"
      ? "特殊结局"
      : grade.grade === "S+"
      ? "真结局"
      : grade.grade === "S"
      ? "荣耀结局"
      : "结局达成";
    const endingQuote = custom?.quote?.trim() || rank.body;
    const endingSubTitle = custom?.subTitle?.trim() || undefined;
    const endingComment = custom?.comment?.trim() || undefined;
    const endingImage = custom?.image?.trim() || undefined;
    const endingHero = custom?.heroImage?.trim() || undefined;
    const endingCommentBy = custom?.commentBy?.trim() || undefined;
    const endingCommentAvatar = custom?.commentAvatar?.trim() || undefined;
    const her = getWorld().worldId === "ent" ? "女明星" : "主角";
    // 记忆素材：剧情志篇目 + 主线最早与最近的片段，供后记「结尾呼应前文记忆」
    const lineOf = (t: Turn) => t.segments.map((x) => x.text).join("").replace(/\s+/g, " ").slice(0, 120);
    const aiTurns = g.story.filter((t) => t.role === "ai");
    const firstScenes = aiTurns.slice(0, 3).map(lineOf);
    const lastScenes = aiTurns.slice(-4).map(lineOf);
    const journal = (g.journal ?? []).slice(-12).map((j) => `${j.when ?? ""}${j.title}`);
    const material = [
      `主角：${g.player.name}，${g.player.age ?? ""}岁，${g.player.description}`,
      `结局方式：${kind === "manual" ? "玩家亲手合上这本书" : kind === "ai" ? "命运自然走到终章" : kind === "bankrupt" ? "破产落幕" : "生涯期满"}`,
      `【结局定级】${rank.title}——${rank.body}`,
      // 结局专属剧情段落：作者绑定的固定事件，作为后记的收尾场景
      (() => { const sc = custom?.sceneId ? (g.fixedEvents ?? []).find((e) => e.id === custom.sceneId) : undefined; return sc ? `【结局收尾场景】${sc.name}：${(sc.prompt ?? "").slice(0, 400)}` : ""; })(),
      `【人生评级】${grade.grade}（${grade.score} 分 · ${grade.verdict}）：${grade.items.map((i) => `${i.label}${i.detail}`).join("、")}`,
      `人生记忆摘要：${g.memory || "（暂无）"}`,
      `关键履历：${g.player.history.map((h) => h.title + "：" + h.detail).join("；") || "（暂无）"}`,
      `剧情志篇目：${journal.join("；") || "（暂无）"}`,
      `最初的场景：${firstScenes.join(" / ") || "（暂无）"}`,
      `最后的场景：${lastScenes.join(" / ") || "（暂无）"}`,
      `重要关系：${g.npcs.map((n) => n.name + "(" + n.relation + ",好感" + n.affinity + ")").join("；")}`,
      g.epilogue?.trim() ? `模型收场时留下的话：${g.epilogue.slice(0, 400)}` : "",
    ].filter(Boolean).join("\n");
    const MIN = 1000;
    // 后记总时限：接口卡住或续写拖太久时，用已写好的部分或本地后记收尾，不能让一个挂起的请求挡住结局页
    const deadline = Date.now() + 150_000;
    const left = () => deadline - Date.now();
    let epilogue = "";
    try {
      if (isConfigured(cfg)) {
        const sys = { role: "system" as const, content: "你是深情细腻的传记作者。只输出后记正文，用空行分段，不要标题以外的说明。" };
        epilogue = await complete(cfg, [
          sys,
          {
            role: "user",
            content: `请为这位${her}写一篇不少于${MIN}字（建议 1200–1800 字）的「生平记事及后传」。\n要求：\n1. 按人生阶段分段：初出茅庐、艰难打拼、高光与低谷、情感与抉择、结局之后的后传、暮年回望；每段写出该阶段的重点事件。\n2. 语言细腻感人，有画面与细节，不要流水账。\n3. 在结尾回扣「最初的场景」与剧情中的具体记忆，形成首尾呼应。\n4. 基调、成就与遗憾须与结局定级和人生评级相符。\n\n${material}`,
          },
        ], left());
        // 字数不够就续写，最多两次；总时限只剩不到 30 秒就不再续写
        for (let i = 0; i < 2 && epilogue.replace(/\s/g, "").length < MIN && left() > 30_000; i++) {
          const more = await complete(cfg, [sys, { role: "user", content: `以下后记只有 ${epilogue.replace(/\s/g, "").length} 字，不足 ${MIN} 字。请紧接末尾续写后传与暮年回望，补足细节并回扣最初的记忆，只输出续写部分：\n\n${epilogue}\n\n素材：\n${material}` }], left());
          if (!more.trim()) break;
          epilogue = `${epilogue.trim()}\n\n${more.trim()}`;
        }
      }
    } catch {
      /* 退回本地后记 */
    }
    if (!epilogue.trim()) epilogue = localEpilogue(g, rank, grade, firstScenes, lastScenes, journal);
    persist({
      ...g,
      ended: true,
      epilogue,
      endingTitle: rank.title,
      endingTag: rank.body,
      endingId: custom?.id,
      endingBadge: defaultBadge,
      endingSubTitle,
      endingQuote,
      endingComment,
      endingImage,
      endingHero,
      endingCommentBy,
      endingCommentAvatar,
      endingGrade: grade,
      endingKind: kind,
    });
    setScreen("ending");
  }, [cfg, persist]);

  const endManually = useCallback(async (kind: "bankrupt" | "finish" | "manual" | "ai" = "manual") => {
    const g = gameRef.current;
    // 防重入：时限/自定义结局/破产可能同时触发；AI 判定收场时 g.ended 已为真但还没有后记，需放行
    if (!g || g.endingGrade || endingRef.current) return;
    endingRef.current = true;
    setBusy(true);
    try {
      await writeEnding(g, kind);
    } catch (e) {
      // 出错也要解锁，否则时限到期 / 结局判定会被永久挡住；留在本局并告知玩家可以再试
      setPopup({ title: "结局没能写完", segments: [{ kind: "system", text: `收尾时出了点问题（${e instanceof Error ? e.message : String(e)}），本局尚未落幕，稍后再试一次即可。` }], changes: [] });
    } finally {
      setBusy(false);
      endingRef.current = false;
    }
  }, [writeEnding]);
  endManuallyRef.current = endManually;

  const value = useMemo<Ctx>(
    () => ({
      cfg, setCfg, theme, setTheme, look: lookRes.look, activeLooks: lookRes.active, lookCss: lookRes.css, previewLook, lookPreview, screen, go, game, busy, lastChanges, popup, setPopup,
      startNew, loadState, submit, setPlayerAvatar, setNpcAvatar, setNpcPortrait, setRelValue, setRomanceable, setNpcDim, saveNow, regenerate, saveEpoch, canRetry, retryPopup, autosaveOn, setAutosaveOn, endManually, setWorldRules, setWorldBook, setMapEdits, setFixedEvents, setRandomGroups, previewFixedEvent,
      branchAct, leaveBranch, setSchedule, runWeekNow, endDayNow, advanceNow, equipTitle, simVisit, simEvent, simMove, simPickup, simUseItem, simGiftItem, simActivity, simBuy, simAskIntel, simNegotiate, simAskOffers, simChooseArc, simConfirmDating,
      projApply, projSign, projNegotiate, projPromote, projWorkday, simContact, simConfess, simBridge, simWedding, simDivorce, simMeetProducer, simAskProducer,
      personaDeclare, personaAct, crisisResolve, resolveBreach, buyCar, sellCar, setActiveCar, xianyuList, xianyuDelist, xianyuSell, commitGame, patchGame, phoneExchange,
      playSpotEvent, playQuest, toggleFav, removeJournal, exportJournal,
    }),
    [cfg, setCfg, theme, setTheme, lookRes, lookPreview, screen, go, game, busy, lastChanges, popup, startNew, loadState, submit, setPlayerAvatar, setNpcAvatar, setNpcPortrait, setRelValue, setRomanceable, setNpcDim, saveNow, regenerate, saveEpoch, canRetry, retryPopup, autosaveOn, setAutosaveOn, endManually, setWorldRules, setWorldBook, setMapEdits, setFixedEvents, setRandomGroups, previewFixedEvent, setSchedule, runWeekNow, endDayNow, advanceNow, equipTitle, simVisit, simEvent, simMove, simPickup, simUseItem, simGiftItem, simActivity, simBuy, simAskIntel, simNegotiate, simAskOffers, simChooseArc, simConfirmDating, projApply, projSign, projNegotiate, projPromote, projWorkday, simContact, simConfess, simBridge, simWedding, simDivorce, simMeetProducer, simAskProducer, personaDeclare, personaAct, crisisResolve, resolveBreach, buyCar, sellCar, setActiveCar, xianyuList, xianyuDelist, xianyuSell, commitGame, patchGame, phoneExchange, playSpotEvent, playQuest, toggleFav, removeJournal, exportJournal],
  );

  return (
    <GameCtx.Provider value={value}>
      <LiveCtx.Provider value={live}>{children}</LiveCtx.Provider>
    </GameCtx.Provider>
  );
}

/* Provider 与 GameCtx 载体一样谢绝热替换：Fast Refresh 在连续编辑本文件时可能
 * 让 Provider 对着一个瞬时失配的 Context 重渲染，触发误报的
 * “useGame outside provider”。改为整页刷新即可从根上消除该竞态。 */
if (import.meta.hot) (import.meta.hot as unknown as { decline: () => void }).decline();

/* 底层规则 · 标记生命周期：一次性标记在下一回合清除；临时标记在对局结束时清除（可关） */
function applyFlagLife(prev: GameState | null, next: GameState): GameState {
  if (!prev || prev.id !== next.id || !next.sim?.flags) return next;
  let flags = next.sim.flags;
  if (next.turnCount > prev.turnCount) flags = dropFlags(flags, "once", new Set(Object.keys(prev.sim?.flags ?? {}))) ?? flags;
  if (next.ended && !prev.ended && rulesOf(next).flags.clearTempOnEnd) flags = dropFlags(flags, "temp") ?? flags;
  return flags === next.sim.flags ? next : { ...next, sim: { ...next.sim, flags } };
}
