import ModRoomTreeEditor from "./ModRoomTreeEditor";
import { useDraft, fmtDraftTime, peekDraft, writeSavedVersionAt, resolveSavedVersionAt, type DraftCursor } from "../lib/useDraft";
import { Modal } from "./ui";
import { loadConfig } from "../lib/store";
import { synthSpeech } from "./phone/screenShare";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { importModJson, useMods, validateMod } from "../mods/registry";
import { applyPlatformThemeToMod, patchWorldTheme, readWorldThemeHint, type WorldThemeFieldsPatch } from "../lib/worldTheme";
import WorldThemeFields from "./WorldThemeFields";
import { fetchPlatformGameTheme, fetchPlatformThemeTags, type PlatformThemeTag } from "../lib/platformThemeTags";
import { readRomancePlatformDraftId } from "../lib/platformRomanceDraft";
import {
  AUTHOR_PREVIEW_END,
  AUTHOR_PREVIEW_FATAL,
  assessAuthorPreview,
  assessAuthorRequiredFields,
  requestAuthorPreview,
  type AuthorPreviewSession,
  type AuthorRequiredIssue,
} from "../lib/authorPreview";
import type { Mod, ModKind, PromptFragments, TermKey } from "../mods/types";
import type { Option } from "../game/data";
import type { Dir, PersonContent, RoomContent } from "../worlds/star2005/content";
import ModBgmEditor from "./ModBgmEditor";
import { locationBgmOptions } from "../lib/modMusic";
import { PLATFORM_AUDIO } from "../game/platformAudio";
import { useGame } from "../store/gameCtx";
import ModTravelEditor from "./ModTravelEditor";
import StartDateSelects from "./StartDateSelects";
import ModAvatarPoolsEditor from "./ModAvatarPoolsEditor";
import { variantNames } from "../game/avatarPools";
import ModCarsEditor from "./ModCarsEditor";
import SlotDataEditor from "./DataForm";
import { ModGigsEditor, ModMealsEditor, ModPregnancyEditor } from "./ModPackEditors";
import { STAT_LABELS, RAW_STAT_LABELS, ALL_STAT_KEYS } from "../game/data";
import { perkKeyOptions } from "../game/perkKeys";
import ModWorldBookEditor from "./ModWorldBookEditor";
import ModRelationsEditor from "./ModRelationsEditor";
import ImagePicker from "./ImagePicker";
import {
  NPC_AVATAR_GEN_SIZE,
  buildNpcAvatarPromptParts,
  workImageGenFromParts,
  workImageSettingsOf,
  type EditorImagePromptParts,
  type WorkImageGenBinding,
} from "../lib/editorImagePrompts";
import { foldLoreFestivalsIntoWorldBook, worldBookMissingDepsErrors } from "../lib/worldBookDeps";
import { DraftRefsContext } from "./draftRefsContext";
import { buildDraftRefs } from "../lib/draftRefs";
import { valueSources } from "../game/valueSources";
import { workMetricKeys } from "../lib/gameRulePresets";
import { keywordTexts } from "../lib/worldBookKeywords";
import {
  humanizeSaveError,
  prepareModForSave,
  resolveSaveErrorJump,
} from "../lib/modSaveHeal";
import FixedEventsPanel from "./FixedEventsPanel";
import ContactsPanel from "./ContactsPanel";
import EndingsPanel from "./EndingsPanel";
import ModIncomeEditor from "./ModIncomeEditor";
import { ModCoverEditor } from "./ModOpeningEditor";
import { coverDisplayUrl } from "./Cover";
import OpeningStyleStudio from "./OpeningStyleStudio";
import ModTrainingsEditor from "./ModTrainingsEditor";
import ModActsEditor from "./ModActsEditor";
import ModRulesEditor from "./ModRulesEditor";
import ModTuningEditor from "./ModTuningEditor";
import ModEconomyRulesPanel from "./ModEconomyRulesPanel";
import {
  GROW_MODULE_META,
  GROW_TUNING_SUB_META,
  type GrowModuleId,
  type GrowTuningSubId,
  isGrowEnabled,
  isGrowModuleOn,
  setGrowEnabled,
  clearGrowModule,
  enableGrowModule,
} from "../game/growModules";
import { isTuningModuleOn, clearTuningModule, enableTuningModule, pruneTuningSlot } from "../game/tuningModules";
import TimelineEditor from "./TimelineEditor";
import { worksMarkPreview } from "../lib/worksChip";
import NpcTagsPicker from "./NpcTagsPicker";
import ModPathsEditor from "./ModPathsEditor";
import type { StartFaction } from "../game/data";
import ModCreationFieldsEditor from "./ModCreationFieldsEditor";
import ModThemeEditor from "./ModThemeEditor";
import AddPlayModModal from "./AddPlayModModal";
import { improperPersonNameReason, sanitizeNpcFactionId } from "../lib/personName";
import { sanitizeModStrings } from "../lib/sanitizeModStrings";
import { applyScriptTone, consolidateScriptTone, readScriptTone } from "../lib/scriptTone";
import {
  isModDescOverLimit,
  isScriptToneOverLimit,
  MOD_DESC_MAX,
  modDescLen,
  SCRIPT_TONE_MAX,
  scriptToneLen,
  validateModBasicInfoLimits,
} from "../lib/modBasicInfoLimits";
import { readFunloomAuthorLabel } from "../lib/platformAvatarLibrary";
import {
  orphanedAutoPlayDeps,
  playModsDependingOn,
  summarizePlayModDeps,
} from "../lib/playModDepsSummary";
import {
  catalogBySlug,
  makeInstallFromCatalog,
  missingPlayModDepNames,
  pickPlayModOpenConfig,
  recommendPlayModsFromSetting,
  resolveInstalledEditorPanels,
  resolvePlayModInstallChain,
  syncFeaturesFromPlayModInstalls,
  type PlayModEditorPanelId,
} from "../mods/playModCatalog";
import GameRulesEditor from "./GameRulesEditor";
import StorylinesEditor from "./StorylinesEditor";
import SidelinesEditor from "./SidelinesEditor";
import PlotLinesTabs from "./PlotLinesTabs";
import LookRulesEditor from "./LookRulesEditor";
import PhoneAppsEditor from "./PhoneAppsEditor";
import NavTabsModEditor from "./NavTabsModEditor";
import type { PlaySlot } from "../lib/types";
import { Dirty, EmptyState, FieldErr, Help, ScopeBanner, SearchBox, matches, useConfirm } from "./EditorKit";
import { IconCheck, IconRedo, IconSpark, IconUndo, StatusMark } from "../lib/icons";

/* 模组可视化编辑器：无需手写 JSON 即可新建 / 编辑用户模组的常用槽位。
 * 保存走 importModJson（与 JSON 导入同一套校验），在下次开新局时生效。 */

const ID_RE = /^[a-z0-9][a-z0-9_-]{1,40}$/;
const VER_RE = /^\d+\.\d+\.\d+([-+].*)?$/;
/** 功能注释：校验兼容旧稿 2005-01-03；写入统一走 StartDateSelects → YYYY.MM.DD */
const DATE_RE = /^\d{4}[-./]\d{2}[-./]\d{2}$/;

/** 底栏页签术语键（编辑器同步写入；档案/支线是本体入口，不进底栏术语） */
const NAV_TAB_TERMS: { k: TermKey; label: string }[] = [
  { k: "tabWorld", label: "页签 · 世界" }, { k: "tabIndustry", label: "页签 · 行业" }, { k: "tabNpc", label: "页签 · 人物" },
  { k: "tabPhone", label: "页签 · 手机" }, { k: "tabImage", label: "页签 · 形象" },
];
const inp = "w-full min-w-0 rounded-lg border border-line bg-paper-2 px-2.5 py-1.5 text-[12.5px] text-ink placeholder:text-ink-soft/70 focus:border-jade focus:outline-none";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const lbl = "mb-0.5 block text-[10.5px] font-bold tracking-[0.12em] text-ink-soft";
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
const shortId = (p: string) => `${p}${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 4)}`;

export function blankMod(kind: ModKind): Mod {
  // 功能注释：新建世界默认开局资金 0、货币名「元」，预览不因资金缺项拦截；创作者可改名称
  return {
    id: "", name: "", version: "0.1.0", author: "", description: "", kind,
    dependencies: kind === "addon" ? ["ent"] : [],
    content: kind === "world" ? { startMoney: 0, moneyLabel: "元" } : {},
  };
}

/* 编辑器分组：玩法并入①基础；外观归「⑤ 美化」。
 * 功能注释：不再提供「全部」页签与独立「玩法 Mod」页；默认停在「① 基础」。搜索关键词仍可跨分组命中区块。 */
const GROUPS = [
  { k: "base", label: "① 基础", hint: "作品封面、名称与简介、剧本基调、时间与推进、头像、建角、人物线路、地点、音乐、已添加的玩法" },
  { k: "role", label: "② 角色", hint: "开局人物与关系档位（表白/婚礼请在「已添加的玩法」里加关系玩法）" },
  { k: "grow", label: "③ 养成", hint: "总养成开关 + 开哪些子项（课程、打工、账单、玩法规则、评级、休息）；分档在建角属性，头衔在玩法 Mod；扣费与破产在④结局" },
  { k: "story", label: "④ 剧情", hint: "世界书、固定 / 首次事件、剧情线（主线 · 支线 · 结局）" },
  { k: "look", label: "⑤ 美化", hint: "手机外观、皮肤美化、开场页外观、剧情美化、底栏样式" },
  { k: "pack", label: "本包内容", hint: "只列出这个叠加包里实际写了内容的区块；要加别的内容，去其他分组找" },
] as const;
const STEPS = GROUPS.filter((x) => x.k !== "pack");
type GroupKey = (typeof GROUPS)[number]["k"];
const GroupCtx = createContext<{ cur: GroupKey; q: string }>({ cur: "base", q: "" });

/* 各分组里「已填写内容」的区块数，显示在分组页签上，一眼看出哪里还没动过 */
const has = (x: unknown) => Array.isArray(x) ? x.length > 0 : x && typeof x === "object" ? Object.keys(x).length > 0 : x !== undefined && x !== "";
function groupFilled(c: Mod["content"], skinOn = false): Record<Exclude<GroupKey, "pack">, number> {
  const n = (...xs: boolean[]) => xs.filter(Boolean).length;
  return {
    base: n(
      has(c.cover),
      !!readScriptTone(c.prompt),
      has(c.startDate) || has(c.travel?.apPerTurn) || has(c.travel?.advanceUnit),
      has(c.avatars),
      has(c.customAttrs) || has(c.creation?.fields) || has(c.creation?.builtin) || c.startMoney !== undefined,
      has(c.creation?.paths),
      has(c.startRoom) || has(c.rooms),
      has(c.bgm) || has(c.audioRefs) || has(c.platformAudioRefs),
      has(c.playModInstalls),
      has(c.travel) || has(c.cars),
      has(c.gigs) || has(c.gigPrices) || has(c.contracts) || has(c.projects) || has(c.industry),
      has(c.imageCrisis) || has(c.weeklyPaper) || has(c.meals) || has(c.pregnancy) || has(c.titles) || has(c.relations),
    ),
    role: n(has(c.npcs), has(c.contacts)),
    // 功能注释：养成只计总开关与子项；扣费/破产在④结局；开局资金已并进①基础·建角
    grow: n(isGrowEnabled(c), has(c.trainings), has(c.sideJobs) || has(c.weekendActs), has(c.bills) || has(c.income), has(c.gameRules), has(c.tuning)),
    story: n(has(c.worldBook), has(c.fixedEvents) || has(c.events), has(c.storylines) || has(c.sidelines) || has(c.endings) || has(c.timeLimit) || has(c.gradeDims) || has(c.tuning?.economy)),
    look: n(
      has(c.phoneAppsCfg),
      has(c.theme),
      has(c.opening),
      has(c.lookRules),
      has(c.navTabs) || has(c.navSize) || NAV_TAB_TERMS.some(({ k }) => !!c.terms?.[k]),
      skinOn,
    ),
  };
}
const isTextField = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || (t.tagName === "INPUT" && !["checkbox", "radio", "button", "range", "color", "file"].includes((t as HTMLInputElement).type)));

/* on：本区块在这个模组里写了内容（「本包内容」视图只列这些） */
function Section({ g, title, hint, count, children, defaultOpen, on, target }: { g: Exclude<GroupKey, "pack">; title: string; hint?: string; count?: number; children: ReactNode; defaultOpen?: boolean; on?: boolean; target?: string }) {
  const { cur, q } = useContext(GroupCtx);
  const s = String(q ?? "").trim().toLowerCase();
  // 功能注释：有搜索词时跨分组展示命中项；无搜索时只显示当前分组（本包内容另按 on）
  if (s ? !(title + (hint ?? "")).toLowerCase().includes(s) : cur === "pack" ? !on : cur !== g) return null;
  // 功能注释：当前分组 / 搜索命中 / 本包内容一览时默认展开，避免叠包作者还要逐块点开
  const open = defaultOpen || !!s || cur === g || cur === "pack";
  return (
    <details data-author-section={target} open={open || undefined} className="group rounded-2xl border border-line bg-paper/50">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5">
        <span className="text-[13px] font-bold text-ink">{title}</span>
        {!!count && <span className="rounded-full bg-jade/15 px-1.5 text-[10.5px] font-semibold text-jade">{count}</span>}
        {hint && <span className="min-w-0 flex-1 truncate text-[11px] text-ink-soft">{hint}</span>}
        <span className="ml-auto text-[12px] text-ink-soft transition group-open:rotate-90">›</span>
      </summary>
      <div className="space-y-2.5 border-t border-line/60 px-3 py-3">{children}</div>
    </details>
  );
}

const GROUP_KEYS = new Set<string>(GROUPS.map((g) => g.k));

