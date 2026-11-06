import { applyFreeStyle } from "./lib/freeStyle";
import { ensureGameFontsLoaded } from "./lib/gameFonts";
import { applyLookCss } from "./lib/plotLook";
import { loadGlobal, saveGlobal } from "./lib/saveScope";
import { resolveSkinTheme } from "./lib/skins";
import { clearWorldGenQuery, shouldOpenWorldGenWizard } from "./lib/worldGenWizard";
import {
  blockWorldGenPersist,
  clearWorldGenSession,
  demoteWorldGenSessionToStep1,
  ensureWorldGenQuery,
  isWorldGenTrimRecovering,
  loadWorldGenSession,
  markWorldGenTrimRecover,
  shouldResumeWorldGenSession,
} from "./lib/worldGenSession";
import { getAuthorPreviewSession, isAuthorPreview, subscribeAuthorPreview } from "./lib/authorPreview";
import { Component, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { GameProvider } from "./store/GameContext";
import { useGame } from "./store/gameCtx";
import { getWorld } from "./mods/registry";
import CharacterCreate from "./components/CharacterCreate";
import Opening from "./components/Opening";
import GameShell from "./components/GameShell";
import Ending from "./components/Ending";
import WorldGenWizard from "./components/WorldGenWizard";
import PlayModCreateShell from "./components/PlayModCreateShell";
import AuthorPreviewChrome from "./components/AuthorPreviewChrome";
import AuthorPreviewPlayShell from "./components/AuthorPreviewPlayShell";
import PlatformShellGate from "./components/PlatformShellGate";
import { readFunloomStaffFromStorage, shouldGateRomancePlatformShell } from "./lib/platformShellGate";
import {
  clearPlayModCreateQuery,
  ensurePlayModCreateQuery,
  shouldOpenPlayModCreate,
} from "./lib/playModCreate";

import { isStaleChunkLoadErrorMessage, reloadOnceForStaleChunk } from "./lib/worldGenGenerate";

/** 功能注释：发版后旧 chunk 404 常表现为动态 import 失败；仅清 error 不够，须整页重载。 */
function isStaleChunkLoadError(error: unknown): boolean {
  return isStaleChunkLoadErrorMessage(
    (error as { message?: string })?.message || error,
  );
}

/** 功能注释：AI 脏会话导致 .trim 崩页；重试前须清世界生成会话并硬刷新，否则会循环报错 */
function isDirtyWorldGenTrimError(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message || error || "");
  return /\.trim is not a function|trim is not a function|\.map is not a function|is not iterable|Objects are not valid as a React child|reading 'startsWith'|reading 'join'|forEach is not a function|reading 'kind'/i.test(msg);
}

function hardReloadWithCacheBust(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("_r", String(Date.now()));
  // 功能注释：去掉可能把人又带回半残状态的时间戳外参数外，保留 createWorld
  window.location.replace(url.toString());
}

