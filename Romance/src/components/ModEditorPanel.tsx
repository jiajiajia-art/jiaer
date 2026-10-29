import ModRoomTreeEditor from "./ModRoomTreeEditor";
import { useDraft, fmtDraftTime } from "../lib/useDraft";
import { loadConfig } from "../lib/store";
import { synthSpeech } from "./phone/screenShare";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { importModJson, useMods, validateMod } from "../mods/registry";
import { AUTHOR_PREVIEW_END, assessAuthorPreview, requestAuthorPreview, type AuthorPreviewSession } from "../lib/authorPreview";
import type { FeatureFlags, Mod, ModKind, PromptFragments, TermKey } from "../mods/types";
import type { Option } from "../game/data";
import type { Dir, PersonContent, RoomContent } from "../worlds/star2005/content";
import AudioPicker from "./AudioPicker";
import { audioLabel } from "../game/audioLib";
import ModBgmEditor from "./ModBgmEditor";
import ModTravelEditor from "./ModTravelEditor";
import ModAvatarPoolsEditor from "./ModAvatarPoolsEditor";
import { variantNames } from "../game/avatarPools";
import ModCarsEditor from "./ModCarsEditor";
import SlotDataEditor from "./DataForm";
import { ModGigsEditor, ModMealsEditor, ModPregnancyEditor } from "./ModPackEditors";
import { GIG_POOL } from "../game/data";
import { RAW_CONTRACTS, RAW_IMAGE_CRISIS, RAW_INDUSTRY, RAW_PROJECTS } from "../worlds/star2005/content";
import { STAT_LABELS, RAW_STAT_LABELS, ALL_STAT_KEYS } from "../game/data";
import { perkKeyOptions } from "../game/perkKeys";
import ModWorldBookEditor from "./ModWorldBookEditor";
import ModLoreEditor from "./ModLoreEditor";
import ModFestivalEditor from "./ModFestivalEditor";
import ModRelationsEditor from "./ModRelationsEditor";
import ImagePicker from "./ImagePicker";
import { LIVE_LOCATIONS, LIVE_PEOPLE } from "../mods/registry";
import FixedEventsPanel from "./FixedEventsPanel";
import ContactsPanel from "./ContactsPanel";
import EndingsPanel from "./EndingsPanel";
import ModIncomeEditor from "./ModIncomeEditor";
import ModOpeningEditor, { ModCoverEditor } from "./ModOpeningEditor";
import OpeningStyleStudio from "./OpeningStyleStudio";
import ModAttrsEditor from "./ModAttrsEditor";
import ModTrainingsEditor from "./ModTrainingsEditor";
import ModActsEditor from "./ModActsEditor";
import ModRulesEditor from "./ModRulesEditor";
import ModPoolsEditor from "./ModPoolsEditor";
import ModTuningEditor from "./ModTuningEditor";
import ModBalancePanel from "./ModBalancePanel";
import ModHealthPanel from "./ModHealthPanel";
import { balanceCheck, priorFor } from "../mods/balance";
import TimelineEditor from "./TimelineEditor";
import { worksMarkPreview } from "../lib/worksChip";
import ModPathsEditor from "./ModPathsEditor";
import ModCreationFieldsEditor from "./ModCreationFieldsEditor";
import ModPromptEditor from "./ModPromptEditor";
import ModThemeEditor from "./ModThemeEditor";
import AddPlayModModal from "./AddPlayModModal";
import { sanitizeModStrings } from "../lib/sanitizeModStrings";
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
  type PlayModEditorPanelId,
} from "../mods/playModCatalog";
import GameRulesEditor from "./GameRulesEditor";
import StorylinesEditor from "./StorylinesEditor";
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
const DATE_RE = /^\d{4}[-./]\d{2}[-./]\d{2}$/;

/** 底栏页签术语键（编辑器同步写入；用于分组完成度统计） */
const NAV_TAB_TERMS: { k: TermKey; label: string }[] = [
  { k: "tabWorld", label: "页签 · 世界" }, { k: "tabIndustry", label: "页签 · 行业" }, { k: "tabNpc", label: "页签 · 人物" },
  { k: "tabPhone", label: "页签 · 手机" }, { k: "tabImage", label: "页签 · 形象" }, { k: "tabSim", label: "页签 · 档案" },
];
const FEATURES: { k: Exclude<keyof FeatureFlags, "phoneApps" | "phoneAppsExtra">; label: string }[] = [
  { k: "industryTab", label: "行业主页签（人气榜 / 机遇）" }, { k: "weeklyPaper", label: "周报小报" },
  { k: "career", label: "通告 / 作品 / 项目" }, { k: "imageCrisis", label: "形象 · 舆情危机" }, { k: "phone", label: "手机页签" },
  { k: "pregnancy", label: "怀孕" }, { k: "transport", label: "交通系统（出行方式 / 车费）" }, { k: "cars", label: "座驾" },
];
/** 功能注释：与 ModPromptEditor 可见字段对齐（仅 gmIntro / worldIntro / narratorPersona） */
const PROMPTS: { k: "gmIntro" | "worldIntro" | "narratorPersona"; label: string; help: string }[] = [
  { k: "gmIntro", label: "GM 开场白", help: "替换系统提示开头「你是……的 GM」整段。" },
  { k: "worldIntro", label: "世界观设定", help: "追加注入，概括时代、地点、基调。" },
  { k: "narratorPersona", label: "叙事口吻", help: "文风、人称、节奏等要求。" },
];
const inp = "w-full min-w-0 rounded-lg border border-line bg-paper-2 px-2.5 py-1.5 text-[12.5px] text-ink placeholder:text-ink-soft/70 focus:border-jade focus:outline-none";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const lbl = "mb-0.5 block text-[10.5px] font-bold tracking-[0.12em] text-ink-soft";
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
const shortId = (p: string) => `${p}${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 4)}`;

export function blankMod(kind: ModKind): Mod {
  return { id: "", name: "", version: "0.1.0", author: "", description: "", kind, dependencies: kind === "addon" ? ["ent"] : [], content: {} };
}

/* 编辑器分组：按所属系统归类；原「④ 世界」已并入①基础（地点）；取消原「⑥ 开场」一级分类 */
const GROUPS = [
  { k: "all", label: "全部", hint: "所有设置一览（按创作顺序排列）" },
  { k: "base", label: "① 基础", hint: "名称与简介、时间与推进、开局封面、地点、头像库、功能开关、底栏页签与手机应用、主题与音乐" },
  { k: "role", label: "② 角色", hint: "玩家的能力属性、建角页（人物线路 / 字段 / 选项池）、世界里的人物与时间线" },
  { k: "grow", label: "③ 养成", hint: "开局资金与初始资源、日程玩法、名气分档与头衔、账单与收支、玩法规则、引擎结算规则" },
  { k: "story", label: "④ 剧情", hint: "世界观提示词、世界书、开场剧情（开场白 / 开场页）、固定 / 首次事件、主线与结局、剧情美化" },
  { k: "play", label: "⑤ 玩法 Mod", hint: "用卡片添加 / 启用 / 关闭玩法与手机应用；详细配置用开关和表单，无需写代码" },
  { k: "pack", label: "本包内容", hint: "只列出这个叠加包里实际写了内容的区块；要加别的内容，去其他分组找" },
] as const;
const STEPS = GROUPS.filter((x) => x.k !== "all" && x.k !== "pack");
type GroupKey = (typeof GROUPS)[number]["k"];
const GroupCtx = createContext<{ cur: GroupKey; q: string; expand: boolean | null }>({ cur: "all", q: "", expand: null });

/* 各分组里「已填写内容」的区块数，显示在分组页签上，一眼看出哪里还没动过 */
const has = (x: unknown) => Array.isArray(x) ? x.length > 0 : x && typeof x === "object" ? Object.keys(x).length > 0 : x !== undefined && x !== "";
function groupFilled(c: Mod["content"]): Record<Exclude<GroupKey, "all" | "pack">, number> {
  const n = (...xs: boolean[]) => xs.filter(Boolean).length;
  return {
    base: n(
      [c.startDate, c.startTime, c.dayStart, c.dayEnd].some(has) || has(c.play) || has(c.travel?.apPerTurn) || has(c.travel?.advanceUnit),
      has(c.cover),
      has(c.startRoom) || has(c.rooms),
      has(c.features),
      has(c.phoneAppsCfg) || has(c.navTabs) || NAV_TAB_TERMS.some(({ k }) => !!c.terms?.[k]),
      has(c.theme),
      has(c.bgm) || has(c.audioRefs),
    ),
    role: n(has(c.customAttrs) || has(c.stats), has(c.creation?.paths), has(c.creation?.fields) || has(c.creation?.builtin),
      [c.styles, c.identities, c.backgrounds, c.directions, c.school, c.parentJobs].some(has), has(c.avatars), has(c.npcs)),
    grow: n(has(c.startMoney), has(c.trainings), has(c.sideJobs) || has(c.weekendActs), has(c.fameTiers) || has(c.titles) || has(c.bills), has(c.income), has(c.gameRules), has(c.tuning)),
    story: n(has(c.prompt), has(c.lore), has(c.worldBook), has(c.festivals), has(c.opening), has(c.fixedEvents) || has(c.events), has(c.storylines), has(c.lookRules)),
    play: n(
      has(c.playModInstalls),
      has(c.travel) || has(c.cars),
      has(c.gigs) || has(c.gigPrices),
      has(c.contracts),
      has(c.projects),
      has(c.industry),
      has(c.imageCrisis),
      has(c.weeklyPaper),
      has(c.meals),
      has(c.pregnancy),
    ),
  };
}
const isTextField = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || (t.tagName === "INPUT" && !["checkbox", "radio", "button", "range", "color", "file"].includes((t as HTMLInputElement).type)));

