import { applyLifecycle } from "../game/lifecycle";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  applyStep,
  buildMessages,
  complete,
  compressMemory,
  displayText,
  extractStep,
  isConfigured,
  mockEpilogue,
  proseToSegments,
  streamChat,
} from "../lib/ai";
import {
  defaultConfig,
  defaultTheme,
  ensureFamily,
  ensureSim,
  loadConfig,
  loadTheme,
  newGame,
  saveConfig,
  saveTheme,
  syncSimToPlayer,
  uid,
  autosaveDebounced,
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
  negotiateGig,
  offersFrom,
  visitLocation,
  weekDate,
  weekdayName,
  type GameState as SimState,
  type GigCat,
} from "../game/logic";
import { fireEncounter, introOf, itemsOfRoom, learnIntel, locOf, tickWorld, travelPlan } from "../game/mud";
import { customItemsOf, findCustomItem, findSpotEvent } from "../game/mapedits";
import { openThread } from "../game/phone";
import { declarePersona, doPublicAct, personaWeekly, resolveCrisis } from "../game/persona";
import { applyProject, doWorkday, negotiateOffer, processAuditions, processReleases, promoteWork, signContract } from "../game/projects";
import { blankRel, confessTo, contactPerson, decayRelations, ensureRelations } from "../game/relations";
import { askProducer, meetProducer } from "../game/producer";
import { PERSON_BY_ID, RELATIONS, SIDEQUEST_BY_ID, evalRequires, itemById, romanticCapOf, type SigningContract } from "../worlds/star2005/content";
import { GIG_POOL, STAT_LABELS, STAT_ORDER, carById, resaleValue } from "../game/data";
import { settleSale, reviewFor, type XianyuListing } from "../game/xianyu";
import type { AIConfig, GameState, Player, Segment, Turn, WorldRules } from "../lib/types";
import type { Character as SimChar } from "../game/logic";

import { GameCtx, LiveCtx, type Ctx, type Screen, type Popup } from "./gameCtx";

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

