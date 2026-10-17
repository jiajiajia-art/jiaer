import EditorPanel from "./EditorPanel";
import IndustryPageHeader from "./IndustryPageHeader";
import { NpcFieldSettings } from "./NpcProfile";
import { useEffect, useState, type ReactNode } from "react";
import { useGame } from "../store/gameCtx";
import HomeTab from "./HomeTab";
import NpcTab from "./NpcTab";
import ActionsTab from "./ActionsTab";
import SimTab from "./SimTab";
import ImageTab from "./ImageTab";
import Phone from "./Phone";
import Finance from "./Finance";
import Works from "./Works";
import BreachDialog from "./BreachDialog";
import AIConfigPanel from "./AIConfigPanel";
import WorldRulesPanel from "./WorldRulesPanel";
import WorldBookPanel from "./WorldBookPanel";
import MapEditorPanel from "./MapEditorPanel";
import StoryQuestPanel from "./StoryQuestPanel";
import MudChrome, { MENU, BOTTOM_TAB_IDS, type MudTab } from "./MudChrome";
import ScheduleBoard from "./ScheduleBoard";
import { Avatar, Chip, Modal } from "./ui";
import { IconCamera, IconClock, IconFlag, IconHeart, IconMoon, IconPin, IconSave, IconScroll, IconSettings, IconSparkle, IconSun, IconUser, IconWallet } from "../lib/icons";
import { Segments } from "./StoryTab";
import { defaultWorldBook } from "../game/worldbook";
import { EntityProvider } from "./EntityText";
import { listManualSaves, saveToSlot, deleteSlot, renameSlot, getSlot, MAX_SLOTS, AUTO_SLOT_ID, type SaveSlot } from "../lib/store";

type Tab = MudTab;

