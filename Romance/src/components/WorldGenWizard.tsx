/**
 * 创作游戏 · 生成世界向导
 * 第 1 步：作品名称 / 故事设定 / AI 线路 / 勾选本次 AI 生成模组
 * 点击「进入完整编辑器」后：按勾选真实调用 AI 分模组生成（温和进度条）→ 打开完整编辑器
 * 未勾选模组不请求、不覆盖；取消保留已完成内容。进度页不提供失败重试入口（时间与推进等须生成时自愈）。
 * 再进入：已生成完成（step2）刷新直达编辑器；未生成则停设定入口。按用户+作品隔离会话。
 */
import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Mod } from "../mods/types";
import {
  DEFAULT_WORLD_GEN_EDITOR_STEP_IDS,
  WORLD_GEN_ENGINES,
  WORLD_FORBID_MAX,
  WORLD_SETTING_MAX,
  WORLD_TITLE_MAX,
  contentIdsFromEditorSteps,
  defaultWorldGenStep1,
  draftModFromWorldGen,
  groupWorldGenEditorStepsByTier,
  isWorldGenCoreStep,
  normalizeWorldGenDraft,
  normalizeWorldGenStep1,
  validateWorldGenStep1,
  WORLD_GEN_SCOPE_VERSION,
  type WorldGenDraft,
  type WorldGenEngineId,
  type WorldGenEditorStep,
  type WorldGenStep1,
} from "../lib/worldGenWizard";
import {
  estimateWorldGenEtaSeconds,
  formatWorldGenEtaLabel,
  formatWorldGenEtaParts,
  makeInitialProgress,
  pickWorldGenScrollTargetId,
  importWithStaleChunkReload,
  isStaleChunkLoadErrorMessage,
  progressHasAuthFailure,
  progressHasStaleChunkFailure,
  reloadOnceForStaleChunk,
  runWorldGenModules,
  STALE_CHUNK_RELOAD_KEY,
  worldGenBatchProgressCounts,
  worldGenEtaDeadlineMs,
  worldGenEtaDisplaySeconds,
  worldGenEtaNeedsRecalibrate,
  WORLD_GEN_PARALLEL_LIMIT,
  type WorldGenProgress,
} from "../lib/worldGenGenerate";
import {
  clearWorldGenPersistBlock,
  clearWorldGenTrimRecover,
  demoteWorldGenSessionToStep1,
  isWorldGenPersistBlocked,
  isWorldGenTrimRecovering,
  loadWorldGenSession,
  loadWorldGenSessionAsync,
  saveWorldGenSession,
  wantsResumeEditor,
} from "../lib/worldGenSession";
import { sanitizeModStrings } from "../lib/sanitizeModStrings";
import { readFunloomAuthToken } from "../lib/platformAvatarLibrary";
import { discardDraftById, fmtDraftTime, peekDraft, resolveSavedVersionAt, writeSavedVersionAt } from "../lib/useDraft";
import {
  commitRomancePlatformDraft,
  readRomancePlatformDraftId,
  scheduleRomancePlatformDraftSync,
} from "../lib/platformRomanceDraft";
import {
  fitWorldGenSettingTextarea,
  gateWorldGenSettingSubmit,
  isWorldGenForbidOverLimit,
  isWorldGenSettingOverLimit,
  truncateWorldGenSetting,
  WORLD_GEN_SETTING_TRUNCATE_CONFIRM,
  worldGenForbidLen,
  worldGenSettingLen,
} from "../lib/worldGenSettingField";
import { IconCheck } from "../lib/icons";
import { useConfirm } from "./EditorKit";
import { Modal } from "./ui";

/** 功能注释：编辑器/工坊拆 chunk；发版后旧 hash 404 时自动硬刷，避免「继续填写草稿」红屏 */
const ModEditorPanel = lazy(() => importWithStaleChunkReload(() => import("./ModEditorPanel")));
const ModWorkshop = lazy(() => importWithStaleChunkReload(() => import("./ModWorkshop")));

function isTrimCrash(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message || error || "");
  return /\.trim is not a function|trim is not a function/i.test(msg);
}

/**
 * 功能注释：编辑器内 trim 崩页就地退回第 1 步，不经 App 全屏 ErrorBoundary，避免「报错闪一下又进编辑器」。
 */
class EditorTrimBoundary extends Component<
  { children: ReactNode; s1: WorldGenStep1; onDemote: () => void },
  { crashed: boolean }
> {
  state = { crashed: false };
  static getDerivedStateFromError(error: Error) {
    return isTrimCrash(error) ? { crashed: true } : null;
  }
  componentDidCatch(error: Error) {
    if (!isTrimCrash(error)) return;
    try {
      demoteWorldGenSessionToStep1(this.props.s1);
    } catch {
      /* ignore */
    }
    this.props.onDemote();
  }
  render() {
    if (this.state.crashed) {
      return (
        <div className="world-gen-shell flex min-h-[40vh] flex-col items-center justify-center px-6 text-center">
          <p className="text-sm text-ink-soft">草稿字段异常，正在退回设定页…</p>
        </div>
      );
    }
    return this.props.children;
  }
}

type Props = {
  onBack: () => void;
  /** 保存/关闭编辑器后回调（上层可清状态）；savedName 有值表示已保存 */
  onComplete: (mod: Mod, draft: WorldGenDraft, savedName?: string) => void;
};

const hint = "text-[11.5px] leading-relaxed text-ink-soft";

/** 功能注释：进度态文案——完成用「已完成」（绿）；进行中不单写「进行中」，具体产出见 detail 行 */
function moduleStatusLabel(status: string) {
  if (status === "done") return "已完成";
  if (status === "failed") return "失败";
  if (status === "running") return "生成中";
  return "等待";
}

function moduleStatusClass(status: string) {
  if (status === "done") return "world-gen-mod-status is-done";
  if (status === "failed") return "world-gen-mod-status is-failed";
  if (status === "running") return "world-gen-mod-status is-running";
  return "world-gen-mod-status";
}

