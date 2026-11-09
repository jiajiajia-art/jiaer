import { wallet } from "../game/wallet";
import { lazyPanel } from "../lib/lazyPanel";
import DiaryCard from "./DiaryCard";
import DiyIcon from "./DiyIcon";
import WeekReportCard from "./WeekReportCard";
import { tierOf } from "../game/data";
import { withFontPreset } from "../lib/gameFonts";
import { FONTS } from "../lib/skins";
import BgmPanel, { hookWorldBgm } from "./BgmPanel";
import { enterScene, setWorkVolume, switchBgm } from "../game/audioEngine";
import { setAuthorAudio } from "../game/audioLib";
import { roomBgmOf } from "../game/mud";
const CustomCssPanel = lazyPanel(() => import("./CustomCssPanel"));
const ThemePackPanel = lazyPanel(() => import("./ThemePackPanel"));
const ScenePanel = lazyPanel(() => import("./ScenePanel"));
import { AssetLibrary, FreeColors, FreeFont, SlotImage, SubTitle } from "./FreeStylePanel";
import { loadAssets } from "../lib/freeStyle";
const NavStylePanel = lazyPanel(() => import("./NavStylePanel"));
const IconDiyPanel = lazyPanel(() => import("./IconDiyPanel"));
const CoverDiyPanel = lazyPanel(() => import("./CoverDiyPanel"));
import DialogDiyPanel, { DialogPreview } from "./DialogDiyPanel";
import { PlotLookPanel } from "./LookRulesEditor";
import { Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { romancePortalRoot } from "../lib/romancePortalRoot";
import { useGame } from "../store/gameCtx";
import { rulesOf } from "../game/engineRules";
import HomeTab from "./HomeTab";
import NpcTab from "./NpcTab";
import ActionsTab from "./ActionsTab";
import SimTab from "./SimTab";
import AttrValueEdit from "./AttrValueEdit";
const ImageTab = lazyPanel(() => import("./ImageTab"));
const Phone = lazyPanel(() => import("./Phone"));
const Finance = lazyPanel(() => import("./Finance"));
const Works = lazyPanel(() => import("./Works"));
import BreachDialog from "./BreachDialog";
const AIConfigPanel = lazyPanel(() => import("./AIConfigPanel"));
const WorldRulesPanel = lazyPanel(() => import("./WorldRulesPanel"));
const WorldBookPanel = lazyPanel(() => import("./WorldBookPanel"));
// 编辑器体积大、只有打开时才需要：按需加载，缩短首屏加载
const MapEditorPanel = lazy(() => import("./MapEditorPanel"));
const ModManagerPanel = lazy(() => import("./ModManagerPanel"));
const FixedEventsPanel = lazy(() => import("./FixedEventsPanel"));
const PanelLoading = () => <p className="py-10 text-center text-[12px] text-ink-soft">加载中…</p>;
const NpcKbPanel = lazyPanel(() => import("./NpcKbPanel"));
import EditorHub from "./EditorHub";
import PlayPrefsPicker from "./PlayPrefsPicker";
import { playPrefsOf } from "../lib/ai";
import { LIVE_LOCATIONS } from "../mods/registry";
import AllowanceWatcher from "./AllowanceWatcher";
import { feature, getWorldStorylines, useMods, worldGrowEnabled, worldHas } from "../mods/registry";
import { shouldShowPlayModMenuEntry } from "../mods/playModCatalog";
import { EDITOR_HUB_MENUS } from "../lib/editorHubMenus";
const EndingsPanel = lazyPanel(() => import("./EndingsPanel"));
const FactionsPanel = lazyPanel(() => import("./FactionsPanel"));
const EngineRulesPanel = lazyPanel(() => import("./EngineRulesPanel"));
const TimelinePanel = lazyPanel(() => import("./TimelinePanel"));
const FixedPersonPanel = lazyPanel(() => import("./FixedPersonPanel"));
import { PathUnlockPanel } from "./PathUnlockPanel";
import { creationCopy } from "../game/data";
const StoryQuestPanel = lazyPanel(() => import("./StoryQuestPanel"));
import MudChrome, { menuItems, NavTabsEditor, type MudTab } from "./MudChrome";
import ScheduleBoard from "./ScheduleBoard";
import { Chip, Modal, toneColor } from "./ui";
import { useConfirm } from "./EditorKit";
import { IconBook, IconCamera, IconClose, IconFlag, IconHeart, IconMenu, IconMoon, IconMusic, IconPin, IconPlay, IconSave, IconScroll, IconSettings, IconSpark, IconSparkle, IconStar, IconSun, IconUser, IconWallet, IconClock } from "../lib/icons";
import { Segments, CastRow } from "./StoryTab";
import NewcomerCards from "./NewcomerCards";
import BranchSheet from "./BranchSheet";
import TopbarView, { topbarDataOf } from "./TopbarView";
const TopbarDiyPanel = lazyPanel(() => import("./TopbarDiyPanel"));
import FrameEditor, { FrameOverlay } from "./FrameDiy";
import { topbarSummary } from "../lib/topbarDiy";
import { defaultWorldBook } from "../game/worldbook";
import { EntityProvider } from "./EntityText";
import { listManualSaves, saveToSlot, deleteSlot, renameSlot, getSlot, MAX_SLOTS, AUTO_SLOT_ID, type SaveSlot, defaultTheme } from "../lib/store";
import { isAuthorPreview } from "../lib/authorPreview";
import { homeMainQuest } from "../lib/homeMainQuest";
import { dayDateLabel } from "../game/logic";

import IndustryPageHeader from "./IndustryPageHeader";
const CgPanel = lazyPanel(() => import("./CgPanel"));
const AudioLibraryPanel = lazyPanel(() => import("./AudioLibraryPanel"));
import { CgGallery } from "./DiaryCg";
import { newlyUnlockedCgs } from "../lib/ai";
import CgUnlockReveal from "./CgUnlockReveal";
import { resolveCgImageFile } from "../game/cgImageStore";
import { applyCgUnlocks, cgRevealBatch, hasCgMenu, latestCgDialogue } from "../lib/cgGallery";
import { liveTerm as T } from "../mods/live";
const GameTour = lazyPanel(() => import("./GameTour"));

type Tab = MudTab;

/* 牌坊菜单每项的罗马音副标（仿明星养成游戏的中英双标签质感） */
const ROMAJI: Record<string, string> = {
  home: "SHIJIE", sim: "RENWU", image: "XINGXIANG", npc: "RENMAI", actions: "YULEQUAN", phone: "SHOUJI",
  works: "ZUOPIN", bag: "XINGNANG", finance: "MOD", theme: "MODE",
};

/* 设置里的「小分支」：一行摘要，点开才展开选项 */
function SettingBranch({ title, en, desc, current, swatch, children, defaultOpen = false }: { title: string; en: string; desc: string; current: string; swatch?: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-paper">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-paper-2">
        <div className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            <span className="text-[14px] font-bold tracking-[0.06em] text-ink">{title}</span>
          </span>
          <span className="block truncate text-[11px] text-ink-soft">{desc}</span>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-paper-2 px-2.5 py-1 text-[11.5px] font-semibold text-ink">
          {swatch}{current}
        </span>
        <span className={`shrink-0 text-[18px] leading-none text-ink-soft transition-transform ${open ? "rotate-90" : ""}`}>›</span>
      </button>
      {open && <div className="border-t border-line bg-paper-2/40 p-3">{children}</div>}
    </div>
  );
}

/** 功能注释：皮肤名 + 线性图标（禁止再用装饰字符当 swatch） */
const SKIN_LABEL: Record<string, [string, ReactElement]> = {
  dream: ["梦幻星紫", <IconSpark key="d" size={16} />],
  bloody: ["血腥玛丽", <IconHeart key="b" size={16} />],
  cute: ["可爱奢华", <IconSparkle key="c" size={16} />],
  glass: ["毛玻璃", <IconStar key="g" size={16} />],
  paper: ["古朴宣纸", <IconScroll key="p" size={16} />],
};
/** 功能注释：玩家设置与编辑器美化共用的皮肤卡片；玩家侧只暴露这一项 */
const PLAYER_SKINS = [
  { id: "dream" as const, label: "梦幻星紫", glyph: <IconSpark size={20} />, desc: "薰衣草糖霜 · 梦幻质感" },
  { id: "bloody" as const, label: "血腥玛丽", glyph: <IconHeart size={20} />, desc: "甜美红×白天鹅 · 浓郁复古" },
  { id: "cute" as const, label: "可爱奢华", glyph: <IconSparkle size={20} />, desc: "蜜桃玫瑰金 · 少女千金" },
  { id: "glass" as const, label: "毛玻璃", glyph: <IconStar size={20} />, desc: "半透磨砂 · 现代精致" },
  { id: "paper" as const, label: "古朴宣纸", glyph: <IconScroll size={20} />, desc: "暖调柔和 · 沉浸典雅" },
];
function PlayerSkinPicker({ skin, onPick }: { skin: string; onPick: (id: (typeof PLAYER_SKINS)[number]["id"]) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="皮肤风格">
      {PLAYER_SKINS.map((sk) => {
        const cur = skin === sk.id;
        return (
          <button
            key={sk.id}
            type="button"
            role="radio"
            aria-checked={cur}
            onClick={() => onPick(sk.id)}
            className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition ${
              cur
                ? "border-white/80 bg-gradient-to-br from-[var(--jade)] to-[var(--coral)] text-white shadow-lg ring-2 ring-fuchsia-300/50"
                : "border-line bg-paper text-ink-soft hover:border-jade/60 hover:bg-paper-2"
            }`}
          >
            <span className="shrink-0 leading-none">{sk.glyph}</span>
            <div className="flex min-w-0 flex-col">
              <span className={`text-[12.5px] font-bold ${cur ? "text-white" : "text-ink"}`}>{sk.label}</span>
              <span className={`truncate text-[10px] ${cur ? "text-white/85" : "text-ink-soft"}`}>{sk.desc}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
const ACCENT_LABEL: Record<string, [string, string]> = { fuchsia: ["璀璨星紫", "bg-purple-600"], plum: ["玫瑰酒红", "bg-rose-800"], rose: ["胭脂蜜桃", "bg-rose-500"], gold: ["琥珀流金", "bg-amber-600"], cyan: ["赛博海蓝", "bg-sky-600"], jade: ["唱片墨绿", "bg-emerald-800"], coral: ["珊瑚朱红", "bg-amber-500"], ink: ["沉稳黛黑", "bg-slate-700"] };

const FONT_LABEL: Record<string, string> = Object.fromEntries(FONTS.map((f) => [f.id, f.label]));

/* 分支内的分页切换（对话框：样式预设 / 气泡与头像 / 细节 DIY） */
function SubTabs({ tabs }: { tabs: [string, ReactNode][] }) {
  const [i, setI] = useState(0);
  return (
    <div>
      <div role="tablist" className="mb-3 flex gap-1 rounded-full border border-line bg-paper-2 p-1">
        {tabs.map(([t], k) => (
          <button key={t} role="tab" aria-selected={i === k} onClick={() => setI(k)}
            className={`flex-1 rounded-full px-2 py-1.5 text-[12px] font-semibold transition ${i === k ? "bg-paper text-jade shadow-sm" : "text-ink-soft hover:text-ink"}`}>{t}</button>
        ))}
      </div>
      {tabs[i][1]}
    </div>
  );
}

/* 美化页分组标题：编号 + 中英标题 + 一句说明 */
function BeautyGroup({ no, title, en, desc }: { no: string; title: string; en: string; desc: string }) {
  return (
    <div className="flex items-end gap-3 px-1 pt-4 first:pt-0">
      <span className="font-serif text-[26px] font-black leading-none text-jade/30 tabular-nums">{no}</span>
      <div className="min-w-0 flex-1 border-b border-line pb-1.5">
        <p className="flex items-baseline gap-2"><span className="text-[15px] font-bold tracking-[0.08em] text-ink">{title}</span><span className="text-[9.5px] font-bold tracking-[0.25em] text-ink-soft/70">{en}</span></p>
        <p className="mt-0.5 text-[11px] text-ink-soft">{desc}</p>
      </div>
    </div>
  );
}

/* 美化页分组导航：吸顶胶囊条，点一组只看这一组（分支自动展开），「全部」回到总览 */
const BEAUTY_GROUPS = [
  ["all", "全部"], ["preset", "主题包"], ["global", "全局风格"], ["dialog", "对话框"], ["scene", "场景"],
  ["chrome", "栏与图标"], ["cover", "封面"], ["plot", "剧情美化"], ["assets", "素材与代码"],
] as const;
type BeautyKey = (typeof BEAUTY_GROUPS)[number][0];
function BeautyNav({ cur, onPick }: { cur: BeautyKey; onPick: (k: BeautyKey) => void }) {
  const i = BEAUTY_GROUPS.findIndex(([k]) => k === cur);
  return (
    <div className="sticky top-0 z-20 -mx-4 border-b border-line bg-paper-2/90 px-4 py-2 backdrop-blur-md">
      <div role="tablist" aria-label="美化分组" className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
        {BEAUTY_GROUPS.map(([k, l], n) => (
          <button key={k} role="tab" aria-selected={cur === k} onClick={() => onPick(k)}
            className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-[12px] font-bold transition ${cur === k ? "border-jade bg-jade text-white shadow-[0_6px_14px_-8px_var(--jade)]" : "border-line bg-paper text-ink-soft hover:border-jade hover:text-jade"}`}>
            {n > 0 && <span className={`font-serif text-[10px] tabular-nums ${cur === k ? "text-white/75" : "text-jade/50"}`}>{String(n).padStart(2, "0")}</span>}{l}
          </button>
        ))}
      </div>
      {cur !== "all" && (
        <div className="mt-1.5 flex items-center justify-between text-[11px]">
          <button onClick={() => onPick("all")} className="text-ink-soft hover:text-jade">‹ 返回全部</button>
          {i < BEAUTY_GROUPS.length - 1 && <button onClick={() => onPick(BEAUTY_GROUPS[i + 1][0])} className="font-semibold text-jade hover:underline">下一组：{BEAUTY_GROUPS[i + 1][1]} ›</button>}
        </div>
      )}
    </div>
  );
}

/* 美化页顶部：当前外观一览 + 恢复默认（仅外观字段；屏幕方向、深浅模式、自定义 CSS 不动） */
function BeautySummary() {
  const { theme, setTheme, activeLooks } = useGame();
  const [confirm, confirmEl] = useConfirm();
  const tags = [
    (SKIN_LABEL[theme.skin ?? "cute"] ?? SKIN_LABEL.cute)[0],
    (ACCENT_LABEL[theme.accent ?? "plum"] ?? ACCENT_LABEL.plum)[0],
    FONT_LABEL[theme.font ?? "song"],
    theme.free?.colors && Object.keys(theme.free.colors).length ? "自定义配色" : "",
    theme.free?.font?.url ? "自定义字体" : "",
    theme.free?.imgs && Object.keys(theme.free.imgs).length ? `贴图 ${Object.keys(theme.free.imgs).length} 处` : "",
    theme.dialogDiy && theme.dialogDiy.on !== false ? "对话框已微调" : "",
    theme.navActive ? "底栏自定" : "",
    theme.topbarDiy && theme.topbarDiy.on !== false ? `顶栏 ${topbarSummary(theme.topbarDiy)}` : "",
    theme.icons ? "图标自定" : "",
    theme.cover && theme.cover.on !== false ? "封面自定" : "",
    theme.sceneBg ? "自定义场景" : "",
    (theme.lookRules?.length ?? 0) > 0 ? `剧情美化 ${theme.lookRules!.length} 条` : "",
  ].filter(Boolean);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-gradient-to-r from-jade/10 via-paper to-coral/10 px-4 py-3">
      {confirmEl}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold tracking-[0.2em] text-ink-soft">当前外观</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {tags.map((t) => <span key={t} className="rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] text-ink">{t}</span>)}
        </div>
        {activeLooks.length > 0 && (
          <p className="mt-1.5 text-[11px] text-jade">剧情美化生效中：{activeLooks.map((a) => a.rule.name || "未命名").join("、")} · 部分外观暂时被覆盖，条件不满足后恢复</p>
        )}
      </div>
      <button className="shrink-0 rounded-full border border-line bg-paper px-3 py-1 text-[11.5px] font-semibold text-ink-soft transition hover:border-danger hover:text-danger"
        onClick={async () => { if (await confirm("把外观恢复为默认？\n屏幕方向、深浅模式与自定义 CSS 保留；建议先在「一键套用」里收藏当前外观。", { ok: "恢复默认" })) setTheme({ ...defaultTheme, mode: theme.mode, orient: theme.orient }); }}>
        恢复默认
      </button>
    </div>
  );
}