/** 功能注释：trim 崩页 → 强制 step1（保留设定）并硬刷新；禁止再进脏编辑器 */
function recoverDirtyWorldGenTrim(forceWipe = false): void {
  // 功能注释：先挡住 beforeunload 把编辑器会话写回去，否则切分区崩页会被立刻刷回原页，看起来像按钮没反应
  markWorldGenTrimRecover();
  blockWorldGenPersist();
  try {
    if (forceWipe) {
      clearWorldGenSession();
    } else {
      const s1 = loadWorldGenSession()?.s1;
      demoteWorldGenSessionToStep1(s1);
    }
  } catch {
    try {
      clearWorldGenSession();
    } catch {
      /* ignore */
    }
  }
  hardReloadWithCacheBust();
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  /**
   * 功能注释：trim 崩页自动恢复。
   * 若已在恢复中仍再次崩（旧缓存/半残标记），禁止空 return 卡死在报错页，改为清空会话再刷。
   */
  componentDidCatch(error: Error) {
    if (typeof window === "undefined") return;
    // 功能注释：点「继续填写草稿」等路径上的旧 chunk 404 → 自动硬刷，不必先停在红屏等用户点重试
    if (isStaleChunkLoadError(error)) {
      if (reloadOnceForStaleChunk(error)) return;
    }
    if (!isDirtyWorldGenTrimError(error)) return;
    recoverDirtyWorldGenTrim(isWorldGenTrimRecovering());
  }
  private retry = () => {
    const err = this.state.error;
    if (isDirtyWorldGenTrimError(err)) {
      // 功能注释：用户点重试时一律强清，避免 recover 标记把人钉在报错页
      recoverDirtyWorldGenTrim(true);
      return;
    }
    if (isStaleChunkLoadError(err)) {
      // 功能注释：带时间戳绕过中间层对 index/入口的短期缓存，拉到新 hash 资源
      hardReloadWithCacheBust();
      return;
    }
    this.setState({ error: null });
  };
  render() {
    if (this.state.error) {
      const stale = isStaleChunkLoadError(this.state.error);
      const dirtyTrim = isDirtyWorldGenTrimError(this.state.error);
      const platformUi =
        typeof document !== "undefined" &&
        !!document.querySelector('[data-platform-ui="1"]');
      return (
        <div
          className={`${platformUi ? "romance-platform" : "paper-grain"} flex min-h-screen flex-col items-center justify-center px-6 text-center`}
        >
          <h1 className="mb-2 font-serif text-2xl font-black text-ink">出了一点小状况</h1>
          <p className="mb-5 max-w-md text-sm text-ink-soft">
            {dirtyTrim
              ? "生成草稿里有不兼容字段。点「重试」会退回设定页并刷新（保留作品名与故事设定）；游戏存档不受影响。"
              : stale
                ? "页面资源已更新，点「重试」将刷新加载最新版本。你的存档仍保存在本地。"
                : "页面渲染时遇到错误。你的存档仍安全保存在本地，刷新即可继续。"}
          </p>
          <pre className="mb-5 max-w-md overflow-auto rounded-lg border border-line bg-paper-2 p-3 text-left text-[11px] text-danger">
            {String(this.state.error.message || this.state.error)}
          </pre>
          <button
            type="button"
            onClick={this.retry}
            className="rounded-xl bg-jade px-5 py-2.5 text-sm font-semibold text-paper-2 transition hover:brightness-110"
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function PlayScreens() {
  const { screen, saveEpoch, game, go } = useGame();
  if (screen === "create" || screen === "cover") return <CharacterCreate />;
  // 功能注释：开幕只挂 Opening，禁止底层 GameShell/底栏透出；点「开始」后再挂载局内界面
  if (screen === "opening") {
    if (!game) {
      // 功能注释：无存档却进开幕 → 脏切屏；回到建角重开，禁止再进封面开始菜单
      return (
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center" data-author-preview-empty="opening">
          <p className="text-sm text-ink-soft">开幕页缺少存档，请重新建角开局。</p>
          <button type="button" className="mt-4 rounded-xl bg-jade px-5 py-2.5 text-sm font-semibold text-paper-2" onClick={() => go("create")}>
            回到建角
          </button>
        </div>
      );
    }
    return <Opening key={`opening-${saveEpoch}`} />;
  }
  if (screen === "game") {
    if (!game) {
      // 功能注释：GameShell 在 !game 时 return null 会变成静默空白；须可回到建角
      return (
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center" data-author-preview-empty="game">
          <p className="text-sm text-ink-soft">局内界面尚未就绪（测试存档为空）。请重新建角开局。</p>
          <button type="button" className="mt-4 rounded-xl bg-jade px-5 py-2.5 text-sm font-semibold text-paper-2" onClick={() => go("create")}>
            回到建角
          </button>
        </div>
      );
    }
    return <GameShell key={`shell-${saveEpoch}`} />;
  }
  if (screen === "ending") return <Ending />;
  // 功能注释：默认建角；封面开始菜单（标题+开始/继续/配置 AI）已下线
  return <CharacterCreate />;
}

function Root() {
  const { screen, theme, setTheme, look, lookCss, game, saveEpoch } = useGame();
  /** 功能注释：?createWorld=1 或未完成向导会话 → 打开向导；刷新须留在编辑器，不得掉进游戏 */
  const [worldGenOpen, setWorldGenOpen] = useState(
    () => shouldOpenWorldGenWizard() || shouldResumeWorldGenSession(),
  );
  /** 功能注释：?createPlayMod=1 → 玩法 Mod 对话工坊（创作游戏二级入口） */
  const [playModCreateOpen, setPlayModCreateOpen] = useState(() => shouldOpenPlayModCreate());
  const previewSession = useSyncExternalStore(subscribeAuthorPreview, getAuthorPreviewSession, () => null);
  const previewing = !!previewSession;

  useEffect(() => {
    if (!worldGenOpen) return;
    // 功能注释：向导打开期间保持 URL 标记，刷新后仍能识别；离开时再清查询与会话
    ensureWorldGenQuery();
  }, [worldGenOpen]);

  useEffect(() => {
    if (!playModCreateOpen) return;
    ensurePlayModCreateQuery();
  }, [playModCreateOpen]);

  const closeWorldGen = () => {
    // 功能注释：挂了平台 draftId 的作品保留本机会话，书架按 ID 续编可先命中本地；无 draftId 的临时向导仍清掉
    let keepByDraft = false;
    try {
      keepByDraft = !!new URLSearchParams(location.search).get("draftId")?.trim();
    } catch {
      keepByDraft = false;
    }
    if (!keepByDraft) clearWorldGenSession();
    clearWorldGenQuery();
    setWorldGenOpen(false);
  };

  const closePlayModCreate = () => {
    clearPlayModCreateQuery();
    setPlayModCreateOpen(false);
  };

  // 模组界面风格：进入某世界时套用一次（记录已套用的世界+配置，玩家之后自改不再覆盖）
  useEffect(() => {
    if (screen !== "game" || !game) return;
    const mt = getWorld().content.theme;
    if (!mt || !Object.keys(mt).length) return;
    const key = `${game.worldId ?? "ent"}:${JSON.stringify(mt)}`;
    if (loadGlobal<string>("mod-theme-applied", "") === key) return;
    saveGlobal("mod-theme-applied", key);
    setTheme({ ...theme, ...resolveSkinTheme(mt) });
  }, [screen, game?.worldId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 应用主题：深浅色（含 auto 跟随系统）+ 主题色；读「实际生效外观」（含剧情美化）
  // 功能注释：生成世界平台表单打开时，卸掉局内皮肤；配色由 .romance-platform / .world-gen-shell 对齐 funloom 暗色酒红创作壳
  useEffect(() => {
    const root = document.documentElement;
    const platformOnly = (worldGenOpen || playModCreateOpen) && !previewing;
    const apply = () => {
      if (platformOnly) {
        root.classList.remove(
          "dark",
          "accent-jade", "accent-plum", "accent-ink", "accent-fuchsia", "accent-gold", "accent-cyan", "accent-rose", "accent-coral",
          "skin-glass", "skin-cute", "skin-dream", "skin-bloody",
          "font-song", "font-hei", "font-round", "font-elegant", "font-brush", "font-hand", "font-cursive", "font-pixel",
          "nav-icon-c", "nav-label-c", "nav-has-img", "ico-c", "ico-sw",
        );
        root.classList.add("font-hei");
        delete root.dataset.bubble;
        delete root.dataset.avatar;
        delete root.dataset.aframe;
        delete root.dataset.stone;
        delete root.dataset.navshape;
        delete root.dataset.navfill;
        delete root.dataset.navanim;
        delete root.dataset.ibtn;
        delete root.dataset.ibtnfill;
        applyFreeStyle(undefined, undefined, undefined);
        applyLookCss("");
        for (const k of ["--nav-c", "--nav-icon", "--nav-label", "--nav-img", "--ico-c", "--btn-c", "--ico-sw", "--ico-scale", "--scene-dim", "--scene-blur"]) {
          root.style.removeProperty(k);
        }
        return;
      }
      const dark = look.mode === "dark" || (look.mode === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", dark);
      root.classList.remove("accent-jade", "accent-plum", "accent-ink", "accent-fuchsia", "accent-gold", "accent-cyan", "accent-rose", "accent-coral");
      root.classList.add(`accent-${look.accent}`);
      root.classList.toggle("skin-glass", look.skin === "glass");
      root.classList.toggle("skin-cute", look.skin === "cute");
      root.classList.toggle("skin-dream", look.skin === "dream");
      root.classList.toggle("skin-bloody", look.skin === "bloody");
      root.classList.remove("font-song", "font-hei", "font-round", "font-elegant", "font-brush", "font-hand", "font-cursive", "font-pixel");
      root.classList.add(`font-${look.font ?? "song"}`);
      // 功能注释：预设字体依赖镜像 stylesheet；未加载时 class 换了字却还是系统默认
      ensureGameFontsLoaded();
      root.dataset.bubble = look.bubbleStyle ?? "frost";
      root.dataset.avatar = look.avatarShape ?? "rounded";
      root.dataset.aframe = look.avatarFrame ?? "white";
      root.dataset.stone = look.sceneTone ?? "none";
      applyFreeStyle(look.free, look.dialogDiy, look.topbarDiy);
      applyLookCss(lookCss); // 剧情美化的条件 CSS
      const na = look.navActive ?? {};
      root.dataset.navshape = na.shape ?? "pill";
      root.dataset.navfill = na.fill ?? "gradient";
      root.dataset.navanim = na.anim ?? "pop";
      const cssv = (k: string, v?: string) => (v ? root.style.setProperty(k, v) : root.style.removeProperty(k));
      cssv("--nav-c", na.color); cssv("--nav-icon", na.iconColor); cssv("--nav-label", na.labelColor);
      cssv("--nav-img", na.bgImg ? `url("${na.bgImg.replace(/"/g, "")}")` : undefined);
      root.classList.toggle("nav-icon-c", !!na.iconColor);
      root.classList.toggle("nav-label-c", !!na.labelColor);
      root.classList.toggle("nav-has-img", !!na.bgImg);
      // 图标与按钮 DIY
      const ic = look.icons ?? {};
      root.classList.toggle("ico-c", !!ic.color);
      root.classList.toggle("ico-sw", ic.stroke != null);
      cssv("--ico-c", ic.color); cssv("--btn-c", ic.btnColor);
      cssv("--ico-sw", ic.stroke != null ? String(ic.stroke) : undefined);
      cssv("--ico-scale", ic.scale ? String(ic.scale / 100) : undefined);
      if (ic.btnShape) root.dataset.ibtn = ic.btnShape; else delete root.dataset.ibtn;
      if (ic.btnFill) root.dataset.ibtnfill = ic.btnFill; else delete root.dataset.ibtnfill;
      root.style.setProperty("--scene-dim", String((look.sceneDim ?? 45) / 100));
      root.style.setProperty("--scene-blur", `${look.sceneBlur ?? 0}px`);
      // 功能注释：叙事段落半透明底；设置里可调，正文黑字叠在浅底上才看得清
      const storyA = Math.min(100, Math.max(40, look.storyBgAlpha ?? 88));
      root.style.setProperty("--story-panel-a", String(storyA / 100));
    };
    apply();
    if (!platformOnly && look.mode === "auto") {
      const mq = matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [look, lookCss, worldGenOpen, playModCreateOpen, previewing]);

  const gatePlatform = shouldGateRomancePlatformShell({
    search: typeof window !== 'undefined' ? window.location.search : '',
    hasWorldGenSession: worldGenOpen || playModCreateOpen || shouldResumeWorldGenSession(),
    isAuthorPreview: previewing,
    isStaff: readFunloomStaffFromStorage(),
  });

  // 功能注释：创作向导在预览时保持挂载（隐藏），滚动与草稿不丢；局内进预览则退出后按 takeReopenEditorMod 重开编辑器
  if (gatePlatform) {
    return <PlatformShellGate />;
  }

  return (
    <>
      {playModCreateOpen && !previewing ? (
        <div className="romance-platform min-h-screen" data-platform-ui="1">
          <PlayModCreateShell
            onClose={() => {
              closePlayModCreate();
              if (typeof history !== "undefined" && history.length > 1) history.back();
            }}
          />
        </div>
      ) : worldGenOpen ? (
        <div
          /* 功能注释：预览时向导壳保活但 hidden；去掉 data-platform-ui，避免 Modal 误挂进不可见树 */
          className={previewing ? "hidden" : "romance-platform min-h-screen"}
          {...(previewing ? {} : { "data-platform-ui": "1" })}
          aria-hidden={previewing || undefined}
        >
          <WorldGenWizard
            onBack={() => {
              closeWorldGen();
              if (typeof history !== "undefined" && history.length > 1) history.back();
            }}
            onComplete={() => {
              closeWorldGen();
            }}
          />
        </div>
      ) : !previewing ? (
        <PlayScreens />
      ) : null}

      {previewing ? (
        /* 功能注释：顶栏占流 + 下方预览区 flex-1，游戏用剩余高度；禁止 fixed 顶栏盖住局内顶/底栏 */
        <div
          className="author-preview-runtime flex h-[100vh] h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[var(--paper)] text-[var(--ink)]"
          data-author-preview-shell="1"
        >
          <AuthorPreviewChrome />
          <div className="author-preview-stage min-h-0 flex-1 overflow-hidden" data-author-preview-stage="1">
            <AuthorPreviewPlayShell>
              <PlayScreens key={`preview-${saveEpoch}`} />
            </AuthorPreviewPlayShell>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function App() {
  return (
    <GameProvider>
      <ErrorBoundary>
        <Root />
      </ErrorBoundary>
    </GameProvider>
  );
}

// 供单测 / 外部探测：是否处于作者预览（避免 tree-shake 误删）
void isAuthorPreview;