function buildDraft(s1: WorldGenStep1): WorldGenDraft {
  const n = normalizeWorldGenStep1(s1);
  return {
    ...n,
    editorStepIds: [...n.editorStepIds],
    contentIds: contentIdsFromEditorSteps(n.editorStepIds),
  };
}

function buildSeedMod(draft: WorldGenDraft): Mod {
  const raw = draftModFromWorldGen(draft);
  const { meta: _m, ...mod } = raw;
  void _m;
  return mod as Mod;
}

/**
 * 功能注释：首屏从会话启动。
 * 已生成/已保存且 step=2（或 URL resume=1）→ 直接回编辑器，刷新不丢完成态。
 * 仅有设定、尚未生成 → 停第 1 步；未保存填写只在本机 draft 键。
 */
function bootFromSession() {
  const s = loadWorldGenSession();
  if (!s) {
    return {
      step: 1 as const,
      s1: defaultWorldGenStep1(),
      mod: null as Mod | null,
      draft: null as WorldGenDraft | null,
      resumeMod: false,
      pendingHeavy: false,
    };
  }
  const s1 = normalizeWorldGenStep1(s.s1);
  const draft = s.draft ? normalizeWorldGenDraft(s.draft) : null;
  // 功能注释：本机会话里的旧 AI 脏 mod 必须先清洗，否则进编辑器仍会 .trim 崩页
  const mod = s.mod ? sanitizeModStrings(s.mod) : null;
  const resumeMod = !!(mod && draft);
  const pendingHeavy = !!s.heavyInIdb && !resumeMod;
  // 功能注释：生成完成态刷新直达编辑器；书架 resume=1 同理
  const resumeEditor =
    resumeMod && (s.step === 2 || wantsResumeEditor());
  return {
    step: (resumeEditor ? 2 : 1) as 1 | 2,
    s1,
    mod: resumeMod ? mod : null,
    draft: resumeMod ? draft : null,
    resumeMod,
    pendingHeavy,
  };
}