/* 牌坊菜单每项的罗马音副标（仿明星养成游戏的中英双标签质感） */
const ROMAJI: Record<string, string> = {
  home: "SHIJIE", sim: "RENWU", image: "XINGXIANG", npc: "RENMAI", actions: "YULEQUAN", phone: "SHOUJI",
  works: "ZUOPIN", bag: "XINGNANG", finance: "CAIWU", theme: "MODE",
};

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
        <Icon width={19} height={19} />
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
  const { game, cfg, theme, setTheme, saveNow, loadState, endManually, popup, setPopup, busy, autosaveOn, setAutosaveOn } = useGame();
  const [tab, setTab] = useState<Tab>("home");
  const landscape = theme.orient === "landscape";
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
      // 「人物」以档案弹窗呈现；其余功能切到对应整屏界面
      if (dest === "sim") { setSimOpen(true); return; }
      setTab(dest);
      setSeen((p) => (p.has(dest) ? p : new Set(p).add(dest)));
    };
    window.addEventListener("star:navtab", onNav as EventListener);
    return () => window.removeEventListener("star:navtab", onNav as EventListener);
  }, [landscape]);
  const [saveMsg, setSaveMsg] = useState<"ok" | "fail" | null>(null);
  const [endOpen, setEndOpen] = useState(false);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [finOpen, setFinOpen] = useState(false);
  const [worksOpen, setWorksOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false); // 世界书（设定片段编辑）
  const [mapEditOpen, setMapEditOpen] = useState(false); // 地图编辑器（点位/背景/物件）
  const [storyOpen, setStoryOpen] = useState(false); // 剧情志（支线剧情 / 收藏 / 导出）
  const [npcFieldsOpen, setNpcFieldsOpen] = useState(false);
  const [setOpen, setSetOpen] = useState(false); // 游戏设置（皮肤 / 字体 / 版式）
  const [savesOpen, setSavesOpen] = useState(false); // 存档管理
  const [saves, setSaves] = useState<SaveSlot[]>([]); // 六个手动槽的当前内容
  const [autoSlot, setAutoSlot] = useState<SaveSlot | null>(null); // 自动存档
  const [editId, setEditId] = useState<string | null>(null); // 正在重命名的槽 id
  const [editName, setEditName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null); // 正在写入的槽（禁用按钮）
  const [schedOpen, setSchedOpen] = useState(false); // 本周日程板（全局弹窗，可从任意页直接唤出）
  const [simOpen, setSimOpen] = useState(false); // 人物档案（点左上角头像唤出的弹窗）
  // 「世界」页场景里的「本周日程」入口直接派发事件唤出，无需先跳到人物页
  useEffect(() => {
    const onSched = () => setSchedOpen(true);
    window.addEventListener("star:navschedule", onSched);
    return () => window.removeEventListener("star:navschedule", onSched);
  }, []);
  if (!game) return null;

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

  const toggleTheme = () => {
    const resolvedDark = theme.mode === "dark" || (theme.mode === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    setTheme({ ...theme, mode: resolvedDark ? "light" : "dark" });
  };
  const isDark = theme.mode === "dark" || (theme.mode === "auto" && typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches);

  const tabNode = (t: Tab): ReactNode =>
    t === "home" ? <HomeTab /> : t === "sim" ? <SimTab /> : t === "image" ? <ImageTab />
    : t === "npc" ? <NpcTab /> : t === "actions" ? <ActionsTab />
    : t === "quest" ? <div className="mx-auto max-w-2xl p-4"><StoryQuestPanel /></div> : t === "settings" ? <div className="mx-auto max-w-2xl p-4">{settingsContent}</div> : <Phone />;

  /* 功能入口统一切换主内容，保留底部导航。 */
  const openFeature = (t: Tab) => {
    if (t === "sim") { setSimOpen(true); return; }
    setTab(t);
    setSeen((p) => (p.has(t) ? p : new Set(p).add(t)));
  };

  const settingsContent = (
          <div className="space-y-4">
            <button onClick={() => setNpcFieldsOpen(true)} className="w-full rounded-lg border border-line p-3 text-left text-sm text-jade">编辑器 · NPC / 职业 / 世界 / 地图</button>
            {/* 皮肤选择：纸质 / 毛玻璃 / 可爱奢华 / 梦幻星紫 */}
            <div>
              <span className="flex items-baseline gap-1.5">
                <span className="text-[14px] font-bold leading-tight tracking-[0.06em] text-ink">界面皮肤</span>
                <span className="text-[9.5px] font-semibold tracking-[0.2em] text-ink-soft">SKIN</span>
              </span>
              <span className="mb-2 block text-[11px] text-ink-soft">整体视觉换肤，不改动布局</span>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {([
                  { id: "dream", label: "梦幻星紫", glyph: "✦", desc: "薰衣草糖霜" },
                  { id: "cute", label: "可爱奢华", glyph: "✿", desc: "蜜桃玫瑰金" },
                  { id: "glass", label: "毛玻璃", glyph: "❖", desc: "半透磨砂" },
                  { id: "paper", label: "纸质", glyph: "▤", desc: "古朴宣纸" },
                ] as const).map((sk) => {
                  const cur = (theme.skin ?? "dream") === sk.id;
                  return (
                    <button
                      key={sk.id}
                      onClick={() => setTheme({ ...theme, skin: sk.id })}
                      aria-pressed={cur}
                      className={`flex flex-col items-center gap-0.5 rounded-xl border px-1 py-2 text-center transition ${cur ? "border-white/70 bg-gradient-to-br from-[var(--jade)] to-[var(--coral)] text-white shadow-[0_6px_16px_-8px_rgba(150,110,220,0.7)]" : "border-line bg-paper text-ink-soft hover:border-jade/60"}`}
                    >
                      <span className="text-[17px] leading-none">{sk.glyph}</span>
                      <span className="text-[12px] font-semibold">{sk.label}</span>
                      <span className={`text-[10px] ${cur ? "text-white/80" : "opacity-70"}`}>{sk.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 字体选择：宋体 / 圆体 / 雅致 / 手写 */}
            <div>
              <span className="flex items-baseline gap-1.5">
                <span className="text-[14px] font-bold leading-tight tracking-[0.06em] text-ink">字体风格</span>
                <span className="text-[9.5px] font-semibold tracking-[0.2em] text-ink-soft">FONT</span>
              </span>
              <span className="mb-2 block text-[11px] text-ink-soft">整体换字，不改动排版</span>
              {/* 功能注释：预览字族用系统字体，避免依赖 fonts.googleapis.com */}
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {([
                  { id: "song", label: "典雅宋体", family: "'Songti SC', 'STSong', serif", desc: "沉稳端庄" },
                  { id: "round", label: "圆润可爱", family: "'PingFang SC', 'Hiragino Sans GB', sans-serif", desc: "软萌活泼" },
                  { id: "elegant", label: "清瘦雅致", family: "'Kaiti SC', 'STKaiti', serif", desc: "秀气文艺" },
                  { id: "brush", label: "手写毛笔", family: "'Kaiti SC', 'STKaiti', serif", desc: "洒脱写意" },
                ] as const).map((ft) => {
                  const cur = (theme.font ?? "song") === ft.id;
                  return (
                    <button
                      key={ft.id}
                      onClick={() => setTheme({ ...theme, font: ft.id })}
                      aria-pressed={cur}
                      className={`flex flex-col items-center gap-0.5 rounded-xl border px-1 py-2 text-center transition ${cur ? "border-white/70 bg-gradient-to-br from-[var(--jade)] to-[var(--coral)] text-white shadow-[0_6px_16px_-8px_rgba(150,110,220,0.7)]" : "border-line bg-paper text-ink-soft hover:border-jade/60"}`}
                    >
                      <span className="text-[19px] leading-none" style={{ fontFamily: ft.family }}>星</span>
                      <span className="text-[12px] font-semibold">{ft.label}</span>
                      <span className={`text-[10px] ${cur ? "text-white/80" : "opacity-70"}`}>{ft.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 版式方向：竖屏 / 横屏（橙光式） */}
            <div>
              <span className="flex items-baseline gap-1.5">
                <span className="text-[14px] font-bold leading-tight tracking-[0.06em] text-ink">版式方向</span>
                <span className="text-[9.5px] font-semibold tracking-[0.2em] text-ink-soft">LAYOUT</span>
              </span>
              <span className="mb-2 block text-[11px] text-ink-soft">竖屏专注阅读 · 横屏橙光式场景</span>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { id: "portrait", label: "竖屏", glyph: "▯", desc: "手机竖版" },
                  { id: "landscape", label: "横屏", glyph: "▭", desc: "橙光场景版" },
                ] as const).map((op) => {
                  const cur = (theme.orient ?? "portrait") === op.id;
                  return (
                    <button
                      key={op.id}
                      onClick={() => setTheme({ ...theme, orient: op.id })}
                      aria-pressed={cur}
                      className={`flex flex-col items-center gap-0.5 rounded-xl border px-1 py-2 text-center transition ${cur ? "border-white/70 bg-gradient-to-br from-[var(--jade)] to-[var(--coral)] text-white shadow-[0_6px_16px_-8px_rgba(150,110,220,0.7)]" : "border-line bg-paper text-ink-soft hover:border-jade/60"}`}
                    >
                      <span className="text-[17px] leading-none">{op.glyph}</span>
                      <span className="text-[12px] font-semibold">{op.label}</span>
                      <span className={`text-[10px] ${cur ? "text-white/80" : "opacity-70"}`}>{op.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
  );

  const activeMenu = MENU.find(m => m.id === tab);
  const PageIcon = activeMenu?.icon ?? IconScroll;
  const pageHeader = tab !== "home" && tab !== "phone" ? <IndustryPageHeader
    title={activeMenu?.label ?? "项目"}
    subtitle={({ actions: "星榜风云", npc: "圈中往来", quest: "支线与收藏", settings: "偏好与设定", phone: "掌上生活", image: "人设与舆情", sim: "人物资料" } as Record<string, string>)[tab] ?? ""}
    eyebrow={`STAR CITY WEEKLY · 第 ${game.sim.week} 周`}
    icon={<PageIcon width={22} height={22} />} flush={false} /> : null;

  const orientChosen = theme.orient === "portrait" || theme.orient === "landscape";

  return (
    <EntityProvider>
    {/* 首次进入 · 选择版式方向（之后可在菜单里随时改） */}
    {!orientChosen && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1a1226]/80 px-5 backdrop-blur-md" role="dialog" aria-modal="true">
        <div className="w-full max-w-md animate-pop rounded-[26px] border border-white/50 bg-gradient-to-b from-[#f3edff] to-[#f8ecf6] p-6 shadow-2xl">
          <p className="text-center text-[11px] font-bold tracking-[0.3em] text-ink-soft">LAYOUT · 选择你的观看方式</p>
          <h2 className="mt-1 text-center text-[19px] font-black text-ink">竖屏，还是横屏？</h2>
          <p className="mt-2 text-center text-[12.5px] leading-relaxed text-ink-soft">这决定她的故事如何在你眼前展开。之后可在「☰ 菜单 → 版式方向」里随时切换。</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {([
              { id: "portrait", glyph: "▯", label: "竖屏", desc: "手机竖版 · 专注阅读叙事", ratio: "h-24 w-14", locked: false },
              { id: "landscape", glyph: "▭", label: "横屏", desc: "横屏版本暂未开放", ratio: "h-14 w-24", locked: true },
            ] as const).map((op) => (
              <button
                key={op.id}
                onClick={() => !op.locked && setTheme({ ...theme, orient: op.id })}
                disabled={op.locked}
                aria-disabled={op.locked}
                className={`group relative flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition ${op.locked ? "cursor-not-allowed border-line/70 bg-slate-100/70 opacity-55 grayscale" : "border-line bg-white/70 hover:-translate-y-0.5 hover:border-jade hover:shadow-[0_12px_28px_-14px_rgba(150,110,220,0.7)]"}`}
              >
                {op.locked && <span className="absolute right-2 top-2 rounded-full bg-ink/10 px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">锁定</span>}
                <span className={`flex ${op.ratio} items-center justify-center rounded-xl border-2 border-line bg-gradient-to-br from-jade/15 to-coral/15 text-[22px] text-jade transition ${!op.locked ? "group-hover:border-jade" : ""}`}>{op.glyph}</span>
                <span className="text-[15px] font-bold text-ink">{op.label}</span>
                <span className="text-[11px] leading-snug text-ink-soft">{op.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )}
    {landscape && (
      /* ═══════════ 横屏 · 橙光式版式 ═══════════
         直接以真正的「世界」页（HomeTab）作为顶天立地的主场景，
         叠一层轻量悬浮操作栏，其余页签在主内容区切换。
         此壳覆盖在竖屏外壳之上；菜单(z-40)与弹窗(z-50)仍渲染其上，得以共用。 */
      <div className="mud-shell fixed inset-0 z-30 flex flex-col overflow-hidden bg-paper landscape-world">
        {/* 顶部柔光压暗：让悬浮 HUD 无论场景明暗都读得清（乙游惯用手法） */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-black/45 via-black/15 to-transparent" aria-hidden />
        {/* 悬浮顶栏：精致乙游式 HUD——名牌 + 世界状态 + 菜单，悬浮不占版面 */}
        {tab === "home" && <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start gap-2.5 px-4 py-3">
          {game.player && (
            <button onClick={() => setSimOpen(true)} aria-label="打开人物档案" className="pointer-events-auto group flex shrink-0 items-center gap-2.5 rounded-full border border-white/20 bg-black/30 py-1 pl-1 pr-4 shadow-lg backdrop-blur-md transition hover:border-gold/60 hover:bg-black/40">
              <span className="relative block">
                <span className="absolute -inset-[3px] rounded-xl bg-gradient-to-br from-gold via-[var(--coral)] to-[var(--jade)] opacity-90 blur-[2px]" aria-hidden />
                <span className="relative block rounded-xl bg-gradient-to-br from-gold to-[var(--coral)] p-[2px]">
                  <span className="block rounded-xl bg-paper-2 p-[1.5px]"><Avatar src={game.player.avatar} name={game.player.name} size={30} editable={false} /></span>
                </span>
              </span>
              <span className="text-left leading-tight">
                <span className="block font-serif text-[14px] font-black text-white drop-shadow">{game.player.name}</span>
                <span className="block text-[8.5px] font-bold uppercase tracking-[0.3em] text-gold/90">查看档案 ›</span>
              </span>
            </button>
          )}
          <div onClick={() => setSimOpen(true)} role="button" tabIndex={0} aria-label="打开人物档案" className="pointer-events-auto flex min-w-0 flex-1 cursor-pointer items-center gap-3 self-center rounded-full border border-white/18 bg-black/30 px-4 py-1.5 text-[12.5px] text-white/90 shadow-lg backdrop-blur-md transition hover:border-gold/60">
            <span className="flex items-center gap-1.5 font-medium"><IconClock width={14} height={14} className="text-gold" />{game.world.time}</span>
            <span className="h-3 w-px shrink-0 bg-white/25" aria-hidden />
            <span className="flex items-center gap-1.5"><IconPin width={14} height={14} className="text-coral" />{game.world.location}</span>
            {game.world.weather && <><span className="hidden h-3 w-px shrink-0 bg-white/25 sm:block" aria-hidden /><span className="hidden items-center gap-1.5 text-white/75 sm:flex"><IconSparkle width={13} height={13} className="text-gold" />{game.world.weather}</span></>}
            {game.sim && <span className={`ml-auto flex items-center gap-1 pl-2 font-semibold tabular-nums ${game.sim.money < 0 ? "text-danger" : "text-gold"}`}><span className="text-[11px] leading-none">¥</span>{(game.sim.money / 10000).toFixed(1)}万</span>}
          </div>
          <div className="pointer-events-auto flex items-center gap-1.5 self-center">
            <button onClick={() => setEndOpen(true)} aria-label="结束" className="rounded-full border border-white/18 bg-black/30 p-2 text-white/85 shadow-lg backdrop-blur-md transition hover:border-danger/60 hover:text-danger"><IconFlag width={16} height={16} /></button>
            <button onClick={() => setMenuOpen((v) => !v)} aria-label="菜单" className="flex items-center gap-1.5 rounded-full border border-white/18 bg-black/30 px-3 py-2 text-[13px] font-semibold text-white shadow-lg backdrop-blur-md transition hover:border-gold/60 hover:text-gold"><span className="text-[15px] leading-none">☰</span>菜单</button>
          </div>
        </header>}
        {pageHeader}

        <main className="relative min-h-0 flex-1">
          {Array.from(seen).map((id) => (
            <div key={id} className={`absolute inset-0 overflow-y-auto ${id === tab ? "" : "hidden"}`}>
              {tabNode(id)}
            </div>
          ))}
        </main>
        <MudChrome tab={tab} setTab={openFeature} />
      </div>
    )}
    <div className="mud-shell dream-game-shell paper-grain mx-auto flex h-screen h-[100dvh] w-full max-w-[560px] flex-col" aria-hidden={landscape}>
      {/* 顶部世界动态栏：点顶栏任意处即唤出人物档案（菜单/结束按钮各自保留原动作）。
          人脉 / 娱乐圈 / 手机 三个整屏页签下隐藏顶栏，把纵向空间全部让给内容，避免遮挡视线。 */}
      {tab === "home" && (
      <header
        onClick={() => setSimOpen(true)}
        className="dream-topbar relative z-20 shrink-0 cursor-pointer border-b border-line bg-gradient-to-b from-paper-2/90 via-paper-2/85 to-paper-2/90 shadow-[0_6px_18px_-14px_rgba(120,90,200,0.6)] backdrop-blur-xl"
      >
        {/* 柔光装饰 */}
        <div className="pointer-events-none absolute -left-8 -top-10 h-24 w-24 rounded-full bg-jade/30 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -right-6 -top-8 h-20 w-20 rounded-full bg-coral/30 blur-3xl" aria-hidden />
        {/* 底部渐变金线 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-line to-transparent" aria-hidden />
        <div className="relative w-full">
          {/* 统一控制台面板：上区 身份 + 操作，下区 世界状态终端读出栅格 */}
          {(() => {
            const parts = (game.world.time ?? "").split(" · ");
            const weekTxt = parts[0] ?? "";        // 「第 1 周」
            const weekNum = (weekTxt.match(/\d+/)?.[0] ?? "").padStart(2, "0"); // 「01」
            const dateTxt = parts.slice(1).join(" · ") || weekTxt; // 「2005.01.03 周一」
            return (
              <div className="overflow-hidden bg-paper-2/55 font-sans text-ink backdrop-blur-sm">
                {/* 上区：身份 + 操作 */}
                <div className="flex items-center gap-2.5 px-2.5 py-2">
                  {game.player && (
                    <button onClick={() => setSimOpen(true)} aria-label="打开人物档案" className="group flex min-w-0 shrink items-center gap-2 rounded-xl py-0.5 pl-0.5 pr-1.5 text-left transition hover:bg-paper-2/70">
                      <div className="relative shrink-0">
                        <div className="advance-halo absolute -inset-1 rounded-xl bg-gradient-to-br from-[var(--jade)] to-[var(--coral)] blur-[6px] opacity-60" aria-hidden />
                        <div className="relative rounded-xl bg-gradient-to-br from-[var(--jade)] to-[var(--coral)] p-[2px] shadow-[0_4px_12px_-4px_rgba(150,110,220,0.7)] transition group-hover:shadow-[0_6px_16px_-6px_rgba(150,110,220,0.85)]">
                          <div className="rounded-xl bg-paper-2 p-[1.5px]">
                            <Avatar src={game.player.avatar} name={game.player.name} size={36} editable={false} />
                          </div>
                        </div>
                      </div>
                      <div className="min-w-0 leading-tight">
                        <p className="flex items-baseline gap-1.5 truncate">
                          <span className="font-serif text-[15px] font-black tracking-wide text-jade-deep">{game.player.name}</span>
                          {game.player.age && <span className="rounded bg-jade/12 px-1.5 py-px text-[10px] font-bold tabular-nums text-jade">{game.player.age}</span>}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.22em] text-ink-soft transition group-hover:text-jade">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-gradient-to-br from-[var(--jade)] to-[var(--coral)]" />
                          查看档案 ›
                        </p>
                      </div>
                    </button>
                  )}

                  <div className="ml-auto flex shrink-0 items-center gap-1.5">
                    <button onClick={(e) => { e.stopPropagation(); setEndOpen(true); }} aria-label="结束游戏" className="rounded-lg border border-line bg-paper-2/70 p-1.5 text-ink-soft transition hover:border-danger/60 hover:text-danger">
                      <IconFlag width={15} height={15} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }} aria-label="牌坊菜单" aria-expanded={menuOpen} className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-bold transition ${menuOpen ? "border-transparent bg-gradient-to-r from-[var(--jade)] to-[var(--coral)] text-white" : "border-line bg-paper-2/70 text-jade-deep hover:bg-paper-2"}`}>
                      <span className="text-[14px] leading-none">☰</span>
                      <span className="hidden uppercase tracking-[0.2em] sm:inline">菜单</span>
                    </button>
                  </div>
                </div>

                {/* 下区：世界状态终端读出栅格（WK · DATE · LOC · WX · FUND） */}
                <div className="flex items-stretch border-t border-line bg-paper/35 font-[inherit]">
                  {weekNum && (
                    <span className="flex shrink-0 flex-col justify-center bg-gradient-to-br from-[var(--jade)] to-[var(--coral)] px-3 py-1.5 text-white">
                      <span className="text-[8.5px] font-bold uppercase leading-none tracking-[0.2em] text-white/75">周</span>
                      <span className="mt-1 text-[15px] font-bold leading-none tabular-nums">{weekNum}</span>
                    </span>
                  )}
                  <span className="flex min-w-0 flex-[1.4] flex-col justify-center border-l border-line/60 px-3 py-1.5">
                    <span className="text-[8.5px] font-bold uppercase leading-none tracking-[0.25em] text-jade/80">日期</span>
                    <span className="mt-1 truncate text-[12px] leading-none tabular-nums tracking-tight text-ink">{dateTxt}</span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col justify-center border-l border-line/60 px-3 py-1.5">
                    <span className="text-[8.5px] font-bold uppercase leading-none tracking-[0.25em] text-coral/80">地点</span>
                    <span className="mt-1 truncate text-[12px] leading-none text-ink">{game.world.location}</span>
                  </span>
                  {game.world.weather && (
                    <span className="flex shrink-0 flex-col justify-center border-l border-line/60 px-3 py-1.5">
                      <span className="text-[8.5px] font-bold uppercase leading-none tracking-[0.25em] text-gold/80">天气</span>
                      <span className="mt-1 truncate text-[12px] leading-none text-ink-soft">{game.world.weather}</span>
                    </span>
                  )}
                  {game.sim && (
                    <span className={`ml-auto flex shrink-0 flex-col justify-center border-l border-line/60 px-3 py-1.5 ${game.sim.money < 0 ? "bg-danger/10" : "bg-jade/[0.07]"}`}>
                      <span className={`text-[8.5px] font-bold uppercase leading-none tracking-[0.25em] ${game.sim.money < 0 ? "text-danger/80" : "text-jade/80"}`}>资产</span>
                      <span className={`mt-1 text-[12px] font-bold leading-none tabular-nums ${game.sim.money < 0 ? "text-danger" : "text-jade"}`}>¥{(game.sim.money / 10000).toFixed(1)}万</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
        {game.world.note && <p className="border-t border-line/60 bg-paper/50 px-4 py-1 text-center text-[11px] text-ink-soft">{game.world.note}</p>}
        {saveMsg === "ok" && <p className="bg-jade/12 px-4 py-1 text-center text-[11px] text-jade">已保存到本地存档</p>}
        {saveMsg === "fail" && <p className="bg-danger/12 px-4 py-1 text-center text-[11px] text-danger">保存失败：本地存储不可用，请检查浏览器权限或空间</p>}
      </header>
      )}

      {/* 牌坊菜单：右上角下拉，收纳全部牌位 */}
      {menuOpen && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
          <button aria-label="关闭菜单" onClick={() => setMenuOpen(false)} className="absolute inset-0 bg-[#2b2247]/40 backdrop-blur-[3px]" />
          <div className="absolute right-3 top-14 max-h-[calc(100dvh-5rem)] w-[min(21rem,calc(100vw-1.5rem))] animate-pop overflow-hidden rounded-[26px] border border-line bg-gradient-to-b from-paper-2/95 via-paper-2/92 to-paper-2/95 shadow-[0_28px_70px_-18px_rgba(120,90,200,0.65)] backdrop-blur-2xl">
            {/* 顶部柔光装饰 */}
            <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-coral/35 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -left-10 top-16 h-28 w-28 rounded-full bg-jade/35 blur-3xl" aria-hidden />

            <div className="relative max-h-[calc(100dvh-5rem)] overflow-y-auto px-3.5 py-3.5">
              {/* 标题 */}
              <div className="mb-2.5 flex items-center gap-2 px-1">
                <span className="text-[15px] text-coral">✿</span>
                <span className="text-[13px] font-black tracking-[0.18em] text-jade-deep">菜单</span>
                <span className="text-[10.5px] font-semibold tracking-[0.22em] text-ink-soft">MENU</span>
                <span className="ml-auto text-[12px] text-coral">❀</span>
              </div>

              {/* 主牌位 */}
              <div className="grid grid-cols-1 gap-1.5">
                {/* 底部已有的页面不在菜单重复展示。 */}
                {MENU.filter((m) => !BOTTOM_TAB_IDS.includes(m.id)).map((m) => (
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

              {/* 收藏册：作品 / 背包 / 财务 */}
              <div className="my-3 flex items-center gap-2 px-1">
                <span className="h-px flex-1 bg-gradient-to-r from-transparent to-line" />
                <span className="text-[10px] font-bold tracking-[0.24em] text-ink-soft">COLLECTION</span>
                <span className="h-px flex-1 bg-gradient-to-l from-transparent to-line" />
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                <MenuRow
                  icon={IconSave} label="存档管理" romaji="SAVE" hint="立即存档 · 读取 / 删除历史存档"
                  onClick={() => { openSaves(); setMenuOpen(false); }}
                  badge={`${game.turnCount} 回合`} badgeTone="jade"
                />
                <MenuRow
                  icon={IconScroll} label="我的作品" romaji={ROMAJI.works} hint="通告履历 · 作品库 · 出演角色"
                  onClick={() => { setWorksOpen(true); setMenuOpen(false); }}
                  badge={`${game.sim.works} 部 · ${game.sim.awards} 奖`} badgeTone="jade"
                />
                
                <MenuRow
                  icon={IconWallet} label="财务 · 支票账单" romaji={ROMAJI.finance} hint="周日结算 · 演艺进账与开销"
                  onClick={() => { setFinOpen(true); setMenuOpen(false); }}
                  badge={`¥${(game.sim.money / 10000).toFixed(1)}万`} badgeTone={game.sim.money < 0 ? "danger" : "jade"}
                />
              </div>

              <MenuRow icon={IconUser} label="编辑器" romaji="EDITOR" hint="NPC 属性与资料 · 职业库 · 世界规则 · 地图" onClick={() => { setNpcFieldsOpen(true); setMenuOpen(false); }} />
              {/* 设置 · 外观 */}
              <div className="my-3 flex items-center gap-2 px-1">
                <span className="h-px flex-1 bg-gradient-to-r from-transparent to-line" />
                <span className="text-[10px] font-bold tracking-[0.24em] text-ink-soft">SETTINGS</span>
                <span className="h-px flex-1 bg-gradient-to-l from-transparent to-line" />
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                <MenuRow
                  icon={isDark ? IconMoon : IconSun} label="暗色模式" romaji={ROMAJI.theme} hint="切换界面明暗，护眼夜读"
                  onClick={toggleTheme}
                  badge={isDark ? "已开启" : "已关闭"} badgeTone={isDark ? "jade" : "muted"}
                />



                <MenuRow
                  icon={IconSettings} label="AI 配置" romaji="MODEL" hint="接入模型 · API Key · 叙事引擎设置"
                  onClick={() => { setCfgOpen(true); setMenuOpen(false); }}
                  badge={cfg?.apiKey ? "已接入" : "未配置"} badgeTone={cfg?.apiKey ? "jade" : "muted"}
                />
                
              </div>
            </div>
          </div>
        </div>
      )}

      {pageHeader}
      {/* 内容区：各功能封装为独立整屏界面，常驻挂载、切换保留状态 */}
      <main className="relative min-h-0 flex-1">
        <div className={`absolute inset-0 ${tab === "home" ? "" : "hidden"}`}>{seen.has("home") && <HomeTab />}</div>
        <div className={`absolute inset-0 overflow-y-auto ${tab === "image" ? "" : "hidden"}`}>{seen.has("image") && <ImageTab />}</div>
        <div className={`absolute inset-0 overflow-y-auto ${tab === "npc" ? "" : "hidden"}`}>{seen.has("npc") && <NpcTab />}</div>
        <div className={`absolute inset-0 overflow-y-auto ${tab === "actions" ? "" : "hidden"}`}>{seen.has("actions") && <ActionsTab />}</div>
        <div className={`absolute inset-0 overflow-y-auto ${tab === "phone" ? "" : "hidden"}`}>{seen.has("phone") && <Phone />}</div>
        <div className={`absolute inset-0 overflow-y-auto ${tab === "quest" ? "" : "hidden"}`}>{seen.has("quest") && <div className="mx-auto max-w-2xl p-4"><StoryQuestPanel /></div>}</div>
        <div className={`absolute inset-0 overflow-y-auto ${tab === "settings" ? "" : "hidden"}`}>{seen.has("settings") && <div className="mx-auto max-w-2xl p-4">{settingsContent}</div>}</div>
      </main>

      {/* 底部时辰盘 · 石牌导航 */}
      <MudChrome tab={tab} setTab={openFeature}  />

      {npcFieldsOpen && <Modal title="编辑器" onClose={() => setNpcFieldsOpen(false)} wide><EditorPanel /></Modal>}
      {/* 通用行动结果弹窗 */}
      {popup && (
        <Modal title={popup.title} onClose={() => setPopup(null)}>
          <Segments segments={popup.segments} npcs={game.npcs} playerAvatar={game.player.avatar} playerName={game.player.name} />
          {popup.changes.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
              {popup.changes.map((c, i) => (
                <Chip key={i} tone={/(-|敌意|压力)/.test(c) ? "danger" : "jade"}>{c}</Chip>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* 本周日程板：全局弹窗，从「世界」页入口直接唤出 */}
      <ScheduleBoard open={schedOpen} onClose={() => setSchedOpen(false)} />

      {/* 人物档案：点左上角头像唤出（原「人物」页内容，现以弹窗呈现） */}
      {simOpen && (
        <Modal title="人物档案" onClose={() => setSimOpen(false)} wide>
          <SimTab />
        </Modal>
      )}

      {/* 我的作品 */}
      {worksOpen && <Works onClose={() => setWorksOpen(false)} />}

      {/* 财务 · 支票与账单 */}
      {finOpen && <Finance onClose={() => setFinOpen(false)} />}

      {/* 逾期违约 · 制片人上门追责（挂起时强制处理，须赔付违约金了结） */}
      {game?.sim.breach && <BreachDialog />}

      {/* 世界规则 · 社会规则设定 */}
      {rulesOpen && (
        <Modal title="世界规则 · 社会规则" onClose={() => setRulesOpen(false)} wide>
          <WorldRulesPanel />
        </Modal>
      )}

      {/* 世界书 · 设定片段 */}
      {bookOpen && (
        <Modal title="世界书 · 设定片段" onClose={() => setBookOpen(false)} wide>
          <WorldBookPanel />
        </Modal>
      )}

      {/* 地图编辑器 · 点位 / 背景 / 物件 */}
      {mapEditOpen && (
        <Modal title="地图编辑器 · 点位与物件" onClose={() => setMapEditOpen(false)} wide>
          <MapEditorPanel />
        </Modal>
      )}

      {/* 剧情志 · 支线剧情 / 收藏 / 导出 */}
      {storyOpen && (
        <Modal title="剧情志 · 支线与收藏" onClose={() => setStoryOpen(false)} wide>
          <StoryQuestPanel />
        </Modal>
      )}

      {/* AI 配置 */}
      {cfgOpen && (
        <Modal title="AI 配置" onClose={() => setCfgOpen(false)} wide>
          <AIConfigPanel />
        </Modal>
      )}

      {/* 存档管理：6 个手动存档位 + 自动存档 + 立即存档 */}
      {savesOpen && (
        <Modal title="存档管理" onClose={() => setSavesOpen(false)} wide>
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
                      {cur ? "▶" : i + 1}
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

      {/* 游戏设置：界面皮肤 / 字体风格 / 版式方向 */}
      {setOpen && (
        <Modal title="游戏设置" onClose={() => setSetOpen(false)} wide>
          {settingsContent}
          <div className="mt-4 border-t border-line pt-4">
            <h3 className="mb-2 text-sm font-bold text-ink">存档与世界设定</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <button onClick={() => { setSetOpen(false); openSaves(); }} className="rounded-lg border border-line bg-paper px-3 py-2 text-left text-sm text-ink hover:border-jade"><span className="block font-semibold">存档管理</span><span className="text-[11px] text-ink-soft">自动存档、手动存档、读取与删除</span></button>
              <button onClick={() => { setSetOpen(false); setBookOpen(true); }} className="rounded-lg border border-line bg-paper px-3 py-2 text-left text-sm text-ink hover:border-jade"><span className="block font-semibold">自定义世界书</span><span className="text-[11px] text-ink-soft">添加规则片段、关键词和背景设定</span></button>
              <button onClick={() => { setSetOpen(false); setRulesOpen(true); }} className="rounded-lg border border-line bg-paper px-3 py-2 text-left text-sm text-ink hover:border-jade"><span className="block font-semibold">世界规则与重复惩罚</span><span className="text-[11px] text-ink-soft">调整社会规则、行为后果和重复行为惩罚</span></button>
              <button onClick={() => { setSetOpen(false); setMapEditOpen(true); }} className="rounded-lg border border-line bg-paper px-3 py-2 text-left text-sm text-ink hover:border-jade"><span className="block font-semibold">地图与场景</span><span className="text-[11px] text-ink-soft">编辑地点、背景图、物件和剧情事件</span></button>
            </div>
          </div>
        </Modal>
      )}

      {/* 结束游戏 */}
      {endOpen && (
        <Modal title="要在这里落幕吗？" onClose={() => (busy ? undefined : setEndOpen(false))}>
          <p className="story-prose text-[14px] text-ink/90">
            每一段星路都会有谢幕的时刻。如果你觉得她的故事已经圆满，可以在此刻温柔地合上这本书——我会为她写下完整的生平后记。<br /><br />
            当然，你也可以继续走下去，把结局交给时间与命运去判定。
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