/* 设置页面板：界面皮肤 / 字体风格 / 版式方向（作为常驻页签内容，与其他页面同级） */
function SettingsPanel({ bare = false, section = "general" }: { bare?: boolean; section?: "general" | "beauty"; /** @deprecated 玩家设置不再跳进完整美化 */ onBeauty?: () => void }) {
  const beauty = section === "beauty";
  const { theme, setTheme, activeLooks, game, patchGame } = useGame();
  // 美化分组导航：全部 / 单组；单组时只渲染该组，分支默认展开
  const [beautyGroup, setBeautyGroup] = useState<BeautyKey>("all");
  const bg = (k: BeautyKey) => beautyGroup === "all" || beautyGroup === k;
  // 功能注释：暗色模式已从菜单列表挪进「游戏设置」，与字体/BGM/方向同页切换
  const isDark = theme.mode === "dark" || (theme.mode === "auto" && typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches);
  const toggleDarkMode = () => {
    const resolvedDark = theme.mode === "dark" || (theme.mode === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    setTheme({ ...theme, mode: resolvedDark ? "light" : "dark" });
  };
  return (
    <div className="settings-fixed w-full pb-6">
      {!bare && (
        <IndustryPageHeader
          title={beauty ? "美化" : "设置"}
          subtitle={beauty ? "主题包 · 风格 · 对话 · 场景 · 图标 · 封面" : "偏好与设定"}
          eyebrow="STAR CITY"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          }
        />
      )}
      <div className="mx-auto max-w-3xl px-4 py-5 space-y-4">
        {/* 功能注释：玩家「游戏设置」只留皮肤风格选择；主题包/对话框/图标等仍在编辑器·美化 */}
        {!beauty && (
        <SettingBranch title="美化" en="SKIN STYLE" desc="选择界面皮肤风格" current={(SKIN_LABEL[theme.skin ?? "cute"] ?? SKIN_LABEL.dream)[0]} swatch={<span>{(SKIN_LABEL[theme.skin ?? "cute"] ?? SKIN_LABEL.dream)[1]}</span>} defaultOpen>
          <PlayerSkinPicker skin={theme.skin ?? "cute"} onPick={(skin) => setTheme({ ...theme, skin })} />
        </SettingBranch>
        )}
        {/* 功能注释：暗色模式不再折叠，整行就是开关，点一次立即切换（3.7）；样式与分支标题行一致 */}
        {!beauty && (
        <button
          type="button"
          data-dark-toggle="1"
          onClick={toggleDarkMode}
          aria-pressed={isDark}
          className="flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-line bg-paper px-4 py-3 text-left transition hover:bg-paper-2"
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-1.5">
              <span className="text-[14px] font-bold tracking-[0.06em] text-ink">暗色模式</span>
              <span className="text-[9.5px] font-semibold tracking-[0.2em] text-ink-soft">DARK MODE</span>
            </span>
            <span className="block truncate text-[11px] text-ink-soft">点一下立即切换界面明暗，护眼夜读</span>
          </span>
          <span className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${isDark ? "border-jade bg-jade/10 text-jade" : "border-line bg-paper-2 text-ink"}`}>
            {isDark ? <IconMoon size={16} /> : <IconSun size={16} />}{isDark ? "已开启" : "已关闭"}
          </span>
        </button>
        )}
        {beauty && (<>
        <BeautySummary />
        <BeautyNav cur={beautyGroup} onPick={setBeautyGroup} />
        {bg("preset") && (<>
        <BeautyGroup no="01" title="一键套用" en="PRESET" desc="整套外观打包成主题包：收藏、分享，或导入别人的主题" />
        <SettingBranch defaultOpen={beautyGroup !== "all"} title="美化主题包" en="THEME PACK" desc="一键打包当前全部外观，导入他人分享的主题即刻套用" current="导入导出" swatch={<IconSave size={16} />}>
          <ThemePackPanel />
        </SettingBranch>
        </>)}
        {bg("global") && (<>
        <BeautyGroup no="02" title="全局风格" en="GLOBAL" desc="作用于整个游戏界面" />
        <SettingBranch title="皮肤" en="SKIN STYLE" desc="整体视觉基调，切换即全局生效" current={(SKIN_LABEL[theme.skin ?? "cute"] ?? SKIN_LABEL.dream)[0]} swatch={<span>{(SKIN_LABEL[theme.skin ?? "cute"] ?? SKIN_LABEL.dream)[1]}</span>}>
          <PlayerSkinPicker skin={theme.skin ?? "cute"} onPick={(skin) => setTheme({ ...theme, skin })} />
        </SettingBranch>
        <SettingBranch title="配色" en="ACCENT COLOR" desc="预设主色一键切换，也可逐色自定义" current={(ACCENT_LABEL[theme.accent ?? "plum"] ?? ACCENT_LABEL.plum)[0]} swatch={<span className={`h-3 w-3 rounded-full ${(ACCENT_LABEL[theme.accent ?? "plum"] ?? ACCENT_LABEL.plum)[1]}`} />}>
          <SubTitle t="预设主色" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { id: "fuchsia", label: "璀璨星紫", bg: "bg-purple-600" },
              { id: "plum", label: "玫瑰酒红", bg: "bg-rose-800" },
              { id: "rose", label: "胭脂蜜桃", bg: "bg-rose-500" },
              { id: "gold", label: "琥珀流金", bg: "bg-amber-600" },
              { id: "cyan", label: "赛博海蓝", bg: "bg-sky-600" },
              { id: "jade", label: "唱片墨绿", bg: "bg-emerald-800" },
              { id: "coral", label: "珊瑚朱红", bg: "bg-amber-500" },
              { id: "ink", label: "沉稳黛黑", bg: "bg-slate-700" },
            ].map((c) => {
              const cur = (theme.accent ?? "plum") === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setTheme({ ...theme, accent: c.id as any })}
                  className={`flex items-center gap-2 rounded-xl border p-2 text-left transition ${
                    cur
                      ? "border-jade bg-jade/15 ring-2 ring-jade/40 font-bold text-ink"
                      : "border-line bg-paper text-ink-soft hover:border-jade/50 hover:bg-paper-2"
                  }`}
                >
                  <span className={`h-4 w-4 shrink-0 rounded-full border border-white/50 shadow-sm ${c.bg}`} />
                  <span className="text-[12px] truncate">{c.label}</span>
                </button>
              );
            })}
          </div>
          <SubTitle t="自定义取色" d="覆盖皮肤与主色，留空跟随" />
          <FreeColors />
        </SettingBranch>
        <SettingBranch title="字体" en="FONT" desc="预设 8 款游戏字体，或上传自定义字体文件（TTF / OTF / WOFF2）" current={theme.free?.font?.url ? "自定义字体" : (FONT_LABEL[theme.font ?? "song"] ?? "典雅宋体")} swatch={<span className="font-serif text-[12px]">字</span>}>
          <SubTitle t="预设字体（8 款可选）" />
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {FONTS.map((ft) => {
              const cur = (theme.font ?? "song") === ft.id && !theme.free?.font?.url;
              return (
                <button
                  key={ft.id}
                  onClick={() => setTheme(withFontPreset(theme, ft.id))}
                  aria-pressed={cur}
                  className={`flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5 text-center transition ${cur ? "border-white/70 bg-gradient-to-br from-[var(--jade)] to-[var(--coral)] text-white shadow-[0_6px_16px_-8px_rgba(150,110,220,0.7)]" : "border-line bg-paper text-ink-soft hover:border-jade/60"}`}
                >
                  <span className="text-[18px] leading-snug" style={{ fontFamily: ft.family }}>{ft.sample ?? "星"}</span>
                  <span className="text-[12px] font-semibold">{ft.label}</span>
                  <span className={`text-[10px] ${cur ? "text-white/80" : "opacity-70"}`}>{ft.desc}</span>
                </button>
              );
            })}
          </div>
          <SubTitle t="自定义字体文件" />
          <FreeFont />
        </SettingBranch>
        <SettingBranch title="全局背景图" en="BACKGROUND" desc="整个游戏界面的底图" current={theme.free?.imgs?.page ? "已设置" : "无"} swatch={<span className="h-3 w-5 rounded-[3px] bg-gradient-to-br from-jade/50 to-coral/50" />}>
          <SlotImage slot="page" />
        </SettingBranch>
        </>)}
        {bg("dialog") && (<>
        <BeautyGroup no="03" title="对话框" en="DIALOGUE" desc="看剧情时的对话·叙事面板；上方预览实时反映三个分页的设置" />
        <SettingBranch defaultOpen={beautyGroup !== "all"} title="对话框" en="DIALOGUE" desc="样式预设 · 气泡与头像 · 细节 DIY" current={({ soft: "柔光卡片", avg: "AVG 对话条", letter: "信笺", glass: "磨砂玻璃", minimal: "极简" } as const)[theme.dialogStyle ?? "soft"] + (theme.dialogDiy && theme.dialogDiy.on !== false ? " · 已微调" : "")} swatch={<span className="h-3 w-6 rounded-[3px] border border-line bg-paper-2" />}>
          <div className="mb-3"><DialogPreview /></div>
          <SubTabs tabs={[
            ["样式预设", <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {([["soft", "柔光卡片", "柔和光晕 · 默认"], ["avg", "AVG 对话条", "深色半透 · 视觉小说"], ["letter", "信笺", "横线信纸 · 虚线边"], ["glass", "磨砂玻璃", "半透模糊 · 透出场景"], ["minimal", "极简", "无底色 · 一条描边"]] as const).map(([id, label, desc]) => {
              const cur = (theme.dialogStyle ?? "soft") === id;
              return (
                <button key={id} onClick={() => setTheme({ ...theme, dialogStyle: id })} aria-pressed={cur}
                  className={`overflow-hidden rounded-[8px] border text-left transition ${cur ? "border-jade ring-2 ring-jade/30" : "border-line hover:border-jade/60"}`}>
                  {/* 缩略预览：与真实面板同一套 CSS */}
                  <span data-dstyle={id} className="dialogue-panel relative block h-14 overflow-hidden border-b border-line px-2.5 py-2" style={{ borderRadius: 0 }}>
                    <span className="block h-1.5 w-10 rounded-full bg-ink/60" />
                    <span className="mt-1.5 block h-1 w-[85%] rounded-full bg-ink-soft/50" />
                    <span className="mt-1 block h-1 w-[60%] rounded-full bg-ink-soft/50" />
                  </span>
                  <span className="block bg-paper px-2.5 py-1.5">
                    <span className={`block text-[12.5px] font-bold ${cur ? "text-jade" : "text-ink"}`}>{label}</span>
                    <span className="block truncate text-[10px] text-ink-soft">{desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mb-1 mt-3 text-[12px] font-bold text-ink">圆角</p>
          <div className="flex gap-1.5">
            {([[2, "方角"], [8, "微圆"], [16, "圆润"], [24, "大圆角"]] as const).map(([v, l]) => {
              const cur = (theme.dialogRadius ?? 8) === v;
              return <button key={v} onClick={() => setTheme({ ...theme, dialogRadius: v })} className={`flex-1 border py-1.5 text-[12px] transition ${cur ? "border-jade bg-jade/10 font-bold text-jade" : "border-line bg-paper text-ink"}`} style={{ borderRadius: Math.min(v, 12) }}>{l}</button>;
            })}
          </div>
          <p className="mb-1 mt-3 text-[12px] font-bold text-ink">面板高度</p>
          <div className="flex gap-1.5">
            {([["low", "矮 · 多看场景"], ["std", "标准"], ["high", "高 · 多看剧情"]] as const).map(([v, l]) => {
              const cur = (theme.dialogHeight ?? "std") === v;
              return <button key={v} onClick={() => setTheme({ ...theme, dialogHeight: v })} className={`flex-1 rounded-[6px] border py-1.5 text-[12px] transition ${cur ? "border-jade bg-jade/10 font-bold text-jade" : "border-line bg-paper text-ink"}`}>{l}</button>;
            })}
          </div>
            </>],
            ["气泡与头像", <>
          <p className="mb-1 text-[12px] font-bold text-ink">气泡形态</p>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {([["frost", "磨砂"], ["solid", "实色"], ["outline", "描边"], ["comic", "漫画"], ["plain", "无框"]] as const).map(([v, l]) => {
              const cur = (theme.bubbleStyle ?? "frost") === v;
              return <button key={v} onClick={() => setTheme({ ...theme, bubbleStyle: v })} aria-pressed={cur} className={`rounded-[6px] border py-1.5 text-[12px] transition ${cur ? "border-jade bg-jade/10 font-bold text-jade" : "border-line bg-paper text-ink"}`}>{l}</button>;
            })}
          </div>
          <p className="mb-1 mt-3 text-[12px] font-bold text-ink">头像形状</p>
          <div className="flex gap-1.5">
            {([["rounded", "圆角方"], ["circle", "圆形"], ["hidden", "不显示"]] as const).map(([v, l]) => {
              const cur = (theme.avatarShape ?? "rounded") === v;
              return <button key={v} onClick={() => setTheme({ ...theme, avatarShape: v })} aria-pressed={cur} className={`flex-1 rounded-[6px] border py-1.5 text-[12px] transition ${cur ? "border-jade bg-jade/10 font-bold text-jade" : "border-line bg-paper text-ink"}`}>{l}</button>;
            })}
          </div>
          <p className="mb-1 mt-3 text-[12px] font-bold text-ink">头像描边</p>
          <div className="flex gap-1.5">
            {([["white", "白边"], ["accent", "主色"], ["glow", "光晕"], ["none", "无"]] as const).map(([v, l]) => {
              const cur = (theme.avatarFrame ?? "white") === v;
              return <button key={v} onClick={() => setTheme({ ...theme, avatarFrame: v })} aria-pressed={cur} disabled={theme.avatarShape === "hidden"} className={`flex-1 rounded-[6px] border py-1.5 text-[12px] transition disabled:opacity-40 ${cur ? "border-jade bg-jade/10 font-bold text-jade" : "border-line bg-paper text-ink"}`}>{l}</button>;
            })}
          </div>
            </>],
            ["细节 DIY", <DialogDiyPanel />],
          ]} />
        </SettingBranch>
        </>)}
        {bg("scene") && (<>
        <BeautyGroup no="04" title="场景" en="SCENE" desc="主界面上半部分的地点实景与对话立绘" />
        <SettingBranch defaultOpen={beautyGroup !== "all"} title="场景背景与立绘" en="SCENE & PORTRAIT" desc="自定义场景背景、遮罩、模糊与滤镜，以及对话时的人物立绘" current={theme.sceneBg ? "自定义" : "地点原图"} swatch={<span className="h-3 w-5 rounded-[3px] bg-gradient-to-br from-jade to-black/70" />}>
          <ScenePanel />
        </SettingBranch>
        </>)}
        {bg("chrome") && (<>
        <BeautyGroup no="05" title="顶栏、底栏与图标" en="CHROME & ICONS" desc="顶部状态栏、底部导航，以及界面上每一个图标与按钮" />
        <SettingBranch title="顶栏" en="TOP BAR" desc="自由组合版式、名牌头像、状态栏模块与配色；上传样式文件、HTML 模板与样式正则" current={topbarSummary(theme.topbarDiy)} swatch={<span className="h-3 w-6 rounded-full bg-gradient-to-r from-jade to-coral" />}>
          <TopbarDiyPanel />
        </SettingBranch>
        <SettingBranch title="画面边框" en="FRAME" desc="给游玩界面加一圈装饰边框：细线、双线、四角等，可调颜色、粗细、圆角" current={theme.gameFrame ? "已自定" : "无"} swatch={<span className="h-3 w-5 rounded-[3px] border-2 border-jade" />}>
          <FrameEditor value={theme.gameFrame} onChange={(gameFrame) => setTheme({ ...theme, gameFrame })} />
        </SettingBranch>
        <SettingBranch title="底栏选中态" en="NAV STYLE" desc="选中按钮的底衬形状、填充、颜色、动效，以及每个按钮的自定义图标" current={theme.navActive ? "已自定" : "默认"} swatch={<span className="h-3 w-6 rounded-full bg-gradient-to-r from-jade/40 to-coral/40" />}>
          <NavStylePanel />
        </SettingBranch>
        <SettingBranch title="图标与按钮" en="ICON DIY" desc="图标颜色、粗细、大小，圆按钮外形，场景点位样式；每个图标都能换成内置图标或你的图片" current={theme.icons ? "已自定" : "默认"} swatch={<span className="flex gap-0.5 text-jade"><span className="h-3 w-3 rounded-full bg-gradient-to-br from-jade to-coral" /><span className="h-3 w-3 rounded-[3px] border border-jade" /></span>}>
          <IconDiyPanel />
        </SettingBranch>
        </>)}
        {bg("cover") && (<>
        <BeautyGroup no="06" title="封面" en="COVER" desc="玩家侧开局菜单 DIY：背景、标题、按钮、氛围特效；作品展示封面请到模组编辑器「① 基础 → 基本信息」名称上方" />
        <SettingBranch title="封面 DIY" en="COVER DIY" desc="背景图 / 视频 · 标题字与标题图 · 版式 · 按钮 · 星光花瓣特效" current={theme.cover ? (theme.cover.on === false ? "已关闭" : "已自定") : "世界封面"} swatch={<span className="h-4 w-3 rounded-[3px] bg-gradient-to-b from-[#2b1d47] to-[#e2a6d6]" />} defaultOpen={beautyGroup !== "all"}>
          <CoverDiyPanel />
        </SettingBranch>
        </>)}
        {bg("plot") && (<>
        <BeautyGroup no="07" title="随剧情变化" en="PLOT LOOK" desc="条件满足时自动换装：深夜转暗、压力爆表变灰、成名后换上流金" />
        <SettingBranch defaultOpen={beautyGroup !== "all"} title="剧情美化" en="CONDITIONAL" desc="按属性、关系、地点、时段、规则变量等条件临时切换外观" current={activeLooks.length ? `生效 ${activeLooks.length}` : `${theme.lookRules?.length ?? 0} 条`} swatch={<span className="h-3 w-6 rounded-full bg-gradient-to-r from-jade via-ink-soft to-gold" />}>
          <PlotLookPanel />
        </SettingBranch>
        </>)}
        {bg("assets") && (<>
        <BeautyGroup no="08" title="素材与代码" en="ASSETS" desc="所有图片位共用素材库；CSS 优先级最高，可覆盖以上一切" />
        <SettingBranch title="素材库与图床" en="ASSETS" desc="批量上传图片、配置图床；任意图片位都能直接选用" current={`${loadAssets().length} 张`} swatch={<span className="h-3 w-5 rounded-[3px] border border-dashed border-jade/70" />}>
          <AssetLibrary />
        </SettingBranch>
        <SettingBranch title="CSS 代码" en="CUSTOM CSS" desc="皮肤定基调，CSS 改细节：配色、圆角、字号、背景图都能写" current="代码" swatch={<span className="font-mono text-[11px]">{"{ }"}</span>}>
          <CustomCssPanel />
        </SettingBranch>
        </>)}
        </>)}

        {/* 游戏字体：常规设置页也能直接切换 8 款预设字体或上传字体文件 */}
        {!beauty && (
        <SettingBranch title="游戏字体" en="GAME FONT" desc="切换全站剧情、对话与界面的字体风格，或上传本地字体文件" current={theme.free?.font?.url ? "自定义字体" : (FONT_LABEL[theme.font ?? "song"] ?? "典雅宋体")} swatch={<span className="font-serif text-[12px]">字</span>}>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {FONTS.map((ft) => {
              const cur = (theme.font ?? "song") === ft.id && !theme.free?.font?.url;
              return (
                <button
                  key={ft.id}
                  onClick={() => setTheme(withFontPreset(theme, ft.id))}
                  aria-pressed={cur}
                  className={`flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5 text-center transition ${cur ? "border-white/70 bg-gradient-to-br from-[var(--jade)] to-[var(--coral)] text-white shadow-[0_6px_16px_-8px_rgba(150,110,220,0.7)]" : "border-line bg-paper text-ink-soft hover:border-jade/60"}`}
                >
                  <span className="text-[18px] leading-snug" style={{ fontFamily: ft.family }}>{ft.sample ?? "星"}</span>
                  <span className="text-[12px] font-semibold">{ft.label}</span>
                  <span className={`text-[10px] ${cur ? "text-white/80" : "opacity-70"}`}>{ft.desc}</span>
                </button>
              );
            })}
          </div>
          <SubTitle t="自定义字体文件" />
          <FreeFont />
        </SettingBranch>
        )}

        {/* 功能注释：叙事段落浅色底透明度；叠图旁白与小说内容卡共用，字色固定近黑 */}
        {!beauty && (
        <div>
          <span className="text-[14px] font-bold leading-tight tracking-[0.06em] text-ink">叙事底透明度</span>
          <span className="mb-2 mt-0.5 block text-[11px] text-ink-soft">剧情正文底下的半透明底 · 调高更易读 · 普通段落保持黑色</span>
          <div className="flex items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2.5">
            <input
              type="range"
              min={40}
              max={100}
              step={5}
              value={theme.storyBgAlpha ?? 88}
              onChange={(e) => setTheme({ ...theme, storyBgAlpha: +e.target.value })}
              className="min-w-0 flex-1 accent-[var(--jade)]"
              aria-label="叙事底透明度"
            />
            <span className="w-10 shrink-0 text-right text-[12px] tabular-nums text-ink-soft">{theme.storyBgAlpha ?? 88}%</span>
          </div>
          <p
            className="story-prose story-narration-panel mt-2 rounded-xl px-3 py-2 text-[13px] leading-relaxed"
            style={{ ["--story-panel-a" as string]: String((theme.storyBgAlpha ?? 88) / 100) }}
          >
            预览：永和九年，岁在癸丑。天色将晚，街灯初上。
          </p>
        </div>
        )}

        {/* 背景音乐：上传 / 点播 */}
        {!beauty && (
        <SettingBranch title="背景音乐" en="MUSIC" desc="上传本地音乐，点歌单即可播放；切换页面不中断" current="歌单" swatch={<IconMusic size={16} />}>
          <BgmPanel />
        </SettingBranch>
        )}

        {/* 版式方向：竖屏 / 横屏；建角已选则直接生效，此处可随时切换，无需解锁 */}
        {!beauty && (
        <div>
          <span className="text-[14px] font-bold leading-tight tracking-[0.06em] text-ink">屏幕方向</span>
          <span className="mb-2 mt-0.5 block text-[11px] text-ink-soft">每局默认竖屏 9:16 · 要横屏在此改 · 随时可改</span>
          <div className="grid grid-cols-2 gap-1.5">
            {([
              { id: "landscape", label: "横屏", box: "h-4 w-7", desc: "16:9 等宽屏比例游戏" },
              { id: "portrait", label: "竖屏", box: "h-7 w-4", desc: "9:16 等竖向比例游戏" },
            ] as const).map((op) => {
              const cur = (theme.orient ?? "portrait") === op.id;
              return (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => {
                    setTheme({ ...theme, orient: op.id });
                    // 功能注释：设置里改方向时同步本局 playPrefs，与建角所选保持一致
                    if (game) patchGame((g) => ({ ...g, playPrefs: { ...g.playPrefs, orient: op.id } }));
                  }}
                  aria-pressed={cur}
                  className={`flex flex-col items-center gap-0.5 rounded-xl border px-1 py-2 text-center transition ${cur ? "border-white/70 bg-gradient-to-br from-[var(--jade)] to-[var(--coral)] text-white shadow-[0_6px_16px_-8px_rgba(150,110,220,0.7)]" : "border-line bg-paper text-ink-soft hover:border-jade/60"}`}
                >
                  <span className={`rounded-[3px] border-2 border-current ${op.box}`} aria-hidden />
                  <span className="text-[12px] font-semibold">{op.label}</span>
                  <span className={`text-[10px] ${cur ? "text-white/80" : "opacity-70"}`}>{op.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
        )}

        {/* 本局游玩偏好：开局时按世界观默认 / 建角所选，之后随时可改，下一回合起生效 */}
        {!beauty && game && (
        <div>
          <span className="flex items-baseline gap-1.5">
            <span className="text-[14px] font-bold leading-tight tracking-[0.06em] text-ink">游玩偏好</span>
          </span>
          <span className="mb-2 block text-[11px] text-ink-soft">只影响本局，下一回合起生效</span>
          <PlayPrefsPicker value={playPrefsOf(game)} onChange={(playPrefs) => patchGame((g) => ({ ...g, playPrefs }))} />
        </div>
        )}
      </div>
    </div>
  );
}

/* 梦幻淡紫菜单行：左侧图标胶囊 + 中英标签 + 右侧徽标（选中态渐变高亮） */
function MenuRow({
  icon: Icon, label, romaji, hint, active, onClick, badge, badgeTone = "muted",
}: {
  icon: typeof IconCamera;
  label: string;
  romaji: string;
  hint: string;
  active?: boolean;
  onClick: () => void;
  badge?: ReactNode;
  badgeTone?: "muted" | "jade" | "gold" | "danger";
}) {
  const badgeCls =
    badgeTone === "jade" ? "bg-jade/15 text-jade"
    : badgeTone === "gold" ? "bg-gold/20 text-gold"
    : badgeTone === "danger" ? "bg-danger/15 text-danger"
    : "bg-paper text-ink-soft";
  return (
    <button
      onClick={onClick}
      aria-current={active}
      className={`group flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all duration-200 ${
        active
          ? "border-white/40 bg-gradient-to-r from-[var(--jade)] to-[var(--coral)] text-white shadow-[0_8px_20px_-8px_rgba(150,110,220,0.7)]"
          : "border-line bg-paper-2/60 text-ink shadow-sm hover:-translate-y-0.5 hover:bg-paper-2/85 hover:shadow-[0_10px_22px_-12px_rgba(150,110,220,0.6)]"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
          active ? "bg-white/25 text-white" : "bg-gradient-to-br from-jade/20 to-coral/20 text-jade-deep group-hover:from-jade/30 group-hover:to-coral/30"
        }`}
      >
        <DiyIcon slot={`menu:${label}`} size={19}><Icon width={19} height={19} /></DiyIcon>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5">
          <span className="truncate text-[14px] font-bold leading-tight tracking-[0.06em]">{label}</span>
          <span className={`text-[9.5px] font-semibold tracking-[0.2em] ${active ? "text-white/70" : "text-ink-soft"}`}>{romaji}</span>
        </span>
        <span className={`block truncate text-[11px] ${active ? "text-white/80" : "text-ink-soft"}`}>{hint}</span>
      </span>
      {badge != null && (
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${active ? "bg-white/25 text-white" : badgeCls}`}>{badge}</span>
      )}
    </button>
  );
}

