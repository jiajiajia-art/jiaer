/**
 * 创作游戏 · 生成世界向导
 * 第 1 步：作品名称 / 故事设定 / AI 线路 / 勾选本次 AI 生成模组
 * 点击「进入完整编辑器」后：按勾选真实调用 AI 分模组生成（温和进度条）→ 打开完整编辑器
 * 未勾选模组不请求、不覆盖；失败可单独重试；取消保留已完成内容。
 * 刷新：从 worldGenSession 恢复步骤、设定、剧本草稿、编辑器分区与滚动，禁止掉进游戏封面。
 */
import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Mod } from "../mods/types";
import {
  ALL_WORLD_GEN_EDITOR_STEP_IDS,
  DEFAULT_WORLD_GEN_EDITOR_STEP_IDS,
  WORLD_GEN_ENGINES,
  WORLD_SETTING_MAX,
  WORLD_TITLE_MAX,
  contentIdsFromEditorSteps,
  defaultWorldGenStep1,
  draftModFromWorldGen,
  groupWorldGenEditorStepsByTier,
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
  isStaleChunkLoadErrorMessage,
  progressHasAuthFailure,
  progressHasStaleChunkFailure,
  retryFailedWorldGenModules,
  retryOneWorldGenModule,
  runWorldGenModules,
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
  saveWorldGenSession,
} from "../lib/worldGenSession";
import { sanitizeModStrings } from "../lib/sanitizeModStrings";
import { readFunloomAuthToken } from "../lib/platformAvatarLibrary";
import { IconCheck } from "../lib/icons";
import { Modal } from "./ui";

const ModEditorPanel = lazy(() => import("./ModEditorPanel"));
const ModWorkshop = lazy(() => import("./ModWorkshop"));

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