/* on：本区块在这个模组里写了内容（「本包内容」视图只列这些） */
function Section({ g, title, hint, count, children, defaultOpen, on }: { g: Exclude<GroupKey, "all" | "pack">; title: string; hint?: string; count?: number; children: ReactNode; defaultOpen?: boolean; on?: boolean }) {
  const { cur, q, expand } = useContext(GroupCtx);
  const s = String(q ?? "").trim().toLowerCase();
  if (s ? !(title + (hint ?? "")).toLowerCase().includes(s) : cur === "pack" ? !on : cur !== "all" && cur !== g) return null;
  const open = expand ?? (defaultOpen || !!s || cur !== "all");
  return (
    <details key={String(expand)} open={open || undefined} className="group rounded-2xl border border-line bg-paper/50">
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

export default function ModEditorPanel({ initial, isNew, onClose, onAiChat, onBackToWizard, initialGroup, onLiveChange, onChromeChange, fluid }: {
  initial: Mod;
  isNew: boolean;
  onClose: (savedName?: string, savedId?: string) => void;
  onAiChat?: (m: Mod) => void;
  /** 创作向导第 2 步：返回第 1 步改设定（不放弃当前编辑草稿） */
  onBackToWizard?: () => void;
  /** 功能注释：刷新恢复时还原分区页签（①基础…） */
  initialGroup?: string;
  /** 功能注释：编辑中把最新剧本回传给向导会话，刷新后仍能恢复 */
  onLiveChange?: (m: Mod) => void;
  /** 功能注释：分区切换时通知向导写入会话 */
  onChromeChange?: (snap: { group: string }) => void;
  /**
   * 功能注释：生成世界流式宽——手机 100% 设备宽，PC 最大 1200 居中。
   * 默认仍锁 1200 最小宽供桌面模组库（非生成世界入口）。
   */
  fluid?: boolean;
}) {
  const { mods } = useMods();
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
    bootModRef.current = boot;
  }
  const [baseline, setBaseline] = useState(() => JSON.stringify(bootModRef.current!));
  const [m, setMRaw] = useState<Mod>(() => bootModRef.current!);
  // 保存后留在编辑器：persisted = 已写入过模组库（id 从此锁定）；savedName 用于返回时提示
  const [persisted, setPersisted] = useState(!isNew);
  const [showModDepsAdvanced, setShowModDepsAdvanced] = useState(false);
  const [savedName, setSavedName] = useState<string>();
  const [savedId, setSavedId] = useState<string>();
  const [savedTip, setSavedTip] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [previewFatal, setPreviewFatal] = useState<string[]>([]);
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
  const lockId = (x: Mod) => (persisted && x.id !== m.id ? { ...x, id: m.id } : x);
  const undo = () => { const h = hist.current; const prev = h.past.pop(); if (!prev) return; h.future.push(m); h.at = 0; const n = lockId(prev); setMRaw(n); liveCb.current?.(n); setRev((r) => r + 1); };
  const redo = () => { const h = hist.current; const next = h.future.pop(); if (!next) return; h.past.push(m); h.at = 0; const n = lockId(next); setMRaw(n); liveCb.current?.(n); setRev((r) => r + 1); };
  const rootRef = useRef<HTMLDivElement>(null);
  // 叠加包（尤其是内置玩法包的副本）默认只看「本包内容」，免得在几十个区块里找；刷新时可强制还原分区
  const [group, setGroup] = useState<GroupKey>(() => {
    // 功能注释：旧会话「功能扩展→玩法」「世界→基础」兼容，避免刷新落在已删页签
    const boot =
      initialGroup === "ext" ? "play"
      : initialGroup === "world" ? "base"
      : initialGroup;
    if (boot && GROUP_KEYS.has(boot)) return boot as GroupKey;
    return initial.kind === "addon" && Object.keys(initial.content ?? {}).length ? "pack" : "base";
  });
  const [expand, setExpand] = useState<boolean | null>(null);
  const goGroup = (k: GroupKey) => { setGroup(k); setQ(""); setExpand(null); rootRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }); };
  const chromeCb = useRef(onChromeChange);
  chromeCb.current = onChromeChange;
  useEffect(() => {
    chromeCb.current?.({ group });
  }, [group]);
  // 数值体检：分区标题上显示需要留意的条数（脏数据不得拖垮整页）
  const healthWarn = useMemo(() => {
    try {
      const p = priorFor(m);
      return balanceCheck(m, p[0]).filter((f) => f.level === "warn").length;
    } catch {
      return 0;
    }
  }, [m]);
  const filled = useMemo(() => groupFilled(m.content), [m.content]);
  const [q, setQ] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [npcQ, setNpcQ] = useState("");
  const [confirm, confirmEl] = useConfirm();
  const dirty = JSON.stringify(m) !== baseline;
  // 本机草稿：编辑中自动缓存；再次打开时若与已保存版本不一致，提示选择要加载的版本
  const draft = useDraft<Mod>(`mod.${persisted ? m.id : "new"}`, m, baseline, dirty);
  const c = m.content;
  const setC = (p: Partial<Mod["content"]>) => setM({ ...m, content: { ...m.content, ...p } });
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
  /** 功能注释：按故事设定推荐玩法 mod，须作者点「安装」才写入；绝不自动添加 */
  const playModRecs = useMemo(() => {
    const seed = [m.description, c.prompt?.worldIntro].filter(Boolean).join("\n");
    return recommendPlayModsFromSetting(seed, c.playModInstalls);
  }, [m.description, c.prompt?.worldIntro, c.playModInstalls]);
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
    setC({ playModInstalls: next });
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
    setC({ playModInstalls: next });
  };
  // 年龄随日历 / 自选开局日期等 play 槽：只写入有意义的键，全空则整槽删除（游玩模式/视角改在生成世界向导第 2 步）
  const setPlay = (p: Partial<PlaySlot>) => {
    const n: PlaySlot = { ...c.play, ...p };
    for (const k of Object.keys(n) as (keyof PlaySlot)[]) if (n[k] === undefined || n[k] === false || n[k] === "") delete n[k];
    setC({ play: Object.keys(n).length ? n : undefined });
  };

  // —— 字段级校验 ——
  const builtinIds = new Set(mods.filter((x) => x.builtin).map((x) => x.id));
  const idErr = !ID_RE.test(m.id) ? "2~41 位小写字母 / 数字 / - _，首字符为字母或数字"
    : builtinIds.has(m.id) ? "与内置模组同名，请换一个"
    : !persisted && mods.some((x) => x.id === m.id) ? "已存在同 id 的模组，保存将覆盖它" : "";
  // 功能注释：AI 脏数据可能把 name 写成非字符串，禁止直接 .trim()
  const nameErr = String(m.name ?? "").trim() ? "" : "必填";
  const verErr = VER_RE.test(m.version) ? "" : "须形如 1.0.0";
  const dateErr = c.startDate && !DATE_RE.test(c.startDate) ? "须形如 2005.01.03" : "";
  const rooms = c.rooms ?? {};
  const roomIds = Object.keys(rooms);
  const npcs = c.npcs ?? [];
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
    setC({ rooms: next, startRoom: c.startRoom === id ? Object.keys(next)[0] : c.startRoom });
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
  const addNpc = () => setC({ npcs: [...npcs, { id: shortId("npc_"), name: "", role: "", kind: "roam", home: c.startRoom ?? roomIds[0] ?? "", roam: [], bio: "", requires: [] }] });

  const clean = (): Mod => {
    const out: Mod = structuredClone(m);
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
    if (ct.prompt) { for (const k of Object.keys(ct.prompt) as (keyof PromptFragments)[]) { const v = ct.prompt[k]; if (typeof v === "string" && !v.trim()) delete ct.prompt[k]; } if (!Object.keys(ct.prompt).length) delete ct.prompt; }
    if (ct.features && !Object.keys(ct.features).length) delete ct.features;
    if (!ct.startDate) delete ct.startDate;
    if (!ct.weather) delete ct.weather;
    if (ct.rooms && !Object.keys(ct.rooms).length) { delete ct.rooms; delete ct.startRoom; }
    delete out.builtin;
    return out;
  };
  const save = (stay = false) => {
    const local = [idErr && !idErr.startsWith("已存在") ? `id：${idErr}` : "", nameErr && "名称必填", verErr && `版本号${verErr}`, dateErr && `开局日期${dateErr}`,
      dupNpc.size ? `人物 id 重复：${[...dupNpc].join("、")}` : "",
      npcs.some((n) => !String(n.name ?? "").trim()) ? "有人物未填写名字" : "",
      npcs.some((n) => !(typeof n.age === "number" && n.age >= 0)) ? `人物年龄必填：${npcs.filter((n) => !(typeof n.age === "number" && n.age >= 0)).map((n) => n.name || n.id).join("、")}` : "",
      npcs.some((n) => !String(n.gender ?? "").trim()) ? `人物性别必填：${npcs.filter((n) => !String(n.gender ?? "").trim()).map((n) => n.name || n.id).join("、")}` : ""].filter(Boolean) as string[];
    const out = clean();
    const errs = [...local, ...validateMod(out)];
    if (errs.length) { setErrors([...new Set(errs)]); return false; }
    const r = importModJson(JSON.stringify(out));
    if (!r.ok) { setErrors(r.errors); return false; }
    draft.clear();
    if (!stay) { onClose(out.name, out.id); return true; }
    setErrors([]);
    setBaseline(JSON.stringify(m));
    setPersisted(true);
    setSavedName(out.name);
    setSavedId(out.id);
    setSavedTip(true);
    setSavedAt(Date.now());
    return true;
  };
  const cancel = async () => { if (!dirty || (await confirm("放弃未保存的修改？本机草稿也会一并删除。", { ok: "放弃" }))) { draft.clear(); onClose(savedName, savedId); } };

  const openPreview = () => {
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
    window.addEventListener("star:author-preview-fatal", onFatal);
    window.addEventListener(AUTHOR_PREVIEW_END, onPreviewEnd);
    return () => {
      window.removeEventListener("star:author-preview-fatal", onFatal);
      window.removeEventListener(AUTHOR_PREVIEW_END, onPreviewEnd);
    };
  }, []);
  // 快捷键：Ctrl/⌘+S 保存（留在编辑器）；不在输入框里时 Ctrl/⌘+Z 撤销、Ctrl/⌘+Shift+Z 或 Ctrl+Y 重做
  const keyRef = useRef({ save, undo, redo });
  keyRef.current = { save, undo, redo };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
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
  const gi = GROUPS.findIndex((x) => x.k === group);
  const si = STEPS.findIndex((x) => x.k === group);
  const prevG = si <= 0 ? null : STEPS[si - 1];
  const nextG = group === "pack" || si === STEPS.length - 1 ? null : STEPS[group === "all" ? 0 : si + 1];
  const canUndo = hist.current.past.length > 0, canRedo = hist.current.future.length > 0;

  const savedLabel = savedAt
    ? `已保存 · ${new Date(savedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
    : null;

  return (
    /* 功能注释：非 fluid 锁 1200 最小宽；fluid 由 .world-gen-editor CSS 管：手机 100% / PC≤1200 */
    <div
      ref={rootRef}
      className={`mod-editor-root mx-auto w-full scroll-mt-2 space-y-2.5 text-ink ${
        fluid ? "min-w-0 max-w-[1200px]" : "min-w-[1200px] max-w-[1200px]"
      }`}
    >
      {confirmEl}
      {addPlayOpen && (
        <AddPlayModModal
          installs={c.playModInstalls ?? []}
          onChange={(playModInstalls) => setC({ playModInstalls: playModInstalls.length ? playModInstalls : undefined })}
          onClose={() => setAddPlayOpen(false)}
          onConfirmDeps={(message) => confirm(message, { ok: "一并添加" })}
        />
      )}
      {/* 功能注释：顶栏固定「保存 / 预览」在右侧且 shrink-0，避免窄屏被标题挤出可视区 */}
      <div className="mod-editor-chrome sticky top-0 z-20 -mx-1 space-y-1 border-b border-line bg-paper-2/95 px-1 py-2 backdrop-blur">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button type="button" className={`${btn} shrink-0 !px-2 sm:!px-2.5`} onClick={() => (onBackToWizard ? onBackToWizard() : void cancel())}>
            ‹ 返回
          </button>
          <span className="min-w-0 flex-1 truncate text-[13px] font-bold sm:text-[14px]">
            {persisted ? `编辑「${m.name || initial.name}」` : "新建模组"}
          </span>
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            {/* 功能注释：保存入口只放顶栏；原底栏「保存并返回 / 放弃」并入此处，避免双入口 */}
            <button
              type="button"
              onClick={() => save(true)}
              disabled={persisted && !dirty}
              title="保存当前全部修改（Ctrl/⌘+S），留在编辑器"
              className="rounded-full bg-jade px-2.5 py-1.5 text-[12px] font-bold text-white transition disabled:opacity-40 sm:px-3.5 sm:text-[12.5px]"
            >
              保存
            </button>
            <button
              type="button"
              onClick={() => (dirty || !persisted ? save(false) : onClose(savedName))}
              title={dirty || !persisted ? "保存并退出编辑器" : "返回上一页"}
              className="rounded-full border border-jade px-2.5 py-1.5 text-[12px] font-bold text-jade transition hover:bg-jade/10 sm:px-3 sm:text-[12.5px]"
            >
              {dirty || !persisted ? "保存并返回" : "返回"}
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
        {errors.length > 0 && (
          <div role="alert" className="max-h-32 overflow-y-auto rounded-xl border border-danger/50 bg-danger/10 px-3 py-2 text-[12px] text-danger">
            <div className="flex items-center justify-between gap-2">
              <b>还有 {errors.length} 处需要修改才能保存：</b>
              <button type="button" onClick={() => setErrors([])} aria-label="关闭提示" className="px-1 text-[14px] leading-none hover:text-ink">×</button>
            </div>
            <ul className="mt-1 space-y-0.5">{errors.map((e, i) => <li key={i}>· {e}</li>)}</ul>
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
        <button type="button" className="text-[12px] font-semibold text-jade hover:underline" onClick={onBackToWizard}>
          ← 返回修改设定
        </button>
      ) : null}
      {draft.pending && (
        <div role="alertdialog" aria-label="发现本机未保存草稿" className="rounded-2xl border border-gold/50 bg-gold/10 p-3.5">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M12 13v4M12 11h.01" /></svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-bold text-ink">发现本机未保存的草稿</p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
                这个模组在浏览器里有一份自动保存的草稿（{fmtDraftTime(draft.pending.at)}），与已保存的版本不一致。请选择要加载的版本。
                {draft.stale && <b className="mt-1 block font-semibold text-danger">注意：草稿生成之后，已保存的版本又被修改过，恢复草稿会覆盖那些修改。</b>}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button onClick={() => { const v = draft.restore(); if (v) { setM(lockId(structuredClone(v))); setRev((r) => r + 1); } }} className="rounded-full bg-jade px-3.5 py-1.5 text-[12px] font-bold text-white">恢复草稿</button>
                <button onClick={draft.discard} className={btn}>使用已保存版本</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {!authorSimplify && (
        <ScopeBanner scope="newgame">模组编辑保存后，在下次「开新局」时生效；当前存档继续使用开局时的内容。想改当前存档，请用世界书 / 地图编辑器等面板。</ScopeBanner>
      )}

      {onAiChat && (
        <button type="button" onClick={() => onAiChat(structuredClone(m))}
          className="flex w-full items-center justify-between gap-2 rounded-2xl border border-jade/40 bg-gradient-to-r from-jade/10 to-coral/10 px-3 py-2 text-left transition hover:border-jade">
          <span>
            <span className="flex items-center gap-1 text-[12.5px] font-bold text-ink"><IconSpark size={14} /> 用对话修改这个模组</span>
            <span className="block text-[11px] text-ink-soft">直接说「加个理智值属性」「把打工收入减半」，AI 改好后可再回来手调；未保存的改动会一起带过去</span>
          </span>
          <span className="shrink-0 text-[12px] font-bold text-jade">打开 ›</span>
        </button>
      )}
      <div className="sticky top-0 z-10 -mx-1 space-y-1.5 border-b border-line bg-paper-2/95 px-1 py-2 backdrop-blur">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          {GROUPS.filter((x) => x.k !== "pack" || m.kind === "addon").map((x) => {
            const on = group === x.k && !q;
            const n = x.k === "all" || x.k === "pack" ? 0 : filled[x.k];
            const warn = x.k === "grow" && healthWarn > 0;
            return (
              <button key={x.k} type="button" onClick={() => goGroup(x.k)} title={x.hint} aria-pressed={on}
                className={`relative flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-[12px] font-bold transition ${on ? "border-jade bg-jade text-white" : "border-line bg-paper text-ink-soft hover:border-jade hover:text-jade"}`}>
                {x.label}
                {n > 0 && <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${on ? "bg-white/25 text-white" : "bg-jade/12 text-jade"}`}>{n}</span>}
                {warn && <span aria-label="数值体检有提醒" className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-gold ring-2 ring-paper-2" />}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1"><SearchBox value={q} onChange={setQ} placeholder="搜索设置项，如「封面」「交通」「属性」…" /></div>
          <button className={`${btn} shrink-0`} onClick={undo} disabled={!canUndo} title="撤销（Ctrl/⌘+Z）" aria-label="撤销"><IconUndo size={14} /></button>
          <button className={`${btn} shrink-0`} onClick={redo} disabled={!canRedo} title="重做（Ctrl/⌘+Shift+Z）" aria-label="重做"><IconRedo size={14} /></button>
        </div>
        {!String(q ?? "").trim() && (
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-[11px] leading-snug text-ink-soft">{GROUPS.find((x) => x.k === group)?.hint}</p>
            {group === "all" && (
              <button type="button" onClick={() => setExpand((v) => !v)} className="shrink-0 text-[11px] font-bold text-jade hover:underline">{expand ? "全部收起" : "全部展开"}</button>
            )}
          </div>
        )}
      </div>
      <GroupCtx.Provider value={{ cur: group, q, expand }}>
      <div key={rev} className="space-y-2.5 [&:not(:has(>details))>.sec-empty]:block">
      <div className="sec-empty hidden"><EmptyState>没有找到「{String(q ?? "").trim()}」相关的设置项，换个词试试，比如「金钱」可以搜「资金」「收入」「账单」。</EmptyState></div>
      <Section
        g="base"
        title="基本信息"
        on={true}
        hint={authorSimplify ? "名称 · 简介 · 作品 ID" : "名称 · id · 类型 · 依赖"}
        defaultOpen
      >
        {authorSimplify ? (
          <>
            {/* 功能注释：作者态只保留名称/简介主入口；版本/作者/图标/类型/底座依赖仍写入底层字段但不在此编辑 */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className={lbl}>名称 *</span>
                <input className={inp} value={m.name} placeholder="如：雾色旅馆" onChange={(e) => setM({ ...m, name: e.target.value })} />
                <FieldErr>{nameErr}</FieldErr>
              </label>
              <label className="sm:col-span-2"><span className={lbl}>简介</span>
                <textarea className={inp} rows={3} value={m.description ?? ""} placeholder="一句话介绍这个世界（列表与开局页展示）" onChange={(e) => setM({ ...m, description: e.target.value })} />
              </label>
              <div className="sm:col-span-2">
                <span className={lbl}>作品 ID</span>
                <p className={`${inp} font-mono text-ink-soft`}>{m.id || "（保存时自动生成）"}</p>
                <Help>由系统自动生成，已有作品不可更改，避免引用失效。</Help>
                {!persisted && idErr ? <FieldErr>{idErr}</FieldErr> : null}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label><span className={lbl}>名称 *</span>
                <input className={inp} value={m.name} placeholder="如：修仙宗门" onChange={(e) => setM({ ...m, name: e.target.value, id: !persisted && (!m.id || m.id === slug(m.name)) ? slug(e.target.value) || m.id : m.id })} />
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
              <label className="block min-w-0 flex-1"><span className={lbl}>简介</span>
                <textarea className={inp} rows={2} value={m.description ?? ""} placeholder="一句话介绍这个世界 / 叠加包（给自己或玩卡的人看）" onChange={(e) => setM({ ...m, description: e.target.value })} />
              </label>
            </div>
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
        on={[c.startDate, c.startTime, c.dayStart, c.dayEnd, c.travel?.apPerTurn, c.travel?.advanceUnit, c.play?.ageAuto, c.play?.pickStartDate].some(has)}
        hint="开局日期 / 时刻 · 每日作息 · 行动点 · 推进节奏 · 年龄随日历"
        count={[c.startDate, c.startTime, c.dayStart, c.dayEnd, c.travel?.apPerTurn, c.travel?.advanceUnit, c.travel?.advanceDays, c.play?.ageAuto, c.play?.pickStartDate].filter((x) => x !== undefined && x !== "").length || undefined}
      >
        <p className="text-[11px] leading-relaxed text-ink-soft">本引擎用真实日历 + 每日时钟：主线推进前进日历并回满行动点；换地点、进支线扣行动点但不推进日历。开局封面与起点在本页「开局封面 / 地点」、资金在「③ 养成」、出行在「⑤ 玩法 Mod」添加后配置、开场白在「④ 剧情」——此处只编时间系统。</p>
        <div className="grid grid-cols-2 gap-2">
          <label><span className={lbl}>开局日期</span>
            <input className={`${inp} font-mono`} value={c.startDate ?? ""} placeholder="2005.01.03" onChange={(e) => setC({ startDate: e.target.value || undefined })} />
            <FieldErr>{dateErr}</FieldErr>
            {!dateErr && c.startDate && (() => {
              const [y, mo, d] = c.startDate.split(/[-./]/).map(Number);
              const dow = (new Date(Date.UTC(y, mo - 1, d)).getUTCDay() + 6) % 7;
              return <Help>{`这天是周${"一二三四五六日"[dow]}${dow ? `，第 1 周只剩 ${7 - dow} 天（周日结算）` : "，第 1 周完整 7 天"}`}</Help>;
            })()}
          </label>
          {([["startTime", "开局时刻", "默认 = 每日起始"], ["dayStart", "每天几点开始", "08:00"], ["dayEnd", "几点算一天结束", "23:00"]] as const).map(([k, l, ph]) => {
            const v = c[k] ?? "";
            const bad = !!v && !/^\d{1,2}:[0-5]\d$/.test(v);
            return (
              <label key={k}><span className={lbl}>{l}</span>
                <input className={`${inp} font-mono ${bad ? "!border-danger" : ""}`} value={v} placeholder={ph} inputMode="numeric"
                  onChange={(e) => setC({ [k]: e.target.value.replace("：", ":") || undefined })}
                  onBlur={(e) => { const m = /^(\d{1,2})[:：]?(\d{2})$/.exec(e.target.value.trim()); if (m) setC({ [k]: `${m[1].padStart(2, "0")}:${m[2]}` }); }} />
                <FieldErr>{bad ? "须形如 08:00" : ""}</FieldErr>
                {k === "dayEnd" && !bad && <Help>可写 24:00 以后表示次日凌晨，如 26:00 = 凌晨 2 点</Help>}
              </label>
            );
          })}
        </div>
        <Help>日期 / 时刻留空 = 沿用引擎或依赖模组默认值。</Help>
        <ModTravelEditor part="pace" value={c.travel} rooms={roomIds.map((id) => ({ id, name: rooms[id].name ?? id }))} onChange={(travel) => setC({ travel })} />
        <div className="space-y-2 rounded-xl border border-line bg-paper-2 p-2.5">
          <label className="flex cursor-pointer items-start gap-2 text-[12.5px] text-ink">
            <input type="checkbox" className="mt-0.5 accent-jade" checked={!!c.play?.ageAuto} onChange={(e) => setPlay({ ageAuto: e.target.checked })} />
            <span>主角年龄随日历增长<span className="block text-[11px] text-ink-soft">每到建角时填的生日 +1 岁（没填生日则在元旦 +1），旁白会播报；NPC 本来就会过生日长岁。</span></span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-[12.5px] text-ink">
            <input type="checkbox" className="mt-0.5 accent-jade" checked={!!c.play?.pickStartDate} onChange={(e) => setPlay({ pickStartDate: e.target.checked })} />
            <span>建角时让玩家自选开局日期<span className="block text-[11px] text-ink-soft">默认用上方「开局日期」；周结算、节日、固定事件与年龄都会按玩家选的那天对齐。</span></span>
          </label>
          {c.play?.pickStartDate && (
            <div className="grid grid-cols-2 gap-2 pl-6">
              {([["startDateMin", "最早可选"], ["startDateMax", "最晚可选"]] as const).map(([k, l]) => {
                const v = c.play?.[k] ?? "";
                return (
                  <label key={k}><span className={lbl}>{l}</span>
                    <input className={`${inp} font-mono ${v && !DATE_RE.test(v) ? "!border-danger" : ""}`} value={v} placeholder="不限" onChange={(e) => setPlay({ [k]: e.target.value || undefined })} />
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <Help>想要「每隔几天 / 每周 / 每月 / 每年某天」重复上演的剧情，在「④ 剧情 → 固定事件」的触发时间里选「周期触发」。</Help>
      </Section>

      {/* 功能注释：作者开局封面（画布布局 / 装扮）唯一编辑入口在①基础；游戏封面页不再放入口，⑤剧情只编开场白 */}
      <Section
        g="base"
        title="开局封面"
        on={has(c.cover)}
        hint="画布布局 · 背景 / 标题 / 按钮 · AI 搭配 · 自定义 HTML（唯一编辑入口）"
        count={Object.keys(c.cover ?? {}).length || undefined}
      >
        <ModCoverEditor value={c.cover} modId={m.id} onChange={(cover) => setC({ ...c, cover })} />
        <Help>玩家侧若要叠自己的封面，在游戏「美化 → 封面」；预览时封面右上角不再出现「装扮封面」按钮。</Help>
      </Section>

      {/* 功能注释：原「④ 世界」仅地点，已并入①基础，紧跟开局封面 */}
      <Section g="base" title="地点" on={has(c.rooms) || has(c.startRoom)} hint="多级子地点 · 树状预览 · 准入 · 出口 · 开局地点" count={roomIds.length}>
        <Help>起始地点请在地点树里点选「设为开局地点」。出行方式请到「⑤ 玩法 Mod」添加「出行与交通」后配置。</Help>
        <ModRoomTreeEditor rooms={rooms} startRoom={c.startRoom} tracks={[...(c.bgm ?? []).map((t) => ({ id: t.id, name: t.name })), ...(c.audio ?? []).filter((x) => x.kind === "bgm").map((x) => ({ id: x.id, name: x.name })), ...(c.audioRefs ?? []).map((id) => ({ id, name: `${audioLabel(id)}（引用）` }))]}
          emptyHint={m.kind === "world" ? "世界观至少需要一个地点才能行走。" : "叠加包可不定义地点（沿用世界观地图）。"}
          onChange={(next, startRoom) => setC({ rooms: next, startRoom })} onDelete={delRoom} onRename={renameRoom} />
      </Section>

      <Section g="base" title="功能开关" on={has(c.features)} hint="关闭后界面自动隐藏对应玩法">
        {FEATURES.map(({ k, label }) => {
          // 怀孕为「显式开启」项（未写 = 关闭，也可叠加「孕育包」）；其余项未写 = 开启
          const optIn = k === "pregnancy";
          const on = optIn ? c.features?.[k] === true : c.features?.[k] !== false;
          return (
            <button key={k} onClick={() => { const f = { ...c.features }; if (optIn) { if (on) delete f[k]; else f[k] = true; } else if (on) f[k] = false; else delete f[k]; setC({ features: f }); }}
              className="flex w-full items-center justify-between gap-2 text-left text-[12.5px]">
              <span>{label}</span>
              <span className={`relative h-4 w-8 shrink-0 rounded-full transition ${on ? "bg-jade" : "bg-line"}`}>
                <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
              </span>
            </button>
          );
        })}
        <Help>除「怀孕」外默认开启，只有关闭的项会写入模组；「怀孕」默认关闭，需在这里打开或叠加「孕育包」。</Help>
      </Section>

      <Section
        g="base"
        title="底栏页签"
        on={has(c.navTabs) || has(c.navSize) || NAV_TAB_TERMS.some(({ k }) => !!c.terms?.[k])}
        hint="底部导航显示名 · 顺序 · 显隐 · 实时预览（与玩家底栏一致）"
        count={c.navTabs?.filter((t) => t.on !== false).length || NAV_TAB_TERMS.filter(({ k }) => !!String(c.terms?.[k] ?? "").trim()).length || undefined}
      >
        <NavTabsModEditor
          terms={c.terms}
          features={c.features}
          navTabs={c.navTabs}
          navSize={c.navSize}
          onChange={(p) => setC(p)}
        />
      </Section>

      <Section
        g="base"
        title="手机应用配置"
        on={has(c.phoneAppsCfg) || showPlay("phoneApp")}
        hint="名称 · 图标 · 顺序 · 开局预装；应用本体请在「⑤ 玩法 Mod」添加"
        count={c.phoneAppsCfg?.length || undefined}
      >
        <Help>论坛 / 直播 / 商城等请到「玩法 Mod」添加；此处只调显示名与小手机试玩。</Help>
        <PhoneAppsEditor value={c.phoneAppsCfg} onChange={(phoneAppsCfg) => setC({ phoneAppsCfg })} />
      </Section>

      <Section g="base" title="主题外观" on={has(c.theme)} hint="皮肤 · 主题色 · 字体 · 深浅色（界面系统，非开场剧情）" count={Object.keys(c.theme ?? {}).length || undefined}>
        <ModThemeEditor value={c.theme} onChange={(theme) => setC({ theme })} />
      </Section>

      <Section g="base" title="内置音乐" on={has(c.bgm)} hint="上传 · 链接 · 开局自动播放" count={(c.bgm ?? []).length}>
        <ModBgmEditor list={c.bgm ?? []} onChange={(bgm) => setC({ bgm: bgm.length ? bgm : undefined })} />
      </Section>
      <Section g="base" title="引用音频库" on={has(c.audioRefs)} hint="方式 B · 只引用作品音频库里已有的 id，不打包文件" count={c.audioRefs?.length}>
        <p className="text-[11px] leading-relaxed text-ink-soft">方式 A 是上方「内置音乐」（音频随 MOD 打包）。方式 B 只记下音频 id：体积小，但目标作品须有同 id 音频。</p>
        <AudioPicker value="" empty="＋ 选择要引用的音频…" onChange={(id) => { if (id && !(c.audioRefs ?? []).includes(id)) setC({ audioRefs: [...(c.audioRefs ?? []), id] }); }} />
        <ul className="mt-1.5 space-y-1">
          {(c.audioRefs ?? []).map((id) => (
            <li key={id} className="flex items-center gap-2 rounded-lg border border-line px-2 py-1 text-[12px]">
              <span className="min-w-0 flex-1 truncate">{audioLabel(id)} <span className="font-mono text-[10.5px] text-ink-soft">{id}</span></span>
              <button className="text-[11px] text-ink-soft hover:text-danger" onClick={() => { const r = (c.audioRefs ?? []).filter((x) => x !== id); setC({ audioRefs: r.length ? r : undefined }); }}>移除</button>
            </li>
          ))}
        </ul>
      </Section>

      {/* 功能注释：头像库配置 + 匹配优先级绑定本剧，入口在①基础；随模组保存/导入导出，不写平台全局 */}
      <Section
        g="base"
        title="头像库与匹配优先级"
        on={has(c.avatars)}
        hint="我的头像池 · 平台公共分类 · 私人/公共库优先 · 通用兜底（随本剧保存）"
        count={(Object.keys(c.avatars?.pools ?? {}).length + (c.avatars?.publicRandom?.length ?? 0) + (c.avatars?.match ? 1 : 0)) || undefined}
        defaultOpen
      >
        <ModAvatarPoolsEditor value={c.avatars} onChange={(avatars) => setC({ avatars })} confirm={confirm} />
      </Section>

      <Section g="role" title="角色属性" on={has(c.customAttrs) || has(c.stats)} hint="八维叫法 / 停用 / 上下限 · 自定义属性 · 分档显示" count={c.customAttrs?.length || undefined}>
        <ModAttrsEditor attrs={c.customAttrs} onAttrs={(customAttrs) => setC({ customAttrs })} stats={c.stats} onStats={(stats) => setC({ stats })} />
      </Section>

      <Section g="role" title="人物线路" on={has(c.creation?.paths)} hint="建角第一步 · 路径卡片 · 开局加成 · 支持 AI 生成" count={c.creation?.paths?.length || undefined}>
        <ModPathsEditor creation={c.creation} identities={c.identities} world={`${m.name}${m.description ? `：${m.description}` : ""}`}
          worldName={m.name} city={c.terms?.city} startDate={c.startDate} school={c.school}
          npcs={(npcs.length ? npcs : LIVE_PEOPLE).map((p) => ({ id: p.id, name: p.name }))}
          rooms={Object.entries(c.rooms ?? {}).map(([id, r]) => ({ id, name: r.name || id }))}
          events={(c.fixedEvents ?? []).map((e) => ({ id: e.id, name: e.name }))}
          statsValue={c.stats} attrsValue={c.customAttrs}
          onChange={({ creation, identities }) => setC({ creation, identities })} />
      </Section>

      <Section g="role" title="建角字段" on={has(c.creation?.fields) || has(c.creation?.builtin)} hint="字段改名 · 锁定 · 选项联动 · 自定义字段" count={(c.creation?.fields?.length ?? 0) + Object.keys(c.creation?.builtin ?? {}).length || undefined}>
        <ModCreationFieldsEditor creation={c.creation} parentJobs={c.parentJobs} backgrounds={c.backgrounds}
          attrs={c.customAttrs} statLabels={c.stats?.labels} npcs={(npcs.length ? npcs : LIVE_PEOPLE).map((p) => ({ id: p.id, name: p.name }))}
          onChange={({ creation, parentJobs }) => setC({ creation, parentJobs })} />
      </Section>

      <Section g="role" title="建角选项池" on={[c.styles, c.identities, c.backgrounds, c.directions, c.school, c.parentJobs].some(has)} hint="外形 · 身份 · 家世 · 方向 · 星座 · 母校 · 父母职业（文字设定，开局加成自行配置）" count={(c.styles?.length ?? 0) + (c.identities?.length ?? 0) + (c.backgrounds?.length ?? 0) + (c.directions?.length ?? 0) || undefined}>
        <ModPoolsEditor stats={c.stats} attrs={c.customAttrs} npcs={(npcs.length ? npcs : LIVE_PEOPLE).map((p) => ({ id: p.id, name: p.name }))} value={{ styles: c.styles, identities: c.identities, backgrounds: c.backgrounds, directions: c.directions, school: c.school, parentJobs: c.parentJobs, zodiacs: c.zodiacs }} onChange={(p) => setC(p)} />
      </Section>


      <Section g="role" title="人物" on={has(c.npcs)} hint="名字 · 身份 · 所在地点 · 头像池 · 作品栏 · 时间线 · 音色" count={npcs.length}>
        <datalist id="mod-avatar-variants">{variantNames(c.avatars ?? null).map((x) => <option key={x} value={x} />)}</datalist>
        {npcs.length > 5 && <SearchBox value={npcQ} onChange={setNpcQ} placeholder="搜索人物" />}
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-paper-2 px-2.5 py-2 text-[12px] text-ink">
          <input type="checkbox" className="accent-jade" checked={c.familyWx !== false} onChange={(e) => setC({ familyWx: e.target.checked ? undefined : false })} />
          父母开局就在微信里<span className="text-ink-soft">（主角的父亲、母亲）</span>
        </label>
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-paper-2 p-2">
          <VoiceField label="父亲音色" value={c.familyVoices?.father} gender="男" sample="在外面照顾好自己，钱不够跟家里说。" onChange={(v) => setC({ familyVoices: { ...c.familyVoices, father: v || undefined } })} />
          <VoiceField label="母亲音色" value={c.familyVoices?.mother} gender="女" sample="吃饭了没有？别光顾着练，身体要紧。" onChange={(v) => setC({ familyVoices: { ...c.familyVoices, mother: v || undefined } })} />
        </div>
        {npcs.length === 0 && <EmptyState>还没有人物。</EmptyState>}
        {npcs.map((n, i) => !matches(npcQ, n.name, n.role, n.id) ? null : (
          <div key={i} className="min-w-0 space-y-1.5 overflow-x-hidden rounded-xl border border-line bg-paper px-2.5 py-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <input className={`${inp} !w-auto min-w-0 flex-1 font-medium ${String(n.name ?? "").trim() ? "" : "!border-danger"}`} value={String(n.name ?? "")} placeholder="名字 *" onChange={(e) => setNpc(i, { name: e.target.value })} />
              <input className={`${inp} !w-auto min-w-0 flex-1`} value={n.role} placeholder="身份，如：掌门" onChange={(e) => setNpc(i, { role: e.target.value })} />
              <button className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[15px] leading-none text-ink-soft hover:bg-coral/10 hover:text-coral" onClick={async () => { if (await confirm(`删除人物「${n.name || n.id}」？`)) setC({ npcs: npcs.filter((_, j) => j !== i) }); }} aria-label="删除人物">×</button>
            </div>
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
            <input className={inp} value={(n.tags ?? []).join("、")} placeholder="人物标签，用顿号或逗号分隔，如：毒舌、护短、工作狂" aria-label="人物标签"
              onChange={(e) => { const t = e.target.value.split(/[、,，]/).map((x) => x.trim()); setNpc(i, { tags: t.some(Boolean) ? t : undefined }); }}
              onBlur={() => n.tags && setNpc(i, { tags: n.tags.filter(Boolean).length ? n.tags.filter(Boolean) : undefined })} />
            <div className="flex min-w-0 items-center gap-1.5">
              <select className={`${inp} !w-auto min-w-0 flex-1`} value={n.home} aria-label="所在地点" onChange={(e) => setNpc(i, { home: e.target.value })}>
                {!roomIds.includes(n.home) && <option value={n.home}>{n.home ? `${n.home}（依赖模组的地点）` : "（未选择）"}</option>}
                {roomIds.map((x) => <option key={x} value={x}>{rooms[x].name || x}</option>)}
              </select>
              <button
                type="button"
                aria-pressed={n.kind !== "staff"}
                className={`shrink-0 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${n.kind === "staff" ? "border-line text-ink-soft" : "border-jade/50 bg-jade/15 text-jade"}`}
                onClick={() => setNpc(i, { kind: n.kind === "staff" ? "roam" : "staff" })}
              >
                {n.kind === "staff" ? "驻守" : "会走动"}
              </button>
            </div>
            <textarea className={`${inp} max-w-full resize-y`} rows={2} value={n.bio} placeholder="人物小传（供 AI 演绎）" onChange={(e) => setNpc(i, { bio: e.target.value })} />
            {/* 作品栏：标题、条目、是否加书名号全部由模组配置，不写死在代码里 */}
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
            <details className="rounded-lg border border-line bg-paper-2 p-2">
              <summary className="cursor-pointer text-[12px] font-bold text-ink">时间线 <span className="font-normal text-ink-soft">· {n.timeline?.length ? `${n.timeline.length} 条` : "过去经历与未来安排，随游戏日期推进"}</span></summary>
              <div className="mt-1.5"><TimelineEditor compact value={n.timeline} onChange={(timeline) => setNpc(i, { timeline })} /></div>
            </details>
            {(() => {
              const av = n.avatarVariant ?? "";
              const bad = !!av && !variantNames(c.avatars ?? null).includes(av);
              return (
                <label className="block">
                  <span className={lbl}>头像池（avatarVariant）· 开局从同名池抽一张做头像，留空则用首字头像</span>
                  <input className={`${inp} ${bad ? "!border-danger" : ""}`} list="mod-avatar-variants" value={av} placeholder="如：青年男性"
                    onChange={(e) => setNpc(i, { avatarVariant: e.target.value || undefined })} />
                  {bad && <span className="mt-0.5 block text-[10.5px] text-danger">找不到本剧已开放的同名头像池（须完全一致；我的头像池需在上方「头像池」里勾「玩家可选」或「随机池」）</span>}
                </label>
              );
            })()}
            {(c.contacts?.groups?.length || c.contacts?.orgs?.length) ? (
              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-line bg-paper-2 p-2 text-[11.5px]">
                <span className="text-ink-soft">人脉分组：</span>
                {(c.contacts?.groups ?? []).map((g) => {
                  const on = !!n.groups?.includes(g.id);
                  return <button key={g.id} onClick={() => { const next = on ? n.groups!.filter((x) => x !== g.id) : [...(n.groups ?? []), g.id]; setNpc(i, { groups: next.length ? next : undefined }); }}
                    className={`rounded-full border px-2 py-0.5 ${on ? "border-jade bg-jade/10 text-jade" : "border-line text-ink-soft"}`}>{g.label || "未命名"}</button>;
                })}
                {!n.groups?.length && <span className="text-ink-soft/70">（未勾选 = 按分组规则自动归类）</span>}
                {!!c.contacts?.orgs?.length && (
                  <select className={`${inp} ml-auto w-36`} value={n.org ?? ""} onChange={(e) => setNpc(i, { org: e.target.value || undefined })}>
                    <option value="">所属组织（无）</option>
                    {c.contacts.orgs.map((o) => <option key={o.id} value={o.id}>{o.label || o.id}</option>)}
                  </select>
                )}
              </div>
            ) : null}
            <VoiceField label="专属音色" value={n.ttsVoice} gender={n.gender} sample={`我是${n.name || "这个人"}，有事找我？`} onChange={(v) => setNpc(i, { ttsVoice: v || undefined })} />
            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink">
              <input type="checkbox" className="accent-jade" checked={!!n.wxStart} onChange={(e) => setNpc(i, { wxStart: e.target.checked || undefined })} />
              开局就在微信里<span className="text-ink-soft">（无需加好友，可直接发消息；同时视为已结识）</span>
            </label>
            <FieldErr>{dupNpc.has(n.id) ? `id「${n.id}」重复` : ""}</FieldErr>
          </div>
        ))}
        <button className={btn} onClick={addNpc}>＋ 添加人物</button>
      </Section>

      <Section g="grow" title="开局资源" on={has(c.startMoney)} hint="开局资金 · 初始资源（唯一编辑入口）" count={c.startMoney !== undefined ? 1 : undefined}>
        <label><span className={lbl}>开局资金</span>
          <input type="number" min={0} className={inp} value={c.startMoney ?? ""} placeholder="沿用默认"
            onChange={(e) => { const v = e.target.value; setC({ startMoney: v === "" ? undefined : Math.max(0, Number(v) || 0) }); }} />
        </label>
        <Help>留空 = 沿用引擎 / 依赖模组默认值。账单与周期收支在下方「养成规则 / 周期收入」配置；数值体检只引用此处结果，不另存一份。</Help>
      </Section>

      <Section g="grow" title="培训课程" on={has(c.trainings)} hint="学费 · 体力 · 属性收益 · 自定义等级与解锁条件" count={c.trainings?.length || undefined}>
        <ModTrainingsEditor value={c.trainings} stats={c.stats} attrs={c.customAttrs} onChange={(trainings) => setC({ trainings })} />
      </Section>

      <Section g="grow" title="打工 · 周末活动" on={has(c.sideJobs) || has(c.weekendActs)} hint="收入 · 压力 · 属性收益 · 解锁条件" count={(c.sideJobs?.length ?? 0) + (c.weekendActs?.length ?? 0) || undefined}>
        <ModActsEditor jobs={c.sideJobs} acts={c.weekendActs} stats={c.stats} attrs={c.customAttrs} onChange={(p) => setC(p)} />
      </Section>

      <Section g="grow" title="养成规则" on={has(c.fameTiers) || has(c.titles) || has(c.bills)} hint="名气分档 · 头衔 · 固定账单" count={(c.fameTiers?.length ?? 0) + (c.titles?.length ?? 0) || undefined}>
        <ModRulesEditor stats={c.stats} attrs={c.customAttrs} value={{ fameTiers: c.fameTiers, titles: c.titles, bills: c.bills }} onChange={(p) => setC(p)} />
      </Section>

      <Section g="grow" title="周期收入" on={has(c.income)} hint="每周结算按条件发放 / 扣除" count={c.income?.length}>
        <ModIncomeEditor value={c.income} onChange={(income) => setC({ income })} />
      </Section>

      <Section g="grow" title="玩法规则" on={has(c.gameRules)} hint="如果 · 否则如果 · 否则 · 每天 / 每周判定 · 规则变量" count={c.gameRules?.length}>
        <GameRulesEditor value={c.gameRules} events={c.fixedEvents} onChange={(gameRules) => setC({ gameRules })} />
      </Section>

      <Section g="grow" title="数值体检" hint="和娱乐圈原版比 · 偏离太多就提醒 · 叠加后会改动哪些数值" count={healthWarn || undefined}>
        <ModHealthPanel mod={m} />
      </Section>

      <Section g="grow" title="数值平衡" hint="扣费依据 · 现金流估算 · 透支 / 破产 / 新手缓冲" count={Object.keys(c.tuning?.economy ?? {}).length || undefined}>
        <ModBalancePanel c={c} kind={m.kind} onChange={setC} />
      </Section>

      <Section g="grow" title="引擎规则" on={has(c.tuning)} hint="表现评级概率 / 倍率 · 休息减压 · 课程与打工倍率 · 通用课程等级" count={Object.keys(c.tuning ?? {}).length || undefined}>
        <ModTuningEditor value={c.tuning} stats={c.stats} attrs={c.customAttrs} npcs={(npcs.length ? npcs : LIVE_PEOPLE).map((p) => ({ id: p.id, name: p.name }))} onChange={(tuning) => setC({ tuning })} />
      </Section>

      <Section g="story" title="世界观提示词" on={has(c.prompt)} hint="即系统提示词 · 可视化编辑 · 支持预览" count={PROMPTS.filter(({ k }) => !!String(c.prompt?.[k] ?? "").trim()).length}>
        <ModPromptEditor value={c.prompt} onChange={(prompt) => setC({ prompt })} />
      </Section>

      <Section g="story" title="详细设定" on={has(c.lore)} hint="地区 · 势力 · 角色 · 只发主角所在地区的完整设定，节省 token" count={c.lore?.length}>
        <ModLoreEditor value={c.lore} onChange={(lore) => setC({ lore })}
          rooms={roomIds.length ? roomIds.map((id) => ({ id, name: rooms[id].name || id })) : LIVE_LOCATIONS.map((l) => ({ id: l.id, name: l.name }))}
          npcs={(npcs.length ? npcs : LIVE_PEOPLE).map((p) => ({ id: p.id, name: p.name }))} />
      </Section>

      <Section g="story" title="世界书" on={has(c.worldBook)} hint="常驻 / 关键词触发 · 支持 JSON 导入" count={c.worldBook?.length}>
        <ModWorldBookEditor value={c.worldBook} onChange={(worldBook) => setC({ worldBook })} npcs={npcs.map((n) => ({ id: n.id, name: n.name || n.id }))} rooms={roomIds.map((id) => ({ id, name: rooms[id].name || id }))} />
      </Section>

      <Section g="story" title="节日" on={has(c.festivals)} hint="平时只发名称 · 临近或提到时发完整设定" count={c.festivals?.length}>
        <ModFestivalEditor value={c.festivals} onChange={(festivals) => setC({ festivals })} />
      </Section>

      <Section g="story" title="开场剧情" on={has(c.opening)} hint="开场页外观 · 开场白 · 头图 / 视频（封面画布在①基础）" count={Object.keys(c.opening ?? {}).length || undefined}>
        <Help>开局封面（画布布局 / 装扮）请到「① 基础 → 开局封面」编辑，此处不重复保存 cover。</Help>
        <p className="ui-label">开场页外观</p>
        <OpeningStyleStudio value={c.opening} modId={m.id} modName={m.name}
          onPage={(page) => { const o = { ...c.opening, page }; if (!page) delete o.page; setC({ ...c, opening: Object.keys(o).length ? o : undefined }); }} />
        <p className="ui-label border-t border-line/60 pt-3">开场白</p>
        <ModOpeningEditor value={c.opening} onChange={(opening) => setC({ ...c, opening })} />
        <Help>首次 / 开局可触发事件在下方「固定事件」。</Help>
      </Section>

      <Section g="story" title="固定事件" on={has(c.fixedEvents) || has(c.events)} hint="首次事件 · 预设剧本 · 时间 / 条件触发 · 事件链 · 可 AI 帮写 · 开新局写入" count={c.fixedEvents?.length}>
        <Help>「开局即可触发」且无前置锁定的条目即首次事件；勿在其它分组再存一份相同事件表。</Help>
        <FixedEventsPanel value={c.fixedEvents} onChange={(v) => setC({ fixedEvents: v.length ? v : undefined })} />
      </Section>

      <Section g="role" title="关系玩法" on={has(c.relations)} hint="表白门槛 · 婚礼费用与好感 · NPC 牵线 · 伴侣加成">
        <ModRelationsEditor value={c.relations} npcs={npcs.map((n) => ({ id: n.id, name: n.name || n.id }))}
          keyOptions={perkKeyOptions({
            statLabels: { ...RAW_STAT_LABELS, ...(c.stats?.labels ?? {}) },
            statOrder: (c.stats?.order?.length ? c.stats.order : ALL_STAT_KEYS).filter((k) => !(c.stats?.hidden ?? []).includes(k)),
            attrs: c.customAttrs,
            metaLabels: c.stats?.metaLabels,
            term: (k, fb) => c.terms?.[k] ?? fb,
          })} onChange={(relations) => setC({ relations: relations as Mod["content"]["relations"] })} />
      </Section>

      <Section g="role" title="人脉页面配置" on={has(c.contacts)} hint="标签名 · 分组与排序 · 卡片双数值与图标 · 关系阶段词 · 所属组织" count={c.contacts?.groups?.length || undefined}>
        <ContactsPanel value={c.contacts} onChange={(contacts) => setC({ contacts })} statsValue={c.stats} attrsValue={c.customAttrs} pathsValue={c.creation?.paths} />
      </Section>

      <Section g="story" title="主线与目标" on={has(c.storylines)} hint="有序节点 · 完成 / 失败条件 · 奖励 · 失败分支 · 可选目标" count={c.storylines?.length}>
        <StorylinesEditor value={c.storylines} events={c.fixedEvents} onChange={(storylines) => setC({ storylines })} />
      </Section>

      <Section g="story" title="结局与时限" on={has(c.endings) || has(c.timeLimit) || has(c.gradeDims)} hint="主线时限（如 3 年结束）· 自定义固定结局 · 结局插图与评级 · 评定维度" count={(c.endings?.length ?? 0) + (c.timeLimit ? 1 : 0) || undefined}>
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
          peopleValue={(npcs.length ? npcs : LIVE_PEOPLE).map((p) => ({ id: p.id, name: p.name }))}
          storylinesValue={c.storylines}
        />
      </Section>

      <Section g="story" title="剧情美化" on={has(c.lookRules)} hint="条件满足时自动切换外观 · 玩家可在美化里关闭" count={c.lookRules?.length}>
        <p className="text-[11px] leading-relaxed text-ink-soft">给这个世界设计「会随剧情变化的外观」：深夜转暗、压力爆表变灰、成名后换上流金……条件与固定事件同一套，也能读取玩法规则里的规则变量。玩家自己的剧情美化优先于此处。</p>
        <LookRulesEditor value={c.lookRules} events={c.fixedEvents} onChange={(lookRules) => setC({ lookRules })} />
      </Section>

      <Section g="play" title="已添加的玩法" on={has(c.playModInstalls) || m.kind === "world" || playModRecs.length > 0} hint="卡片添加 · 开关启用 · 表单配置；未添加不显示空面板" count={c.playModInstalls?.length || undefined} defaultOpen>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="rounded-full bg-jade px-3 py-1.5 text-[12px] font-semibold text-paper" onClick={() => setAddPlayOpen(true)}>添加玩法</button>
          <Help>基础世界不含扩展玩法。点添加后才会出现对应配置；关掉「启用」不会删除已填内容。</Help>
        </div>
        {/* 功能注释：玩法组件依赖（playModInstalls.dependsOn）≠ 模组底座 dependencies；统一在玩法页展示摘要 */}
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
        {authorSimplify && (
          <div className="rounded-xl border border-line/70 bg-paper px-3 py-2">
            <button type="button" className="text-[12px] font-bold text-jade hover:underline" onClick={() => setShowModDepsAdvanced((v) => !v)}>
              {showModDepsAdvanced ? "收起 · 高级：模组底座依赖" : "高级设置 · 模组底座依赖"}
            </button>
            {showModDepsAdvanced && (
              <div className="mt-2 space-y-1.5">
                <Help>这是世界观 / 叠加包之间的底座依赖（Mod.dependencies），与上方「玩法组件依赖」不是同一份数据。普通作品一般无需改动。</Help>
                {otherMods.length === 0 ? <p className="text-[11.5px] text-ink-soft">没有其他模组可依赖。</p> : (
                  <div className="flex flex-wrap gap-1.5">
                    {otherMods.map((x) => {
                      const on = deps.includes(x.id);
                      return (
                        <button key={x.id} type="button" onClick={() => setM({ ...m, dependencies: on ? deps.filter((d) => d !== x.id) : [...deps, x.id] })}
                          className={`rounded-full border px-2.5 py-0.5 text-[11.5px] ${on ? "border-jade bg-jade/15 text-jade-deep" : "border-line text-ink-soft"}`}>
                          {on ? <IconCheck size={12} className="mr-0.5 inline" /> : null}{x.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                {!!deps.length && (
                  <p className="text-[11px] text-ink-soft">当前底座依赖：{deps.join("、")}</p>
                )}
              </div>
            )}
          </div>
        )}
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
            本剧已保存出行配置（数据仍保留）。请添加并启用「出行与交通」后，才能继续用表单调整出行方式等。
          </p>
        )}
        {(c.playModInstalls ?? []).length === 0 && m.kind !== "addon" && (
          <EmptyState>还没有玩法。可先根据上方推荐添加，或点「添加玩法」浏览；未添加时不会显示通告 / 孕育 / 出行等配置。</EmptyState>
        )}
        <ul className="space-y-2">
          {(c.playModInstalls ?? []).map((inst, i) => {
            const cat = catalogBySlug(inst.slug);
            const enabled = inst.enabled !== false;
            return (
              <li key={inst.modId} className={`space-y-2 rounded-2xl border p-3 ${enabled ? "border-jade/40 bg-paper" : "border-line bg-paper-2 opacity-80"}`}>
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
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <button
                      type="button"
                      aria-pressed={enabled}
                      onClick={() => {
                        const list = [...(c.playModInstalls ?? [])];
                        list[i] = { ...inst, ...pickPlayModOpenConfig({ enabled: !enabled }) };
                        setC({ playModInstalls: list });
                      }}
                      className={`relative h-6 w-11 rounded-full transition ${enabled ? "bg-jade" : "bg-line"}`}
                      title={enabled ? "点击关闭此玩法" : "点击启用此玩法"}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? "left-[22px]" : "left-0.5"}`} />
                    </button>
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-ink-soft hover:text-danger"
                      onClick={() => void removePlayInstall(inst.slug)}
                    >
                      移除
                    </button>
                  </div>
                </div>
                {enabled && (
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
                      <span>在游戏里显示入口<span className="ml-1 text-[11px] text-ink-soft">关闭后玩法数据仍保留，只是先不露出入口</span></span>
                      <input type="checkbox" className="h-4 w-4 accent-jade" checked={inst.visible !== false}
                        onChange={(e) => {
                          const list = [...(c.playModInstalls ?? [])];
                          list[i] = { ...inst, ...pickPlayModOpenConfig({ visible: e.target.checked }) };
                          setC({ playModInstalls: list });
                        }} />
                    </label>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      {/* 功能注释：出行与交通改为玩法 Mod；未安装不展示详细配置，content.travel / features.transport 原样保留 */}
      {showPlay("travel") && (
        <Section
          g="play"
          title="出行与交通"
          on={has(c.travel) || c.features?.transport === false}
          hint={c.features?.transport === false ? "已安装 · 未启用内置交通（点哪去哪）" : "已安装 · 可自定义出行方式与花费"}
          count={c.travel?.modes?.length}
          defaultOpen
        >
          <label className="flex items-center justify-between gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-[12.5px] text-ink">
            <span>启用内置交通<span className="ml-1 text-[11px] text-ink-soft">开启后玩家出行需选择「怎么去」并按配置扣费；关闭则点哪去哪、免费。已填字段不会因关闭而删除。</span></span>
            <input
              type="checkbox"
              checked={c.features?.transport !== false}
              onChange={(e) => setC({ features: { ...c.features, transport: e.target.checked ? undefined : false } })}
              className="h-4 w-4 accent-[var(--jade)]"
            />
          </label>
          {c.features?.transport !== false && (
            <ModTravelEditor
              part="transport"
              value={c.travel}
              rooms={roomIds.map((id) => ({ id, name: rooms[id].name ?? id }))}
              onChange={(travel) => setC({ travel })}
            />
          )}
        </Section>
      )}

      {showPlay("cars") && (
        <Section g="play" title="座驾" on={has(c.cars)} hint="购车与切换座驾（建议同时启用出行与交通）" count={c.cars?.length} defaultOpen>
          <label className="flex items-center justify-between gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-[12.5px] text-ink">
            <span>车产系统<span className="ml-1 text-[11px] text-ink-soft">来自已安装「座驾包」；此处只调开放配置</span></span>
            <input
              type="checkbox"
              checked={c.features?.cars !== false && !!c.cars?.length}
              onChange={(e) => setC(e.target.checked
                ? { features: { ...c.features, cars: undefined }, cars: c.cars?.length ? c.cars : [{ id: "car1", name: "", price: 10000, resale: 0.5, comfort: 0, tag: "", desc: "" }] }
                : { features: { ...c.features, cars: false } })}
              className="h-4 w-4 accent-[var(--jade)]"
            />
          </label>
          {c.features?.cars !== false && !!c.cars?.length && (
            <ModCarsEditor
              cars={c.cars}
              travel={c.travel}
              world={`${m.name}${m.description ? `：${m.description}` : ""}`}
              statLabels={{ ...(STAT_LABELS as Record<string, string>) }}
              rooms={roomIds.map((id) => ({ id, name: rooms[id].name ?? id }))}
              onChange={(p) => setC(p)}
            />
          )}
        </Section>
      )}

      {showPlay("gigs") && <Section g="play" title="通告库" hint="通告门槛 · 酬劳 · 名气 · 成长 · 星级价目表" count={c.gigs?.length || undefined} on={has(c.gigs) || has(c.gigPrices)}>
        <Help>由已安装「演艺事业包」提供。叠加包通告按 id 追加 / 覆盖。</Help>
        <ModGigsEditor value={c.gigs} prices={c.gigPrices} defaults={() => GIG_POOL} onChange={(gigs) => setC({ gigs })} onPrices={(gigPrices) => setC({ gigPrices })} />
      </Section>}

      {showPlay("contracts") && <Section g="play" title="经纪合约" hint="开局候选合约 · 通告性质 · 议价规则" count={c.contracts?.signing?.length || undefined} on={has(c.contracts)}>
        <SlotDataEditor value={c.contracts} defaults={() => RAW_CONTRACTS} onChange={(contracts) => setC({ contracts })}
          emptyText="本模组没有写经纪合约（沿用世界观设置）。" note="「开局候选合约」在建角最后一步让玩家签；「通告档位参数」和「议价规则」决定接通告时怎么谈价、会不会被抢。" />
      </Section>}

      {showPlay("projects") && <Section g="play" title="影视项目" hint="项目模板 · 试镜 · 片场事件 · 质量与上映 · 制片人" count={c.projects?.projects?.length || undefined} on={has(c.projects)}>
        <SlotDataEditor value={c.projects} defaults={() => RAW_PROJECTS} onChange={(projects) => setC({ projects })}
          emptyText="本模组没有写影视项目（沿用世界观设置）。" note="「项目模板」是玩家能接的剧 / 电影 / 综艺；其余是试镜、拍摄、上映的结算参数，不确定就别动。" />
      </Section>}

      {showPlay("industry") && <Section g="play" title="行业生态" hint="经纪公司 · 片名库 · 代言品牌 · 奖项 · 圈内动态" count={c.industry?.companies?.length || undefined} on={has(c.industry)}>
        <SlotDataEditor value={c.industry} defaults={() => RAW_INDUSTRY} onChange={(industry) => setC({ industry })}
          emptyText="本模组没有写行业生态（沿用世界观设置）。" note="人气榜、周报和圈内新闻从这里取公司、片名、品牌与奖项。" />
      </Section>}

      {showPlay("imageCrisis") && <Section g="play" title="舆情人设" hint="人设 · 公开行动 · 危机 · 公关应对 · 判定权重" count={c.imageCrisis?.crises?.length || undefined} on={has(c.imageCrisis)}>
        <SlotDataEditor value={c.imageCrisis} defaults={() => RAW_IMAGE_CRISIS} onChange={(imageCrisis) => setC({ imageCrisis })}
          emptyText="本模组没有写舆情人设（沿用世界观设置）。" note="需要已安装「舆情人设包」。" />
      </Section>}

      {showPlay("weeklyPaper") && <Section g="play" title="娱乐周报" hint="报头 · 副标题" on={has(c.weeklyPaper)}>
        <div className="grid grid-cols-2 gap-2">
          <label><span className={lbl}>报头</span><input className={inp} value={c.weeklyPaper?.masthead ?? ""} placeholder="週報" onChange={(e) => { const w = { ...c.weeklyPaper, masthead: e.target.value || undefined }; setC({ weeklyPaper: w.masthead || w.tagline ? w : undefined }); }} /></label>
          <label><span className={lbl}>副标题</span><input className={inp} value={c.weeklyPaper?.tagline ?? ""} placeholder="可留空" onChange={(e) => { const w = { ...c.weeklyPaper, tagline: e.target.value || undefined }; setC({ weeklyPaper: w.masthead || w.tagline ? w : undefined }); }} /></label>
        </div>
        <Help>由已安装「娱乐周报包」提供；内容取自行业生态与本周动向。</Help>
      </Section>}

      {showPlay("meals") && <Section g="play" title="每周吃什么" hint="伙食档位 · 每周花费 · 压力 / 能力 / 气色 · 解锁门槛" count={c.meals?.length || undefined} on={has(c.meals)}>
        <ModMealsEditor value={c.meals} onChange={(meals) => setC({ meals })} />
      </Section>}

      {showPlay("pregnancy") && <Section g="play" title="孕育" hint="开关 · 孕期 · 受孕率 · 察觉时间 · 孩子名字池" on={has(c.pregnancy) || c.features?.pregnancy === true}>
        <label className="flex items-center justify-between gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-[12.5px] text-ink">
          <span>开启孕育<span className="ml-1 text-[11px] text-ink-soft">亲密关系可能带来怀孕，征兆、孕期与分娩随日程推进</span></span>
          <input type="checkbox" checked={c.features?.pregnancy === true} onChange={(e) => { const f = { ...c.features }; if (e.target.checked) f.pregnancy = true; else delete f.pregnancy; setC({ features: f }); }} className="h-4 w-4 accent-[var(--jade)]" />
        </label>
        <ModPregnancyEditor value={c.pregnancy} onChange={(pregnancy) => setC({ pregnancy })} />
      </Section>}

      </div>
      </GroupCtx.Provider>
      {!String(q ?? "").trim() && (prevG || nextG) && (
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
      <p className="text-[11px] text-ink-soft">未在当前页展示的内容会原样保留；保存请用顶部「保存 / 保存并返回」（Ctrl/⌘+S）。</p>
    </div>
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