// 合并「养成/人物」后，本文件不再引用 CharacterTab（触发一次全量重转译，清除旧 HMR 残留）。
export default function GameShell() {
  useEffect(() => { hookWorldBgm(); }, []);
  const { game, cfg, theme, look, saveNow, loadState, endManually, popup, setPopup, retryPopup, busy, autosaveOn, setAutosaveOn, commitGame } = useGame();
  // 进入设了 BGM 的地点（含任意一层子地点）自动切歌；没设的地点不打断当前音乐
  const curRoom = game?.sim.room;
  // 地点 / RP 房间 BGM：进入自动播放；离开到没设 BGM 的地方，停止由场景开的那首
  useEffect(() => { enterScene(curRoom ? roomBgmOf(curRoom) : undefined); }, [curRoom]);
  // 音频库：作者音频与作品音量同步给播放器（MOD 注入的随 MOD 启用自动合并）
  useEffect(() => { setAuthorAudio(game?.audio); }, [game?.audio]);
  useEffect(() => { setWorkVolume(game?.audioVolume ?? 1); }, [game?.audioVolume]);
  // 皮肤联动 BGM
  const skinBgm = look.skin ? game?.skinBgm?.[look.skin] : undefined;
  useEffect(() => { if (skinBgm) void switchBgm(skinBgm); }, [skinBgm]);
  const [tab, setTab] = useState<Tab>("home");
  // 剧情输出期间统一锁定：不能切去其他功能 / 手机聊天，看完这一段再行动
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const [lockTip, setLockTip] = useState(false);
  const lockTimer = useRef<number | undefined>(undefined);
  const flashLock = useCallback(() => {
    setLockTip(true);
    window.clearTimeout(lockTimer.current);
    lockTimer.current = window.setTimeout(() => setLockTip(false), 1800);
  }, []);
  // 剧情开始书写时，若停在其他页签则收回剧情页，保证玩家看到正在发生的故事
  useEffect(() => { if (busy) { setTab((t) => (t === "home" ? t : "home")); setPanelOpen(false); } }, [busy]); // eslint-disable-line react-hooks/exhaustive-deps
  const [setOpen, setSetOpen] = useState(false); // 设置弹窗
  const [cgOpen, setCgOpen] = useState(false); // 玩家 CG 图鉴
  const [cgEditOpen, setCgEditOpen] = useState(false); // 编辑器 · CG 编排
  const [audioOpen, setAudioOpen] = useState(false); // 编辑器 · 音频库
  const [cgReveal, setCgReveal] = useState<{ id: string; extra: number } | null>(null);
  const knownCgUnlocks = useRef<Set<string> | null>(null);
  const knownCgSave = useRef("");
  // 功能注释：剧情写完（busy=false）后统一判定；同批仅首张演出，其余合并为一句。
  useEffect(() => {
    if (!game) return;
    if (knownCgSave.current !== game.id) {
      knownCgSave.current = game.id;
      knownCgUnlocks.current = new Set(Object.keys(game.cgUnlocked ?? {}));
    }
    if (busy) return;
    const ids = newlyUnlockedCgs(game);
    if (ids.length) {
      const time = game.world?.time ?? "";
      commitGame(applyCgUnlocks(game, ids, time, latestCgDialogue(game.story)));
      return;
    }
    const unlocked = Object.keys(game.cgUnlocked ?? {});
    const fresh = unlocked.filter((id) => !knownCgUnlocks.current?.has(id));
    knownCgUnlocks.current = new Set(unlocked);
    const reveal = cgRevealBatch(fresh);
    if (reveal) setCgReveal(reveal);
  }, [game, busy, commitGame]);
  const landscape = theme.orient === "landscape";
  // 横屏（橙光式）：侧栏面板开合
  const [panelOpen, setPanelOpen] = useState(false);
  const [navEditOpen, setNavEditOpen] = useState(false);
  // 页签懒挂载：只有访问过的页签才真正挂载，之后常驻以保留状态。
  // 避免开局就把六个页签（含手机里每秒走动的时钟）一起挂起来空转。
  const [seen, setSeen] = useState<Set<Tab>>(() => new Set<Tab>(["home"]));
  useEffect(() => {
    setSeen((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));
  }, [tab]);
  // 跨页签跳转（如「人脉」里点主角 → 跳到「人物档案」）
  useEffect(() => {
    const onNav = (e: Event) => {
      const dest = (e as CustomEvent<Tab>).detail;
      if (busyRef.current && dest !== "home") { flashLock(); return; }
      // 「人物」以档案弹窗呈现；其余功能切到对应整屏界面（横屏则展开侧栏浮层）
      if (dest === "sim") { setSimOpen(true); return; }
      // 功能注释：顶栏状态行 / 主线条 → 任务主线弹窗，不整页切到剧情志
      if (dest === "quest") { setQuestOpen(true); return; }
      setTab(dest);
      setSeen((p) => (p.has(dest) ? p : new Set(p).add(dest)));
      if (landscape) setPanelOpen(true);
    };
    window.addEventListener("star:navtab", onNav as EventListener);
    return () => window.removeEventListener("star:navtab", onNav as EventListener);
  }, [landscape]);
  // 功能注释：状态行专发 star:quest-open，与菜单「剧情志」同一弹窗
  useEffect(() => {
    const onQuest = () => setQuestOpen(true);
    window.addEventListener("star:quest-open", onQuest);
    return () => window.removeEventListener("star:quest-open", onQuest);
  }, []);
  // 当面玩手机被打断：收起手机，回到剧情页（回合由 GameContext 推进）
  useEffect(() => {
    const h = () => { setTab("home"); if (landscape) setPanelOpen(false); };
    window.addEventListener("phone:interrupt", h);
    return () => window.removeEventListener("phone:interrupt", h);
  }, [landscape]);
  const [saveMsg, setSaveMsg] = useState<"ok" | "fail" | null>(null);
  const [endOpen, setEndOpen] = useState(false);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [finOpen, setFinOpen] = useState(false);
  const [worksOpen, setWorksOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false); // 世界书（设定片段编辑）
  const [mapEditOpen, setMapEditOpen] = useState(false);
  const [modsOpen, setModsOpen] = useState(false); // 模组 / 世界观管理
  const { world: modWorld } = useMods(); // 地图编辑器（点位/背景/物件）
  const [fixedOpen, setFixedOpen] = useState(false);
  const [questOpen, setQuestOpen] = useState(false); // 剧情志弹窗
  const [personTab, setPersonTab] = useState<"persona" | "memory">("persona"); // 固定人物：人设 / 记忆
  const [beautyOpen, setBeautyOpen] = useState(false); // 编辑器 · 美化
  const [editorOpen, setEditorOpen] = useState(false); // 编辑器总入口（六个创作工具）
  const [endingsOpen, setEndingsOpen] = useState(false); // 结局设定编辑器
  const [factionOpen, setFactionOpen] = useState(false); // 阵营派系
  const [engineOpen, setEngineOpen] = useState(false); // 底层世界规则
  // 底层规则 · 预加载：空闲时把尚未解锁的 CG 先拉进浏览器缓存，解锁弹出时不再等图
  const preload = !!game && rulesOf(game).media.preload;
  const cgKey = (game?.cgs ?? []).filter((c) => c.enabled !== false && (c.imageFileId || c.image) && !game?.cgUnlocked?.[c.id]).map((c) => `${c.imageFileId ?? ""}|${c.image ?? ""}`).slice(0, 24).join("\n");
  useEffect(() => {
    if (!preload || !cgKey) return;
    const t = window.setTimeout(() => {
      for (const item of cgKey.split("\n")) {
        const [fileId, legacy] = item.split("|");
        void resolveCgImageFile(fileId).then((src) => { const image = src ?? legacy; if (image) new Image().src = image; });
      }
    }, 1500);
    return () => window.clearTimeout(t);
  }, [preload, cgKey]);
  const [timelineOpen, setTimelineOpen] = useState(false); // 主线复盘时间线
  const [personOpen, setPersonOpen] = useState(false); // 固定人物编辑器（性别/人设/口吻） // 固定事件编辑器（创作者预设剧本）
  // 从编辑器入口打开的面板，关闭后回到入口，方便连续改多项；直接在入口点 × 才真正退出
  const [hubReturn, setHubReturn] = useState(false);
  const hubChildOpen = personOpen || mapEditOpen || rulesOpen || beautyOpen || navEditOpen || bookOpen || fixedOpen || cgEditOpen || endingsOpen || factionOpen || timelineOpen || engineOpen;
  useEffect(() => {
    if (hubReturn && !hubChildOpen && !editorOpen && !modsOpen) { setHubReturn(false); setEditorOpen(true); }
  }, [hubReturn, hubChildOpen, editorOpen, modsOpen]);
  const [savesOpen, setSavesOpen] = useState(false); // 存档管理
  const [saves, setSaves] = useState<SaveSlot[]>([]); // 六个手动槽的当前内容
  const [autoSlot, setAutoSlot] = useState<SaveSlot | null>(null); // 自动存档
  const [editId, setEditId] = useState<string | null>(null); // 正在重命名的槽 id
  const [editName, setEditName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null); // 正在写入的槽（禁用按钮）
  const [schedOpen, setSchedOpen] = useState(false); // 本周日程板（全局弹窗，可从任意页直接唤出）
  const [simOpen, setSimOpen] = useState(false); // 人物档案（点左上角头像唤出的弹窗）
  // 「世界」页场景里的「本周日程」入口直接派发事件唤出，无需先跳到人物页；关养成时忽略，避免仍弹出日程板
  useEffect(() => {
    const onSched = () => { if (worldGrowEnabled()) setSchedOpen(true); };
    window.addEventListener("star:navschedule", onSched);
    const onAi = () => setCfgOpen(true);
    window.addEventListener("star:openaicfg", onAi);
    return () => { window.removeEventListener("star:navschedule", onSched); window.removeEventListener("star:openaicfg", onAi); };
  }, []);
  if (!game) return null;

  // 功能注释：作者预览顶栏只显示当前主线步骤，去掉周数/日期/地点/金钱等干扰项
  const authorPreviewing = isAuthorPreview();
  // 功能注释：小说模式固定三行顶栏；Studio 预览也要开，否则产品验收对不上稿
  const novelLayout = playPrefsOf(game).mode === "novel";
  const mainQuest = game.sim
    ? homeMainQuest(game.sim, getWorldStorylines(), dayDateLabel(game.sim.day ?? 0))
    : null;
  const topbarData = {
    ...topbarDataOf(game, modWorld.chain[0].name),
    // 功能注释：局势摘要并入主线同一块顶栏，不再单独渲染第二条飘条
    note: game.world.note?.trim() || undefined,
    ...(mainQuest
      ? {
          questStep: mainQuest.waitLabel ? `${mainQuest.stepName} · ${mainQuest.waitLabel}` : mainQuest.stepName,
          questLineName: mainQuest.lineName,
          questDesc: mainQuest.stepDesc,
          questWait: mainQuest.waitLabel,
          questDone: mainQuest.done,
          questTotal: mainQuest.total,
          questProgress: mainQuest.progress,
        }
      : {}),
  };

  const refreshSaves = async () => {
    const [manual, auto] = await Promise.all([listManualSaves(), getSlot(AUTO_SLOT_ID)]);
    setSaves(manual);
    setAutoSlot(auto);
  };
  const openSaves = () => { void refreshSaves(); setEditId(null); setSavesOpen(true); };
  // 立即存档：把当前进度刷入自动存档槽
  const quickSave = async () => {
    const ok = await saveNow();
    setSaveMsg(ok ? "ok" : "fail");
    setTimeout(() => setSaveMsg(null), 1800);
    if (ok) void refreshSaves();
  };
  // 存入 / 覆盖某个手动槽
  const saveIntoSlot = async (id: string) => {
    setSavingId(id);
    const ok = await saveToSlot(id, game);
    setSavingId(null);
    setSaveMsg(ok ? "ok" : "fail");
    setTimeout(() => setSaveMsg(null), 1800);
    if (ok) void refreshSaves();
  };
  const removeSlot = async (id: string) => {
    await deleteSlot(id);
    void refreshSaves();
  };
  const commitRename = async () => {
    if (editId) { await renameSlot(editId, editName); void refreshSaves(); }
    setEditId(null);
  };
  // 六个固定槽位（顺序稳定），空槽显示为「可存入」
  const SLOT_IDS = Array.from({ length: MAX_SLOTS }, (_, i) => `slot-${i + 1}`);

  const tabNode = (t: Tab): ReactNode =>
    t === "home" ? <HomeTab /> : t === "sim" ? <SimTab /> : t === "image" ? (feature("imageCrisis") ? <ImageTab /> : null)
    : t === "npc" ? <NpcTab /> : t === "actions" ? <ActionsTab />
    : t === "quest" ? <div className="mx-auto max-w-3xl px-4 py-5"><StoryQuestPanel /></div>
    : t === "settings" ? <SettingsPanel bare onBeauty={() => setBeautyOpen(true)} /> : <Phone />;

  /* 统一功能入口：世界 / 手机为常驻底页，其余（人物 / 形象 / 人脉 / 娱乐圈）一律封装为浮层弹窗。
   * 横屏沿用右侧侧栏浮层，竖屏改以居中弹窗呈现，菜单 / 底栏 / 跨页跳转皆走此分发。 */
  const openFeature = (t: Tab) => {
    if (busy && t !== "home") { flashLock(); return; }
    if (t === "sim") { setSimOpen(true); return; }
    setTab(t);
    setSeen((p) => (p.has(t) ? p : new Set(p).add(t)));
    if (landscape && t !== "home") setPanelOpen(true);
  };

  return (
    <EntityProvider>
    {landscape && (
      /* ═══════════ 横屏 · 橙光式版式 ═══════════
         直接以真正的「世界」页（HomeTab）作为顶天立地的主场景，
         叠一层轻量悬浮操作栏，其余页签(人物/形象/…)以侧栏浮层打开。
         此壳覆盖在竖屏外壳之上；菜单(z-40)与弹窗(z-50)仍渲染其上，得以共用。 */
      <div className="mud-shell fixed inset-0 z-30 flex flex-col overflow-hidden bg-paper landscape-world">
        <FrameOverlay f={theme.gameFrame} />
        {/* 顶栏：名牌 + 世界状态 + 菜单，随设置里的皮肤 / 主色调换色 */}
        <TopbarView
          compact
          data={topbarData}
          diy={look.topbarDiy}
          topbar={look.topbar}
          topbarText={look.topbarText}
          questOnly={authorPreviewing && !novelLayout}
          novelLayout={novelLayout}
          menuOpen={menuOpen}
          onProfile={() => setSimOpen(true)}
          onMenu={() => setMenuOpen((v) => !v)}
          onEnd={() => setEndOpen(true)}
        />

        {/* 主场景：真正的「世界」页顶天立地铺满 */}
        <div className="min-h-0 flex-1">{seen.has("home") && <HomeTab />}</div>
        {landscape && <GameTour active />}

        {/* 功能页以菜单选中后的浮层呈现。 */}
        {panelOpen && createPortal(
          <div className="ui-overlay z-30" role="dialog" aria-modal="true" onClick={() => setPanelOpen(false)}>
            <div className="ui-sheet ui-dialog animate-pop" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-line bg-paper-2/90 px-4 py-2.5">
                <span className="text-[14px] font-bold text-ink">{menuItems().find((m) => m.id === tab)?.label ?? (tab === "quest" ? "任务" : tab === "settings" ? "设置" : "面板")}</span>
                <button onClick={() => setPanelOpen(false)} aria-label="关闭" className="ui-icon-btn"><IconClose /></button>
              </div>
              <div className="ui-dialog-body relative">{tabNode(tab)}</div>
            </div>
          </div>
        , romancePortalRoot()!)}
      </div>
    )}
    {/* 功能注释：作者预览时高度吃满预览舞台，勿 h-screen，否则叠加测试顶栏后底栏被裁切 */}
    <div
      className={`app-root m-0 flex w-full flex-col overflow-hidden bg-paper p-0 text-ink ${
        authorPreviewing ? "h-full max-h-full min-h-0" : "h-screen h-[100dvh]"
      }`}
      data-author-preview-game={authorPreviewing ? "1" : undefined}
      aria-hidden={landscape}
    >
      {/* 顶部世界动态栏：跟随全局界面皮肤；功能注释：仅「世界」Tab 显示（3.10），其它页签从自己的内容顶起 */}
      {tab === "home" && (
      <TopbarView
        data={topbarData}
        diy={look.topbarDiy}
        topbar={look.topbar}
        topbarText={look.topbarText}
        questOnly={authorPreviewing && !novelLayout}
        novelLayout={novelLayout}
        menuOpen={menuOpen}
        onProfile={() => setSimOpen(true)}
        onMenu={() => setMenuOpen((v) => !v)}
        onEnd={() => setEndOpen(true)}
      >
        {(game.attrDefs ?? []).some((d) => d.pin) && (
          <div className="flex gap-1.5 overflow-x-auto px-4 pb-1.5 [scrollbar-width:none]">
            {game.attrDefs!.filter((d) => d.pin).map((d) => {
              const v = game.player.attrs.find((a) => a.key === d.id)?.value ?? d.init;
              const t = (d.display ?? "both") !== "num" ? tierOf(v, d.tiers) : undefined;
              return (
                <span key={d.id} className="flex shrink-0 items-center gap-1 rounded-full border border-line bg-paper/90 px-2.5 py-0.5 text-[11px] text-ink shadow-sm">
                  {d.icon && <span>{d.icon}</span>}<span className="text-ink-soft">{d.label}</span>
                  {t && <b style={{ color: toneColor(d.color ?? "coral") }}>{t}</b>}
                  {(!t || d.display === "both" || !d.display) && <AttrValueEdit def={d} className="text-[11px]" />}
                </span>
              );
            })}
          </div>
        )}
        {saveMsg === "ok" && <p className="bg-jade/12 px-4 py-1 text-center text-[11px] text-jade">已保存到本地存档</p>}
        {saveMsg === "fail" && <p className="bg-danger/12 px-4 py-1 text-center text-[11px] text-danger">保存失败：本地存储不可用，请检查浏览器权限或空间</p>}
      </TopbarView>
      )}

      {lockTip && (
        <div role="status" className="pointer-events-none fixed left-1/2 top-16 z-[90] -translate-x-1/2 animate-pop rounded-full bg-ink/90 px-4 py-2 text-[12.5px] font-medium text-paper shadow-lg">
          剧情正在上演，看完这一段再行动
        </div>
      )}
      {/* 线下剧情触发的来电：不在手机页时，顶部弹出提醒，点按去接听 */}
      {game.phone?.ringing && tab !== "phone" && (
        <button
          onClick={() => { if (busy) { flashLock(); return; } setTab("phone"); setSeen((p) => (p.has("phone") ? p : new Set(p).add("phone"))); if (landscape) setPanelOpen(true); }}
          className="fixed left-1/2 top-3 z-[45] flex w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2 animate-pop items-center gap-3 rounded-[22px] bg-[#1c2430]/92 px-3.5 py-2.5 text-left text-white shadow-[0_16px_40px_-12px_rgba(0,0,0,0.55)] ring-1 ring-white/10 backdrop-blur-xl"
        >
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#34c759]">
            <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-[#34c759]/50" />
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="relative"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" /></svg>
          </span>
          <span className="min-w-0 flex-1">
            <b className="block truncate text-[14px]">{game.phone.ringing.name}</b>
            <span className="block truncate text-[12px] text-white/70">{game.phone.ringing.video ? "视频" : "语音"}来电 · 点按去手机接听</span>
          </span>
        </button>
      )}

      {/* 牌坊菜单：右上角下拉，收纳全部牌位 */}
      {menuOpen && createPortal(
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
          <button aria-label="关闭菜单" onClick={() => setMenuOpen(false)} className="absolute inset-0 bg-[#2b2247]/40 backdrop-blur-[3px]" />
          <div className="absolute right-3 top-14 max-h-[calc(100dvh-5rem)] w-[min(21rem,calc(100vw-1.5rem))] animate-pop overflow-hidden rounded-[26px] border border-line bg-gradient-to-b from-paper-2/95 via-paper-2/92 to-paper-2/95 shadow-[0_28px_70px_-18px_rgba(120,90,200,0.65)] backdrop-blur-2xl">
            {/* 顶部柔光装饰 */}
            <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-coral/35 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -left-10 top-16 h-28 w-28 rounded-full bg-jade/35 blur-3xl" aria-hidden />

            <div className="relative max-h-[calc(100dvh-5rem)] overflow-y-auto px-3.5 py-3.5">
              {/* 标题 */}
              <div className="mb-2.5 flex items-center gap-2 px-1">
                <IconMenu size={16} className="text-coral" />
                <span className="text-[13px] font-black tracking-[0.18em] text-jade-deep">菜单</span>
                <span className="text-[10.5px] font-semibold tracking-[0.22em] text-ink-soft">MENU</span>
                <IconSpark size={14} className="ml-auto text-coral" />
              </div>

              {/* 主牌位 */}
              <div className="grid grid-cols-1 gap-1.5">
                {/* 世界为当前主场景，其余功能统一收纳在菜单中。 */}
                {menuItems().filter((m) => !["home", "npc", "actions", "phone"].includes(m.id)).map((m) => (
                  <MenuRow
                    key={m.id}
                    icon={m.icon}
                    label={m.label}
                    romaji={ROMAJI[m.id] ?? ""}
                    hint={m.hint}
                    active={tab === m.id}
                    onClick={() => { setMenuOpen(false); openFeature(m.id); }}
                  />
                ))}
              </div>

              {/* 收藏册：作品 / 背包 / 玩法 Mod（支票账单，按已选玩法显隐） */}
              <div className="my-3 flex items-center gap-2 px-1">
                <span className="h-px flex-1 bg-gradient-to-r from-transparent to-line" />
                <span className="text-[10px] font-bold tracking-[0.24em] text-ink-soft">COLLECTION</span>
                <span className="h-px flex-1 bg-gradient-to-l from-transparent to-line" />
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                <MenuRow
                  icon={IconSparkle} label="玩法引导" romaji="GUIDE" hint="重新看一遍：光点、选项、行动点和推进分别怎么用"
                  onClick={() => { setMenuOpen(false); setTab("home"); window.setTimeout(() => window.dispatchEvent(new Event("star:tour")), 350); }}
                />
                <MenuRow
                  icon={IconSave} label="存档管理" romaji="SAVE" hint="立即存档 · 读取 / 删除历史存档"
                  onClick={() => { openSaves(); setMenuOpen(false); }}
                  badge={`${game.turnCount} 回合`} badgeTone="jade"
                />
                <MenuRow
                  icon={IconFlag} label="结束游戏" romaji="FIN" hint="手动结束并生成后记与人生评级；不结束则等 AI 判定结局"
                  onClick={() => { setEndOpen(true); setMenuOpen(false); }}
                />
                {feature("career") && <MenuRow
                  icon={IconScroll} label="我的作品" romaji={ROMAJI.works} hint={`${T("gig")}履历 · 作品库 · 出演角色`}
                  onClick={() => { setWorksOpen(true); setMenuOpen(false); }}
                  badge={`${game.sim.works} 部 · ${game.sim.awards} 奖`} badgeTone="jade"
                />}
                {hasCgMenu(game.cgs) && <MenuRow
                  icon={IconSparkle} label="CG 图鉴" romaji="" hint="好感与剧情达成后解锁的剧情插图"
                  onClick={() => { setCgOpen(true); setMenuOpen(false); }}
                  badge={`${Object.keys(game.cgUnlocked ?? {}).length}/${(game.cgs ?? []).filter((c) => c.enabled !== false).length}`} badgeTone="gold"
                />}
                <MenuRow
                  icon={IconFlag} label="剧情志" romaji="STORY" hint="支线剧情 · 收藏留存 · 一键导出"
                  onClick={() => { setQuestOpen(true); setMenuOpen(false); }}
                  badge={`${(game.journal ?? []).length} 篇`} badgeTone="gold"
                />
                {shouldShowPlayModMenuEntry(feature("career"), worldHas("bills")) && (
                <MenuRow
                  icon={IconWallet} label="玩法 Mod" romaji={ROMAJI.finance} hint="周日结算 · 支票与生活账单"
                  onClick={() => { setFinOpen(true); setMenuOpen(false); }}
                  badge={wallet.short(wallet.balance(game), game)} badgeTone={wallet.balance(game) < 0 ? "danger" : "jade"}
                />
                )}
              </div>

              {/* 设置：暗色模式已并入「游戏设置」 */}
              <div className="my-3 flex items-center gap-2 px-1">
                <span className="h-px flex-1 bg-gradient-to-r from-transparent to-line" />
                <span className="text-[10px] font-bold tracking-[0.24em] text-ink-soft">SETTINGS</span>
                <span className="h-px flex-1 bg-gradient-to-l from-transparent to-line" />
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                <MenuRow
                  icon={IconSettings} label="AI 配置" romaji="MODEL" hint="接入模型 · API Key · 叙事引擎设置"
                  onClick={() => { setCfgOpen(true); setMenuOpen(false); }}
                  badge={cfg?.apiKey ? "已接入" : "未配置"} badgeTone={cfg?.apiKey ? "jade" : "muted"}
                />
                <MenuRow
                  icon={IconSparkle} label="游戏设置" romaji="OPTIONS" hint="暗色模式 · 界面皮肤 · 背景音乐 · 字体风格 · 屏幕方向"
                  onClick={() => { setSetOpen(true); setMenuOpen(false); }}
                />
              </div>
            </div>
          </div>
        </div>
      , romancePortalRoot()!)}

      {/* 内容区：各功能封装为独立整屏界面，常驻挂载、切换保留状态 */}
      <main className="relative min-h-0 flex-1">
        <div className={`absolute inset-0 ${tab === "home" ? "" : "hidden"}`}>{seen.has("home") && <HomeTab />}</div>
        <div className={`absolute inset-0 overflow-y-auto ${tab === "image" ? "" : "hidden"}`}>{seen.has("image") && feature("imageCrisis") && <ImageTab />}</div>
        <div className={`absolute inset-0 overflow-y-auto ${tab === "npc" ? "" : "hidden"}`}>{seen.has("npc") && <NpcTab />}</div>
        <div className={`absolute inset-0 overflow-y-auto ${tab === "actions" ? "" : "hidden"}`}>{seen.has("actions") && feature("industryTab") && <ActionsTab />}</div>
        <div className={`absolute inset-0 overflow-hidden ${tab === "phone" ? "" : "hidden"}`}>{seen.has("phone") && <Phone />}</div>

        {/* 任务（剧情志）· 常驻页签，与「世界 / 娱乐圈」同级 */}
        <div className={`absolute inset-0 overflow-y-auto ${tab === "quest" ? "" : "hidden"}`}>
          {seen.has("quest") && <StoryQuestPanel />}
        </div>

        {/* 设置 · 常驻页签（皮肤 / 字体 / 版式） */}
        <div className={`absolute inset-0 overflow-y-auto ${tab === "settings" ? "" : "hidden"}`}>
          {seen.has("settings") && <SettingsPanel onBeauty={() => setBeautyOpen(true)} />}
        </div>
      </main>

      {/* 底部时辰盘 · 石牌导航 */}
      <MudChrome tab={tab} setTab={openFeature} />
      {!landscape && <GameTour active={tab === "home"} />}

      {/* 支线剧场：点事件进入扣行程点，支线内行动不再扣 */}
      <BranchSheet />

      {/* 通用行动结果弹窗 */}
      {popup && (
        <Modal title={popup.scene && !popup.report ? "场景" : popup.title} onClose={() => setPopup(null)}>
          {popup.diary && !popup.report && <DiaryCard d={popup.diary} />}
          {popup.report ? (
            <WeekReportCard report={popup.report} changes={popup.changes} diary={popup.diary} bill={popup.report.span ? null : game?.sim.lastBill} earned={game?.sim.lastCheck?.amount} onNext={() => setPopup(null)} />
          ) : popup.scene ? (
            <article className="scene-sheet -mx-1 overflow-hidden rounded-[22px] border border-line bg-paper shadow-[0_10px_30px_-20px_var(--jade)]">
              <header className="relative bg-gradient-to-br from-jade/20 via-paper-2 to-coral/20 px-4 pb-3 pt-4">
                <h3 className="font-serif text-[19px] font-bold text-ink">{popup.title}</h3>
                <p className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-ink-soft">
                  {popup.scene.location && <span className="inline-flex items-center gap-1 rounded-full bg-paper/80 px-2 py-0.5"><IconPin size={12} /> {popup.scene.location}</span>}
                  {popup.scene.time && <span className="inline-flex items-center gap-1 rounded-full bg-paper/80 px-2 py-0.5"><IconClock size={12} /> {popup.scene.time}</span>}
                </p>
              </header>
              <div className="px-4 py-3.5">
                <Segments segments={popup.segments} npcs={game.npcs} playerAvatar={game.player.avatar} playerName={game.player.name} />
              </div>
            </article>
          ) : popup.diary ? null : (
            <Segments segments={popup.segments} npcs={game.npcs} playerAvatar={game.player.avatar} playerName={game.player.name} />
          )}
          {!popup.report && <CastRow segments={popup.segments} changes={popup.changes} npcs={game.npcs} onOpen={() => setPopup(null)} />}
          {!popup.report && <NewcomerCards ids={popup.newcomers} />}
          {popup.retry && (
            <button type="button" disabled={busy} onClick={retryPopup} className="mt-4 w-full rounded-full border border-[var(--danger)]/40 bg-[var(--danger)]/5 py-2 text-[13px] font-semibold text-[var(--danger)] transition hover:bg-[var(--danger)]/10 disabled:opacity-50">
              ↻ 重新触发
            </button>
          )}
          {!popup.report && !popup.diary && popup.changes.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
              {popup.changes.map((c, i) => (
                <Chip key={i} tone={/(-|敌意|压力)/.test(c) ? "danger" : "jade"}>{c}</Chip>
              ))}
            </div>
          )}
        </Modal>
      )}

      {navEditOpen && (
        <Modal title="底部栏" onClose={() => setNavEditOpen(false)}>
          <NavTabsEditor />
        </Modal>
      )}

      {/* 本周日程板：全局弹窗，从「世界」页入口直接唤出 */}
      <ScheduleBoard open={schedOpen} onClose={() => setSchedOpen(false)} />

      {/* 人物档案：点左上角头像唤出（原「人物」页内容，现以弹窗呈现） */}
      {simOpen && (
        <Modal title="人物档案" onClose={() => setSimOpen(false)}>
          <SimTab embedded />
        </Modal>
      )}

      {/* 我的作品 */}
      {worksOpen && <Works onClose={() => setWorksOpen(false)} />}

      {/* 玩法 Mod · 支票与账单（仅装了对应玩法时从菜单进入） */}
      {finOpen && <Finance onClose={() => setFinOpen(false)} />}

      {/* 逾期违约 · 制片人上门追责（挂起时强制处理，须赔付违约金了结） */}
      {game?.sim.breach && <BreachDialog />}

      {/* 世界规则 · 社会规则设定 */}
      {rulesOpen && (
        <Modal title="世界规则 · 社会规则" onClose={() => setRulesOpen(false)}>
          <WorldRulesPanel />
        </Modal>
      )}

      {/* 世界书 · 设定片段 */}
      {bookOpen && (
        <Modal title="世界书 · 设定片段" onClose={() => setBookOpen(false)}>
          <WorldBookPanel />
        </Modal>
      )}

      {/* 地图编辑器 · 点位 / 背景 / 物件 */}
      {mapEditOpen && (
        <Modal title="地图编辑器 · 点位与物件" onClose={() => setMapEditOpen(false)}>
          <Suspense fallback={<PanelLoading />}><MapEditorPanel /></Suspense>
        </Modal>
      )}

      {/* 模组 / 世界观管理 */}
      {modsOpen && (
        <Modal title="创意工坊" onClose={() => setModsOpen(false)}>
          <Suspense fallback={<PanelLoading />}><ModManagerPanel /></Suspense>
        </Modal>
      )}

      <AllowanceWatcher />
      {questOpen && (
        <Modal title="剧情志" onClose={() => setQuestOpen(false)}>
          <StoryQuestPanel onNavigate={() => setQuestOpen(false)} />
        </Modal>
      )}

      {editorOpen && (() => {
        const go = (f: (v: boolean) => void, back = true) => () => { f(true); setEditorOpen(false); setHubReturn(back); };
        const n = (x: number, u: string) => `${x} ${u}`;
        const fixedN = (game.fixedEvents ?? []).length, endN = (game.customEndings ?? []).length;
        const bookN = (game.worldBook ?? defaultWorldBook()).filter((e) => e.enabled).length;
        const mapN = Object.keys(game.mapEdits ?? {}).length, kbN = Object.keys(game.npcKb ?? {}).length;
        const personaN = game.npcs.filter((x) => x.persona?.gender || x.persona?.text?.trim() || x.persona?.voice?.trim() || x.edited?.length || x.home).length;
        const allPaths = creationCopy().paths ?? [];
        const lockedPathN = allPaths.filter((p) => !p.open).length;
        return (
          <Modal title="编辑器" onClose={() => setEditorOpen(false)}>
            {(() => {
              // 功能注释：菜单文案与 editorHubMenus 同源，创作向导第 2 步据此全量迁移，禁止再手写 label
              const hub = (id: string) => EDITOR_HUB_MENUS.find((m) => m.id === id)!;
              return (
            <EditorHub
              project={modWorld.chain[0].name}
              stats={[{ k: "地点", v: LIVE_LOCATIONS.length }, { k: "人物", v: game.npcs.length }, { k: "事件", v: fixedN }, { k: "结局", v: endN }]}
              groups={[
                { id: "now", title: "本局修订", scope: "即改即生效", tools: [
                  { id: "person", label: hub("person").label, en: "", hint: hub("person").hint, icon: IconUser, stat: personaN || kbN ? n(personaN, "位已改") : "原貌", done: personaN > 0 || kbN > 0, onOpen: go(setPersonOpen), panel: () => <FixedPersonPanel /> },
                  { id: "map", label: hub("map").label, en: "", hint: hub("map").hint, icon: IconPin, stat: mapN ? n(mapN, "处已改") : "原貌", done: mapN > 0, onOpen: go(setMapEditOpen), panel: () => <MapEditorPanel /> },
                  { id: "rules", label: hub("rules").label, en: "", hint: hub("rules").hint, icon: IconScroll, stat: game.worldRules?.enabled ? "已启用" : "循现实", done: !!game.worldRules?.enabled, onOpen: go(setRulesOpen), panel: () => <WorldRulesPanel /> },
                  { id: "engine", label: hub("engine").label, en: "", hint: hub("engine").hint, icon: IconScroll, stat: game.engineRules ? "已自定" : "默认", done: !!game.engineRules, onOpen: go(setEngineOpen), panel: () => <EngineRulesPanel /> },
                  { id: "beauty", label: hub("beauty").label, en: "", hint: hub("beauty").hint, icon: IconSparkle, stat: "外观", done: true, onOpen: go(setBeautyOpen), panel: () => <SettingsPanel bare section="beauty" /> },
                  { id: "nav", label: hub("nav").label, en: "", hint: hub("nav").hint, icon: IconSparkle, stat: game.navTabs?.length ? "已自定" : "默认", done: !!game.navTabs?.length, onOpen: go(setNavEditOpen), panel: () => <NavTabsEditor /> },
                  { id: "book", label: hub("book").label, en: "", hint: hub("book").hint, icon: IconScroll, stat: n(bookN, "条"), done: bookN > 0, onOpen: go(setBookOpen), panel: () => <WorldBookPanel /> },
                ] },
                { id: "story", title: "剧情", scope: "条件达成即上演", tools: [
                  { id: "fixed", label: hub("fixed").label, en: "", hint: hub("fixed").hint, icon: IconFlag, stat: fixedN ? n(fixedN, "段") : "暂无", done: fixedN > 0, onOpen: go(setFixedOpen), panel: () => <FixedEventsPanel /> },
                  { id: "cg", label: hub("cg").label, en: "", hint: hub("cg").hint, icon: IconSparkle, stat: (game.cgs ?? []).length ? n((game.cgs ?? []).length, "张") : "暂无", done: (game.cgs ?? []).length > 0, onOpen: go(setCgEditOpen), panel: () => <CgPanel /> },
                  { id: "audio", label: hub("audio").label, en: "", hint: hub("audio").hint, icon: IconSparkle, stat: (game.audio ?? []).length ? n((game.audio ?? []).length, "条") : "暂无", done: (game.audio ?? []).length > 0, onOpen: go(setAudioOpen), panel: () => <AudioLibraryPanel /> },
                  { id: "faction", label: hub("faction").label, en: "", hint: hub("faction").hint, icon: IconUser, stat: (game.factions ?? []).length ? n((game.factions ?? []).length, "个") : "暂无", done: (game.factions ?? []).length > 0, onOpen: go(setFactionOpen), panel: () => <FactionsPanel /> },
                  { id: "timeline", label: hub("timeline").label, en: "", hint: hub("timeline").hint, icon: IconScroll, stat: (game.timeline ?? []).length ? n((game.timeline ?? []).length, "条") : "暂无", done: (game.timeline ?? []).length > 0, onOpen: go(setTimelineOpen), panel: () => <TimelinePanel onLeave={() => setEditorOpen(false)} /> },
                  { id: "end", label: hub("end").label, en: "", hint: hub("end").hint, icon: IconFlag, stat: endN ? n(endN, "个") : "暂无", done: endN > 0, onOpen: go(setEndingsOpen), panel: () => <EndingsPanel /> },
                ] },
                { id: "mod", title: "世界观", scope: "新局生效 · 可导出分享", tools: [
                  { id: "paths", label: hub("paths").label, en: "", hint: hub("paths").hint, icon: IconFlag, stat: lockedPathN ? `${lockedPathN} 未解锁` : `${allPaths.length} 已解锁`, done: lockedPathN > 0, onOpen: go(setModsOpen, false), panel: () => <PathUnlockPanel /> },
                  { id: "mods", label: hub("mods").label, en: "", hint: hub("mods").hint, icon: IconSparkle, stat: modWorld.chain[0].name.split(" ")[0], done: true, onOpen: go(setModsOpen, false), panel: () => <ModManagerPanel /> },
                ] },
              ]}
            />
              );
            })()}
          </Modal>
        );
      })()}


      {/* 固定事件 · 创作者预设剧本（满足条件后代码判定触发） */}
      {fixedOpen && (
        <Modal title="固定事件 · 剧本编排" onClose={() => setFixedOpen(false)}>
          <Suspense fallback={<PanelLoading />}><FixedEventsPanel /></Suspense>
        </Modal>
      )}

      {setOpen && <Modal title="设置" onClose={() => setSetOpen(false)}><SettingsPanel bare onBeauty={() => { setSetOpen(false); setBeautyOpen(true); }} /></Modal>}
      {beautyOpen && <Modal title="美化" onClose={() => setBeautyOpen(false)}><SettingsPanel bare section="beauty" /></Modal>}
      {cgOpen && (
        <Modal title="CG 图鉴" onClose={() => {
          setCgOpen(false);
          if (game.cgNew?.length) commitGame({ ...game, cgNew: [] });
        }}>
          <CgGallery />
        </Modal>
      )}
      {cgReveal && (() => {
        const cg = game.cgs?.find((item) => item.id === cgReveal.id);
        if (!cg) return null;
        return (
          <CgUnlockReveal
            cg={cg}
            extraCount={cgReveal.extra}
            reduced={typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches}
            onClose={() => setCgReveal(null)}
          />
        );
      })()}
      {audioOpen && (
        <Modal title="音频库 · BGM & 音效" onClose={() => setAudioOpen(false)}>
          <AudioLibraryPanel />
        </Modal>
      )}
      {cgEditOpen && (
        <Modal title="CG 图鉴编排" onClose={() => setCgEditOpen(false)}>
          <CgPanel />
        </Modal>
      )}

      {engineOpen && (
        <Modal title="底层世界规则" onClose={() => setEngineOpen(false)}>
          <EngineRulesPanel />
        </Modal>
      )}
      {factionOpen && (
        <Modal title="阵营派系" onClose={() => setFactionOpen(false)}>
          <FactionsPanel />
        </Modal>
      )}
      {timelineOpen && (
        <Modal title="主线复盘 · 时间线" onClose={() => setTimelineOpen(false)}>
          <TimelinePanel onLeave={() => setTimelineOpen(false)} />
        </Modal>
      )}

      {endingsOpen && (
        <Modal title="结局设定 · 多结局编排" onClose={() => setEndingsOpen(false)}>
          <EndingsPanel />
        </Modal>
      )}

      {/* 固定人物 · 新增 / 基础资料与常驻地点 / 性别 / 人设 / 说话口吻 */}
      {personOpen && (
        <Modal title="人物" onClose={() => setPersonOpen(false)}>
<FixedPersonPanel />
        </Modal>
      )}

      {/* AI 配置 */}
      {cfgOpen && (
        <Modal title="AI 配置" onClose={() => setCfgOpen(false)}>
          <AIConfigPanel />
        </Modal>
      )}

      {/* 存档管理：6 个手动存档位 + 自动存档 + 立即存档 */}
      {savesOpen && (
        <Modal title="存档管理" onClose={() => setSavesOpen(false)}>
          {/* 当前进度 + 立即存档（写入自动存档槽） */}
          <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-dashed border-jade/50 bg-jade/[0.05] p-3.5">
            <div className="min-w-0">
              <p className="text-[13.5px] font-bold text-ink">当前进度</p>
              <p className="truncate text-[11.5px] text-ink-soft">{game.world.time} · {game.world.location} · 第 {game.turnCount} 回合</p>
              {saveMsg === "ok" && <p className="mt-0.5 text-[11px] text-jade">已写入本地大容量存档</p>}
              {saveMsg === "fail" && <p className="mt-0.5 text-[11px] text-danger">存档失败：本地存储不可用</p>}
            </div>
            <button
              onClick={() => void quickSave()}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-br from-[var(--jade)] to-[var(--coral)] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(150,110,220,0.7)] transition hover:brightness-110"
            >
              <IconSave width={16} height={16} /> 立即存档
            </button>
          </div>

          {/* 自动存档开关 + 读取自动存档 */}
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-line bg-paper p-3.5">
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-ink">自动存档</p>
              <p className="truncate text-[11px] text-ink-soft">
                {autoSlot ? `${autoSlot.state.world.time} · 第 ${autoSlot.state.turnCount} 回合 · ${new Date(autoSlot.updatedAt).toLocaleString("zh-CN")}` : "每次行动后自动保存（防抖写入，不卡顿）"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {autoSlot && (
                <button onClick={() => { loadState(autoSlot.state); setSavesOpen(false); }} className="rounded-lg bg-jade px-3 py-1.5 text-xs font-medium text-paper-2 transition hover:brightness-110">
                  读取
                </button>
              )}
              <button
                onClick={() => setAutosaveOn(!autosaveOn)}
                aria-pressed={autosaveOn}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${autosaveOn ? "bg-jade" : "bg-line"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${autosaveOn ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>
          </div>

          {/* 6 个手动存档位 */}
          <p className="mb-2 px-0.5 text-[11px] font-bold tracking-[0.18em] text-ink-soft">手动存档位 · 共 {MAX_SLOTS} 位</p>
          <div className="space-y-2">
            {SLOT_IDS.map((id, i) => {
              const sv = saves.find((s) => s.id === id);
              const cur = !!sv && sv.state.id === game.id;
              const busySlot = savingId === id;
              return (
                <div key={id} className={`rounded-xl border p-3 ${cur ? "border-jade/60 bg-jade/[0.06]" : "border-line bg-paper"}`}>
                  <div className="flex items-center gap-3">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold ${cur ? "bg-jade text-paper-2" : "bg-paper-2 text-ink-soft"}`}>
                      {cur ? <IconPlay size={12} /> : i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      {editId === id ? (
                        <input
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") void commitRename(); if (e.key === "Escape") setEditId(null); }}
                          onBlur={() => void commitRename()}
                          className="w-full rounded-md border border-jade/60 bg-white px-2 py-1 text-[13px] font-bold text-ink outline-none"
                        />
                      ) : sv ? (
                        <>
                          <p className="truncate font-serif font-bold text-ink">{sv.name}</p>
                          <p className="text-[11px] text-ink-soft">
                            {sv.state.world.time} · 第 {sv.state.turnCount} 回合 · {new Date(sv.updatedAt).toLocaleString("zh-CN")}
                          </p>
                        </>
                      ) : (
                        <p className="text-[12.5px] italic text-ink-soft">空存档位</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-2.5 flex flex-wrap justify-end gap-1.5">
                    <button
                      disabled={busySlot}
                      onClick={() => void saveIntoSlot(id)}
                      className="rounded-lg bg-gradient-to-br from-[var(--jade)] to-[var(--coral)] px-3 py-1.5 text-xs font-medium text-white transition hover:brightness-110 disabled:opacity-50"
                    >
                      {sv ? "覆盖存档" : "存入此位"}
                    </button>
                    {sv && (
                      <>
                        <button onClick={() => { loadState(sv.state); setSavesOpen(false); }} className="rounded-lg bg-jade px-3 py-1.5 text-xs font-medium text-paper-2 transition hover:brightness-110">
                          读取存档
                        </button>
                        <button onClick={() => { setEditId(id); setEditName(sv.name); }} className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink-soft transition hover:border-jade hover:text-jade-deep">
                          重命名
                        </button>
                        <button onClick={() => void removeSlot(id)} className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink-soft transition hover:border-danger hover:text-danger">
                          删除
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>
      )}

      {/* 结束游戏 */}
      {endOpen && (
        <Modal title="要在这里落幕吗？" onClose={() => (busy ? undefined : setEndOpen(false))}>
          <p className="story-prose text-[14px] text-ink/90">
            每一段星路都会有谢幕的时刻。如果你觉得她的故事已经圆满，可以在此刻温柔地合上这本书——我会为她写下完整的生平后记。<br /><br />
            当然，你也可以继续走下去，把结局交给时间与命运——由 AI 判定结局。<br /><br />
            无论哪种方式，都会生成一篇<b>不少于 1000 字</b>的生平记事与后传，并给出评价这一生的<b>人生评级</b>（S+ ~ D）。
          </p>
          <div className="mt-5 flex gap-3">
            <button onClick={() => setEndOpen(false)} disabled={busy} className="flex-1 rounded-lg border border-line py-2.5 text-sm font-medium text-ink transition hover:bg-line/40 disabled:opacity-50">
              再陪她走走
            </button>
            <button onClick={() => void endManually()} disabled={busy} className="flex-1 rounded-lg bg-coral py-2.5 text-sm font-semibold text-paper-2 transition hover:brightness-110 disabled:opacity-60">
              {busy ? "落笔中…" : "温柔地结束"}
            </button>
          </div>
        </Modal>
      )}
    </div>
    </EntityProvider>
  );
}