export default function ModEditorPanel({ initial, isNew, onClose, onAiChat, onBackToWizard, initialGroup, onLiveChange, onChromeChange, onCommitted, resumeDraftChoice, savedVersionAt: savedVersionAtProp, fluid, localDraftKey }: {
  initial: Mod;
  isNew: boolean;
  onClose: (savedName?: string, savedId?: string) => void;
  onAiChat?: (m: Mod) => void;
  /** 创作向导第 2 步：返回第 1 步改设定（不放弃当前编辑草稿） */
  onBackToWizard?: () => void;
  /**
   * 功能注释：仅「继续填写草稿」后由上层传入；有待选草稿时禁止用它抢先跳到上次填写位置。
   */
  initialGroup?: string;
  /**
   * 功能注释：编辑中可回传最新剧本供预览等；禁止把未保存填写写成「已保存作品」会话基线。
   */
  onLiveChange?: (m: Mod) => void;
  /** 功能注释：分区切换时通知向导（未选草稿前不报上次停留位） */
  onChromeChange?: (snap: { group: string }) => void;
  /** 功能注释：用户点保存成功后回传，供向导把会话基线更新为已保存版本 */
  onCommitted?: (m: Mod) => void;
  /**
   * 功能注释：入口已替用户选过版本时跳过弹窗：continue 加载草稿+位置，saved 用已保存并从开头开始。
   */
  resumeDraftChoice?: "continue" | "saved" | null;
  /**
   * 功能注释：已保存版本的时间兜底（如向导会话 updatedAt）；本机有记下的保存时刻时优先用记下的。
   */
  savedVersionAt?: number | null;
  /**
   * 功能注释：生成世界流式宽——手机 100% 设备宽，PC 最大 1200 居中。
   * 默认仍锁 1200 最小宽供桌面模组库（非生成世界入口）。
   */
  fluid?: boolean;
  /**
   * 功能注释：平台书架续编时传入稳定草稿键（如 mod.platform.{fileId}），整次编辑不随 isNew/persisted 改键，避免串稿。
   */
  localDraftKey?: string;
}) {
  // 功能注释：有平台键则全程固定；否则仍按「新建 → new / 已落库 → mod.id」
  const resolveLocalDraftKey = (persistedNow: boolean, modId: string) =>
    localDraftKey || `mod.${persistedNow ? modId : "new"}`;
  const { mods } = useMods();
  const { game } = useGame();
  /**
   * 功能注释：fluid = 生成世界 / 作者态。精简基本信息入口（藏版本/作者/图标/类型/底座依赖），
   * 模组库高级入口仍用完整表单。底层字段一律保留，不因隐藏而清空。
   */
  const authorSimplify = !!fluid;
  /**
   * 功能注释：仅新建作品绑当前账号作者、补全空 id / 版本；编辑旧作绝不覆盖原作者与原 id。
   * 用 ref 保证 baseline 与首屏 m 同一份，避免进页即 dirty。
   */
  const bootModRef = useRef<Mod | null>(null);
  if (!bootModRef.current) {
    let boot = sanitizeModStrings(structuredClone(initial));
    if (isNew) {
      if (!String(boot.author ?? "").trim()) {
        const label = readFunloomAuthorLabel();
        if (label) boot = { ...boot, author: label };
      }
      if (!String(boot.id ?? "").trim()) {
        boot = { ...boot, id: `ai-${Date.now().toString(36)}` };
      }
      if (!VER_RE.test(String(boot.version ?? ""))) {
        boot = { ...boot, version: "0.1.0" };
      }
    }
    // 功能注释：进编辑器就把旧「详细设定 / 节日」并入世界书，只留一处可编辑
    boot = { ...boot, content: foldLoreFestivalsIntoWorldBook(boot.content) };
    bootModRef.current = boot;
  }
  const [baseline, setBaseline] = useState(() => JSON.stringify(bootModRef.current!));
  const [m, setMRaw] = useState<Mod>(() => bootModRef.current!);
  // 功能注释：C0.2 当前作品世界题材（清单可选字段）；安装玩法 / 应用时用来提示适用题材不一致
  const worldTheme = useMemo(() => readWorldThemeHint(m), [m]);
  // 功能注释：平台公共题材只拉一次（lib 内缓存 / 去重），同时供题材下拉、玩法商店与手机应用的「适用题材」解析共用
  const [platformThemeTags, setPlatformThemeTags] = useState<PlatformThemeTag[]>([]);
  useEffect(() => {
    let cancelled = false;
    void fetchPlatformThemeTags().then((list) => { if (!cancelled) setPlatformThemeTags(list); });
    return () => { cancelled = true; };
  }, []);
  const enabledThemeTags = platformThemeTags.length ? platformThemeTags : undefined;
  // 保存后留在编辑器：persisted = 已写入过模组库（id 从此锁定）；savedName 用于返回时提示
  const [persisted, setPersisted] = useState(!isNew);
  const [savedName, setSavedName] = useState<string>();
  const [savedId, setSavedId] = useState<string>();
  const [savedTip, setSavedTip] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [previewFatal, setPreviewFatal] = useState<string[]>([]);
  const [requiredGate, setRequiredGate] = useState<{ action: "预览" | "保存并离开"; issues: AuthorRequiredIssue[] } | null>(null);
  // —— 撤销 / 重做：连续输入（700ms 内）合并为一步；rev 变化时重挂表单，让各子编辑器的本地输入框同步 ——
  const hist = useRef<{ past: Mod[]; future: Mod[]; at: number }>({ past: [], future: [], at: 0 });
  const [rev, setRev] = useState(0);
  const liveCb = useRef(onLiveChange);
  liveCb.current = onLiveChange;
  const setM = (next: Mod) => {
    const h = hist.current; const now = Date.now();
    if (now - h.at > 700 || !h.past.length) { h.past.push(m); if (h.past.length > 100) h.past.shift(); }
    h.at = now; h.future = [];
    setMRaw(next);
    liveCb.current?.(next);
  };
  // 功能注释：平台书架续编时，把平台作品题材补进清单（只补缺，不覆盖创作者已写）；每个作品只取一次
  const mLatestRef = useRef(m);
  mLatestRef.current = m;
  const setMLatestRef = useRef(setM);
  setMLatestRef.current = setM;
  useEffect(() => {
    const fileId = readRomancePlatformDraftId();
    if (!fileId) return;
    const cur = mLatestRef.current;
    const hint = readWorldThemeHint(cur);
    if (hint.themeTagId != null && hint.themeLabel) return;
    let cancelled = false;
    void fetchPlatformGameTheme(fileId).then((theme) => {
      if (cancelled || !theme) return;
      const latest = mLatestRef.current;
      const next = applyPlatformThemeToMod(latest, theme);
      if (next !== latest) setMLatestRef.current(next);
    });
    return () => { cancelled = true; };
  }, []);
  const patchTheme = (patch: Partial<WorldThemeFieldsPatch>) => setM(patchWorldTheme(m, patch));
  const lockId = (x: Mod) => (persisted && x.id !== m.id ? { ...x, id: m.id } : x);
  const undo = () => { const h = hist.current; const prev = h.past.pop(); if (!prev) return; h.future.push(m); h.at = 0; const n = lockId(prev); setMRaw(n); liveCb.current?.(n); setRev((r) => r + 1); };
  const redo = () => { const h = hist.current; const next = h.future.pop(); if (!next) return; h.past.push(m); h.at = 0; const n = lockId(next); setMRaw(n); liveCb.current?.(n); setRev((r) => r + 1); };
  const rootRef = useRef<HTMLDivElement>(null);
  /** 功能注释：把会话/草稿里的分区名收成现行 GroupKey；旧「玩法」页并入基础 */
  const normalizeGroup = (raw?: string | null): GroupKey => {
    const boot =
      raw === "ext" || raw === "play" ? "base"
      : raw === "world" || raw === "all" ? "base"
      : raw;
    if (boot && GROUP_KEYS.has(boot)) return boot as GroupKey;
    return initial.kind === "addon" && Object.keys(initial.content ?? {}).length ? "pack" : "base";
  };
  // 功能注释：有待选草稿时先停在表单开头，禁止用 initialGroup 把人送进上次填写位置
  const [group, setGroup] = useState<GroupKey>(() => {
    const conflict = peekDraft<Mod>(
      resolveLocalDraftKey(!isNew, String(initial.id || "new")),
      JSON.stringify(bootModRef.current),
    );
    if (conflict) return "base";
    return normalizeGroup(initialGroup);
  });
  const goGroup = (k: GroupKey) => { setGroup(k); setQ(""); rootRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }); };
  /** 功能注释：必填弹窗点某项 → 切到对应页签、滚到建角字段并高亮；开局资金须落在①基础·建角行。 */
  const [focusAuthorField, setFocusAuthorField] = useState<string | null>(null);
  const goRequiredIssue = (issue: AuthorRequiredIssue) => {
    setRequiredGate(null);
    setGroup(issue.group);
    setQ("");
    setFocusAuthorField(issue.target);
    window.setTimeout(() => {
      const field = rootRef.current?.querySelector<HTMLElement>(`[data-author-field="${issue.target}"]`);
      const section = rootRef.current?.querySelector<HTMLElement>(`[data-author-section="${issue.target}"]`);
      const target = field ?? section;
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
      if (field && (field.tagName === "INPUT" || field.tagName === "TEXTAREA" || field.tagName === "SELECT")) {
        field.focus({ preventScroll: true });
      }
      window.setTimeout(() => setFocusAuthorField((cur) => (cur === issue.target ? null : cur)), 2800);
    }, 60);
  };
  const blockIfRequiredMissing = (action: "预览" | "保存并离开") => {
    const issues = assessAuthorRequiredFields(m);
    if (!issues.length) return false;
    setRequiredGate({ action, issues });
    return true;
  };
  const chromeCb = useRef(onChromeChange);
  chromeCb.current = onChromeChange;
  const filled = useMemo(() => groupFilled(m.content, has(m.ext?.skin)), [m.content, m.ext?.skin]);
  const [q, setQ] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [errorsExpanded, setErrorsExpanded] = useState(false);
  /** 功能注释：保存自愈说明（补 id / 停用未挂靠世界书），成功后短时展示，不挡保存 */
  const [healNotes, setHealNotes] = useState<string[]>([]);
  const [npcQ, setNpcQ] = useState("");
  const [confirm, confirmEl] = useConfirm();
  const dirty = JSON.stringify(m) !== baseline;
  const draftCursor: DraftCursor = {
    group,
    scrollY: typeof window !== "undefined" ? window.scrollY || 0 : 0,
  };
  // 本机草稿：编辑中自动缓存。刚进入且与已保存不一致时先问版本；问完前不打开表单、不跳上次位置。
  const draft = useDraft<Mod>(resolveLocalDraftKey(persisted, m.id), m, baseline, dirty, draftCursor);
  const draftChoiceApplied = useRef(false);
  // 功能注释：入口已选定版本时直接执行，不再二次弹窗
  useEffect(() => {
    if (draftChoiceApplied.current || !resumeDraftChoice || !draft.pending) return;
    draftChoiceApplied.current = true;
    if (resumeDraftChoice === "continue") {
      const row = draft.restore();
      if (!row) return;
      // 功能注释：本机草稿可能早于自愈逻辑；恢复时再 sanitize，避免缺 branches / 脏 opening 拦保存
      const restored = lockId(sanitizeModStrings(structuredClone(row.value)));
      setMRaw(restored);
      liveCb.current?.(structuredClone(restored));
      setRev((r) => r + 1);
      if (row.cursor?.group) setGroup(normalizeGroup(row.cursor.group));
      else if (initialGroup) setGroup(normalizeGroup(initialGroup));
      const y = row.cursor?.scrollY;
      if (typeof y === "number" && y > 0) requestAnimationFrame(() => window.scrollTo(0, y));
      return;
    }
    draft.discard();
    setGroup(normalizeGroup(null));
    requestAnimationFrame(() => window.scrollTo(0, 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅首屏消费入口选择
  }, [resumeDraftChoice]);
  // 功能注释：选完草稿前不把分区报给会话，避免未保存停留位写进作品会话
  useEffect(() => {
    if (draft.pending) return;
    chromeCb.current?.({ group });
  }, [group, draft.pending]);
  const c = m.content;
  // 功能注释：每次写入内容时清掉已下线的「几点几分 / 建角自选开局日期」槽，旧稿打开再保存即对齐新产品约定
  const setC = (p: Partial<Mod["content"]>) => {
    const next = { ...m.content, ...p } as Mod["content"] & {
      startTime?: string; dayStart?: string; dayEnd?: string;
    };
    delete next.startTime;
    delete next.dayStart;
    delete next.dayEnd;
    if (next.play) {
      // 功能注释：年龄随日历已内置开启，创作者不再配置；顺带清掉已下线的建角自选开局日期字段
      const play = { ...next.play } as PlaySlot & {
        pickStartDate?: boolean; startDateMin?: string; startDateMax?: string;
      };
      delete play.ageAuto;
      delete play.pickStartDate;
      delete play.startDateMin;
      delete play.startDateMax;
      next.play = Object.keys(play).length ? play : undefined;
    }
    // 功能注释：换地点 AP、推进叙事字数、叙事开关均内置，剥掉旧稿可配残留
    if (next.travel) {
      const { advanceStory: _as, apPerMove: _ap, advanceWords: _aw, ...travel } = next.travel as typeof next.travel & {
        advanceStory?: boolean; apPerMove?: number; advanceWords?: number;
      };
      void _as; void _ap; void _aw;
      next.travel = travel;
    }
    setM({ ...m, content: next });
  };
  const [addPlayOpen, setAddPlayOpen] = useState(false);
  /* 功能注释：玩法配置面板按已安装 Mod 动态出现；编辑 addon 本体时按其目录声明的面板展示 */
  const playPanels = useMemo(() => {
    if (m.kind === "addon") {
      const cat = catalogBySlug(m.id);
      if (cat) return new Set<PlayModEditorPanelId>(cat.editorPanels);
    }
    return resolveInstalledEditorPanels(c.playModInstalls);
  }, [m.kind, m.id, c.playModInstalls]);
  const showPlay = (panel: PlayModEditorPanelId) => playPanels.has(panel);
  // 功能注释：「代表作」等娱乐圈人物栏只在演艺事业相关玩法装上后显示
  const showCareerNpcFields =
    showPlay("gigs") || showPlay("contracts") || showPlay("projects") || showPlay("industry");
  // 功能注释：势力块已从地点页撤下；人物「所属势力」只绑当前作品仍存在的 startFactions
  const startFactions: StartFaction[] = Array.isArray(c.creation?.startFactions) ? c.creation!.startFactions! : [];
  const startFactionIds = useMemo(
    () => new Set(startFactions.map((f) => f.id).filter(Boolean)),
    [startFactions],
  );
  // 功能注释：势力列表变化时丢掉已失效 factionId，避免下拉里出现「已失效」
  useEffect(() => {
    let changed = false;
    const next = npcs.map((n) => {
      const cleaned = sanitizeNpcFactionId(n.factionId, startFactionIds);
      if (cleaned === (n.factionId?.trim() || undefined)) return n;
      changed = true;
      return { ...n, factionId: cleaned };
    });
    if (changed) setC({ npcs: next });
    // 仅跟势力表走；人物手改不在此重扫
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startFactionIds
  }, [startFactionIds]);
  /** 功能注释：按故事设定推荐玩法 mod，须作者点「安装」才写入；绝不自动添加 */
  const playModRecs = useMemo(() => {
    const seed = [m.description, readScriptTone(c.prompt)].filter(Boolean).join("\n");
    return recommendPlayModsFromSetting(seed, c.playModInstalls);
  }, [m.description, c.prompt, c.playModInstalls]);
  const installRecommended = async (slug: string) => {
    const item = catalogBySlug(slug);
    if (!item) return;
    const cur = c.playModInstalls ?? [];
    const depNames = missingPlayModDepNames(item, cur);
    if (depNames.length) {
      if (!(await confirm(`「${item.name}」需要「${depNames.join("、")}」才能正常使用。是否一并添加？`))) return;
    } else if (!(await confirm(`确认添加「${item.name}」？添加后才会出现对应配置区。`))) {
      return;
    }
    const chain = resolvePlayModInstallChain(item, cur);
    let next = [...cur];
    for (const row of chain) {
      if (next.some((x) => x.slug === row.slug)) continue;
      const rowInst = {
        ...makeInstallFromCatalog(row, next.length),
        ...(row.slug !== item.slug ? { autoInstalled: true as const } : {}),
      };
      next = [...next, rowInst];
    }
    const patch: Partial<Mod["content"]> = {
      playModInstalls: next,
      features: syncFeaturesFromPlayModInstalls(next, c.features) as Mod["content"]["features"],
    };
    // 功能注释：刚装上头衔包且尚无表时给一条空白头衔，方便作者从空表填起
    if (chain.some((row) => row.slug === "pack-titles") && !(c.titles && c.titles.length)) {
      patch.titles = [{ id: `t_${Date.now().toString(36).slice(-5)}`, name: "", tier: "青铜", req: {}, desc: "" }];
    }
    // 功能注释：装上关系玩法且尚无 relations 槽时给空对象，打开配置面板便于改门槛
    if (chain.some((row) => row.slug === "pack-relations" || row.editorPanels?.includes("relations")) && !c.relations) {
      // 功能注释：空槽即可打开关系配置面板，缺省字段由下游 normalize 补齐
      patch.relations = {} as NonNullable<Mod["content"]["relations"]>;
    }
    setC(patch);
  };
  /**
   * 功能注释：从作品移除玩法。若仍被其它玩法依赖则强提示；
   * 移除后对「系统自动装入且无人再需要」的依赖二次确认，手动装入的绝不静默删。
   */
  const removePlayInstall = async (slug: string) => {
    const cur = c.playModInstalls ?? [];
    const target = cur.find((x) => x.slug === slug);
    if (!target) return;
    const name = catalogBySlug(slug)?.name || slug;
    const blockers = playModsDependingOn(slug, cur);
    if (blockers.length) {
      if (!(await confirm(
        `「${name}」仍被「${blockers.map((b) => b.name).join("、")}」依赖。移除后它们可能无法正常使用。仍要移除？`,
        { ok: "仍要移除" },
      ))) return;
    } else if (!(await confirm(`从本作品移除「${name}」？已填配置会一并删除。`, { ok: "移除" }))) {
      return;
    }
    let next = cur.filter((x) => x.slug !== slug);
    const orphans = orphanedAutoPlayDeps(next);
    if (orphans.length) {
      const names = orphans.map((o) => catalogBySlug(o.slug)?.name || o.slug).join("、");
      if (await confirm(
        `以下依赖由系统自动添加，且已不再被其它玩法需要：${names}。是否一并移除？（点取消则保留这些依赖）`,
        { ok: "一并移除" },
      )) {
        const drop = new Set(orphans.map((o) => o.slug));
        next = next.filter((x) => !drop.has(x.slug));
      }
    }
    const patch: Partial<Mod["content"]> = {
      playModInstalls: next.length ? next : undefined,
      features: syncFeaturesFromPlayModInstalls(next, c.features) as Mod["content"]["features"],
    };
    // 功能注释：卸掉头衔包时清掉头衔表，未添加的剧本不应残留头衔
    if (slug === "pack-titles" || catalogBySlug(slug)?.editorPanels.includes("titles")) {
      patch.titles = undefined;
    }
    // 功能注释：卸掉关系玩法时清配置，避免未安装却残留表白/婚礼数值
    if (slug === "pack-relations" || catalogBySlug(slug)?.editorPanels.includes("relations")) {
      patch.relations = undefined;
    }
    setC(patch);
  };
  // —— 字段级校验 ——
  const builtinIds = new Set(mods.filter((x) => x.builtin).map((x) => x.id));
  const idErr = !ID_RE.test(m.id) ? "2~41 位小写字母 / 数字 / - _，首字符为字母或数字"
    : builtinIds.has(m.id) ? "与内置模组同名，请换一个"
    : !persisted && mods.some((x) => x.id === m.id) ? "已存在同 id 的模组，保存将覆盖它" : "";
  // 功能注释：AI 脏数据可能把 name 写成非字符串，禁止直接 .trim()
  const nameErr = String(m.name ?? "").trim() ? "" : "必填";
  const scriptToneText = readScriptTone(c.prompt);
  const descOver = isModDescOverLimit(m.description);
  const toneOver = isScriptToneOverLimit(scriptToneText);
  const descErr = descOver ? `最多 ${MOD_DESC_MAX} 字` : "";
  const toneErr = toneOver ? `最多 ${SCRIPT_TONE_MAX} 字` : "";
  const verErr = VER_RE.test(m.version) ? "" : "须形如 1.0.0";
  const dateErr = c.startDate && !DATE_RE.test(c.startDate) ? "须形如 2005.01.03" : "";
  const rooms = c.rooms ?? {};
  const roomIds = Object.keys(rooms);
  const npcs = c.npcs ?? [];
  // 功能注释：当前表单的人物/地点/物品/属性/阵营——条件·效果下拉、默认值与引用审计只读这份，
  // 草稿为空就保持空，禁止回退 LIVE_PEOPLE / LIVE_LOCATIONS（内置娱乐圈）。
  const draftSrcs = valueSources({ stats: c.stats, attrs: c.customAttrs, paths: c.creation?.paths });
  const draftRefs = buildDraftRefs({
    npcs, rooms, items: c.items, factions: c.factions, attrs: c.customAttrs,
    statKeys: draftSrcs.filter((x) => x.kind === "stat").map((x) => x.key), srcs: draftSrcs,
    metricKeys: workMetricKeys({ attrs: c.customAttrs, metaLabels: c.stats?.metaLabels, startMoney: c.startMoney, moneyLabel: c.moneyLabel }),
  });
  const dupNpc = new Set(npcs.map((n) => n.id).filter((id, i, a) => a.indexOf(id) !== i));

  // —— 地点 ——
  const delRoom = async (id: string) => {
    const refs = npcs.filter((n) => n.home === id).length;
    const kidsN = Object.values(rooms).filter((r) => r.parent === id).length;
    if (!(await confirm(`删除地点「${rooms[id]?.name || id}」？${refs ? `\n有 ${refs} 位人物住在这里，需另选所在地点。` : ""}${kidsN ? `\n它的 ${kidsN} 个子地点会上移一层。` : ""}\n指向它的出口会一并清除。`))) return;
    const next: Record<string, RoomContent> = {};
    for (const [rid, r] of Object.entries(rooms)) if (rid !== id) {
      const exits = Object.fromEntries(Object.entries(r.exits ?? {}).filter(([, to]) => to !== id));
      // 子地点上移一层，挂到被删地点的父地点下（不会连带删掉整枝）
      next[rid] = { ...r, exits, ...(r.parent === id ? { parent: rooms[id]?.parent } : {}) };
    }
    // 功能注释：删掉开局地点后必须由作者重新勾选，禁止自动选列表第一项。
    setC({ rooms: next, startRoom: c.startRoom === id ? undefined : c.startRoom });
  };
  const renameRoom = (oldId: string, raw: string) => {
    const id = slug(raw);
    if (!id || id === oldId || rooms[id]) return;
    const next: Record<string, RoomContent> = {};
    for (const [rid, r] of Object.entries(rooms)) {
      const exits = Object.fromEntries(Object.entries(r.exits ?? {}).map(([d, to]) => [d, to === oldId ? id : to]));
      next[rid === oldId ? id : rid] = { ...r, exits, ...(r.parent === oldId ? { parent: id } : {}) };
    }
    setC({
      rooms: next, startRoom: c.startRoom === oldId ? id : c.startRoom,
      npcs: npcs.map((n) => ({ ...n, home: n.home === oldId ? id : n.home, roam: (n.roam ?? []).map((x) => (x === oldId ? id : x)) })),
    });
  };

  // —— 人物 ——
  const setNpc = (i: number, p: Partial<PersonContent>) => setC({ npcs: npcs.map((n, j) => (j === i ? { ...n, ...p } : n)) });
  // 功能注释：作品级画风 / 负面词（content.imageGen）——人物 / 地点 / 大地图 / 封面生图共用；点「开始生成」时把创作者改过的画风与负面词存回作品
  const imageGenBinding: WorkImageGenBinding = {
    settings: workImageSettingsOf(c.imageGen),
    onCommit: (parts: EditorImagePromptParts) => {
      const next = workImageGenFromParts(parts);
      if (JSON.stringify(next ?? null) !== JSON.stringify(c.imageGen ?? null)) setC({ imageGen: next });
    },
  };
  const addNpc = () => setC({ npcs: [...npcs, { id: shortId("npc_"), name: "", role: "", kind: "roam", home: c.startRoom ?? roomIds[0] ?? "", roam: [], bio: "", requires: [] }] });

  const clean = (): Mod => {
    const out: Mod = structuredClone(m);
    // 功能注释：详细设定 / 节日并入世界书，只保留一份，避免创作者写两遍
    out.content = foldLoreFestivalsIntoWorldBook(out.content);
    const ct = out.content;
    out.id = String(out.id ?? "").trim(); out.name = String(out.name ?? "").trim();
    if (ct.terms) {
      for (const k of Object.keys(ct.terms) as TermKey[]) {
        const raw = ct.terms[k] as unknown;
        const s = typeof raw === "string" ? raw.trim() : "";
        if (s) ct.terms[k] = s;
        else delete ct.terms[k];
      }
      if (!Object.keys(ct.terms).length) delete ct.terms;
    }
    if (ct.navTabs && !ct.navTabs.length) delete ct.navTabs;
    if (!ct.navSize) delete ct.navSize;
    // 功能注释：保存时把旧三字段并进 scriptTone，作者只维护一处
    if (ct.prompt) {
      ct.prompt = consolidateScriptTone(ct.prompt) ?? {};
      for (const k of Object.keys(ct.prompt) as (keyof PromptFragments)[]) {
        const v = ct.prompt[k];
        if (typeof v === "string" && !v.trim()) delete ct.prompt[k];
      }
      if (!Object.keys(ct.prompt).length) delete ct.prompt;
    }
    if (ct.features && !Object.keys(ct.features).length) delete ct.features;
    if (!ct.startDate) delete ct.startDate;
    // 功能注释：保存时剥掉已下线的换地点 AP / 推进叙事字数，运行时走内置默认
    if (ct.travel) {
      const { advanceStory: _as, apPerMove: _ap, advanceWords: _aw, ...travel } = ct.travel as typeof ct.travel & {
        advanceStory?: boolean; apPerMove?: number; advanceWords?: number;
      };
      void _as; void _ap; void _aw;
      ct.travel = travel;
    }
    if (!ct.weather) delete ct.weather;
    if (ct.rooms && !Object.keys(ct.rooms).length) { delete ct.rooms; delete ct.startRoom; }
    // 功能注释：作者态作品本体不挂 registry 底座；娱乐圈/校园骨架等不得被勾进 dependencies
    if (authorSimplify && out.kind === "world") out.dependencies = [];
    delete out.builtin;
    return out;
  };
  /** 功能注释：点保存错误项 → 切到对应页签并滚到区块（对齐必填弹窗定位体验） */
  const goSaveError = (raw: string) => {
    const jump = resolveSaveErrorJump(raw);
    if (!jump) return;
    setGroup(jump.group);
    setQ("");
    window.setTimeout(() => {
      if (!jump.target) {
        rootRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
        return;
      }
      // 功能注释：优先区块 details，其次 author-field（开局资金等嵌在建角列表里）
      const section =
        rootRef.current?.querySelector<HTMLElement>(`[data-author-section="${jump.target}"]`)
        ?? rootRef.current?.querySelector<HTMLElement>(`[data-author-field="${jump.target}"]`);
      section?.scrollIntoView({ block: "center", behavior: "smooth" });
      if (section && section.tagName === "DETAILS" && !(section as HTMLDetailsElement).open) {
        (section as HTMLDetailsElement).open = true;
      }
    }, 60);
  };

  const save = (stay = false) => {
    // 功能注释：留在编辑器的「保存」只存草稿；离开编辑器也只是保存草稿并退出，平台上架须走「提交发布审核」。
    if (!stay && blockIfRequiredMissing("保存并离开")) return false;
    const basicLimitErr = validateModBasicInfoLimits({
      description: m.description,
      scriptTone: readScriptTone(c.prompt),
    });
    const local = [idErr && !idErr.startsWith("已存在") ? `id：${idErr}` : "", nameErr && "名称必填", basicLimitErr,
      verErr && `版本号${verErr}`, dateErr && `开局日期${dateErr}`,
      dupNpc.size ? `人物 id 重复：${[...dupNpc].join("、")}` : "",
      npcs.some((n) => !String(n.name ?? "").trim()) ? "有人物未填写名字" : "",
      npcs.some((n) => !(typeof n.age === "number" && n.age >= 0)) ? `人物年龄必填：${npcs.filter((n) => !(typeof n.age === "number" && n.age >= 0)).map((n) => n.name || n.id).join("、")}` : "",
      npcs.some((n) => !String(n.gender ?? "").trim()) ? `人物性别必填：${npcs.filter((n) => !String(n.gender ?? "").trim()).map((n) => n.name || n.id).join("、")}` : "",
    ].filter(Boolean) as string[];
    const cleaned = clean();
    // 功能注释：不可变自愈（含 null 槽）；旧就地写法会跳过 null，validateMod 仍报缺 id
    const { mod: out, notes: healed } = prepareModForSave(cleaned);
    const errs = [...local, ...worldBookMissingDepsErrors(out.content.worldBook), ...validateMod(out)];
    if (errs.length) {
      setHealNotes([]);
      setErrorsExpanded(false);
      setErrors([...new Set(errs)]);
      return false;
    }
    const r = importModJson(JSON.stringify(out));
    if (!r.ok) { setErrors(r.errors); setHealNotes([]); return false; }
    draft.clear();
    // 功能注释：保存成功才把清洗后的版本交给上层作「已保存」基线；未保存填写不得冒充作品
    onCommitted?.(out);
    const committedAt = Date.now();
    // 功能注释：平台键与 mod.id 键都记保存时刻，冲突弹窗才能对照「已保存版本」
    writeSavedVersionAt(resolveLocalDraftKey(true, out.id), committedAt);
    writeSavedVersionAt(`mod.${out.id}`, committedAt);
    if (!localDraftKey) writeSavedVersionAt("mod.new", committedAt);
    if (!stay) { onClose(out.name, out.id); return true; }
    setErrors([]);
    setErrorsExpanded(false);
    setHealNotes(healed);
    setBaseline(JSON.stringify(out));
    setMRaw(out);
    setPersisted(true);
    setSavedName(out.name);
    setSavedId(out.id);
    setSavedTip(true);
    setSavedAt(committedAt);
    return true;
  };
  const cancel = async () => { if (!dirty || (await confirm("放弃未保存的修改？本机草稿也会一并删除。", { ok: "放弃" }))) { draft.clear(); onClose(savedName, savedId); } };

  /** 功能注释：返回设定向导前，有未保存修改须确认，避免表单白填 */
  const backToWizard = async () => {
    if (!onBackToWizard) return;
    if (dirty && !(await confirm("有未保存的修改，确定返回设定页？本机草稿仍会保留，可稍后恢复。", { ok: "返回设定" }))) return;
    onBackToWizard();
  };

  const openPreview = () => {
    // 功能注释：预览始终使用当前表单；先检查原始值，不能让 clean/默认值替作者补齐，通过后才清洗并启动。
    if (blockIfRequiredMissing("预览")) return;
    const out = clean();
    const { fatal, warnings } = assessAuthorPreview(out);
    if (fatal.length) {
      setPreviewFatal(fatal);
      return;
    }
    setPreviewFatal([]);
    requestAuthorPreview(out, warnings, window.scrollY || 0);
  };

  useEffect(() => { if (!savedTip) return; const t = setTimeout(() => setSavedTip(false), 3200); return () => clearTimeout(t); }, [savedTip]);
  useEffect(() => {
    const onFatal = (ev: Event) => {
      const errors = (ev as CustomEvent<{ errors?: string[] }>).detail?.errors;
      if (errors?.length) setPreviewFatal(errors);
    };
    const onPreviewEnd = (ev: Event) => {
      const y = (ev as CustomEvent<AuthorPreviewSession | null>).detail?.scrollY;
      if (typeof y === "number") {
        requestAnimationFrame(() => window.scrollTo(0, y));
      }
    };
    window.addEventListener(AUTHOR_PREVIEW_FATAL, onFatal);
    window.addEventListener(AUTHOR_PREVIEW_END, onPreviewEnd);
    return () => {
      window.removeEventListener(AUTHOR_PREVIEW_FATAL, onFatal);
      window.removeEventListener(AUTHOR_PREVIEW_END, onPreviewEnd);
    };
  }, []);
  // 快捷键：Ctrl/⌘+S 保存（留在编辑器）；不在输入框里时 Ctrl/⌘+Z 撤销、Ctrl/⌘+Shift+Z 或 Ctrl+Y 重做
  const keyRef = useRef({ save, undo, redo, block: false });
  keyRef.current = { save, undo, redo, block: !!draft.pending };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      if (keyRef.current.block) { e.preventDefault(); return; }
      if (k === "s") { e.preventDefault(); keyRef.current.save(true); return; }
      if (isTextField(e.target)) return;
      if (k === "z" && !e.shiftKey) { e.preventDefault(); keyRef.current.undo(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); keyRef.current.redo(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const otherMods = mods.filter((x) => x.id !== m.id);
  const deps = m.dependencies ?? [];
  const si = STEPS.findIndex((x) => x.k === group);
  const prevG = si <= 0 ? null : STEPS[si - 1];
  const nextG = group === "pack" || si < 0 || si === STEPS.length - 1 ? null : STEPS[si + 1];
  const canUndo = hist.current.past.length > 0, canRedo = hist.current.future.length > 0;

  const savedLabel = savedAt
    ? `已保存 · ${new Date(savedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
    : null;

  return (
    <DraftRefsContext.Provider value={draftRefs}>
    {/* 功能注释：非 fluid 锁 1200 最小宽；fluid 由 .world-gen-editor CSS 管：手机 100% / PC≤1200 */}
    <div
      ref={rootRef}
      inert={draft.pending ? true : undefined}
      className={`mod-editor-root mx-auto w-full scroll-mt-2 space-y-2.5 text-ink ${
        fluid ? "min-w-0 max-w-[1200px]" : "min-w-[1200px] max-w-[1200px]"
      }`}
    >
      {confirmEl}
      {requiredGate && (
        <Modal title={`${requiredGate.action}前还需补全`} onClose={() => setRequiredGate(null)} heavyBackdrop>
          <p className="text-[13px] leading-relaxed text-ink-soft">
            以下 {requiredGate.issues.length} 项缺失，补全前不能{requiredGate.action}。点击任一项可直接定位：
          </p>
          <div className="mt-3 space-y-1.5">
            {requiredGate.issues.map((issue) => (
              <button
                key={issue.field}
                type="button"
                onClick={() => goRequiredIssue(issue)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-paper px-3 py-2 text-left text-[12.5px] font-semibold text-ink transition hover:border-jade hover:text-jade"
              >
                <span>{issue.label}</span>
                <span aria-hidden>›</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {addPlayOpen && (
        <AddPlayModModal
          installs={c.playModInstalls ?? []}
          onChange={(playModInstalls) => {
            const next = playModInstalls.length ? playModInstalls : undefined;
            const addedTitles = (next ?? []).some((x) => x.slug === "pack-titles" || x.editorPanels?.includes("titles"))
              && !(c.playModInstalls ?? []).some((x) => x.slug === "pack-titles" || x.editorPanels?.includes("titles"));
            const addedRelations = (next ?? []).some((x) => x.slug === "pack-relations" || x.editorPanels?.includes("relations"))
              && !(c.playModInstalls ?? []).some((x) => x.slug === "pack-relations" || x.editorPanels?.includes("relations"));
            const patch: Partial<Mod["content"]> = {
              playModInstalls: next,
              features: syncFeaturesFromPlayModInstalls(next, c.features) as Mod["content"]["features"],
            };
            if (addedTitles && !(c.titles && c.titles.length)) {
              patch.titles = [{ id: `t_${Date.now().toString(36).slice(-5)}`, name: "", tier: "青铜", req: {}, desc: "" }];
            }
            if (addedRelations && !c.relations) {
              patch.relations = {} as NonNullable<Mod["content"]["relations"]>;
            }
            setC(patch);
          }}
          onClose={() => setAddPlayOpen(false)}
          onConfirmDeps={(message) => confirm(message, { ok: "一并添加" })}
          worldThemeTagId={worldTheme.themeTagId}
          worldThemeLabel={worldTheme.themeLabel}
          worldThemeCode={worldTheme.themeCode}
          enabledThemeTags={enabledThemeTags}
        />
      )}
      {/* 功能注释：顶栏固定「保存 / 预览」在右侧且 shrink-0，避免窄屏被标题挤出可视区 */}
      <div className="mod-editor-chrome sticky top-0 z-20 -mx-1 space-y-1 border-b border-line bg-paper-2/95 px-1 py-2 backdrop-blur">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button type="button" className={`${btn} shrink-0 !px-2 sm:!px-2.5`} onClick={() => (onBackToWizard ? void backToWizard() : void cancel())}>
            ‹ 返回
          </button>
          <span className="min-w-0 flex-1 truncate text-[13px] font-bold sm:text-[14px]">
            {persisted ? `编辑「${m.name || initial.name}」` : "创建世界"}
          </span>
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            {/* 功能注释：顶栏只留「保存 / 放弃 / 预览」；已去掉「保存后退出」按钮，退出用左侧‹返回 */}
            <button
              type="button"
              onClick={() => save(true)}
              disabled={persisted && !dirty}
              title="保存当前全部修改（Ctrl/⌘+S），留在编辑器"
              className="rounded-full bg-jade px-2.5 py-1.5 text-[12px] font-bold text-white transition disabled:opacity-40 sm:px-3.5 sm:text-[12.5px]"
            >
              保存
            </button>
            {dirty ? (
              <button type="button" className={`${btn} !text-ink-soft`} onClick={() => void cancel()} title="放弃未保存修改">
                放弃
              </button>
            ) : null}
            <button
              type="button"
              onClick={openPreview}
              title="用当前编辑内容启动完整游戏测试（无需先保存）"
              className="rounded-full border border-jade px-2.5 py-1.5 text-[12px] font-bold text-jade transition hover:bg-jade/10 sm:px-3.5 sm:text-[12.5px]"
            >
              预览
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pl-0.5">
          {dirty && draft.savedAt ? (
            <span className="text-[10.5px] text-ink-soft">草稿已存本机 · {fmtDraftTime(draft.savedAt)}</span>
          ) : null}
          {!dirty && savedLabel ? (
            <span className="text-[10.5px] font-bold text-jade">{savedLabel}</span>
          ) : null}
          {savedTip && savedLabel ? (
            <span className="text-[10.5px] font-bold text-jade"><StatusMark kind="ok">{savedLabel} · 下次开新局生效</StatusMark></span>
          ) : null}
          <Dirty on={dirty} />
        </div>
        {healNotes.length > 0 && errors.length === 0 ? (
          <div
            role="status"
            className="rounded-xl border border-jade/35 bg-jade/10 px-3 py-2 text-[12px] text-jade"
            data-save-heal-notes="1"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <b className="font-bold">已自动处理好 {healNotes.length} 处，可以继续编辑</b>
                <ul className="mt-1 space-y-0.5 text-[11.5px] text-jade/90">
                  {(errorsExpanded ? healNotes : healNotes.slice(0, 3)).map((n, i) => (
                    <li key={i}>· {n}</li>
                  ))}
                </ul>
                {healNotes.length > 3 ? (
                  <button
                    type="button"
                    className="mt-1 text-[11px] font-semibold underline-offset-2 hover:underline"
                    onClick={() => setErrorsExpanded((v) => !v)}
                  >
                    {errorsExpanded ? "收起" : `展开其余 ${healNotes.length - 3} 条`}
                  </button>
                ) : null}
              </div>
              <button type="button" onClick={() => setHealNotes([])} aria-label="关闭提示" className="px-1 text-[14px] leading-none hover:text-ink">×</button>
            </div>
          </div>
        ) : null}
        {errors.length > 0 && (
          <div
            role="alert"
            className="rounded-2xl border border-line bg-paper px-3 py-2.5 shadow-sm"
            data-save-error-banner="1"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[12.5px] font-bold text-ink">还差 {errors.length} 处才能保存</p>
                <p className="mt-0.5 text-[11px] text-ink-soft">点下面条目可跳到对应栏目修改</p>
              </div>
              <button type="button" onClick={() => { setErrors([]); setErrorsExpanded(false); }} aria-label="关闭提示" className="rounded-lg px-1.5 text-[14px] leading-none text-ink-soft hover:bg-paper-2 hover:text-ink">×</button>
            </div>
            <div className="mt-2 space-y-1.5">
              {(errorsExpanded ? errors : errors.slice(0, 4)).map((e, i) => (
                <button
                  key={`${i}-${e}`}
                  type="button"
                  onClick={() => goSaveError(e)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-paper-2 px-3 py-2 text-left text-[12.5px] font-semibold text-ink transition hover:border-jade hover:text-jade"
                >
                  <span className="min-w-0 flex-1 leading-snug">{humanizeSaveError(e)}</span>
                  <span aria-hidden className="shrink-0 text-ink-soft">›</span>
                </button>
              ))}
            </div>
            {errors.length > 4 ? (
              <button
                type="button"
                className="mt-2 text-[11.5px] font-semibold text-jade underline-offset-2 hover:underline"
                onClick={() => setErrorsExpanded((v) => !v)}
              >
                {errorsExpanded ? "收起" : `展开其余 ${errors.length - 4} 条`}
              </button>
            ) : null}
          </div>
        )}
      </div>
      {previewFatal.length > 0 && (
        <div role="alert" className="rounded-xl border border-danger/50 bg-danger/10 px-3 py-2 text-[12px] text-danger">
          <div className="flex items-center justify-between gap-2">
            <b>无法启动预览：</b>
            <button type="button" onClick={() => setPreviewFatal([])} aria-label="关闭" className="px-1 text-[14px] leading-none">×</button>
          </div>
          <ul className="mt-1 space-y-0.5">{previewFatal.map((e, i) => <li key={i}>· {e}</li>)}</ul>
        </div>
      )}
      {onBackToWizard ? (
        <button type="button" className="text-[12px] font-semibold text-jade hover:underline" onClick={() => void backToWizard()}>
          ← 返回修改设定
        </button>
      ) : null}
      {draft.pending && (
        <Modal title="发现本机未保存的草稿" locked onClose={() => { /* 只能点两个按钮，遮罩 / Esc / 关闭都不选版本 */ }}>
          <p className="text-[13px] leading-relaxed text-ink-soft">
            {(() => {
              // 功能注释：本机草稿与已保存版本都写出时间（今天 HH:MM / M月D日 HH:MM），两边对照
              const draftId = resolveLocalDraftKey(persisted, m.id);
              const savedAtMs = resolveSavedVersionAt(draftId, savedVersionAtProp ?? savedAt)
                ?? resolveSavedVersionAt("mod.new", savedVersionAtProp ?? savedAt);
              const savedBit = savedAtMs != null ? `已保存的版本（${fmtDraftTime(savedAtMs)}）` : "已保存的版本";
              return <>这个模组在浏览器里有一份自动保存的草稿（{fmtDraftTime(draft.pending.at)}），与{savedBit}不一致。请选择要加载的版本。</>;
            })()}
            {draft.stale && <b className="mt-1 block font-semibold text-danger">注意：草稿生成之后，已保存的版本又被修改过，继续填写草稿会覆盖那些修改。</b>}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              autoFocus
              onClick={() => {
                const row = draft.restore();
                if (!row) return;
                // 功能注释：本机草稿可能缺 branches / 脏 opening；恢复时 sanitize，避免保存被拦
                setM(lockId(sanitizeModStrings(structuredClone(row.value))));
                setRev((r) => r + 1);
                // 功能注释：只有「继续填写草稿」才回到上次分区/滚动；选完前不得抢跳
                if (row.cursor?.group) setGroup(normalizeGroup(row.cursor.group));
                const y = row.cursor?.scrollY;
                if (typeof y === "number" && y > 0) {
                  requestAnimationFrame(() => window.scrollTo(0, y));
                }
              }}
              className="ui-btn ui-btn-primary ui-btn-sm"
            >
              继续填写草稿
            </button>
            <button
              type="button"
              onClick={() => {
                draft.discard();
                setGroup(normalizeGroup(null));
                requestAnimationFrame(() => window.scrollTo(0, 0));
              }}
              className="ui-btn ui-btn-sm"
            >
              从已保存版本开始
            </button>
          </div>
        </Modal>
      )}
      {/* 功能注释：选完版本前不打开表单，只保留顶栏与弹窗，避免先看到/滚到上次填写位 */}
      {!draft.pending && !authorSimplify && (
        <ScopeBanner scope="newgame">模组编辑保存后，在下次「开新局」时生效；当前存档继续使用开局时的内容。想改当前存档，请用世界书 / 地图编辑器等面板。</ScopeBanner>
      )}

      {!draft.pending && onAiChat && (
        <button type="button" onClick={() => onAiChat(structuredClone(m))}
          className="flex w-full items-center justify-between gap-2 rounded-2xl border border-jade/40 bg-gradient-to-r from-jade/10 to-coral/10 px-3 py-2 text-left transition hover:border-jade">
          <span>
            <span className="flex items-center gap-1 text-[12.5px] font-bold text-ink"><IconSpark size={14} /> 用对话修改这个模组</span>
            <span className="block text-[11px] text-ink-soft">直接说「加个理智值属性」「把打工收入减半」，AI 改好后可再回来手调；未保存的改动会一起带过去</span>
          </span>
          <span className="shrink-0 text-[12px] font-bold text-jade">打开 ›</span>
        </button>
      )}
      {!draft.pending && (
      <div className="sticky top-0 z-10 -mx-1 border-b border-line bg-paper-2/95 px-1 py-2 backdrop-blur">
        {/* 功能注释：页签下不再放设置项搜索框；撤销/重做并到页签右侧 */}
        <div className="flex items-center gap-1.5">
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
            {GROUPS.filter((x) => x.k !== "pack" || m.kind === "addon").map((x) => {
              const on = group === x.k && !q;
              const n = x.k === "pack" ? 0 : filled[x.k];
              return (
                <button key={x.k} type="button" onClick={() => goGroup(x.k)} title={x.hint} aria-pressed={on}
                  className={`relative flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-[12px] font-bold transition ${on ? "border-jade bg-jade text-white" : "border-line bg-paper text-ink-soft hover:border-jade hover:text-jade"}`}>
                  {x.label}
                  {n > 0 && <span className={`wg-tab-count rounded-full px-1.5 text-[10px] font-bold tabular-nums leading-none ${on ? "is-on" : "bg-jade/12 text-jade"}`}>{n}</span>}
                </button>
              );
            })}
          </div>
          <button className={`${btn} shrink-0`} onClick={undo} disabled={!canUndo} title="撤销（Ctrl/⌘+Z）" aria-label="撤销"><IconUndo size={14} /></button>
          <button className={`${btn} shrink-0`} onClick={redo} disabled={!canRedo} title="重做（Ctrl/⌘+Shift+Z）" aria-label="重做"><IconRedo size={14} /></button>
        </div>
      </div>
      )}
      {!draft.pending && (
      <GroupCtx.Provider value={{ cur: group, q }}>
      <div key={rev} className="space-y-2.5 [&:not(:has(>details))>.sec-empty]:block">
      <div className="sec-empty hidden"><EmptyState>没有找到「{String(q ?? "").trim()}」相关的设置项，换个词试试，比如「金钱」可以搜「资金」「收入」「账单」。</EmptyState></div>
      <Section
        g="base"
        title="基本信息"
        target="author-field-name"
        on={true}
        hint={authorSimplify ? "作品封面 · 名称 · 简介 · 剧本基调" : "作品封面 · 名称 · id · 类型 · 依赖"}
        defaultOpen
      >
        {/* 功能注释：作品展示封面在名称之上；只配背景，开局菜单不再套用 */}
        <div data-author-field="author-field-cover" tabIndex={-1} className="mb-3 space-y-1.5">
          <p className="text-[12px] font-bold text-ink">作品封面</p>
          <ModCoverEditor
            value={c.cover}
            modId={m.id}
            workTitle={m.name}
            workSummary={m.description}
            imageGen={imageGenBinding}
            onChange={(cover) => {
              // 功能注释：背景写入 content.cover；同步首图到 manifest.cover 供列表/详情/书架
              const url = coverDisplayUrl(cover);
              setM({ ...m, cover: url || undefined, content: { ...c, cover } });
            }}
          />
        </div>
        {authorSimplify ? (
          <>
            {/* 功能注释：作者态只保留名称/简介/系统提示词；编号入口与三栏合并说明已下线；版本等底层字段仍保留 */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className={lbl}>名称 *</span>
                <input data-author-field="author-field-name" className={inp} value={m.name} placeholder="如：雾色旅馆" onChange={(e) => setM({ ...m, name: e.target.value })} />
                <FieldErr>{nameErr}</FieldErr>
              </label>
              <label className="sm:col-span-2">
                <span className={`${lbl} flex items-baseline justify-between gap-2`}>
                  <span>简介</span>
                  <span className={`text-[10.5px] font-semibold tabular-nums ${descOver ? "text-coral" : "text-ink-soft"}`} aria-live="polite">
                    {modDescLen(m.description)}/{MOD_DESC_MAX}
                  </span>
                </span>
                <textarea
                  className={`${inp} ${descOver ? "!border-coral" : ""}`}
                  rows={2}
                  value={m.description ?? ""}
                  placeholder="按世界观摘要的约 100 字简介（列表与开局页展示，可改）"
                  onChange={(e) => setM({ ...m, description: e.target.value })}
                />
                <Help>默认是世界观摘要，不是创作者长设定原文；可手改。</Help>
                <FieldErr>{descErr}</FieldErr>
              </label>
              <label className="sm:col-span-2">
                <span className={`${lbl} flex items-baseline justify-between gap-2`}>
                  <span>剧本基调（系统提示词）</span>
                  <span className={`text-[10.5px] font-semibold tabular-nums ${toneOver ? "text-coral" : "text-ink-soft"}`} aria-live="polite">
                    {scriptToneLen(scriptToneText)}/{SCRIPT_TONE_MAX}
                  </span>
                </span>
                <textarea
                  data-author-field="author-field-script-tone"
                  className={`${inp} max-h-[9.5rem] resize-y overflow-y-auto ${toneOver ? "!border-coral" : ""}`}
                  rows={3}
                  value={scriptToneText}
                  placeholder="生成世界时由 AI 填写的系统提示词；也可事后手改（最多 5000 字）"
                  onChange={(e) => setC({ prompt: applyScriptTone(c.prompt, e.target.value) })}
                />
                <Help>生成世界时由 AI 写出并填入；开局与每回合都会注入。超出 5000 字标红，不能照常保存。</Help>
                <FieldErr>{toneErr}</FieldErr>
              </label>
            </div>
            <WorldThemeFields value={worldTheme} tags={platformThemeTags} onPatch={patchTheme} />
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label><span className={lbl}>名称 *</span>
              <input data-author-field="author-field-name" className={inp} value={m.name} placeholder="如：修仙宗门" onChange={(e) => setM({ ...m, name: e.target.value, id: !persisted && (!m.id || m.id === slug(m.name)) ? slug(e.target.value) || m.id : m.id })} />
                <FieldErr>{nameErr}</FieldErr>
              </label>
              <label><span className={lbl}>id *</span>
                <input className={`${inp} font-mono`} value={m.id} placeholder="my-world" disabled={persisted} onChange={(e) => setM({ ...m, id: e.target.value.toLowerCase() })} />
                {!persisted ? <FieldErr>{idErr}</FieldErr> : <Help>已保存的模组 id 不可修改（存档按 id 关联）。</Help>}
              </label>
              <label><span className={lbl}>版本号</span>
                <input className={`${inp} font-mono`} value={m.version} onChange={(e) => setM({ ...m, version: e.target.value })} />
                <FieldErr>{verErr}</FieldErr>
              </label>
              <label><span className={lbl}>作者</span><input className={inp} value={m.author ?? ""} onChange={(e) => setM({ ...m, author: e.target.value })} /></label>
            </div>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start">
              <div className="shrink-0"><span className={lbl}>图标</span>
                <ImagePicker value={m.icon} label="模组图标" max={256} thumb="h-14 w-14" onChange={(icon) => setM({ ...m, icon: icon || undefined })} />
              </div>
              <label className="block min-w-0 flex-1">
                <span className={`${lbl} flex items-baseline justify-between gap-2`}>
                  <span>简介</span>
                  <span className={`text-[10.5px] font-semibold tabular-nums ${descOver ? "text-coral" : "text-ink-soft"}`} aria-live="polite">
                    {modDescLen(m.description)}/{MOD_DESC_MAX}
                  </span>
                </span>
                <textarea
                  className={`${inp} ${descOver ? "!border-coral" : ""}`}
                  rows={2}
                  value={m.description ?? ""}
                  placeholder="按世界观摘要的约 100 字简介（可改，最多 200 字）"
                  onChange={(e) => setM({ ...m, description: e.target.value })}
                />
                <Help>默认是世界观摘要，不是创作者长设定原文；可手改。</Help>
                <FieldErr>{descErr}</FieldErr>
              </label>
            </div>
            <label className="block">
              <span className={`${lbl} flex items-baseline justify-between gap-2`}>
                <span>剧本基调（系统提示词）</span>
                <span className={`text-[10.5px] font-semibold tabular-nums ${toneOver ? "text-coral" : "text-ink-soft"}`} aria-live="polite">
                  {scriptToneLen(scriptToneText)}/{SCRIPT_TONE_MAX}
                </span>
              </span>
              <textarea
                data-author-field="author-field-script-tone"
                className={`${inp} max-h-[9.5rem] resize-y overflow-y-auto ${toneOver ? "!border-coral" : ""}`}
                rows={3}
                value={scriptToneText}
                placeholder="生成世界时由 AI 填写的系统提示词；也可事后手改（最多 5000 字）"
                onChange={(e) => setC({ prompt: applyScriptTone(c.prompt, e.target.value) })}
              />
              <Help>生成世界时由 AI 写出并填入；开局与每回合都会注入。超出 5000 字标红，不能照常保存。</Help>
              <FieldErr>{toneErr}</FieldErr>
            </label>
            <WorldThemeFields value={worldTheme} tags={platformThemeTags} onPatch={patchTheme} />
            <div>
              <span className={lbl}>类型</span>
              <div className="inline-flex max-w-full flex-wrap rounded-lg border border-line bg-paper-2 p-0.5 text-[12px] font-bold">
                {(["world", "addon"] as const).map((k) => (
                  <button key={k} onClick={() => setM({ ...m, kind: k })} className={`rounded-md px-2.5 py-1 sm:px-3 ${m.kind === k ? "bg-jade/15 text-jade-deep" : "text-ink-soft"}`}>
                    {k === "world" ? "世界观（单选）" : "叠加包（可多选）"}
                  </button>
                ))}
              </div>
              <Help>世界观是一局的底座；叠加包在世界观之上覆盖 / 追加内容。</Help>
            </div>
            {m.kind === "addon" && (
              <div>
                <span className={lbl}>列表内容合并方式</span>
                <div className="inline-flex rounded-lg border border-line bg-paper-2 p-0.5 text-[12px] font-bold">
                  {([["merge", "追加合并（推荐）"], ["replace", "整体替换"]] as const).map(([k, l]) => (
                    <button key={k} onClick={() => setM({ ...m, slotMerge: k })} className={`rounded-md px-3 py-1 ${(m.slotMerge ?? "replace") === k ? "bg-jade/15 text-jade-deep" : "text-ink-soft"}`}>{l}</button>
                  ))}
                </div>
                <Help>头衔、课程、打工、周末活动、建角选项等列表：追加合并 = 只加新条目 / 覆盖同 id 条目，世界观原有的保留；整体替换 = 只用本包写的。</Help>
              </div>
            )}
            <div>
              <span className={lbl}>依赖</span>
              {otherMods.length === 0 ? <p className="text-[11.5px] text-ink-soft">没有其他模组可依赖。</p> : (
                <div className="flex flex-wrap gap-1.5">
                  {otherMods.map((x) => {
                    const on = deps.includes(x.id);
                    return (
                      <button key={x.id} onClick={() => setM({ ...m, dependencies: on ? deps.filter((d) => d !== x.id) : [...deps, x.id] })}
                        className={`rounded-full border px-2.5 py-0.5 text-[11.5px] ${on ? "border-jade bg-jade/15 text-jade-deep" : "border-line text-ink-soft"}`}>
                        {on ? <IconCheck size={12} className="mr-0.5 inline" /> : null}{x.name}
                      </button>
                    );
                  })}
                </div>
              )}
              <Help>叠加包通常依赖某个世界观；缺少依赖时该包会被跳过。</Help>
            </div>
          </>
        )}
      </Section>

      <Section
        g="base"
        title="时间与推进"
        target="author-field-start-date"
        on={[c.startDate, c.travel?.apPerTurn, c.travel?.advanceUnit].some(has)}
        hint="开局日期 · 行动点 · 按日/周/月/年推进 · 年龄随日历（内置）"
        count={[c.startDate, c.travel?.apPerTurn, c.travel?.advanceUnit, c.travel?.advanceDays].filter((x) => x !== undefined && x !== "").length || undefined}
      >
        {/* 功能注释：只留日历机制一句；开局地点/开场页/资金等跳转说明不对创作者展示 */}
        <p className="text-[11px] leading-relaxed text-ink-soft">本引擎用真实日历推进：主线推进前进日历并回满行动点；换地点、进支线扣行动点但不推进日历。此处只编日期与推进节奏。</p>
        <div>
          <span className={lbl}>开局日期</span>
          <StartDateSelects
            data-author-field="author-field-start-date"
            value={c.startDate}
            onChange={(startDate) => setC({ startDate })}
          />
          <FieldErr>{dateErr}</FieldErr>
        </div>
        {/* 功能注释：开局日期下不再挂灰字说明；年/月/日选择本身已够用，建角也不可自选 */}
        <ModTravelEditor part="pace" value={c.travel} rooms={roomIds.map((id) => ({ id, name: rooms[id].name ?? id }))} onChange={(travel) => setC({ travel })} />
      </Section>

      {/* 功能注释：头像（私库/公库/分类）归①基础；单块配置，随模组保存/导入导出，不写平台全局 */}
      <Section
        g="base"
        title="头像"
        on={has(c.avatars)}
        hint="私库 · 公库 · 分类 · 匹配优先级 · 通用兜底（随本剧保存）"
        count={(Object.keys(c.avatars?.pools ?? {}).length + (c.avatars?.publicRandom?.length ?? 0) + (c.avatars?.match ? 1 : 0)) || undefined}
        defaultOpen
      >
        <ModAvatarPoolsEditor value={c.avatars} onChange={(avatars) => setC({ avatars })} confirm={confirm} />
      </Section>

      {/* 功能注释：建角在①基础、地点之上；属性/开局资金/字段合并为统一「建角字段」列表；预览点开局资金可滚到本节 */}
      <Section
        g="base"
        title="建角"
        target="author-field-start-money"
        on={has(c.customAttrs) || has(c.creation?.fields) || has(c.creation?.builtin) || c.startMoney !== undefined || !!c.moneyLabel}
        hint="建角字段 · 文本/单选/数值/日期/货币 · 开局页只显示这里配过的"
        count={(c.customAttrs?.length ?? 0) + (c.creation?.fields?.length ?? 0) + Object.keys(c.creation?.builtin ?? {}).length + (c.startMoney !== undefined ? 1 : 0) || undefined}
      >
        <ModCreationFieldsEditor creation={c.creation} backgrounds={c.backgrounds}
          attrs={c.customAttrs} startMoney={c.startMoney} moneyLabel={c.moneyLabel}
          focusAuthorField={focusAuthorField}
          statLabels={c.stats?.labels} npcs={npcs.map((p) => ({ id: p.id, name: p.name }))}
          onChange={({ creation }) => setC({ creation })}
          onAttrs={(customAttrs) => setC({ customAttrs })}
          onStartMoney={(v) => setC({ startMoney: v })}
          onMoneyLabel={(v) => setC({ moneyLabel: v })} />
      </Section>

      {/* 功能注释：人物线路紧挨建角字段下方（①基础），便于先配属性再挂线路依赖 */}
      <Section g="base" title="人物线路" on={has(c.creation?.paths)} hint="建角第一步 · 路径卡片 · 开局状态 / 地点 / 人际 · 支持 AI 生成" count={c.creation?.paths?.length || undefined}>
        <ModPathsEditor creation={c.creation} identities={c.identities} world={`${m.name}${m.description ? `：${m.description}` : ""}`}
          npcs={npcs.map((p) => ({ id: p.id, name: p.name }))}
          rooms={Object.entries(c.rooms ?? {}).map(([id, r]) => ({ id, name: r.name || id }))}
          events={(c.fixedEvents ?? []).map((e) => ({ id: e.id, name: e.name }))}
          statsValue={c.stats} attrsValue={c.customAttrs}
          onChange={({ creation, identities }) => setC({ creation, identities })}
          onMergeNpcs={(incoming) => {
            const byId = new Map(npcs.map((n) => [n.id, n]));
            for (const row of incoming) {
              if (!row?.id || !String(row.name ?? "").trim()) continue;
              // 功能注释：AI 合并人物时丢弃纯身份名与已失效势力，避免写进草稿
              if (improperPersonNameReason(row.name)) continue;
              const factionId = sanitizeNpcFactionId(row.factionId, startFactionIds);
              const prev = byId.get(row.id);
              if (!prev) {
                byId.set(row.id, {
                  id: row.id,
                  name: String(row.name),
                  role: row.role || "",
                  kind: "roam",
                  home: row.home || c.startRoom || roomIds[0] || "",
                  roam: Array.isArray(row.roam) ? row.roam : [],
                  bio: row.bio || "",
                  gender: row.gender,
                  age: row.age,
                  tags: row.tags,
                  relation: row.relation,
                  metStart: row.metStart,
                  wxStart: row.wxStart,
                  factionId,
                  requires: [],
                });
                continue;
              }
              byId.set(row.id, {
                ...prev,
                name: prev.name?.trim() ? prev.name : String(row.name),
                role: prev.role?.trim() ? prev.role : (row.role || prev.role),
                bio: prev.bio?.trim() ? prev.bio : (row.bio || ""),
                gender: prev.gender || row.gender,
                age: typeof prev.age === "number" ? prev.age : row.age,
                tags: prev.tags?.length ? prev.tags : row.tags,
                relation: prev.relation || row.relation,
                factionId: sanitizeNpcFactionId(prev.factionId, startFactionIds) || factionId,
              });
            }
            setC({ npcs: [...byId.values()] });
          }}
        />
      </Section>

      {/* 功能注释：地点名字与出口留在①基础、建角与人物线路之下；作品展示封面已在基本信息名称上方 */}
      <Section g="base" title="地点" target="author-field-rooms" on={has(c.rooms) || has(c.startRoom) || has(c.worldMaps)} hint="大地图 · 多级地点树 · 准入 · 开局地点" count={roomIds.length}>
        <div data-author-section="author-field-start-room">
          <ModRoomTreeEditor
            rooms={rooms}
            worldMaps={c.worldMaps}
            startRoom={c.startRoom}
            imageGen={imageGenBinding}
            tracks={locationBgmOptions(c, { author: game?.audio ?? [], platform: PLATFORM_AUDIO })}
            emptyHint={m.kind === "world" ? "世界观至少需要一个地点才能行走。" : "叠加包可不定义地点（沿用世界观地图）。"}
            onChange={(next, startRoom, nextMaps) => setC({ rooms: next, startRoom, worldMaps: nextMaps })}
            onDelete={delRoom}
            onRename={renameRoom}
          />
        </div>
      </Section>

      {/* 功能注释：关系档位并在开局人物上方统一配置；卡片数值已下线 */}
      <Section g="role" title="人物" on={has(c.npcs) || has(c.contacts)} hint="关系档位 · 须有名有姓 · 身份 · 标签 · 小传 · 时间线" count={npcs.length || undefined}>
        <datalist id="mod-avatar-variants">{variantNames(c.avatars ?? null).map((x) => <option key={x} value={x} />)}</datalist>
        <ContactsPanel value={c.contacts} onChange={(contacts) => setC({ contacts })} />
        {npcs.length > 5 && <SearchBox value={npcQ} onChange={setNpcQ} placeholder="搜索人物" />}
        {npcs.length === 0 && <EmptyState>还没有人物。</EmptyState>}
        {npcs.map((n, i) => !matches(npcQ, n.name, n.role, n.id) ? null : (
          <div key={i} className="min-w-0 space-y-1.5 overflow-x-hidden rounded-xl border border-line bg-paper px-2.5 py-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <input
                className={`${inp} !w-auto min-w-0 flex-1 font-medium ${improperPersonNameReason(n.name) ? "!border-danger" : ""}`}
                value={String(n.name ?? "")}
                placeholder="姓名 *（须有名有姓，如沈晚晴）"
                aria-label="姓名（须有名有姓）"
                onChange={(e) => setNpc(i, { name: e.target.value })}
              />
              <input className={`${inp} !w-auto min-w-0 flex-1`} value={n.role} placeholder="身份/称号，如：掌门" onChange={(e) => setNpc(i, { role: e.target.value })} />
              <button className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[15px] leading-none text-ink-soft hover:bg-coral/10 hover:text-coral" onClick={async () => { if (await confirm(`删除人物「${n.name || n.id}」？`)) setC({ npcs: npcs.filter((_, j) => j !== i) }); }} aria-label="删除人物">×</button>
            </div>
            {improperPersonNameReason(n.name) && (
              <p className="text-[10.5px] text-coral">{improperPersonNameReason(n.name)}</p>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              <input type="number" min={0} className={`${inp} !w-20 ${typeof n.age === "number" ? "" : "!border-danger"}`} value={n.age ?? ""} placeholder="年龄 *" aria-label="年龄（必填）"
                onChange={(e) => setNpc(i, { age: e.target.value === "" ? undefined : Math.max(0, Math.trunc(Number(e.target.value))) })} />
              <select className={`${inp} !w-24 ${String(n.gender ?? "").trim() ? "" : "!border-danger"}`} value={String(n.gender ?? "")} aria-label="性别（必填）" onChange={(e) => setNpc(i, { gender: e.target.value || undefined })}>
                <option value="">性别 *</option><option value="男">男</option><option value="女">女</option><option value="其他">其他</option>
              </select>
              <span className="text-[11.5px] text-ink-soft">生日</span>
              <select className={`${inp} !w-20`} value={n.birthday?.m ?? ""} aria-label="生日月份（选填）"
                onChange={(e) => setNpc(i, { birthday: e.target.value ? { m: Number(e.target.value), d: Math.min(n.birthday?.d ?? 1, [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][Number(e.target.value) - 1]) } : undefined })}>
                <option value="">随机</option>{Array.from({ length: 12 }, (_, k) => <option key={k} value={k + 1}>{k + 1} 月</option>)}
              </select>
              {n.birthday && (
                <select className={`${inp} !w-20`} value={n.birthday.d} aria-label="生日日期" onChange={(e) => setNpc(i, { birthday: { m: n.birthday!.m, d: Number(e.target.value) } })}>
                  {Array.from({ length: [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][n.birthday.m - 1] }, (_, k) => <option key={k} value={k + 1}>{k + 1} 日</option>)}
                </select>
              )}
              {!n.birthday && <span className="text-[10.5px] text-ink-soft/70">留空 = 开局自动分配</span>}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <input className={`${inp} min-w-0 flex-1`} value={n.relation ?? ""} placeholder="与主角的关系，如：你的经纪人 / 你的表姐"
                aria-label="与主角的关系" onChange={(e) => setNpc(i, { relation: e.target.value || undefined })} />
              <span className="text-[11.5px] text-ink-soft">初始好感</span>
              <input type="number" min={-100} max={100} className={`${inp} !w-20`} value={n.init ?? ""} placeholder="0" aria-label="初始好感"
                onChange={(e) => setNpc(i, { init: e.target.value === "" ? undefined : Math.max(-100, Math.min(100, Math.trunc(Number(e.target.value)))) })} />
            </div>
            <NpcTagsPicker value={n.tags} onChange={(tags) => setNpc(i, { tags })} />
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <select className={`${inp} !w-auto min-w-0 flex-1`} value={n.home} aria-label="所在地点" onChange={(e) => setNpc(i, { home: e.target.value })}>
                {!roomIds.includes(n.home) && <option value={n.home}>{n.home ? `${n.home}（依赖模组的地点）` : "（未选择）"}</option>}
                {roomIds.map((x) => <option key={x} value={x}>{rooms[x].name || x}</option>)}
              </select>
              {/* 功能注释：人物 kind 固定 roam；短简介字段已并入小传 */}
              <select
                className={`${inp} !w-auto min-w-[7.5rem]`}
                value={sanitizeNpcFactionId(n.factionId, startFactionIds) ?? ""}
                aria-label="所属势力"
                onChange={(e) => setNpc(i, { factionId: sanitizeNpcFactionId(e.target.value, startFactionIds) })}
              >
                <option value="">所属势力（可选）</option>
                {startFactions.map((f) => <option key={f.id} value={f.id}>{f.name || f.id}</option>)}
              </select>
            </div>
            {!startFactions.length && (
              <p className="text-[10.5px] text-ink-soft">作品尚未配置势力列表时，所属势力可选为空；有势力数据时在此选择归属。</p>
            )}
            <label className="block">
              <span className={lbl}>小传 · 贴合世界观（约 300 字；供 AI 演绎与生图）</span>
              <textarea className={`${inp} max-w-full resize-y`} rows={5} value={n.bio} placeholder="人物小传（约 300 字，贴合世界观；供 AI 演绎）" onChange={(e) => setNpc(i, { bio: e.target.value })} />
            </label>
            {/* 功能注释：代表作等栏目仅演艺事业玩法显示，避免每个剧本都塞娱乐圈模板 */}
            {showCareerNpcFields && (
              <div className="min-w-0 space-y-1.5 rounded-lg border border-line bg-paper-2 p-2">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <input className={`${inp} !w-auto min-w-0 flex-1 basis-32`} value={n.worksLabel ?? ""} placeholder="栏目名：代表作" onChange={(e) => setNpc(i, { worksLabel: e.target.value || undefined })} />
                  <button
                    type="button"
                    aria-pressed={!n.worksPlain}
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition ${!n.worksPlain ? "border-jade/50 bg-jade/15 text-jade" : "border-line bg-paper text-ink-soft hover:border-jade/40 hover:text-ink"}`}
                    onClick={() => setNpc(i, { worksPlain: n.worksPlain ? undefined : true })}
                  >
                    {!n.worksPlain ? "《书名号》" : "纯文字"}
                  </button>
                </div>
                <textarea className={`${inp} max-w-full resize-y`} rows={2} value={(n.works ?? []).join("\n")} placeholder={"每行一条，如：\n风起南巷\n半城烟雨\n（留空 = 资料卡不显示这一栏）"}
                  onChange={(e) => { const w = e.target.value.split(/\n/).map((x) => x.replace(/^《|》$/g, "")); setNpc(i, { works: w.some((x) => x.trim()) ? w : undefined }); }} />
                <p className="truncate text-[10.5px] text-ink-soft">资料卡：{(n.worksLabel ?? "").trim() || "代表作"} · {worksMarkPreview(n.works, n.worksPlain)}</p>
              </div>
            )}
            <details className="rounded-lg border border-line bg-paper-2 p-2">
              <summary className="cursor-pointer text-[12px] font-bold text-ink">时间线 <span className="font-normal text-ink-soft">· {n.timeline?.length ? `${n.timeline.length} 条` : "过去经历与未来安排，随游戏日期推进"}</span></summary>
              <div className="mt-1.5"><TimelineEditor compact value={n.timeline} onChange={(timeline) => setNpc(i, { timeline })} /></div>
            </details>
            {/* 功能注释：固定头像走统一 ImagePicker 生图；无图且无池时游玩端仍用首字头像 */}
            <div className="space-y-1.5">
              {/* 功能注释：外观描述与小传分开，只喂头像生图（性别/年龄感/发型/面容/衣着），不写关系与剧情；留空时生图弹窗按性别+年龄给脚手架 */}
              <label className="block">
                <span className={lbl}>外观描述 · 只给头像生图用（发型 / 面容 / 衣着），不写关系与剧情</span>
                <textarea className={`${inp} max-w-full resize-y`} rows={2} value={n.appearancePrompt ?? ""} placeholder="如：黑色齐肩发，圆脸，杏眼，米色针织衫（留空则生图时按性别与年龄给模板）"
                  onChange={(e) => setNpc(i, { appearancePrompt: e.target.value || undefined })} />
              </label>
              <span className={lbl}>头像 · 生图 / 上传后写入本人物；也可只填头像池名开局抽一张</span>
              <ImagePicker
                value={n.avatar}
                label={`${n.name || "人物"}头像`}
                max={768}
                thumb="h-16 w-16"
                onChange={(avatar) => setNpc(i, { avatar: avatar || undefined })}
                aiGen={{
                  size: NPC_AVATAR_GEN_SIZE,
                  placeholder: "只写这个人的外观：性别、年龄感、发型、面容、衣着……",
                  initialParts: buildNpcAvatarPromptParts(
                    { gender: n.gender, age: n.age, appearancePrompt: n.appearancePrompt },
                    imageGenBinding.settings,
                  ),
                  // 功能注释：重绘时默认把当前头像带进参考图（最多 2 张），弹窗里可移除；仍会发送主体提示词
                  initialRefs: n.avatar ? [n.avatar] : undefined,
                  onPartsCommit: imageGenBinding.onCommit,
                }}
              />
              {(() => {
                const av = n.avatarVariant ?? "";
                const bad = !!av && !variantNames(c.avatars ?? null).includes(av);
                return (
                  <label className="block">
                    <span className={lbl}>头像池 · 无固定头像时开局从同名池抽一张，都没有则用首字头像</span>
                    <input className={`${inp} ${bad ? "!border-danger" : ""}`} list="mod-avatar-variants" value={av} placeholder="如：青年男性"
                      onChange={(e) => setNpc(i, { avatarVariant: e.target.value || undefined })} />
                    {bad && <span className="mt-0.5 block text-[10.5px] text-danger">找不到本剧已开放的同名头像池（须完全一致；我的头像池需在上方「头像池」里勾「玩家可选」或「随机池」）</span>}
                  </label>
                );
              })()}
            </div>
            <VoiceField label="专属音色" value={n.ttsVoice} gender={n.gender} sample={`我是${n.name || "这个人"}，有事找我？`} onChange={(v) => setNpc(i, { ttsVoice: v || undefined })} />
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink">
                <input type="checkbox" className="accent-jade" checked={!!n.metStart || !!n.wxStart} disabled={!!n.wxStart}
                  onChange={(e) => setNpc(i, { metStart: e.target.checked || undefined })} />
                开局已认识
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink">
                <input type="checkbox" className="accent-jade" checked={!!n.wxStart} onChange={(e) => setNpc(i, { wxStart: e.target.checked || undefined })} />
                出现在联系人<span className="text-ink-soft">（同时视为开局已认识）</span>
              </label>
            </div>
            <FieldErr>{dupNpc.has(n.id) ? `id「${n.id}」重复` : ""}</FieldErr>
          </div>
        ))}
        <button className={btn} onClick={addNpc}>＋ 添加人物</button>
      </Section>

      {/* 功能注释：养成页只负责「开不开 + 开哪些」；三块开关合并成总养成开关，经济入口在④结局。 */}
      <Section
        g="grow"
        title="总养成开关"
        target="grow-modules"
        on={isGrowEnabled(c)}
        hint="开 = 本作品启用养成；关 = 整块锁定，局内不走养成，底栏「日程」改名为「推进」"
        defaultOpen
      >
        <label className="mb-3 flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-paper-2/60 px-3 py-2.5 text-[12.5px] text-ink">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-jade"
            checked={isGrowEnabled(c)}
            onChange={(e) => setC(setGrowEnabled(c, e.target.checked))}
          />
          <span>
            <span className="font-bold">启用养成</span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-soft">
              关闭后子项配置保留但不生效；游戏中底部中央按钮显示为「推进」，直接推进时间，不打开日程板。
            </span>
          </span>
        </label>

        {isGrowEnabled(c) && (
          <div className="space-y-3">
            <p className="text-[11px] leading-relaxed text-ink-soft">
              统一勾选本作品要用的养成子项；没勾的不显示、开局也不套用。不要勾娱乐圈专用通告/违约——那些在「已添加的玩法」里。数值分档在「① 基础 → 建角」；头衔请加「头衔包」。
            </p>
            <div className="space-y-1">
              {GROW_MODULE_META.map((mod) => {
                const on = isGrowModuleOn(c, mod.id);
                return (
                  <label key={mod.id} className="flex items-start gap-2 text-[11.5px] text-ink">
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-jade"
                      checked={on}
                      onChange={(e) => {
                        const id = mod.id as GrowModuleId;
                        if (e.target.checked) setC(enableGrowModule(c, id));
                        else setC(clearGrowModule(c, id));
                      }}
                    />
                    <span>
                      <span className="font-semibold">{mod.label}</span>
                      <span className="text-ink-soft"> · {mod.hint}</span>
                    </span>
                  </label>
                );
              })}
              {GROW_TUNING_SUB_META.map((mod) => {
                const on = isTuningModuleOn(c.tuning, mod.id);
                return (
                  <label key={mod.id} className="flex items-start gap-2 text-[11.5px] text-ink">
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-jade"
                      checked={on}
                      onChange={(e) => {
                        const id = mod.id as GrowTuningSubId;
                        const nextTuning = e.target.checked
                          ? enableTuningModule(c.tuning ?? {}, id)
                          : clearTuningModule(c.tuning ?? {}, id);
                        setC({ tuning: pruneTuningSlot(nextTuning) as typeof c.tuning });
                      }}
                    />
                    <span>
                      <span className="font-semibold">{mod.label}</span>
                      <span className="text-ink-soft"> · {mod.hint}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            {/* 功能注释：玩法规则列表嵌在总开关下，不再单独占「玩法规则」卡片标题 */}
            {isGrowModuleOn(c, "gameRules") && (
              <div className="space-y-1.5 border-t border-line/70 pt-3">
                <p className="text-[12px] font-bold text-ink">
                  规则列表
                  {c.gameRules?.length ? <span className="ml-1.5 text-[11px] font-semibold text-ink-soft">{c.gameRules.length}</span> : null}
                </p>
                <p className="text-[11px] text-ink-soft">判定时机 · 条件 · 调用事件库 · 规则变量；加规则 / 展开 / 删除不变</p>
                <GameRulesEditor
                  value={c.gameRules}
                  events={c.fixedEvents}
                  libraryEvents={c.events}
                  metricKeys={draftRefs.metricKeys}
                  onChange={({ gameRules, events }) => setC({
                    gameRules,
                    ...(events !== undefined ? { events } : {}),
                  })}
                />
              </div>
            )}

            {/* 功能注释：只渲染已勾引擎表单；勾选清单已在上方统一，且不露出娱乐圈工作/违约 */}
            {(isTuningModuleOn(c.tuning, "dayGrade") || isTuningModuleOn(c.tuning, "rest") || isGrowModuleOn(c, "courses") || isGrowModuleOn(c, "jobs")) && (
              <div className="border-t border-line/70 pt-3">
                <ModTuningEditor
                  value={c.tuning}
                  stats={c.stats}
                  attrs={c.customAttrs}
                  npcs={npcs.map((p) => ({ id: p.id, name: p.name }))}
                  showCourses={isGrowModuleOn(c, "courses")}
                  showJobs={isGrowModuleOn(c, "jobs")}
                  showCareer={false}
                  showModulePicker={false}
                  onChange={(tuning) => setC({ tuning })}
                />
              </div>
            )}
          </div>
        )}
      </Section>

      {isGrowEnabled(c) && isGrowModuleOn(c, "courses") && (
        <Section g="grow" title="培训课程" on={has(c.trainings)} hint="学费 · 体力 · 属性收益 · 自定义等级与解锁条件" count={c.trainings?.length || undefined}>
          <ModTrainingsEditor value={c.trainings} stats={c.stats} attrs={c.customAttrs} onChange={(trainings) => setC({ trainings })} />
        </Section>
      )}

      {isGrowEnabled(c) && isGrowModuleOn(c, "jobs") && (
        <Section g="grow" title="打工 · 周末活动" on={has(c.sideJobs) || has(c.weekendActs)} hint="收入 · 压力 · 属性收益 · 解锁条件" count={(c.sideJobs?.length ?? 0) + (c.weekendActs?.length ?? 0) || undefined}>
          <ModActsEditor jobs={c.sideJobs} acts={c.weekendActs} stats={c.stats} attrs={c.customAttrs} onChange={(p) => setC(p)} />
        </Section>
      )}

      {isGrowEnabled(c) && isGrowModuleOn(c, "bills") && (
        <>
          <Section g="grow" title="固定账单" on={has(c.bills)} hint="每周 / 每 4 周自动扣款 · 只写本作品有的项">
            <ModRulesEditor stats={c.stats} attrs={c.customAttrs} value={{ bills: c.bills }} showTitles={false} onChange={(p) => setC(p)} />
          </Section>
          <Section g="grow" title="周期收入" on={has(c.income)} hint="每周结算按条件发放 / 扣除" count={c.income?.length}>
            <ModIncomeEditor value={c.income} onChange={(income) => setC({ income })} />
          </Section>
        </>
      )}

      <Section g="story" title="世界书" target="world-book" on={has(c.worldBook)} hint="名称 · 正文 · 关键词 · 必须挂本作品地点或人物" count={c.worldBook?.length}>
        <ModWorldBookEditor
          value={c.worldBook}
          onChange={(worldBook) => setC({ worldBook })}
          npcs={npcs.map((n) => ({ id: n.id, name: n.name || n.id }))}
          rooms={roomIds.map((id) => ({ id, name: rooms[id].name || id }))}
        />
      </Section>

      <Section g="story" title="固定事件" target="fixed-events" on={has(c.fixedEvents) || has(c.events)} hint="首次事件 · 预设剧本 · 时间 / 条件触发 · 事件链 · 可 AI 帮写 · 开新局写入" count={c.fixedEvents?.length}>
        <Help>「开局即可触发」且无前置锁定的条目即首次事件；勿在其它分组再存一份相同事件表。</Help>
        {/* 功能注释：事件库只传本作品 events/eventGroups；新建为空，禁止回退娱乐圈 123 条预设 */}
        <FixedEventsPanel
          value={c.fixedEvents}
          storylines={c.storylines}
          sidelines={c.sidelines}
          libraryEvents={c.events}
          libraryGroups={c.eventGroups}
          worldContext={{
            title: m.name || m.id,
            setting: [m.description, readScriptTone(c.prompt)].filter(Boolean).join("\n"),
            scriptTone: readScriptTone(c.prompt) || undefined,
            // 功能注释：AI 帮写只读本作品表单：世界书 / 地点 / 人物 / 属性；没有就是空
            worldBook: (c.worldBook ?? []).map((w) => ({ id: w.id, title: w.title, keywords: keywordTexts(w.keywords).join("、"), content: w.content })),
            rooms: roomIds.map((id) => ({ id, name: rooms[id]?.name || id })),
            npcs: npcs.map((n) => ({ id: n.id, name: n.name || n.id })),
            metrics: draftSrcs.filter((x) => x.kind === "metric" && x.group !== "引擎内置（兜底）").map((x) => ({ key: x.key, label: x.label })),
            stats: draftSrcs.filter((x) => x.kind === "stat").map((x) => ({ key: x.key, label: x.label })),
          }}
          onChange={(v) => setC({ fixedEvents: v.length ? v : undefined })}
        />
      </Section>

      {/* 功能注释：主线 / 支线 / 结局同页；透支破产等经济规则挂在结局小节 */}
      <Section
        g="story"
        title="剧情线"
        on={has(c.storylines) || has(c.sidelines) || has(c.endings) || has(c.timeLimit) || has(c.gradeDims) || has(c.tuning?.economy)}
        hint="主线 · 支线 · 结局（时限 / 自定义结局 / 评级 / 经济规则）"
        count={(c.storylines?.length ?? 0) + (c.sidelines?.length ?? 0) + (c.endings?.length ?? 0) || undefined}
      >
        <PlotLinesTabs
          counts={{ main: c.storylines?.length, side: c.sidelines?.length, end: c.endings?.length }}
          main={<StorylinesEditor value={c.storylines} sidelines={c.sidelines} events={c.fixedEvents} onChange={(storylines) => setC({ storylines })} />}
          side={<SidelinesEditor value={c.sidelines} events={c.fixedEvents} storylines={c.storylines} onChange={(sidelines) => setC({ sidelines })} />}
          end={
            <div className="space-y-4">
              <EndingsPanel
                value={c.endings}
                onChange={(v) => setC({ endings: v.length ? v : undefined })}
                timeLimitValue={c.timeLimit}
                onTimeLimitChange={(t) => setC({ timeLimit: t })}
                gradeDimsValue={c.gradeDims}
                onGradeDimsChange={(d) => setC({ gradeDims: d?.length ? d : undefined })}
                eventsValue={c.fixedEvents}
                startDateValue={c.startDate ?? c.calendar?.startDate}
                statsValue={c.stats}
                attrsValue={c.customAttrs}
                pathsValue={c.creation?.paths}
                peopleValue={npcs.map((p) => ({ id: p.id, name: p.name }))}
                storylinesValue={c.storylines}
                sidelinesValue={c.sidelines}
              />
              <ModEconomyRulesPanel
                c={c}
                showBills={isGrowModuleOn(c, "bills")}
                onChange={setC}
              />
            </div>
          }
        />
      </Section>

      <Section g="base" title="已添加的玩法" on={has(c.playModInstalls) || m.kind === "world" || playModRecs.length > 0} hint="添加即启用 · 移除即停用；未添加不显示空面板" count={c.playModInstalls?.length || undefined} defaultOpen>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="rounded-full bg-jade px-3 py-1.5 text-[12px] font-semibold text-paper" onClick={() => setAddPlayOpen(true)}>添加玩法</button>
          <Help>
            基础设定、建角、地点、人物、事件、档案是本剧本体，在其它页直接配。这里只加可选玩法（孕育、出行、座驾等）；加进列表即启用，移除即停用。娱乐圈 / 校园等世界观底子不是玩法，不要在这里勾。
          </Help>
        </div>
        {/* 功能注释：只展示玩法组件互相依赖；作者态永不展示 registry 底座勾选（娱乐圈/校园骨架等） */}
        {(() => {
          const edges = summarizePlayModDeps(c.playModInstalls);
          if (!edges.length) return null;
          return (
            <div className="rounded-xl border border-line bg-paper-2 px-3 py-2.5">
              <p className="text-[12px] font-bold text-ink">玩法依赖摘要</p>
              <p className="mt-0.5 text-[11px] text-ink-soft">由玩法目录自动维护；缺依赖时添加玩法会提示一并安装。</p>
              <ul className="mt-2 space-y-1.5">
                {edges.map((e) => (
                  <li key={e.slug} className="text-[12px] text-ink">
                    <span className="font-semibold">{e.name}</span>
                    <span className="text-ink-soft"> → </span>
                    {e.needs.map((n, i) => (
                      <span key={n.slug}>
                        {i > 0 ? "、" : null}
                        <span className={n.installed ? "text-jade" : "text-danger"}>{n.name}{n.installed ? "" : "（未安装）"}</span>
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}
        {playModRecs.length > 0 && (
          <div className="rounded-xl border border-jade/30 bg-jade/5 px-3 py-2.5">
            <p className="text-[12px] font-bold text-ink">按当前题材推荐</p>
            <p className="mt-0.5 text-[11px] text-ink-soft">不会自动添加；点「添加」后才写入本剧。</p>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {playModRecs.map((rec) => (
                <li key={rec.id} className="flex items-center gap-2 rounded-xl border border-line/70 bg-paper px-2.5 py-2">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-paper-2 text-jade" dangerouslySetInnerHTML={{ __html: rec.iconSvg }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-semibold text-ink">{rec.name}</span>
                    <span className="block text-[11px] text-ink-soft line-clamp-2">{rec.description}</span>
                  </span>
                  <button
                    type="button"
                    className="shrink-0 rounded-full border border-jade/50 bg-jade/10 px-2.5 py-0.5 text-[11px] font-bold text-jade"
                    onClick={() => void installRecommended(rec.slug)}
                  >
                    添加
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {/* 功能注释：旧模组已有 travel 数据但不丢；引导到玩法卡片继续编辑 */}
        {!showPlay("travel") && has(c.travel?.modes) && (
          <p className="rounded-xl border border-line bg-paper-2 px-3 py-2 text-[12px] text-ink-soft">
            本剧已保存出行配置（数据仍保留）。请添加「出行与交通」后，才能继续用表单调整出行方式等。
          </p>
        )}
        {(c.playModInstalls ?? []).length === 0 && m.kind !== "addon" && (
          <EmptyState>还没有玩法。可先根据上方推荐添加，或点「添加玩法」浏览；未添加时不会显示通告 / 孕育 / 出行等配置。</EmptyState>
        )}
        <ul className="space-y-2">
          {(c.playModInstalls ?? []).map((inst, i) => {
            const cat = catalogBySlug(inst.slug);
            return (
              <li key={inst.modId} className="space-y-2 rounded-2xl border border-jade/40 bg-paper p-3">
                <div className="flex items-start gap-3">
                  <div
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-paper-2 text-jade"
                    dangerouslySetInnerHTML={{ __html: cat?.iconSvg || inst.iconSvg || "" }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13.5px] font-bold text-ink">{cat?.name || inst.slug}</span>
                      <span className="rounded-full border border-line px-2 text-[10.5px] text-ink-soft">
                        {cat?.componentKind === "phone_app" ? "手机应用" : "玩法"}
                      </span>
                    </div>
                    {!!cat?.description && <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-soft">{cat.description}</p>}
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-[11px] font-semibold text-ink-soft hover:text-danger"
                    onClick={() => void removePlayInstall(inst.slug)}
                  >
                    移除
                  </button>
                </div>
                <div className="grid gap-2 border-t border-line/60 pt-2 sm:grid-cols-2">
                  {!!(cat?.needsNavEntry || inst.navLabel || cat?.defaultNavLabel) && (
                    <label><span className={lbl}>底栏显示名</span>
                      <input className={inp} value={inst.navLabel ?? ""} placeholder={cat?.defaultNavLabel || "不显示在底栏"}
                        onChange={(e) => {
                          const list = [...(c.playModInstalls ?? [])];
                          list[i] = { ...inst, ...pickPlayModOpenConfig({ navLabel: e.target.value }) };
                          setC({ playModInstalls: list });
                        }} />
                    </label>
                  )}
                  <label className="flex items-center justify-between gap-2 rounded-xl border border-line bg-paper-2 px-3 py-2 text-[12.5px] text-ink sm:col-span-2">
                    <span>在游戏里显示入口<span className="ml-1 text-[11px] text-ink-soft">关闭后玩法仍生效，只是先不露出入口</span></span>
                    <input type="checkbox" className="h-4 w-4 accent-jade" checked={inst.visible !== false}
                      onChange={(e) => {
                        const list = [...(c.playModInstalls ?? [])];
                        list[i] = { ...inst, ...pickPlayModOpenConfig({ visible: e.target.checked }) };
                        setC({ playModInstalls: list });
                      }} />
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* 功能注释：出行与交通为已添加玩法；加上就生效，去掉就失效，不再另做功能开关 */}
      {showPlay("travel") && (
        <Section
          g="base"
          title="出行与交通"
          on={has(c.travel)}
          hint="已添加 · 可自定义出行方式与花费"
          count={c.travel?.modes?.length}
          defaultOpen
        >
          <ModTravelEditor
            part="transport"
            value={c.travel}
            rooms={roomIds.map((id) => ({ id, name: rooms[id].name ?? id }))}
            onChange={(travel) => setC({ travel })}
          />
        </Section>
      )}

      {showPlay("cars") && (
        <Section g="base" title="座驾" on={has(c.cars)} hint="已添加 · 购车与切换座驾（建议同时添加出行与交通）" count={c.cars?.length} defaultOpen>
          <ModCarsEditor
            cars={c.cars?.length ? c.cars : [{ id: "car1", name: "", price: 10000, resale: 0.5, comfort: 0, tag: "", desc: "" }]}
            travel={c.travel}
            world={`${m.name}${m.description ? `：${m.description}` : ""}`}
            statLabels={{ ...(STAT_LABELS as Record<string, string>) }}
            rooms={roomIds.map((id) => ({ id, name: rooms[id].name ?? id }))}
            onChange={(p) => setC(p)}
          />
        </Section>
      )}

      {showPlay("gigs") && <Section g="base" title="通告库" hint="通告门槛 · 酬劳 · 名气 · 成长 · 星级价目表" count={c.gigs?.length || undefined} on={has(c.gigs) || has(c.gigPrices)}>
        <Help>由已添加「演艺事业包」提供。叠加包通告按 id 追加 / 覆盖。</Help>
        <ModGigsEditor value={c.gigs} prices={c.gigPrices} onChange={(gigs) => setC({ gigs })} onPrices={(gigPrices) => setC({ gigPrices })} />
      </Section>}

      {showPlay("contracts") && <Section g="base" title="经纪合约" hint="开局候选合约 · 通告性质 · 议价规则" count={c.contracts?.signing?.length || undefined} on={has(c.contracts)}>
        <SlotDataEditor value={c.contracts} onChange={(contracts) => setC({ contracts })}
          emptyText="还没写经纪合约，开局不会生效。" note="「开局候选合约」在建角最后一步让玩家签；「通告档位参数」和「议价规则」决定接通告时怎么谈价、会不会被抢。" />
      </Section>}

      {showPlay("projects") && <Section g="base" title="影视项目" hint="项目模板 · 试镜 · 片场事件 · 质量与上映 · 制片人" count={c.projects?.projects?.length || undefined} on={has(c.projects)}>
        <SlotDataEditor value={c.projects} onChange={(projects) => setC({ projects })}
          emptyText="还没写影视项目，开局不会生效。" note="「项目模板」是玩家能接的剧 / 电影 / 综艺；其余是试镜、拍摄、上映的结算参数，不确定就别动。" />
      </Section>}

      {showPlay("industry") && <Section g="base" title="行业生态" hint="经纪公司 · 片名库 · 代言品牌 · 奖项 · 圈内动态" count={c.industry?.companies?.length || undefined} on={has(c.industry)}>
        <SlotDataEditor value={c.industry} onChange={(industry) => setC({ industry })}
          emptyText="还没写行业生态，开局不会生效。" note="人气榜、周报和圈内新闻从这里取公司、片名、品牌与奖项。" />
      </Section>}

      {showPlay("imageCrisis") && <Section g="base" title="舆情人设" hint="人设 · 公开行动 · 危机 · 公关应对 · 判定权重" count={c.imageCrisis?.crises?.length || undefined} on={has(c.imageCrisis)}>
        <SlotDataEditor value={c.imageCrisis} onChange={(imageCrisis) => setC({ imageCrisis })}
          emptyText="还没写舆情人设，开局不会生效。" note="需要已添加「舆情人设包」。" />
      </Section>}

      {showPlay("weeklyPaper") && <Section g="base" title="娱乐周报" hint="报头 · 副标题" on={has(c.weeklyPaper)}>
        <div className="grid grid-cols-2 gap-2">
          <label><span className={lbl}>报头</span><input className={inp} value={c.weeklyPaper?.masthead ?? ""} placeholder="週報" onChange={(e) => { const w = { ...c.weeklyPaper, masthead: e.target.value || undefined }; setC({ weeklyPaper: w.masthead || w.tagline ? w : undefined }); }} /></label>
          <label><span className={lbl}>副标题</span><input className={inp} value={c.weeklyPaper?.tagline ?? ""} placeholder="可留空" onChange={(e) => { const w = { ...c.weeklyPaper, tagline: e.target.value || undefined }; setC({ weeklyPaper: w.masthead || w.tagline ? w : undefined }); }} /></label>
        </div>
        <Help>由已添加「娱乐周报包」提供；内容取自行业生态与本周动向。</Help>
      </Section>}

      {showPlay("meals") && <Section g="base" title="每周吃什么" hint="伙食档位 · 每周花费 · 压力 / 能力 / 气色 · 解锁门槛" count={c.meals?.length || undefined} on={has(c.meals)}>
        <ModMealsEditor value={c.meals} onChange={(meals) => setC({ meals })} />
      </Section>}

      {/* 功能注释：头衔仅在添加「头衔包」后出现；数值分档在建角属性，不进本块 */}
      {showPlay("titles") && (
        <Section g="base" title="头衔" on={has(c.titles)} hint="达标即获得 · 品阶 · 条件（名气 / 口碑 / 能力 / 自定义属性）" count={c.titles?.length || undefined}>
          <Help>已添加「头衔包」才显示本区；移除玩法会清掉头衔表。多少分叫什么档，请在「建角」数值属性里配分档。</Help>
          <ModRulesEditor stats={c.stats} attrs={c.customAttrs} value={{ titles: c.titles }} showBills={false} onChange={(p) => setC(p)} />
        </Section>
      )}

      {showPlay("pregnancy") && <Section g="base" title="孕育" hint="孕期 · 受孕率 · 察觉时间 · 孩子名字池" on={has(c.pregnancy) || c.features?.pregnancy === true}>
        <Help>已添加「孕育包」即生效；此处只调孕期参数。从玩法列表移除孕育包即关闭。</Help>
        <ModPregnancyEditor value={c.pregnancy} onChange={(pregnancy) => setC({ pregnancy })} />
      </Section>}

      {/* 功能注释：关系玩法须从商店添加；未安装不出现配置块，人物页也不出表白/婚礼 */}
      {showPlay("relations") && (
        <Section g="base" title="关系玩法" on={has(c.relations) || c.features?.relationsPlay === true} hint="表白门槛 · 婚礼费用与好感 · NPC 牵线 · 伴侣加成">
          <Help>已添加「关系玩法」才显示本区；人物页的表白、婚礼入口随本玩法开关。移除玩法会清空本区配置。</Help>
          <ModRelationsEditor value={c.relations} npcs={npcs.map((n) => ({ id: n.id, name: n.name || n.id }))}
            keyOptions={perkKeyOptions({
              statLabels: { ...RAW_STAT_LABELS, ...(c.stats?.labels ?? {}) },
              statOrder: (c.stats?.order?.length ? c.stats.order : ALL_STAT_KEYS).filter((k) => !(c.stats?.hidden ?? []).includes(k)),
              attrs: c.customAttrs,
              metaLabels: c.stats?.metaLabels,
              term: (k, fb) => c.terms?.[k] ?? fb,
            })} onChange={(relations) => setC({ relations: relations as Mod["content"]["relations"] })} />
        </Section>
      )}

      <Section
        g="look"
        title="手机应用配置"
        on={has(c.phoneAppsCfg) || has(c.phoneHomeWallpaper) || showPlay("phoneApp")}
        hint="显示名 · 图标 · 主屏顺序 · Dock · 开局预装 · 桌面背景"
        count={(c.phoneAppsCfg?.length ?? 0) + (c.phoneHomeWallpaper ? 1 : 0) || undefined}
      >
        {/* 功能注释：不向创作者展示内部规则说明，只留预览 / 点背景 / 应用清单操作区 */}
        <PhoneAppsEditor
          value={c.phoneAppsCfg}
          wallpaper={c.phoneHomeWallpaper}
          onChange={(phoneAppsCfg) => setC({ phoneAppsCfg })}
          onWallpaperChange={(phoneHomeWallpaper) => setC({ phoneHomeWallpaper })}
          worldThemeTagId={worldTheme.themeTagId}
          worldThemeLabel={worldTheme.themeLabel}
          worldThemeCode={worldTheme.themeCode}
          enabledThemeTags={enabledThemeTags}
        />
      </Section>

      {/* 功能注释：皮肤美化只留主题皮肤与自定义色/字体；面板级 DIY（色值滑条与动画）入口已下线，旧 ext.skin 运行时仍可读。 */}
      <Section
        g="look"
        title="皮肤美化"
        on={has(c.theme)}
        count={Object.keys(c.theme ?? {}).length || undefined}
      >
        <ModThemeEditor value={c.theme} onChange={(theme) => setC({ theme })} />
      </Section>

      {/* 功能注释：音乐是世界本体，落在①基础（C1.2）；不再挂⑤美化 */}
      <Section g="base" title="音乐" on={has(c.bgm) || has(c.audioRefs) || has(c.platformAudioRefs)} hint="上传 · 链接 · 本机库 · 作品引用 · 平台曲库" count={(c.bgm?.length ?? 0) + (c.audioRefs?.length ?? 0) + (c.platformAudioRefs?.length ?? 0)}>
        <ModBgmEditor bgm={c.bgm} audioRefs={c.audioRefs} platformAudioRefs={c.platformAudioRefs} platformAutoplay={c.platformAutoplay} musicOrder={c.musicOrder} onChange={(patch) => setC(patch)} />
      </Section>

      <Section g="look" title="开场剧情" target="author-field-opening" on={has(c.opening)} hint="开场页外观 · AI 对话 / 粘贴 HTML · 实时预览" count={Object.keys(c.opening ?? {}).length || undefined}>
        {/* 功能注释：只留开场页外观；旧模组 title/paragraphs 等字段仍保留在 content.opening，运行时用内置排版播放，编辑器不再二次填写 */}
        <Help>作品展示封面在「① 基础 → 基本信息」名称上方配置（仅列表/详情/书架用，开局不显示）。自定义开场页用 AI 对话或粘贴 HTML；不做自定义时，游戏按内置排版播已有开场文案（旧数据不会被保存清掉）。</Help>
        <p className="ui-label">开场页外观</p>
        <div data-author-field="author-field-opening" tabIndex={-1}>
          <OpeningStyleStudio value={c.opening} modId={m.id} modName={m.name}
            onPage={(page) => {
            // 功能注释：只改 page，展开保留旧 kicker/title/paragraphs 等，禁止因改版式而抹掉内置开场白
            const o = { ...(c.opening ?? {}), page };
            if (!page) delete o.page;
            setC({ ...c, opening: Object.keys(o).length ? o : undefined });
            }} />
        </div>
      </Section>

      <Section g="look" title="剧情美化" on={has(c.lookRules)} hint="条件满足时自动切换外观 · 玩家可在美化里关闭" count={c.lookRules?.length}>
        <p className="text-[11px] leading-relaxed text-ink-soft">给这个世界设计「会随剧情变化的外观」：深夜转暗、压力爆表变灰、成名后换上流金……条件与固定事件同一套，也能读取玩法规则里的规则变量。玩家自己的剧情美化优先于此处。</p>
        <LookRulesEditor value={c.lookRules} events={c.fixedEvents} onChange={(lookRules) => setC({ lookRules })} />
      </Section>

      <Section
        g="look"
        title="底栏页签"
        on={has(c.navTabs) || has(c.navSize) || NAV_TAB_TERMS.some(({ k }) => !!c.terms?.[k])}
        hint="图标 · 顺序 · 选中态 · 显示名 · 实时预览"
        count={c.navTabs?.filter((t) => t.on !== false).length || NAV_TAB_TERMS.filter(({ k }) => !!String(c.terms?.[k] ?? "").trim()).length || undefined}
      >
        <Help>
          档案与支线是游戏本体（头像弹窗 / 菜单剧情志），不进底栏，也不进玩法列表。
          可选玩法在「① 基础 → 已添加的玩法」添加即生效、移除即停用；这里只调底栏布局与改名。
        </Help>
        <NavTabsModEditor
          terms={c.terms}
          features={c.features}
          navTabs={c.navTabs}
          navSize={c.navSize}
          onChange={(p) => setC(p)}
        />
      </Section>

      </div>
      </GroupCtx.Provider>
      )}
      {!draft.pending && !String(q ?? "").trim() && (prevG || nextG) && (
        <div className="flex gap-2">
          {prevG && (
            <button type="button" onClick={() => goGroup(prevG.k)} className="shrink-0 rounded-xl border border-line px-3 py-2 text-[12.5px] font-bold text-ink-soft hover:border-jade hover:text-jade">‹ {prevG.label}</button>
          )}
          {nextG && (
            <button type="button" onClick={() => goGroup(nextG.k)} className="flex-1 rounded-xl border border-dashed border-jade/60 py-2 text-[12.5px] font-bold text-jade hover:bg-jade/10">
              下一步：{nextG.label} ›
            </button>
          )}
        </div>
      )}
      {!draft.pending && (
        <p className="text-[11px] text-ink-soft">未在当前页展示的内容会原样保留；保存请用顶部「保存」（Ctrl/⌘+S）。</p>
      )}
    </div>
    </DraftRefsContext.Provider>
  );
}

/* 人物音色：填语音模型的 voice 名，可当场试听；留空则按性别用设置里的默认音色 */
function VoiceField({ label, value, gender, sample, onChange }: { label: string; value?: string; gender?: string; sample: string; onChange: (v: string) => void }) {
  const [st, setSt] = useState<"" | "busy" | "ok" | string>("");
  const cfg = loadConfig();
  const test = async () => {
    setSt("busy");
    try { const url = await synthSpeech(cfg, sample, gender, value?.trim() || undefined); await new Audio(url).play(); setSt("ok"); }
    catch (e) { setSt(e instanceof Error ? e.message : "试听失败"); }
  };
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="shrink-0 text-[11.5px] text-ink-soft">{label}</span>
        <input className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-2 py-1 text-[12px] text-ink outline-none focus:border-jade" value={value ?? ""} placeholder={cfg.ttsModel ? "留空用默认音色" : "需先在设置里配置语音模型"} onChange={(e) => onChange(e.target.value)} />
        <button type="button" disabled={!cfg.ttsModel || st === "busy"} onClick={test} className="shrink-0 rounded-full border border-jade px-2 py-0.5 text-[11px] font-bold text-jade transition hover:bg-jade/10 disabled:opacity-40">{st === "busy" ? "…" : "试听"}</button>
      </div>
      {st && st !== "busy" && st !== "ok" && <p className="mt-0.5 truncate text-[10.5px] text-danger">{st}</p>}
    </div>
  );
}