export function GameProvider({ children }: { children: ReactNode }) {
  const [cfg, setCfgState] = useState<AIConfig>(defaultConfig);
  const [theme, setThemeState] = useState<ThemePref>(defaultTheme);
  const [screen, setScreen] = useState<Screen>("cover");
  const [game, setGame] = useState<GameState | null>(null);
  const [live, setLive] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastChanges, setLastChanges] = useState<string[]>([]);
  const [popup, setPopup] = useState<Popup>(null);
  const [autosaveOn, setAutosaveOnState] = useState<boolean>(true);
  const autosaveOnRef = useRef(true);
  autosaveOnRef.current = autosaveOn;
  const gameRef = useRef<GameState | null>(null);
  gameRef.current = game;
  // 上一回合的输入与前置状态，供「重新生成」在 AI 输出异常时原样重跑
  const lastTurnRef = useRef<{ base: GameState; input: string; hideInput?: boolean } | null>(null);

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
  const setTheme = useCallback((t: ThemePref) => {
    setThemeState(t);
    saveTheme(t);
  }, []);

  const go = useCallback((s: Screen) => setScreen(s), []);
  const loadState = useCallback((s: GameState) => {
    setGame(syncSimToPlayer(ensureFamily(ensureSim(s))));
    setScreen("game");
  }, []);

  // 持久化：立即更新内存态，并（若开启自动存档）以 300ms 防抖异步写入 localforage。
  // localforage 写入是异步且带全局异常兜底的，因此这里同步返回 true 表示「已受理」。
  const persist = useCallback((s: GameState): boolean => {
    s = applyLifecycle(s);
    setGame(s);
    if (autosaveOnRef.current) autosaveDebounced(s);
    return true;
  }, []);

  // 核心：推进一回合
  const runTurn = useCallback(
    async (base: GameState, input: string, asPopup: boolean, hideInput = false, journalMeta?: Omit<import("../lib/types").JournalEntry, "id" | "ts" | "text">) => {
      // 未配置 AI：剧情演绎需要模型，绝不凭空编造旁白/台词或偷偷改动好感数值。
      // 地图移动、通告、养成等确定性玩法无需 AI，仍照常运行。
      if (!isConfigured(cfg)) {
        setPopup({
          title: "还没接入 AI",
          segments: [
            {
              kind: "system",
              text: "让主持人为你叙写剧情、演绎人物对话，需要先接入一个 AI 模型。点右上角的齿轮填入接口即可。\n\n（地图走动、洽谈通告、养成数值这些玩法不依赖 AI，随时都能玩。）",
            },
          ],
          changes: [],
        });
        return;
      }

      setBusy(true);
      setLive("");
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

      let full = "";
      // 流式渲染节流：AI 每吐一个 token 都刷新会导致整棵树（六个常驻页签）逐字重渲染，
      // 且 displayText 每次重解析全量字符串（O(n²)）。改为最多每 ~90ms 落一帧。
      let latest = "";
      let lastFlush = 0;
      let flushTimer: ReturnType<typeof setTimeout> | null = null;
      const flush = () => { flushTimer = null; lastFlush = Date.now(); setLive(displayText(latest)); };
      try {
        full = await streamChat(cfg, buildMessages(working, input), (_d, f) => {
          latest = f;
          const dt = Date.now() - lastFlush;
          if (dt >= 90) flush();
          else if (!flushTimer) flushTimer = setTimeout(flush, 90 - dt);
        });
      } catch (e) {
        if (flushTimer) clearTimeout(flushTimer);
        setBusy(false);
        setLive("");
        setPopup({
          title: "AI 请求失败",
          segments: [{ kind: "system", text: (e as Error).message || "网络或配置异常，请检查 AI 配置。" }],
          changes: [],
        });
        return;
      }
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

      const effectiveStep = step ?? { options: [], narration: prose };
      const { next, changes } = applyStep(working, effectiveStep);

      if (asPopup) {
        setPopup({ title: journalMeta?.title ?? "行动结果", segments, changes });
        // 弹窗行动也同步数值，但不写入主剧情
        // 剧情事件：把这次演绎出的正文独立成篇，存进剧情志（可收藏/导出）
        let landed = next;
        if (journalMeta) {
          const text = segments.map((sg) => (sg.kind === "dialogue" ? `${sg.speaker}：${sg.text}` : sg.text)).join("\n");
          const entry: import("../lib/types").JournalEntry = { ...journalMeta, id: uid(), ts: Date.now(), text };
          landed = { ...next, journal: [entry, ...(next.journal ?? [])] };
        }
        persist(landed);
        setLastChanges(changes);
        setLive("");
        setBusy(false);
        return;
      }

      const aiTurn: Turn = { id: uid(), role: "ai", segments, raw: full, ts: Date.now() };
      const withStory = { ...next, story: [...next.story, aiTurn] };
      persist(withStory);
      setLastChanges(changes);
      setLive("");
      setBusy(false);

      // 每 5 回合异步压缩主线记忆
      if (withStory.turnCount > 0 && withStory.turnCount % 5 === 0) {
        compressMemory(cfg, withStory)
          .then((mem) => {
            const cur = gameRef.current;
            if (cur && cur.id === withStory.id) persist({ ...cur, memory: mem });
          })
          .catch(() => undefined);
      }

      if (withStory.ended) {
        // AI 判定收场：若模型没有随手附上后记，则走统一的后记生成（AI 或本地兜底），
        // 否则 Ending 页会永远停在「后记正在生成……」。
        if (!withStory.epilogue?.trim()) {
          void endManuallyRef.current?.();
        } else {
          setScreen("ending");
        }
      }
    },
    [cfg, persist],
  );

  const startNew = useCallback(
    (player: Player, simChar?: SimChar, contract?: SigningContract, worldRules?: WorldRules) => {
      const g = newGame(player, simChar, contract);
      if (worldRules) g.worldRules = worldRules;
      setGame(g);
      setScreen("opening"); // 先播开局序章动画（场景图 + 科班出身叙事），玩家点「入行」后再进入游戏
      void runTurn(
        g,
        "游戏开始，请写主角的出身序章。先用细腻旁白交代她出生于怎样的家庭：结合【主角设定】里的家世、阶层、父亲职业、母亲职业与母校，描画她的成长底色。重点写清——父母为何不愿她入行去当明星：越是殷实或名门（如皇族、家族企业），父母越希望她安稳继承家业、走一条体面的正途，而非抛头露面；越是清贫或书香之家，则担心娱乐圈浮沉无根、糟蹋了她的前程。让父母的反对与其职业、阶层严丝合缝。随后收束到此刻——她已瞒着或说服了家人，站在出道倒计时的起点。以人物对话（父母的劝阻/叹息）与旁白交织呈现，最后给出可选行动。",
        false,
        true, // 幕后导演指令：仅驱动 AI 生成序章，不作为玩家气泡显示
      );
    },
    [runTurn],
  );

  const submit = useCallback(
    async (input: string, asPopup = false) => {
      const g = gameRef.current;
      if (!g || busy) return;
      await runTurn(g, input, asPopup);
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

  // 手动调节核心关系轴（好感 s.rel / 心动·信任·近况心情 s.relations），钳制到各自区间后回灌镜像
  const setRelValue = useCallback(
    (pid: string, dimId: string, value: number) => {
      const g = gameRef.current;
      if (!g?.sim) return;
      const s = g.sim;
      const v = Math.round(value);
      if (dimId === "friendship") {
        const cap = pid === "guchen" || pid === "songshixu" ? 1000 : 100;
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
    setGame(g);
    return writeAutosave(g);
  }, []);

  // 重新生成：AI 输出异常（乱码）时，从上一回合的前置状态用同样的输入重跑
  const regenerate = useCallback(() => {
    const last = lastTurnRef.current;
    if (!last || busy) return;
    void runTurn(last.base, last.input, false, last.hideInput);
  }, [busy, runTurn]);

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

  const setMapEdits = useCallback(
    (next: import("../lib/types").MapEdits) => {
      const g = gameRef.current;
      if (!g) return;
      persist({ ...g, mapEdits: next });
    },
    [persist],
  );

  /* —— 确定性引擎接线 —— */
  // 比较前后 sim，产出玩家可读的数值变化提示
  const simDiff = (a: SimState, b: SimState): string[] => {
    const out: string[] = [];
    const push = (label: string, d: number, suffix = "") => { if (d) out.push(`${label} ${d > 0 ? "+" : ""}${d}${suffix}`); };
    push("名气", b.fame - a.fame);
    push("口碑", b.reputation - a.reputation);
    push("压力", b.stress - a.stress);
    const money = Math.round((b.money - a.money) / 1000) / 10;
    if (money) out.push(`资金 ${money > 0 ? "+" : ""}${money}万`);
    for (const k of STAT_ORDER) push(STAT_LABELS[k], b.stats[k] - a.stats[k]);
    if (b.works !== a.works) out.push("作品 +" + (b.works - a.works));
    if (b.awards !== a.awards) out.push("奖项 +" + (b.awards - a.awards));
    return out;
  };

  // 把新的 sim 落地：同步档案、更新世界时间、存档
  const commitSim = useCallback((nextSim: SimState, narration?: string): GameState | null => {
    const g = gameRef.current;
    if (!g) return null;
    // 确定性动作的叙事结果直接落进下半部分的对话框（故事线），不再另开绿色小字。
    const story = narration
      ? [...g.story, { id: uid(), role: "ai" as const, segments: [{ kind: "system" as const, text: narration }], ts: Date.now() }]
      : g.story;
    const merged = syncSimToPlayer({
      ...g,
      sim: nextSim,
      story,
      world: {
        ...g.world,
        time: `第 ${nextSim.week} 周 · ${dayDateLabel(nextSim.day)} ${weekdayName(nextSim.day)}`,
        location: locOf(nextSim.room)?.name ?? g.world.location,
      },
    });
    persist(merged);
    return merged;
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
    commitSim({
      ...g.sim,
      money: g.sim.money - fee,
      trust: Math.max(0, g.sim.trust - trustHit),
      breach: null,
    });
  }, [commitSim]);

  // 一天推进结果落地：每天跑发行/关系衰减，周结算时叠加人设周结算，并弹出当天结果（含档位与收益）。
  const applyDayResult = useCallback((prevSim: SimState, res: ReturnType<typeof advanceDay>) => {
    // 发行/试镜/关系衰减按日历日推进，每天翻页都结算一次
    const rel = applyReleases(res.next);
    let next: SimState = { ...rel.s, relations: decayRelations(rel.s) };
    const relEvents = rel.events;
    if (res.settled) next = personaWeekly(next);
    const changes = simDiff(prevSim, next);
    const merged = commitSim(next);
    setLastChanges(changes);
    const relText = relEvents.length ? "\n\n" + relEvents.join("\n") : "";
    const gainText = res.gains.length ? "\n" + res.gains.join(" · ") : "";
    if (res.settled) {
      const tail = next.log.slice(-3).join("\n");
      setPopup({
        title: `${res.gradeLabel ? res.gradeLabel + " · " : ""}第 ${prevSim.week} 周结算`,
        segments: [{ kind: "system", text: `${res.dayText}${gainText}\n\n${next.log.length ? tail : ""}${relText}` }],
        changes,
      });
      if (res.ended && merged) void endManuallyRef.current?.(res.ended);
    } else {
      setPopup({
        title: res.gradeLabel ? `${res.gradeLabel} · ${res.actLabel}` : res.actLabel,
        segments: [{ kind: "system", text: res.dayText + gainText + relText }],
        changes,
      });
    }
  }, [commitSim]);

  // 过完本周：从今天一路快进到跨过周日、完成周结算（或触发终局）
  const runWeekNow = useCallback(() => {
    const g = gameRef.current;
    if (!g || busy) return;
    let cur: SimState = g.sim;
    let res = advanceDay(cur);
    while (!res.rolledWeek && !res.ended) {
      cur = res.next;
      res = advanceDay(cur);
    }
    applyDayResult(g.sim, res);
  }, [busy, applyDayResult]);

  // 推进一天：结算当天安排的一件事，翻页到次日
  const endDayNow = useCallback(() => {
    const g = gameRef.current;
    if (!g || busy) return;
    const res = advanceDay(g.sim);
    applyDayResult(g.sim, res);
  }, [busy, applyDayResult]);

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

  // 私下联系：回暖心情、推进好感/私人信任/心动（任何 NPC 都可攻略）
  const simContact = useCallback((pid: string, name?: string) => {
    const g = gameRef.current;
    if (!g || busy) return;
    const { next, msg } = contactPerson(g.sim, pid, name);
    const changes = simDiff(g.sim, next);
    commitSim(next);
    setLastChanges(changes);
    if (msg) setPopup({ title: "私下联系", segments: [{ kind: "system", text: msg }], changes });
  }, [busy, commitSim]);

  // 表白：普通 NPC 的轻量攻略；固定角色需走七段情感线
  const simConfess = useCallback((pid: string, name?: string) => {
    const g = gameRef.current;
    if (!g || busy) return;
    const { next, msg } = confessTo(g.sim, pid, name);
    const changes = simDiff(g.sim, next);
    commitSim(next);
    setLastChanges(changes);
    if (msg) setPopup({ title: "表白心意", segments: [{ kind: "system", text: msg }], changes });
  }, [busy, commitSim]);

  const simVisit = useCallback((locId: string): string => {
    const g = gameRef.current;
    if (!g || busy) return "正忙，稍后再试。";
    const { next, msg } = visitLocation(g.sim, locId);
    const changes = simDiff(g.sim, next);
    commitSim(next, msg);
    setLastChanges(changes);
    return "";
  }, [busy, commitSim]);

  // 条件邂逅：先确定性结算数值，再把叙事种子交给 AI 演绎（落入对话框）
  const simEvent = useCallback((id: string) => {
    const g = gameRef.current;
    if (!g || busy) return;
    // 邂逅需要 AI 演绎叙事；未接入时不要提前消耗一次性事件（否则数值扣了、旗标烧了却看不到剧情）。
    if (!isConfigured(cfg)) {
      setPopup({ title: "还差一步", segments: [{ kind: "system", text: "这段邂逅要由 AI 来演绎。请先在右上角接入 AI，再来触发。" }], changes: [] });
      return;
    }
    const { next, seed } = fireEncounter(g.sim, id);
    if (!seed) return;
    const changes = simDiff(g.sim, next);
    const merged = commitSim(next);
    setLastChanges(changes);
    if (merged) void runTurn(merged, `【场景：${locOf(next.room)?.name}】${seed}`, true);
  }, [busy, cfg, commitSim, runTurn]);

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
    const locName = locOf(hit.roomId)?.name ?? g.world.location;
    void runTurn(
      g,
      `【场景：${locName}】${event.annotation ? event.annotation + "\n" : ""}${event.seed}`,
      true,
      false,
      { kind: "spot", srcId: event.id, title: event.title, annotation: event.annotation, seed: event.seed, location: locName, when: whenLabel(g) },
    );
  }, [busy, cfg, runTurn]);

  // 演绎一段支线剧情（内容池 SIDEQUESTS）：把场景 + 续接约束交给 AI，独立存进剧情志
  const playQuest = useCallback((questId: string) => {
    const g = gameRef.current;
    if (!g || busy) return;
    const q = SIDEQUEST_BY_ID[questId];
    if (!q) return;
    if (!isConfigured(cfg)) {
      setPopup({ title: "还差一步", segments: [{ kind: "system", text: "这段支线要交给 AI 来演绎。请先在右上角接入 AI，再来触发。" }], changes: [] });
      return;
    }
    const seed = `${q.scene.join("\n")}\n\n【续接方向｜${q.continuationKind}】${q.continuation}`;
    void runTurn(
      g,
      `【支线剧情：${q.title}】\n触发条件：${q.condition}\n\n${seed}`,
      true,
      false,
      { kind: "quest", srcId: q.id, title: `${q.code} · ${q.title}`, annotation: q.condition, seed, location: g.world.location, when: whenLabel(g) },
    );
  }, [busy, cfg, runTurn]);

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
    commitSim(next);
    setLastChanges(changes);
    if (next.crisis && !g.sim.crisis) {
      setPopup({ title: "舆情预警", segments: [{ kind: "system", text: lines.join("\n") }], changes });
    }
    return lines;
  }, [busy, commitSim]);

  const crisisResolve = useCallback((responseId: string): string[] => {
    const g = gameRef.current;
    if (!g || busy || !g.sim.crisis) return [];
    const res = resolveCrisis(g.sim, responseId);
    if (!res) return [];
    const changes = simDiff(g.sim, res.s);
    commitSim(res.s);
    setLastChanges(changes);
    setPopup({ title: "危机公关", segments: [{ kind: "system", text: res.lines.join("\n") }], changes });
    return res.lines;
  }, [busy, commitSim]);

  // MUD 世界移动：确认前往后执行——扣交通费、登记战争迷雾、推进一次世界心跳（NPC 走动 + 环境事件）
  const simMove = useCallback((roomId: string, companionId?: string, trip?: { fee: number; minutes: number; modeLabel: string }): string[] => {
    const g = gameRef.current;
    if (!g) return [];
    const plan = travelPlan(g.sim, roomId);
    if (!plan.reachable) return [plan.reason ?? "去不了那里。"];
    const fee = trip?.fee ?? plan.fee;
    const minutes = trip?.minutes ?? plan.minutes;
    // 踩地图（探索新地点）需当前时段安排的是「自由活动」；已知地点随时可回访
    const firstArrival = !(g.sim.visited ?? []).includes(roomId);
    const dow = (g.sim.day ?? 0) % 7;
    const roamingNow = (g.sim.schedule ?? [])[dow] === "freeroam";
    if (plan.explore && !roamingNow) {
      return [`今天（${weekdayName(g.sim.day)}）手头另有安排——把当天日程排成「自由活动」，才能出门踩点探索新地方。`];
    }
    const visited = firstArrival ? [...(g.sim.visited ?? []), roomId] : g.sim.visited;
    const discoveredAt = firstArrival ? { ...(g.sim.discoveredAt ?? {}), [roomId]: g.sim.day } : g.sim.discoveredAt;
    const moved: SimState = {
      ...g.sim,
      room: roomId,
      visited,
      discoveredAt,
      money: g.sim.money - fee,
      clockMin: (g.sim.clockMin ?? 480) + minutes, // 移动令当日时刻流动
    };
    const beat = tickWorld(moved);
    const via = trip?.modeLabel ? `${trip.modeLabel} · ` : "";
    const cost = fee > 0 ? `交通费 ¥${fee}` : "免费";
    const head = `${plan.explore ? "你摸索着来到" : "你来到"}${locOf(roomId)?.name ?? roomId}（${via}${cost}）。${plan.explore ? "这处地方在地图上点亮了。" : ""}`;
    // 首次踏入触发一次性场景剧情（内容池提供），随抵达一并呈现
    const intro = firstArrival ? introOf(roomId) : undefined;
    const lines = [head, ...(intro ? ["" + intro] : []), ...beat.events.map((e) => e.text)];
    // —— 同行：邀约成立时，同行者随你一并抵达，路上相处升温 ——
    let mobs = beat.mobs;
    const merge: Partial<SimState> = {};
    if (companionId && (g.sim.rel?.[companionId] ?? 0) >= 20 && (g.sim.mobs?.[companionId] ?? "") === g.sim.room) {
      mobs = { ...mobs, [companionId]: roomId };
      const name = PERSON_BY_ID[companionId]?.name ?? companionId;
      const cap = companionId === "guchen" || companionId === "songshixu" ? 1000 : 100;
      merge.rel = { ...moved.rel, [companionId]: Math.min(cap, (moved.rel?.[companionId] ?? 0) + 2) };
      merge.stress = Math.max(0, (moved.stress ?? 0) - 4);
      lines.push(`${name}与你结伴同行，一路相谈甚欢（关系 +2，压力 -4）。`);
    }
    // 移动结果同样落进对话框（故事线）
    commitSim({ ...moved, ...merge, mobs, tick: beat.tick }, lines.join("\n"));
    // 作者事件库：抵达指定地点后，先检查一次性记录与属性门槛，再按概率抽取一项自动触发。
    const fired = new Set((g.journal ?? []).filter((entry) => entry.kind === "spot").map((entry) => entry.srcId));
    const autoEvent = (g.mapEdits?.[roomId]?.events ?? []).find((event) => {
      if (!event.autoTrigger || !event.title.trim() || !event.seed.trim()) return false;
      if (event.once && fired.has(event.id)) return false;
      const statId = event.requiredStat;
      const statValue = statId ? (statId in moved.stats ? moved.stats[statId as keyof typeof moved.stats] : (moved as unknown as Record<string, number>)[statId] ?? 0) : 0;
      if (statId && statValue < (event.requiredMin ?? 0)) return false;
      return Math.random() * 100 < (event.probability ?? 100);
    });
    if (autoEvent) window.setTimeout(() => playSpotEvent(autoEvent.id), 0);
    return lines;
  }, [commitSim, playSpotEvent]);

  // 拾取/收纳地点物品（只读查看不消耗，收入行囊记录到存档）
  const simPickup = useCallback((itemId: string): string => {
    const g = gameRef.current;
    if (!g) return "";
    // 先查内容池物件，未命中再查玩家在地图编辑器里为该点位新增的自定义物件
    const it = itemsOfRoom(g.sim.room).find((x) => x.id === itemId)
      ?? customItemsOf(g, g.sim.room).find((x) => x.id === itemId);
    if (!it) return "";
    if ((g.sim.bag ?? []).includes(itemId)) return `${it.name}已经在你的行囊里了。`;
    commitSim({ ...g.sim, bag: [...(g.sim.bag ?? []), itemId] }, `你把${it.name}收进了行囊。`);
    return "";
  }, [commitSim]);

  // 背包互动：使用不消耗物品，只留下一条确定性记录；赠送会消耗物品并结算固定关系收益。
  const simUseItem = useCallback((itemId: string): string => {
    const g = gameRef.current;
    if (!g) return "";
    if (!(g.sim.bag ?? []).includes(itemId)) return "这件物品不在你的背包里。";
    const it = itemById(itemId) ?? findCustomItem(g, itemId);
    if (!it) return "找不到这件物品。";
    const msg = `你取出「${it.name}」细细端详。${it.desc}`;
    const next = { ...g.sim, log: [...g.sim.log, `【第 ${g.sim.week} 周 · 行囊】使用了${it.name}。`].slice(-40) };
    commitSim(next, msg);
    return "";
  }, [commitSim]);

  const simGiftItem = useCallback((itemId: string, personId: string): string => {
    const g = gameRef.current;
    if (!g) return "";
    if (!(g.sim.bag ?? []).includes(itemId)) return "这件物品不在你的背包里。";
    if (!(g.sim.metPeople ?? []).includes(personId)) return "要先和对方认识，才能送出礼物。";
    const it = itemById(itemId) ?? findCustomItem(g, itemId);
    const person = g.npcs.find((n) => n.id === personId);
    if (!it || !person) return "找不到这件物品或联系人。";
    const cap = personId === "guchen" || personId === "songshixu" ? 1000 : 100;
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
    const msg = `你把「${it.name}」赠给了${person.name}。关系 +5。`;
    const merged = commitSim(next, msg);
    if (merged) persist({ ...merged, npcs });
    return "";
  }, [commitSim, persist]);

  // 居家/在场活动：按内容池数值应用增益（看电视/休息/看书……看书需先买书）。
  const simActivity = useCallback((actId: string): string => {
    const g = gameRef.current;
    if (!g || busy) return "正忙，稍后再试。";
    const { next, msg, ok } = doActivity(g.sim, g.sim.room, actId);
    if (!ok) return msg;
    const changes = simDiff(g.sim, next);
    commitSim(next, msg);
    setLastChanges(changes);
    return "";
  }, [busy, commitSim]);

  // 购买标价物品（书店买书等）：扣现金、收入行囊
  const simBuy = useCallback((itemId: string): string => {
    const g = gameRef.current;
    if (!g || busy) return "正忙，稍后再试。";
    const { next, msg, ok } = buyItem(g.sim, g.sim.room, itemId);
    if (!ok) return msg;
    const changes = simDiff(g.sim, next);
    commitSim(next, msg);
    setLastChanges(changes);
    return "";
  }, [busy, commitSim]);

  // —— 车辆：4S 店购车 / 卖车（残值回收）/ 选定座驾 ——
  const buyCar = useCallback((carId: string): string => {
    const g = gameRef.current;
    if (!g || busy) return "正忙，稍后再试。";
    const c = carById(carId);
    if (!c) return "没有这款车。";
    if ((g.sim.cars ?? []).includes(carId)) return "这款车你已经拥有了。";
    if (g.sim.money < c.price) return `资金不足，还差 ¥${(c.price - g.sim.money).toLocaleString("zh-CN")}。`;
    const cars = [...(g.sim.cars ?? []), carId];
    const next = { ...g.sim, money: g.sim.money - c.price, cars, activeCar: g.sim.activeCar ?? carId };
    commitSim(next, `你在星辉 4S 店提了一辆「${c.name}」（¥${c.price.toLocaleString("zh-CN")}）。往后出行可以自己开车了。`);
    setLastChanges([`资金 -${c.price}`]);
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
    const next = { ...g.sim, money: g.sim.money + gain, cars, activeCar };
    commitSim(next, `你把「${c.name}」卖回了 4S 店，回收 ¥${gain.toLocaleString("zh-CN")}（折旧 ¥${loss.toLocaleString("zh-CN")}）。`);
    setLastChanges([`资金 +${gain}`]);
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
    commitSim(
      { ...g.sim, money: g.sim.money + soldPrice, xianyu },
      `你在咸鱼卖出了「${l.name}」，到账 ¥${soldPrice.toLocaleString("zh-CN")}。买家「${review.buyer}」给了 ${review.rating} 星好评。`,
    );
    setLastChanges([`资金 +${soldPrice}`]);
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
    if (!g) return;
    const { next, msg } = chooseArc(g.sim, pid, idx);
    const changes = simDiff(g.sim, next);
    commitSim(next);
    setLastChanges(changes);
    if (msg) setPopup({ title: "情感线推进", segments: [{ kind: "system", text: msg }], changes });
  }, [commitSim]);

  const simConfirmDating = useCallback((pid: string) => {
    const g = gameRef.current;
    if (!g) return;
    const { next, msg } = confirmDating(g.sim, pid);
    commitSim(next);
    if (msg) setPopup({ title: "定情", segments: [{ kind: "system", text: msg }], changes: [] });
  }, [commitSim]);

  // —— 手机系统：整档提交（聊天/通话逐条落库并持久化）——
  const commitGame = useCallback((next: GameState) => {
    persist(next);
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

  const endManuallyRef = useRef<((kind?: "bankrupt" | "finish" | "manual") => Promise<void>) | null>(null);

  const endManually = useCallback(async (kind?: "bankrupt" | "finish" | "manual") => {
    const g = gameRef.current;
    if (!g) return;
    setBusy(true);
    // 依据结局类型给出定级：破产走破产结局，其余按名气/口碑/奖项分档
    const rank = kind === "bankrupt" ? bankruptEnding(g.sim) : endingText(g.sim);
    let epilogue = "";
    try {
      if (isConfigured(cfg)) {
        epilogue = await complete(cfg, [
          { role: "system", content: "你是深情细腻的传记作者。" },
          {
            role: "user",
            content: `请为这位女明星写一篇不少于1000字的生平后记与后传，语言细腻感人，分阶段回顾她的一生（初出茅庐、艰难打拼、成名、情感与抉择、暮年回望），并在结尾呼应前文的记忆细节。\n\n【结局定级】${rank.title}——${rank.body}\n请让整篇后记的基调、成就与遗憾都与这个结局定级相符。\n\n主角：${g.player.name}，${g.player.description}\n人生记忆摘要：${g.memory}\n关键履历：${g.player.history.map((h) => h.title + "：" + h.detail).join("；")}\n重要关系：${g.npcs.map((n) => n.name + "(" + n.relation + ",好感" + n.affinity + ")").join("；")}`,
          },
        ]);
      }
    } catch {
      /* 退回本地后记 */
    }
    if (!epilogue.trim()) epilogue = `${rank.body}\n\n${mockEpilogue(g.player)}`;
    persist({ ...g, ended: true, epilogue, endingTitle: rank.title, endingTag: rank.body });
    setBusy(false);
    setScreen("ending");
  }, [cfg, persist]);
  endManuallyRef.current = endManually;

  const value = useMemo<Ctx>(
    () => ({
      cfg, setCfg, theme, setTheme, screen, go, game, busy, lastChanges, popup, setPopup,
      startNew, loadState, submit, setPlayerAvatar, setNpcAvatar, setRelValue, setNpcDim, saveNow, regenerate, autosaveOn, setAutosaveOn, endManually, setWorldRules, setWorldBook, setMapEdits,
      setSchedule, runWeekNow, endDayNow, equipTitle, simVisit, simEvent, simMove, simPickup, simUseItem, simGiftItem, simActivity, simBuy, simAskIntel, simNegotiate, simAskOffers, simChooseArc, simConfirmDating,
      projApply, projSign, projNegotiate, projPromote, projWorkday, simContact, simConfess, simMeetProducer, simAskProducer,
      personaDeclare, personaAct, crisisResolve, resolveBreach, buyCar, sellCar, setActiveCar, xianyuList, xianyuDelist, xianyuSell, commitGame, phoneExchange,
      playSpotEvent, playQuest, toggleFav, removeJournal, exportJournal,
    }),
    [cfg, setCfg, theme, setTheme, screen, go, game, busy, lastChanges, popup, startNew, loadState, submit, setPlayerAvatar, setNpcAvatar, setRelValue, setNpcDim, saveNow, regenerate, autosaveOn, setAutosaveOn, endManually, setWorldRules, setWorldBook, setMapEdits, setSchedule, runWeekNow, endDayNow, equipTitle, simVisit, simEvent, simMove, simPickup, simUseItem, simGiftItem, simActivity, simBuy, simAskIntel, simNegotiate, simAskOffers, simChooseArc, simConfirmDating, projApply, projSign, projNegotiate, projPromote, projWorkday, simContact, simConfess, simMeetProducer, simAskProducer, personaDeclare, personaAct, crisisResolve, resolveBreach, buyCar, sellCar, setActiveCar, xianyuList, xianyuDelist, xianyuSell, commitGame, phoneExchange, playSpotEvent, playQuest, toggleFav, removeJournal, exportJournal],
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