function moduleStatusLabel(status: string) {
  if (status === "done") return "完成";
  if (status === "failed") return "失败";
  if (status === "running") return "进行中";
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

/** 功能注释：首屏从会话启动；step2 缺 mod/draft 时回退 step1，避免卡空白 */
function bootFromSession() {
  const s = loadWorldGenSession();
  if (!s) {
    return {
      step: 1 as const,
      s1: defaultWorldGenStep1(),
      mod: null as Mod | null,
      draft: null as WorldGenDraft | null,
      scrollY: 0,
      editorGroup: undefined as string | undefined,
    };
  }
  const canEditor = s.step === 2 && !!s.mod && !!s.draft;
  const s1 = normalizeWorldGenStep1(s.s1);
  const draft = s.draft ? normalizeWorldGenDraft(s.draft) : null;
  // 功能注释：本机会话里的旧 AI 脏 mod 必须先清洗，否则刷新进编辑器仍会 .trim 崩页
  const mod = canEditor && s.mod ? sanitizeModStrings(s.mod) : null;
  return {
    step: (canEditor ? 2 : 1) as 1 | 2,
    s1,
    mod,
    draft,
    scrollY: s.scrollY,
    editorGroup: s.editorGroup,
  };
}

export default function WorldGenWizard({ onBack, onComplete }: Props) {
  const boot = useMemo(() => bootFromSession(), []);
  const [step, setStep] = useState<1 | 2>(boot.step);
  const [s1, setS1] = useState<WorldGenStep1>(boot.s1);
  const [mod, setMod] = useState<Mod | null>(boot.mod);
  const [draft, setDraft] = useState<WorldGenDraft | null>(boot.draft);
  const [workshop, setWorkshop] = useState<{ mod: Mod; isNew: boolean } | null>(null);
  const [err, setErr] = useState("");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<WorldGenProgress | null>(null);
  /** 功能注释：生成本批开始时间；ETA 用 deadline 每秒倒计，进度变化时按速率重标定 */
  const genStartedAtRef = useRef<number>(0);
  const etaDeadlineRef = useRef<number>(0);
  const etaFinishedRef = useRef<number>(-1);
  const [etaTick, setEtaTick] = useState(0);
  /** 功能注释：模组进度列表容器，滚动到当前「进行中」行 */
  const modListRef = useRef<HTMLUListElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const draftRef = useRef<WorldGenDraft | null>(boot.draft);
  const modRef = useRef<Mod | null>(boot.mod);
  const editorGroupRef = useRef(boot.editorGroup ?? "base");
  const scrollRestored = useRef(false);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 功能注释：把向导进度写入会话；刷新后 App 凭此重开向导而非游戏 */
  const persistNow = useCallback(() => {
    // 功能注释：恢复期禁止写回 step2/脏 mod；但必须允许落盘纯 step1，否则 1.5s 清 recover 标记后磁盘仍是脏编辑器，一刷新又崩
    if (isWorldGenPersistBlocked() || isWorldGenTrimRecovering()) {
      if (step !== 1 || modRef.current || draftRef.current) return;
    }
    saveWorldGenSession({
      step,
      s1,
      draft: draftRef.current,
      mod: modRef.current,
      scrollY: typeof window !== "undefined" ? window.scrollY || 0 : 0,
      editorGroup: editorGroupRef.current,
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

  // 功能注释：恢复态只留在第 1 步；稳定 1.5s 后再解挡板，禁止首屏又把脏 mod 写回
  useEffect(() => {
    // 功能注释：parse 在 recover 标记下只「读成」step1，磁盘可能仍是脏 step2；进页立刻重写 step1，避免清标记后刷新再崩
    if (isWorldGenTrimRecovering() || isWorldGenPersistBlocked()) {
      demoteWorldGenSessionToStep1(boot.s1);
      modRef.current = null;
      draftRef.current = null;
      setMod(null);
      setDraft(null);
      setStep(1);
    } else if (boot.step === 2 && boot.mod) {
      modRef.current = boot.mod;
      persistNow();
    }
    const t = window.setTimeout(() => {
      // 功能注释：解挡前再落一次纯 step1，防止定时器窗口内磁盘仍脏
      if (isWorldGenTrimRecovering() || isWorldGenPersistBlocked()) {
        demoteWorldGenSessionToStep1(boot.s1);
      }
      clearWorldGenPersistBlock();
      clearWorldGenTrimRecover();
      try {
        sessionStorage.removeItem("star:wgStaleChunkReload");
      } catch {
        /* ignore */
      }
    }, 1500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅首屏处理恢复挡板
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
    const onScroll = () => schedulePersist();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", persistNow);
    window.addEventListener("beforeunload", persistNow);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", persistNow);
      window.removeEventListener("beforeunload", persistNow);
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [schedulePersist, persistNow]);

  // 功能注释：挂载后还原滚动；等编辑器懒加载后再滚一次
  useEffect(() => {
    if (scrollRestored.current || boot.scrollY <= 0) return;
    const y = boot.scrollY;
    const apply = () => window.scrollTo(0, y);
    apply();
    const t = window.setTimeout(() => {
      apply();
      scrollRestored.current = true;
    }, 80);
    return () => window.clearTimeout(t);
  }, [boot.scrollY, step, mod]);

  const tieredModules = useMemo(() => groupWorldGenEditorStepsByTier(), []);
  const [showExtendedModules, setShowExtendedModules] = useState(false);
  const selected = useMemo(() => new Set(s1.editorStepIds ?? []), [s1.editorStepIds]);
  const selectedCount = selected.size;
  const coreCount = DEFAULT_WORLD_GEN_EDITOR_STEP_IDS.length;
  const allCount = ALL_WORLD_GEN_EDITOR_STEP_IDS.length;

  const patch1 = (p: Partial<WorldGenStep1>) => {
    setS1((prev) => ({ ...prev, ...p }));
    setErr("");
  };

  const toggleModule = (id: string) => {
    setS1((prev) => {
      const set = new Set(prev.editorStepIds ?? []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      const editorStepIds = ALL_WORLD_GEN_EDITOR_STEP_IDS.filter((x) => set.has(x));
      return {
        ...prev,
        editorStepIds,
        contentIds: contentIdsFromEditorSteps(editorStepIds),
        scopeVersion: WORLD_GEN_SCOPE_VERSION,
      };
    });
    setErr("");
  };

  /** 功能注释：默认「全选」= 基础世界模组；扩展玩法须作者另点「含扩展」 */
  const selectAllModules = () => {
    patch1({
      editorStepIds: [...DEFAULT_WORLD_GEN_EDITOR_STEP_IDS],
      contentIds: contentIdsFromEditorSteps(DEFAULT_WORLD_GEN_EDITOR_STEP_IDS),
      scopeVersion: WORLD_GEN_SCOPE_VERSION,
    });
  };

  const selectAllIncludingExtended = () => {
    patch1({
      editorStepIds: [...ALL_WORLD_GEN_EDITOR_STEP_IDS],
      contentIds: contentIdsFromEditorSteps(ALL_WORLD_GEN_EDITOR_STEP_IDS),
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

  const openEditor = useCallback((m: Mod, d: WorldGenDraft) => {
    setMod(m);
    setDraft(d);
    modRef.current = m;
    draftRef.current = d;
    setGenerating(false);
    setProgress(null);
    setStep(2);
    // 功能注释：进入编辑器立刻落盘，避免生成刚完成就刷新掉进游戏
    saveWorldGenSession({
      step: 2,
      s1,
      draft: d,
      mod: m,
      scrollY: typeof window !== "undefined" ? window.scrollY || 0 : 0,
      editorGroup: editorGroupRef.current,
      updatedAt: Date.now(),
    });
  }, [s1]);

  /** 功能注释：只更 ref + 落盘，避免每键 setState 重渲整棵向导树 */
  const onEditorLiveChange = useCallback(
    (next: Mod) => {
      modRef.current = next;
      schedulePersist();
    },
    [schedulePersist],
  );

  const onEditorChromeChange = useCallback(
    (snap: { group: string }) => {
      editorGroupRef.current = snap.group;
      schedulePersist();
    },
    [schedulePersist],
  );

  /** 第 1→生成→2：校验后真实调用 AI；禁止未请求就灌模板内容 */
  const goEditor = async () => {
    const normalized = normalizeWorldGenStep1(s1);
    if (normalized.editorStepIds.join("\0") !== (s1.editorStepIds ?? []).join("\0")) {
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
        try {
          if (sessionStorage.getItem("star:wgStaleChunkReload") !== "1") {
            sessionStorage.setItem("star:wgStaleChunkReload", "1");
            const url = new URL(window.location.href);
            url.searchParams.set("_r", String(Date.now()));
            window.location.replace(url.toString());
            return;
          }
        } catch {
          /* ignore */
        }
        setErr("页面资源已更新，请强制刷新（Ctrl/Cmd+Shift+R）后再生成。");
        return;
      }
      // 功能注释：有失败或取消时停在进度面板，便于重试；全部成功再进编辑器
      if (!result.cancelled && result.progress.failedCount === 0) {
        openEditor(result.mod, d);
      } else {
        setGenerating(false);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "生成失败";
      if (isStaleChunkLoadErrorMessage(msg)) {
        try {
          if (sessionStorage.getItem("star:wgStaleChunkReload") !== "1") {
            sessionStorage.setItem("star:wgStaleChunkReload", "1");
            const url = new URL(window.location.href);
            url.searchParams.set("_r", String(Date.now()));
            window.location.replace(url.toString());
            return;
          }
        } catch {
          /* ignore */
        }
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
    openEditor(m, d);
  };

  const retryFailed = async () => {
    const d = draftRef.current;
    const m = modRef.current;
    const prev = progress;
    if (!d || !m || !prev) return;
    if (!readFunloomAuthToken()) {
      setErr("请先登录平台账号后再重试。");
      return;
    }
    const ctl = new AbortController();
    abortRef.current = ctl;
    markGenStart();
    setGenerating(true);
    setErr("");
    try {
      const result = await retryFailedWorldGenModules({
        draft: d,
        seedMod: m,
        moduleIds: d.editorStepIds,
        previous: prev,
        signal: ctl.signal,
        onProgress: setProgress,
      });
      modRef.current = result.mod;
      setProgress(result.progress);
      if (!result.cancelled && result.progress.failedCount === 0) {
        openEditor(result.mod, d);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "重试失败");
    } finally {
      abortRef.current = null;
      setGenerating(false);
    }
  };

  const retryOne = async (moduleId: string) => {
    const d = draftRef.current;
    const m = modRef.current;
    const prev = progress;
    if (!d || !m || !prev) return;
    if (!readFunloomAuthToken()) {
      setErr("请先登录平台账号后再重试。");
      return;
    }
    const ctl = new AbortController();
    abortRef.current = ctl;
    markGenStart();
    setGenerating(true);
    setErr("");
    try {
      const result = await retryOneWorldGenModule({
        draft: d,
        seedMod: m,
        moduleIds: [moduleId],
        previous: prev,
        moduleId,
        signal: ctl.signal,
        onProgress: setProgress,
      });
      modRef.current = result.mod;
      setProgress(result.progress);
      if (!result.cancelled && result.progress.failedCount === 0) {
        openEditor(result.mod, d);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "重试失败");
    } finally {
      abortRef.current = null;
      setGenerating(false);
    }
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
    const finished = progress.doneCount + progress.failedCount;
    const remainingMods = Math.max(0, progress.total - finished);
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
      syncEtaDeadline(progress.total, finished);
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
                title="按已完成速度与并行度估算；慢模组超时会自动重估，仅供参考"
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
                生成世界使用平台 AI（登录账号 + KK 币），无需单独配置 API Key。请确认已登录且积分充足，再点「重试失败项」。
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
            {progress.modules.map((m) => (
              <li
                key={m.id}
                data-wg-mod-id={m.id}
                data-wg-status={m.status}
                className={`world-gen-mod-row${m.status === "running" ? " is-running" : ""}${
                  m.status === "done" ? " is-done" : ""
                }${m.status === "failed" ? " is-failed" : ""}`}
              >
                <span className={moduleStatusClass(m.status)}>{moduleStatusLabel(m.status)}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-ink">{m.name}</span>
                  {m.error ? <span className="mt-0.5 block text-[11px] text-danger">{m.error}</span> : null}
                </span>
                {m.status === "failed" && !running && !/未继续请求/.test(m.error || "") ? (
                  <button type="button" className="world-gen-chip shrink-0" onClick={() => void retryOne(m.id)}>
                    单独重试
                  </button>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            {running ? (
              <button type="button" onClick={cancelGen} className="world-gen-chip px-4 py-2 text-[13px]">
                取消生成
              </button>
            ) : (
              <>
                {progress.failedCount > 0 && !progressHasStaleChunkFailure(progress) ? (
                  <button
                    type="button"
                    onClick={() => void retryFailed()}
                    className="world-gen-chip border-jade/40 text-jade"
                  >
                    重试失败项
                  </button>
                ) : null}
                {!progressHasStaleChunkFailure(progress) ? (
                  <button type="button" onClick={continueToEditor} className="world-gen-cta">
                    {progress.doneCount ? "进入编辑器（保留已完成）" : "进入空编辑器"}
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
                  返回修改设定
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
              initialGroup={boot.editorGroup === "all" ? "base" : boot.editorGroup}
              onLiveChange={onEditorLiveChange}
              onChromeChange={onEditorChromeChange}
              onAiChat={(m) => setWorkshop({ mod: m, isNew: true })}
              onClose={(savedName) => {
                onComplete(modRef.current ?? mod, draft, savedName);
              }}
              onBackToWizard={() => {
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
                <span>作品名称</span>
                <span className="world-gen-field-count">
                  {s1.title.length}/{WORLD_TITLE_MAX}
                </span>
              </div>
              <input
                className="world-gen-input"
                value={s1.title}
                maxLength={WORLD_TITLE_MAX}
                placeholder="例如：雾港来信"
                onChange={(e) => patch1({ title: e.target.value })}
              />
            </label>
            <label className="block">
              <div className="world-gen-field-label">
                <span>故事设定</span>
                <span className="world-gen-field-count">
                  {s1.setting.length}/{WORLD_SETTING_MAX}
                </span>
              </div>
              <textarea
                className="world-gen-textarea"
                value={s1.setting}
                maxLength={WORLD_SETTING_MAX}
                placeholder="例如：玩家继承海边旅店，在往来旅客中寻找姐姐。"
                onChange={(e) => patch1({ setting: e.target.value })}
              />
            </label>
            <p className={`mt-2 ${hint}`}>
              这段内容将作为 AI 创作的主要依据。你可以补充玩法、角色关系、世界规则和内容禁区。
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
                <span className={hint}>保留原意，补全结构并优化表达</span>
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
                已选 {selectedCount}/{allCount}（基础默认 {coreCount}）
              </span>
            </div>
            <p className={`mb-3 ${hint}`}>
              首次默认只生成基础世界（地点、人物、势力、建角、开局事件等）。玩法组件、手机应用、孕育、通告、座驾等扩展默认不生成；可在下方展开后自行勾选。重新生成时只更新勾选项，不会覆盖已安装组件与作者手改。
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              <button type="button" onClick={selectAllModules} className="world-gen-chip">
                全选基础
              </button>
              <button type="button" onClick={selectAllIncludingExtended} className="world-gen-chip">
                含扩展全选
              </button>
              <button type="button" onClick={clearAllModules} className="world-gen-chip">
                取消全选
              </button>
            </div>
            <div className="max-h-72 space-y-3 overflow-y-auto pr-0.5">
              <p className="text-[11px] font-bold text-jade">基础世界（默认）</p>
              {renderModuleGroup(tieredModules.core)}
              <div className="border-t border-line/70 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExtendedModules((v) => !v)}
                  className="mb-2 text-[11.5px] font-bold text-ink-soft hover:text-ink"
                >
                  {showExtendedModules ? "收起扩展玩法" : "展开扩展玩法（默认不生成）"} ·{" "}
                  {tieredModules.extended.reduce((n, g) => n + g.steps.length, 0)} 项
                </button>
                {showExtendedModules ? renderModuleGroup(tieredModules.extended) : null}
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="world-gen-dock">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button type="button" onClick={onBack} className="world-gen-ghost">
            ← 上一步
          </button>
          <button type="button" onClick={() => void goEditor()} disabled={generating} className="world-gen-cta">
            进入完整编辑器 →
          </button>
        </div>
      </div>
      {errModal}
    </div>
  );
}