export default function WorldGenWizard({ onBack, onComplete }: Props) {
  const boot = useMemo(() => bootFromSession(), []);
  const [step, setStep] = useState<1 | 2>(boot.step);
  const [s1, setS1] = useState<WorldGenStep1>(boot.s1);
  const [mod, setMod] = useState<Mod | null>(boot.mod);
  const [draft, setDraft] = useState<WorldGenDraft | null>(boot.draft);
  const [workshop, setWorkshop] = useState<{ mod: Mod; isNew: boolean } | null>(null);
  const [confirm, confirmEl] = useConfirm();
  const settingRef = useRef<HTMLTextAreaElement | null>(null);
  const forbidRef = useRef<HTMLTextAreaElement | null>(null);
  /** 功能注释：仅「继续填写草稿」后带入分区；默认从表单开头 */
  const [editorBootGroup, setEditorBootGroup] = useState<string | undefined>(undefined);
  /**
   * 功能注释：入口已选定草稿策略时交给编辑器执行，避免进表单后再弹一次。
   * continue = 打开草稿并停在上次位置；saved = 删草稿、已保存版本、表单开头。
   */
  const [editorDraftChoice, setEditorDraftChoice] = useState<"continue" | "saved" | null>(null);
  /** 功能注释：入口草稿二选一；选定前不挂载编辑器表单；savedAt 供弹窗写出已保存版本时间 */
  const [entranceDraftGate, setEntranceDraftGate] = useState<null | {
    pendingAt: number;
    savedAt: number | null;
    stale: boolean;
  }>(null);
  const [err, setErr] = useState("");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<WorldGenProgress | null>(null);
  /** 功能注释：已完成项可点开查看生成结果摘要 */
  const [expandedSummaryIds, setExpandedSummaryIds] = useState<Set<string>>(() => new Set());
  /** 功能注释：生成本批开始时间；ETA 用 deadline 每秒倒计，进度变化时按速率重标定 */
  const genStartedAtRef = useRef<number>(0);
  const etaDeadlineRef = useRef<number>(0);
  const etaFinishedRef = useRef<number>(-1);
  const [etaTick, setEtaTick] = useState(0);
  /** 功能注释：模组进度列表容器，滚动到当前「进行中」行 */
  const modListRef = useRef<HTMLUListElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const draftRef = useRef<WorldGenDraft | null>(boot.draft);
  /** 功能注释：会话基线 = 上次生成或点保存的版本；未保存填写不得写入此 ref */
  const modRef = useRef<Mod | null>(boot.mod);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 功能注释：把向导进度写入会话；刷新后 App 凭此重开向导停在入口，而非游戏 */
  const persistNow = useCallback(() => {
    // 功能注释：恢复期禁止写回 step2/脏 mod；但必须允许落盘纯 step1，否则 1.5s 清 recover 标记后磁盘仍是脏编辑器，一刷新又崩
    if (isWorldGenPersistBlocked() || isWorldGenTrimRecovering()) {
      if (step !== 1 || modRef.current || draftRef.current) return;
    }
    // 功能注释：会话只记设定 + 已保存/已生成基线；滚动与分区不记成作品停留位（草稿自带 cursor）
    saveWorldGenSession({
      step: step === 2 ? 2 : 1,
      s1,
      draft: draftRef.current,
      mod: modRef.current,
      scrollY: 0,
      editorGroup: undefined,
      updatedAt: Date.now(),
    });
  }, [step, s1]);

  const schedulePersist = useCallback(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      persistTimer.current = null;
      persistNow();
    }, 280);
  }, [persistNow]);

  useEffect(() => {
    schedulePersist();
  }, [step, s1, mod, draft, schedulePersist]);

  // 功能注释：进向导就预取编辑器 chunk；旧 tab 握着失效 hash 时立刻硬刷，不必等点「继续填写草稿」才红屏
  useEffect(() => {
    void importWithStaleChunkReload(() => import("./ModEditorPanel"));
  }, []);

  // 功能注释：trim 恢复仍强制 step1；正常刷新保留 step2 完成态并落盘。IDB 补齐大体积 mod。
  useEffect(() => {
    if (isWorldGenTrimRecovering() || isWorldGenPersistBlocked()) {
      demoteWorldGenSessionToStep1(boot.s1);
      modRef.current = null;
      draftRef.current = null;
      setMod(null);
      setDraft(null);
      setStep(1);
    } else if (boot.resumeMod && boot.mod && boot.draft) {
      modRef.current = boot.mod;
      draftRef.current = boot.draft;
      // 功能注释：按当前 step 落盘（2=编辑器完成态），禁止再强行写成 step1
      persistNow();
    }
    let cancelled = false;
    void (async () => {
      if (boot.resumeMod && !boot.pendingHeavy) return;
      const full = await loadWorldGenSessionAsync();
      if (cancelled || !full?.mod || !full?.draft) return;
      const clean = sanitizeModStrings(full.mod);
      const d = normalizeWorldGenDraft(full.draft);
      modRef.current = clean;
      draftRef.current = d;
      setMod(clean);
      setDraft(d);
      if (full.step === 2 || wantsResumeEditor()) setStep(2);
    })();
    const t = window.setTimeout(() => {
      if (isWorldGenTrimRecovering() || isWorldGenPersistBlocked()) {
        demoteWorldGenSessionToStep1(boot.s1);
      }
      clearWorldGenPersistBlock();
      clearWorldGenTrimRecover();
      try {
        sessionStorage.removeItem(STALE_CHUNK_RELOAD_KEY);
        sessionStorage.removeItem("star:wgStaleChunkReload");
      } catch {
        /* ignore */
      }
    }, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅首屏处理恢复挡板 / IDB 补齐
  }, []);

  /** 功能注释：编辑器 trim 崩 → 丢弃脏 mod，退回第 1 步并提示重生成 */
  const demoteFromEditorTrim = useCallback(() => {
    demoteWorldGenSessionToStep1(s1);
    modRef.current = null;
    draftRef.current = null;
    setMod(null);
    setDraft(null);
    setWorkshop(null);
    setStep(1);
    setErr("上次生成的草稿字段不兼容，已退回设定页。请调整设定后重新生成（作品名与故事设定已保留）。");
  }, [s1]);

  // 功能注释：生成中每秒刷新预计耗时，避免数字卡住
  useEffect(() => {
    if (!generating || !progress || progress.cancelled) return;
    const t = window.setInterval(() => setEtaTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [generating, progress, progress?.cancelled]);

  const runningModuleKey = useMemo(() => {
    if (!progress?.modules?.length) return "";
    return progress.modules
      .filter((m) => m.status === "running")
      .map((m) => m.id)
      .join("|");
  }, [progress?.modules]);

  /** 功能注释：整批结束后若有失败，用失败 id 串触发一次滚入 + 强调动画 */
  const settledFailKey = useMemo(() => {
    if (generating || !progress?.modules?.length || !progress.failedCount) return "";
    return progress.modules
      .filter((m) => m.status === "failed")
      .map((m) => m.id)
      .join("|");
  }, [generating, progress?.modules, progress?.failedCount]);

  const scrollModRowIntoView = useCallback((targetId: string, attention: boolean) => {
    if (!modListRef.current) return;
    // 功能注释：模组 id 均为安全字符；无 CSS.escape 时退回原串，避免 WebView 抛错
    const safeId =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(targetId)
        : targetId.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const row = modListRef.current.querySelector(
      `[data-wg-mod-id="${safeId}"]`,
    ) as HTMLElement | null;
    if (!row) return;
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    row.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: reduceMotion ? "auto" : "smooth",
    });
    if (!attention || reduceMotion) return;
    row.classList.remove("is-attention");
    // 功能注释：强制重启动画，避免同批二次失败时 class 不刷新
    void row.offsetWidth;
    row.classList.add("is-attention");
    window.setTimeout(() => row.classList.remove("is-attention"), 2600);
  }, []);

  // 功能注释：进行中项变化时，把列表滚到首个 running，配合行高亮动画
  useEffect(() => {
    if (!generating || !runningModuleKey) return;
    const targetId = pickWorldGenScrollTargetId(progress?.modules, { prefer: "running" });
    if (!targetId) return;
    scrollModRowIntoView(targetId, false);
  }, [generating, runningModuleKey, progress?.modules, scrollModRowIntoView]);

  // 功能注释：生成结束有失败时，立刻滚到首个失败行并播放强调动画，避免用户还停在列表顶部
  useEffect(() => {
    if (!settledFailKey) return;
    const targetId = pickWorldGenScrollTargetId(progress?.modules, { prefer: "failed" });
    if (!targetId) return;
    const t = window.setTimeout(() => scrollModRowIntoView(targetId, true), 80);
    return () => window.clearTimeout(t);
  }, [settledFailKey, progress?.modules, scrollModRowIntoView]);

  const markGenStart = () => {
    const now = Date.now();
    genStartedAtRef.current = now;
    etaFinishedRef.current = -1;
    etaDeadlineRef.current = 0;
    setEtaTick(0);
  };

  /** 功能注释：完成数变化或倒计时耗尽时重估剩余并写入 deadline，避免卡在「1秒」 */
  const syncEtaDeadline = (total: number, finished: number) => {
    const now = Date.now();
    const elapsedMs = genStartedAtRef.current ? now - genStartedAtRef.current : 0;
    const remaining = estimateWorldGenEtaSeconds({
      total,
      finished,
      elapsedMs,
      parallelLimit: WORLD_GEN_PARALLEL_LIMIT,
    });
    etaDeadlineRef.current = worldGenEtaDeadlineMs(remaining, now);
    etaFinishedRef.current = finished;
  };

  useEffect(() => {
    window.addEventListener("pagehide", persistNow);
    window.addEventListener("beforeunload", persistNow);
    return () => {
      window.removeEventListener("pagehide", persistNow);
      window.removeEventListener("beforeunload", persistNow);
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [persistNow]);

  const tieredModules = useMemo(() => groupWorldGenEditorStepsByTier(), []);
  const selected = useMemo(() => new Set(s1.editorStepIds ?? []), [s1.editorStepIds]);
  // 功能注释：勾选区只渲染基础世界；计数 = 已勾 / 基础可选总数
  const { selectedCount, allCount } = useMemo(() => {
    const coreIds = tieredModules.core.flatMap((g) => g.steps.map((s) => s.id));
    return {
      selectedCount: coreIds.filter((id) => selected.has(id)).length,
      allCount: coreIds.length,
    };
  }, [tieredModules, selected]);

  const patch1 = (p: Partial<WorldGenStep1>) => {
    setS1((prev) => ({ ...prev, ...p }));
    setErr("");
  };

  const toggleModule = (id: string) => {
    // 功能注释：扩展玩法不在此勾选生成，忽略误触
    if (!isWorldGenCoreStep(id)) return;
    setS1((prev) => {
      const set = new Set(prev.editorStepIds ?? []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      const editorStepIds = DEFAULT_WORLD_GEN_EDITOR_STEP_IDS.filter((x) => set.has(x));
      return {
        ...prev,
        editorStepIds,
        contentIds: contentIdsFromEditorSteps(editorStepIds),
        scopeVersion: WORLD_GEN_SCOPE_VERSION,
      };
    });
    setErr("");
  };

  /** 功能注释：全选 = 基础世界模组；扩展玩法只走编辑器「添加玩法」 */
  const selectAllModules = () => {
    patch1({
      editorStepIds: [...DEFAULT_WORLD_GEN_EDITOR_STEP_IDS],
      contentIds: contentIdsFromEditorSteps(DEFAULT_WORLD_GEN_EDITOR_STEP_IDS),
      scopeVersion: WORLD_GEN_SCOPE_VERSION,
    });
  };

  const clearAllModules = () => {
    patch1({ editorStepIds: [], contentIds: [] });
  };

  const renderModuleGroup = (groups: { group: string; steps: WorldGenEditorStep[] }[]) =>
    groups.map(({ group, steps }) => (
      <div key={group}>
        <p className="mb-1.5 text-[11px] font-bold tracking-wide text-ink-soft">{group}</p>
        <div className="space-y-1.5">
          {steps.map((s) => {
            const on = selected.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggleModule(s.id)}
                className={`world-gen-choice ${on ? "is-on" : ""}`}
              >
                <span className="world-gen-choice-check" aria-hidden>
                  {on ? <IconCheck size={11} /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold text-ink">{s.name}</span>
                  <span className={`block ${hint}`}>{s.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    ));

  const WORLD_GEN_DRAFT_ID = "mod.new";

  const openEditor = useCallback((m: Mod, d: WorldGenDraft, opts?: { group?: string; draftChoice?: "continue" | "saved" | null; wipeLocalDraft?: boolean }) => {
    // 功能注释：重新生成进入时清掉旧本机草稿，避免拿过期草稿盖住新生成的已保存基线
    if (opts?.wipeLocalDraft || opts?.draftChoice === "saved") {
      discardDraftById(WORLD_GEN_DRAFT_ID);
    }
    setMod(m);
    setDraft(d);
    modRef.current = m;
    draftRef.current = d;
    setEditorBootGroup(opts?.group);
    setEditorDraftChoice(opts?.draftChoice ?? null);
    setEntranceDraftGate(null);
    setGenerating(false);
    setProgress(null);
    setStep(2);
    // 功能注释：进入编辑器立刻落盘（已保存/已生成基线 + step2）；停留位不写会话
    const at = Date.now();
    writeSavedVersionAt(WORLD_GEN_DRAFT_ID, at);
    saveWorldGenSession({
      step: 2,
      s1,
      draft: d,
      mod: m,
      scrollY: 0,
      editorGroup: undefined,
      updatedAt: at,
    });
  }, [s1]);

  /**
   * 功能注释：未点保存的编辑只进 useDraft，禁止写回会话冒充已保存作品。
   * 会话基线仅在 onCommitted / 生成完成时更新。
   */
  const onEditorLiveChange = useCallback((next: Mod) => {
    // 功能注释：本机草稿仍只走 useDraft；平台书架草稿防抖 PATCH 同一 draftId，禁止再 create
    const platformDraftId = readRomancePlatformDraftId();
    if (platformDraftId) {
      scheduleRomancePlatformDraftSync(platformDraftId, next.name);
    }
  }, []);

  /** 功能注释：点保存成功后更新会话基线（已保存版本）并记下保存时刻 */
  const onEditorCommitted = useCallback(
    (committed: Mod) => {
      modRef.current = committed;
      setMod(committed);
      writeSavedVersionAt(WORLD_GEN_DRAFT_ID, Date.now());
      if (committed.id) writeSavedVersionAt(`mod.${committed.id}`, Date.now());
      schedulePersist();
      const platformDraftId = readRomancePlatformDraftId();
      if (platformDraftId) {
        void commitRomancePlatformDraft(platformDraftId, committed.name);
      }
    },
    [schedulePersist],
  );

  /**
   * 功能注释：从入口继续编辑。有差异草稿先在入口弹窗；选定前不打开表单、不跳上次位置。
   */
  const continueExistingWork = useCallback(() => {
    const saved = modRef.current;
    const d = draftRef.current;
    if (!saved || !d) return;
    const baseline = JSON.stringify(saved);
    const pending = peekDraft<Mod>(WORLD_GEN_DRAFT_ID, baseline);
    if (!pending) {
      void importWithStaleChunkReload(() => import("./ModEditorPanel"))
        .then(() => openEditor(saved, d, { group: undefined, draftChoice: null }))
        .catch((e) => {
          setErr(e instanceof Error ? e.message : "加载编辑器失败，请强制刷新后重试");
        });
      return;
    }
    // 功能注释：已保存版本时间 = 本机记下的保存时刻，否则用会话 updatedAt
    const sessionAt = loadWorldGenSession()?.updatedAt ?? null;
    setEntranceDraftGate({
      pendingAt: pending.at,
      savedAt: resolveSavedVersionAt(WORLD_GEN_DRAFT_ID, sessionAt),
      stale: pending.base !== baseline,
    });
  }, [openEditor]);

  /**
   * 功能注释：先确保 ModEditorPanel chunk 可加载再开表单。
   * 发版后旧 hash 404 时 importWithStaleChunkReload 会硬刷并挂起，避免点「继续填写草稿」直接 Failed to fetch。
   */
  const acceptEntranceDraft = useCallback(() => {
    const saved = modRef.current;
    const d = draftRef.current;
    if (!saved || !d) return;
    const pending = peekDraft<Mod>(WORLD_GEN_DRAFT_ID, JSON.stringify(saved));
    void importWithStaleChunkReload(() => import("./ModEditorPanel"))
      .then(() => {
        openEditor(saved, d, {
          group: pending?.cursor?.group,
          draftChoice: "continue",
        });
      })
      .catch((e) => {
        setErr(e instanceof Error ? e.message : "加载编辑器失败，请强制刷新后重试");
      });
  }, [openEditor]);

  const acceptEntranceSaved = useCallback(() => {
    const saved = modRef.current;
    const d = draftRef.current;
    if (!saved || !d) return;
    discardDraftById(WORLD_GEN_DRAFT_ID);
    void importWithStaleChunkReload(() => import("./ModEditorPanel"))
      .then(() => {
        openEditor(saved, d, { group: undefined, draftChoice: "saved" });
      })
      .catch((e) => {
        setErr(e instanceof Error ? e.message : "加载编辑器失败，请强制刷新后重试");
      });
  }, [openEditor]);

  // 功能注释：故事设定 / 禁止生成高度跟字数走，切换回第 1 步或粘贴长文后重算
  useEffect(() => {
    if (step !== 1) return;
    fitWorldGenSettingTextarea(settingRef.current);
    fitWorldGenSettingTextarea(forbidRef.current);
  }, [step, s1.setting, s1.forbidGen]);

  /** 第 1→生成→2：校验后真实调用 AI；禁止未请求就灌模板内容 */
  const goEditor = async () => {
    // 功能注释：超限闸门——勾选 AI 放行润色；未勾选须确认截断，不能照常提交
    const gate = gateWorldGenSettingSubmit({ setting: s1.setting, aiPolish: s1.aiPolish });
    let working = s1;
    if (!gate.ok) {
      if ("needTruncateConfirm" in gate && gate.needTruncateConfirm) {
        const ok = await confirm(WORLD_GEN_SETTING_TRUNCATE_CONFIRM, {
          title: "故事设定超长",
          ok: "截断并继续",
          danger: true,
        });
        if (!ok) return;
        const truncated = truncateWorldGenSetting(s1.setting);
        working = { ...s1, setting: truncated };
        setS1(working);
      } else if ("error" in gate && gate.error) {
        setErr(gate.error);
        return;
      } else {
        return;
      }
    }
    const normalized = normalizeWorldGenStep1(working);
    if (normalized.editorStepIds.join("\0") !== (working.editorStepIds ?? []).join("\0")) {
      setS1(normalized);
    }
    const msg = validateWorldGenStep1(normalized);
    if (msg) {
      setErr(msg);
      return;
    }
    // 功能注释：生成世界走平台 LLM + 积分，只需登录；不要求局内「AI 配置」
    if (!readFunloomAuthToken()) {
      setErr("请先登录平台账号后再生成世界。");
      return;
    }
    const d = buildDraft(normalized);
    const seed = buildSeedMod(d);
    const ctl = new AbortController();
    abortRef.current = ctl;
    markGenStart();
    setGenerating(true);
    setProgress(makeInitialProgress(d.editorStepIds));
    setErr("");
    draftRef.current = d;
    modRef.current = seed;
    try {
      const result = await runWorldGenModules({
        draft: d,
        seedMod: seed,
        moduleIds: d.editorStepIds,
        signal: ctl.signal,
        onProgress: setProgress,
      });
      modRef.current = result.mod;
      setProgress(result.progress);
      // 功能注释：发版后旧 chunk 404 须硬刷新，禁止当成生成失败进空编辑器
      if (!result.cancelled && progressHasStaleChunkFailure(result.progress)) {
        setGenerating(false);
        if (reloadOnceForStaleChunk()) return;
        setErr("页面资源已更新，请强制刷新（Ctrl/Cmd+Shift+R）后再生成。");
        return;
      }
      // 功能注释：有失败或取消时停在进度面板，便于重试；全部成功再进编辑器
      if (!result.cancelled && result.progress.failedCount === 0) {
        openEditor(result.mod, d, { wipeLocalDraft: true });
      } else {
        setGenerating(false);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "生成失败";
      if (isStaleChunkLoadErrorMessage(msg)) {
        if (reloadOnceForStaleChunk(msg)) return;
        setErr("页面资源已更新，请强制刷新（Ctrl/Cmd+Shift+R）后再生成。");
      } else {
        setErr(msg);
      }
      setGenerating(false);
      setProgress(null);
    } finally {
      abortRef.current = null;
    }
  };

  const cancelGen = () => {
    abortRef.current?.abort();
  };

  const continueToEditor = () => {
    const m = modRef.current;
    const d = draftRef.current;
    if (!m || !d) return;
    openEditor(m, d, { wipeLocalDraft: true });
  };

  /** 功能注释：未登录时「知道了」要拉起平台登录，不能只关掉提示 */
  const dismissErr = () => {
    const needLogin = /请先登录平台账号/.test(err);
    setErr("");
    if (needLogin && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("funloom:open-auth"));
    }
  };

  /** 功能注释：校验失败用居中弹窗，避免底栏旁小字条被挡住、难发现。 */
  const errModal = err ? (
    <Modal title="还差一步" onClose={() => setErr("")} heavyBackdrop>
      <p className="text-[14px] leading-relaxed text-ink" role="alert">
        {err}
      </p>
      <div className="mt-5 flex justify-end">
        <button
          type="button"
          autoFocus
          onClick={dismissErr}
          className="rounded-full bg-ink px-5 py-2 text-[13.5px] font-bold text-paper transition hover:brightness-110"
        >
          知道了
        </button>
      </div>
    </Modal>
  ) : null;

  /* —— 真实生成进度面板（非假百分比） —— */
  if (progress && step === 1) {
    const pct = progress.total
      ? Math.round(((progress.doneCount + progress.failedCount) / progress.total) * 100)
      : 0;
    const running = generating && !progress.cancelled;
    // 功能注释：列表按细项计完成度；预计耗时按大类批次数（同类合并请求）
    const batchStats = worldGenBatchProgressCounts(progress.modules);
    const finished = batchStats.finished;
    const remainingMods = Math.max(0, batchStats.total - finished);
    // etaTick：每秒刷新；完成数变化或截止已过仍有剩余时重标定（否则会长期显示 1 秒）
    void etaTick;
    if (
      running &&
      worldGenEtaNeedsRecalibrate({
        deadlineMs: etaDeadlineRef.current,
        remainingModules: remainingMods,
        finishedChanged: etaFinishedRef.current !== finished,
        hasDeadline: !!etaDeadlineRef.current,
      })
    ) {
      syncEtaDeadline(batchStats.total, finished);
    }
    const etaSec = running
      ? worldGenEtaDisplaySeconds({
          deadlineMs: etaDeadlineRef.current,
          remainingModules: remainingMods,
        })
      : 0;
    const etaParts = formatWorldGenEtaParts(etaSec);
    return (
      <div className="world-gen-shell world-gen-progress-stage">
        <div className="world-gen-progress-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="world-gen-kicker">创作游戏 · 生成中</p>
              <h1 className="world-gen-title" style={{ fontSize: "1.35rem" }}>
                正在为世界填充模组
              </h1>
            </div>
            {running ? (
              <div
                className="world-gen-eta"
                aria-live="polite"
                /* 功能注释：不足 1 分只报秒，避免「0分 25秒」 */
                aria-label={`预计耗时 ${formatWorldGenEtaLabel(etaParts)}`}
                title="按合并请求（大类）完成速度估算；慢请求超时会自动重估，仅供参考"
              >
                <p className="world-gen-eta-label">预计耗时</p>
                <p className="world-gen-eta-value">
                  {etaParts.minutes > 0 ? (
                    <>
                      <span className="world-gen-eta-num">{etaParts.minutes}</span>
                      <span className="world-gen-eta-unit">分</span>
                      <span className="world-gen-eta-num">
                        {String(etaParts.seconds).padStart(2, "0")}
                      </span>
                    </>
                  ) : (
                    <span className="world-gen-eta-num">{etaParts.seconds}</span>
                  )}
                  <span className="world-gen-eta-unit">秒</span>
                </p>
              </div>
            ) : null}
          </div>
          <p className="world-gen-lead" style={{ marginTop: "0.65rem" }}>
            {progress.label}
          </p>

          {!running && progressHasStaleChunkFailure(progress) ? (
            <div
              className="mt-3 rounded-xl border border-danger/30 bg-danger/5 px-3 py-2.5 text-[12.5px] leading-relaxed text-ink"
              role="alert"
            >
              <p className="font-bold text-danger">页面资源已更新</p>
              <p className="mt-1 text-ink-soft">
                当前标签页还在用旧版本脚本（动态模块 404），不是 AI 生成失败。请强制刷新后再点「进入完整编辑器」，不要进空编辑器。
              </p>
              <button
                type="button"
                className="world-gen-cta mt-2"
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set("_r", String(Date.now()));
                  window.location.replace(url.toString());
                }}
              >
                立即刷新
              </button>
            </div>
          ) : null}
          {!running && !progressHasStaleChunkFailure(progress) && progressHasAuthFailure(progress) ? (
            <div
              className="mt-3 rounded-xl border border-danger/30 bg-danger/5 px-3 py-2.5 text-[12.5px] leading-relaxed text-ink"
              role="alert"
            >
              <p className="font-bold text-danger">已停止后续请求</p>
              <p className="mt-1 text-ink-soft">
                生成世界使用平台 AI（登录账号 + KK 币），无需单独配置 API Key。请确认已登录且积分充足后，点「返回」再重新生成。
              </p>
            </div>
          ) : null}

          <div
            className={`world-gen-bar${running ? " is-live" : ""}`}
            role="progressbar"
            aria-valuenow={progress.doneCount}
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-label={progress.label}
          >
            <i style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-[11.5px] tabular-nums text-ink-soft">
            已完成 {progress.doneCount}/{progress.total}
            {progress.failedCount ? ` · 失败 ${progress.failedCount}` : ""}
            {progress.stoppedByAuth ? " · 已提前停止" : ""}
          </p>

          <ul ref={modListRef} className="world-gen-mod-list text-[12.5px]">
            {progress.modules.map((m) => {
              const summaryOpen = expandedSummaryIds.has(m.id);
              return (
              <li
                key={m.id}
                data-wg-mod-id={m.id}
                data-wg-status={m.status}
                data-wg-detail={m.detail || ""}
                className={`world-gen-mod-row${m.status === "running" ? " is-running" : ""}${
                  m.status === "done" ? " is-done" : ""
                }${m.status === "failed" ? " is-failed" : ""}`}
              >
                <span className={moduleStatusClass(m.status)}>{moduleStatusLabel(m.status)}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-ink">{m.name}</span>
                  {m.status === "running" && m.detail ? (
                    <span className="world-gen-mod-detail mt-0.5 block text-[11px] text-ink-soft">{m.detail}</span>
                  ) : null}
                  {m.status === "done" && m.summary ? (
                    <button
                      type="button"
                      className="world-gen-mod-summary-toggle mt-0.5 block text-left text-[11px] text-jade"
                      aria-expanded={summaryOpen}
                      onClick={() => {
                        setExpandedSummaryIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(m.id)) next.delete(m.id);
                          else next.add(m.id);
                          return next;
                        });
                      }}
                    >
                      {summaryOpen ? "收起生成摘要" : "查看生成摘要"}
                    </button>
                  ) : null}
                  {m.status === "done" && m.summary && summaryOpen ? (
                    <span className="world-gen-mod-summary mt-1 block rounded-lg border border-jade/25 bg-jade/5 px-2 py-1.5 text-[11px] leading-relaxed text-ink">
                      {m.summary}
                    </span>
                  ) : null}
                  {m.error ? <span className="mt-0.5 block text-[11px] text-danger">{m.error}</span> : null}
                </span>
              </li>
              );
            })}
          </ul>

          {/* 功能注释：进度页底部只留「进入编辑器」与「返回」；开局日期等由生成管线自愈，不提供重试入口 */}
          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            {running ? (
              <button type="button" onClick={cancelGen} className="world-gen-chip px-4 py-2 text-[13px]">
                取消生成
              </button>
            ) : (
              <>
                {!progressHasStaleChunkFailure(progress) ? (
                  <button type="button" onClick={continueToEditor} className="world-gen-cta">
                    进入编辑器
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setProgress(null);
                    setGenerating(false);
                  }}
                  className="world-gen-ghost"
                >
                  返回
                </button>
              </>
            )}
          </div>
        </div>
        {errModal}
      </div>
    );
  }

  if (step === 2 && mod && draft) {
    if (workshop) {
      return (
        /* 功能注释：平台生成世界·工坊，仅此壳套暗色，不改局内其它页 */
        <div className="world-gen-shell world-gen-editor min-h-screen overflow-x-hidden px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-4">
          <Suspense fallback={<p className="p-8 text-center text-sm text-ink-soft">加载创意工坊…</p>}>
            <ModWorkshop
              target={workshop}
              onEdit={(m) => {
                setWorkshop(null);
                setMod(m);
              }}
              onClose={(saved) => {
                setWorkshop(null);
                if (saved) onComplete(mod, draft, saved);
              }}
            />
          </Suspense>
        </div>
      );
    }
    return (
      /* 功能注释：第 2 步完整编辑器 · 平台暗色壳；fluid 适配手机，禁止整页横滑 / 奶油底 */
      <div className="world-gen-shell world-gen-editor min-h-screen overflow-x-hidden px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-4">
        <EditorTrimBoundary s1={s1} onDemote={demoteFromEditorTrim}>
          <Suspense fallback={<p className="p-8 text-center text-sm text-ink-soft">加载编辑器…</p>}>
            <ModEditorPanel
              key={mod.id || "world-gen-new"}
              initial={mod}
              isNew
              fluid
              initialGroup={editorBootGroup === "all" ? "base" : editorBootGroup}
              resumeDraftChoice={editorDraftChoice}
              savedVersionAt={resolveSavedVersionAt(WORLD_GEN_DRAFT_ID, loadWorldGenSession()?.updatedAt ?? null)}
              onLiveChange={onEditorLiveChange}
              onCommitted={onEditorCommitted}
              onAiChat={(m) => setWorkshop({ mod: m, isNew: true })}
              onClose={(savedName) => {
                onComplete(modRef.current ?? mod, draft, savedName);
              }}
              onBackToWizard={() => {
                setEditorDraftChoice(null);
                setEditorBootGroup(undefined);
                setStep(1);
                schedulePersist();
              }}
            />
          </Suspense>
        </EditorTrimBoundary>
      </div>
    );
  }

  return (
    <div className="world-gen-shell">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 pb-28 pt-7 sm:px-6">
        <header className="mb-6">
          <p className="world-gen-kicker">创作游戏 · 第 1/2 步</p>
          <h1 className="world-gen-title">生成世界</h1>
          <p className="world-gen-lead">
            填写作品名称、故事设定并选择创作引擎，勾选本次需要 AI 生成的模组；进入完整编辑器时会调用平台 AI（按模组扣 KK
            币），无需单独配置密钥。
          </p>
        </header>

        <div className="space-y-4">
          <section className="world-gen-card">
            <div className="world-gen-card-head">
              <h2 className="world-gen-card-title">
                <span className="world-gen-card-index">01</span>
                核心设定
              </h2>
            </div>
            <label className="mb-4 block">
              <div className="world-gen-field-label">
                {/* 功能注释：作品名称为必填；红 * 与校验「请填写作品名称」对齐，禁止生成不加 */}
                <span>
                  作品名称
                  <span className="world-gen-req" aria-hidden="true">
                    *
                  </span>
                </span>
                <span className="world-gen-field-count">
                  {s1.title.length}/{WORLD_TITLE_MAX}
                </span>
              </div>
              <input
                className="world-gen-input"
                value={s1.title}
                maxLength={WORLD_TITLE_MAX}
                placeholder="例如：雾港来信"
                required
                aria-required="true"
                onChange={(e) => patch1({ title: e.target.value })}
              />
            </label>
            <label className="block">
              <div className="world-gen-field-label">
                {/* 功能注释：故事设定为必填；红 * 与校验「请填写故事设定」对齐 */}
                <span>
                  故事设定
                  <span className="world-gen-req" aria-hidden="true">
                    *
                  </span>
                </span>
                <span
                  className={`world-gen-field-count${isWorldGenSettingOverLimit(s1.setting) ? " is-over" : ""}`}
                  aria-live="polite"
                >
                  {worldGenSettingLen(s1.setting)}/{WORLD_SETTING_MAX}
                </span>
              </div>
              <textarea
                ref={settingRef}
                className="world-gen-textarea"
                value={s1.setting}
                rows={2}
                placeholder="例如：玩家继承海边旅店，在往来旅客中寻找姐姐。"
                required
                aria-required="true"
                onChange={(e) => {
                  patch1({ setting: e.target.value });
                  fitWorldGenSettingTextarea(e.currentTarget);
                }}
              />
            </label>
            <p className={`mt-2 ${hint}`}>
              这段内容将作为 AI 创作的主要依据。你可以补充玩法、角色关系与世界规则。上限 {WORLD_SETTING_MAX}{" "}
              字；超出后计数标红，未勾选 AI 整理时提交会先确认截断。
            </p>
            <label className="mt-4 block">
              <div className="world-gen-field-label">
                <span>禁止生成</span>
                <span
                  className={`world-gen-field-count${isWorldGenForbidOverLimit(s1.forbidGen) ? " is-over" : ""}`}
                  aria-live="polite"
                >
                  {worldGenForbidLen(s1.forbidGen)}/{WORLD_FORBID_MAX}
                </span>
              </div>
              <textarea
                ref={forbidRef}
                className="world-gen-textarea"
                value={s1.forbidGen}
                rows={2}
                placeholder="例如：不要出现现代娱乐圈通告；不要生成未成年恋爱；不要出现血腥虐杀。"
                onChange={(e) => {
                  patch1({ forbidGen: e.target.value });
                  fitWorldGenSettingTextarea(e.currentTarget);
                }}
              />
            </label>
            <p className={`mt-2 ${hint}`}>
              写清楚不要出现的内容、不要生成的设定。生成世界与后续 AI 补全都会遵守；不会被「由 AI
              整理设定」改写。
            </p>
            <button
              type="button"
              role="checkbox"
              aria-checked={s1.aiPolish}
              onClick={() => patch1({ aiPolish: !s1.aiPolish })}
              className={`world-gen-choice mt-3 ${s1.aiPolish ? "is-on" : ""}`}
            >
              <span className="world-gen-choice-check" aria-hidden>
                {s1.aiPolish ? <IconCheck size={12} /> : null}
              </span>
              <span>
                <span className="block text-[13px] font-bold text-ink">由 AI 整理设定</span>
                <span className={hint}>保留原意，补全结构并优化表达（作品名称也可润色）</span>
              </span>
            </button>
          </section>

          <section className="world-gen-card">
            <div className="world-gen-card-head">
              <h2 className="world-gen-card-title">
                <span className="world-gen-card-index">02</span>
                选择创作引擎
              </h2>
            </div>
            <p className={`mb-3 ${hint}`}>每种引擎的擅长方向与消耗倍率不同，最终按实际生成用量扣除 KK 币。</p>
            <div className="space-y-2">
              {WORLD_GEN_ENGINES.map((e) => {
                const on = s1.engineId === e.id;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => patch1({ engineId: e.id as WorldGenEngineId })}
                    className={`world-gen-choice ${on ? "is-on" : ""}`}
                  >
                    <span className="world-gen-choice-mark" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-bold text-ink">{e.name}</span>
                        <span className="world-gen-chip !px-2 !py-0.5 text-[10.5px]">{e.tag}</span>
                      </span>
                      <span className={`mt-0.5 block ${hint}`}>{e.desc}</span>
                      <span className="mt-1 block text-[11.5px] font-semibold text-jade">
                        KK 币倍率 {e.rate.toFixed(1)}x
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="world-gen-card">
            <div className="world-gen-card-head">
              <h2 className="world-gen-card-title">
                <span className="world-gen-card-index">03</span>
                本次需要 AI 生成的模组
              </h2>
              <span className="world-gen-field-count">
                已选 {selectedCount}/{allCount}
              </span>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <button type="button" onClick={selectAllModules} className="world-gen-chip">
                全选基础
              </button>
              <button type="button" onClick={clearAllModules} className="world-gen-chip">
                取消全选
              </button>
            </div>
            <div className="max-h-72 space-y-3 overflow-y-auto pr-0.5">
              <p className="text-[11px] font-bold text-jade">基础世界（默认）</p>
              {renderModuleGroup(tieredModules.core)}
            </div>
          </section>
        </div>
      </div>

      <div className="world-gen-dock">
        <div className="mx-auto flex max-w-xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button type="button" onClick={onBack} className="world-gen-ghost">
            ← 上一步
          </button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {mod && draft ? (
              <button type="button" onClick={continueExistingWork} disabled={generating} className="world-gen-ghost">
                继续编辑已有内容
              </button>
            ) : null}
            <button type="button" onClick={() => void goEditor()} disabled={generating} className="world-gen-cta">
              {mod && draft ? "重新生成并进入编辑器 →" : "进入完整编辑器 →"}
            </button>
          </div>
        </div>
      </div>
      {entranceDraftGate ? (
        <Modal title="发现本机未保存的草稿" locked onClose={() => { /* 只能点两个按钮 */ }}>
          <p className="text-[13px] leading-relaxed text-ink-soft">
            {(() => {
              const savedBit = entranceDraftGate.savedAt != null
                ? `已保存的版本（${fmtDraftTime(entranceDraftGate.savedAt)}）`
                : "已保存的版本";
              return <>这部作品在浏览器里有一份自动保存的草稿（{fmtDraftTime(entranceDraftGate.pendingAt)}），与{savedBit}不一致。请先选择，再打开表单。</>;
            })()}
            {entranceDraftGate.stale ? (
              <b className="mt-1 block font-semibold text-danger">
                注意：草稿生成之后，已保存的版本又被修改过，继续填写草稿会覆盖那些修改。
              </b>
            ) : null}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" autoFocus onClick={acceptEntranceDraft} className="ui-btn ui-btn-primary ui-btn-sm">
              继续填写草稿
            </button>
            <button type="button" onClick={acceptEntranceSaved} className="ui-btn ui-btn-sm">
              从已保存版本开始
            </button>
          </div>
        </Modal>
      ) : null}
      {confirmEl}
      {errModal}
    </div>
  );
}
