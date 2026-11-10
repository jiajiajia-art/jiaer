/* App Store 可下载的实用小组件：番茄钟 / 闹钟时钟 / 计算器 / 备忘录 / 天气。全部真实可用，纯本地。 */
import { loadData, saveData } from "../../lib/saveScope";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useGame } from "../../store/gameCtx";
import { useGameNow } from "./Widgets";
import { weekdayName, dayParts } from "../../game/logic";
import { IconPlus, IconClose, IconClock, IconSun, IconSearch } from "./icons";
import { IconChevronDown, IconChevronUp } from "../../lib/icons";
import { liveTerm as T } from "../../mods/live";
import Studio, { PlayerApps } from "./studio/Studio";
import { takeStudioRequest } from "./studio/review";

export type StoreItem = {
  id: string;
  label: string;
  tagline: string;
  desc: string;
  icon: ReactNode;
  cat: string;
  rating: number;
  size: string;
  cover: string;
  kicker: string;
  story: string;
  kind?: "app" | "widget";
  core?: boolean;
  /** 功能注释：平台应用作者展示名 */
  authorName?: string;
};

export type IconApp = { id: string; label: string; node: ReactNode };

function AppsTabGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="7" cy="7" r="3.2" /><circle cx="17" cy="7" r="3.2" /><circle cx="7" cy="17" r="3.2" /><circle cx="17" cy="17" r="3.2" />
    </svg>
  );
}
function IconsTabGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="4" y="4" width="7" height="7" rx="2.2" /><rect x="13" y="4" width="7" height="7" rx="2.2" />
      <rect x="4" y="13" width="7" height="7" rx="2.2" /><path d="M16.5 13.5v6M13.5 16.5h6" strokeLinecap="round" />
    </svg>
  );
}

/* —— 应用商店：仿 Apple App Store（今天 / App / 图标 / 搜索 四 Tab + 底部标签栏） —— */
export function AppStoreApp({ onBack, catalog, installed, onInstall, onOpen, iconApps, iconOverrides, onSetIcon }: {
  onBack: () => void; catalog: StoreItem[]; installed: Set<string>;
  onInstall: (id: string) => void; onOpen: (id: string) => void;
  iconApps: IconApp[]; iconOverrides: Record<string, string>; onSetIcon: (id: string, url: string | null) => void;
}) {
  const storeNow = useGameNow();
  const [downloading, setDownloading] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<StoreTab>("today");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<StoreItem | null>(null);
  const [jump] = useState(takeStudioRequest);
  const [studio, setStudio] = useState(!!jump);
  const [studioInit, setStudioInit] = useState(jump ?? undefined);
  // 其它页面请求跳转到开发者工坊
  useEffect(() => {
    const h = () => { const r = takeStudioRequest(); setStudioInit(r ?? undefined); setStudio(true); };
    window.addEventListener("studio:open", h);
    return () => window.removeEventListener("studio:open", h);
  }, []);
  const { game } = useGame();

  const pickIcon = (id: string, f: File | undefined) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => onSetIcon(id, String(r.result));
    r.readAsDataURL(f);
  };

  const getIt = (id: string) => {
    let v = 0;
    setDownloading((d) => ({ ...d, [id]: 0 }));
    const t = setInterval(() => {
      v += 0.2;
      if (v >= 1) {
        clearInterval(t);
        setDownloading((d) => { const { [id]: _drop, ...rest } = d; return rest; });
        onInstall(id);
      } else {
        setDownloading((d) => ({ ...d, [id]: v }));
      }
    }, 160);
  };

  const Pill = ({ id, kind }: { id: string; kind?: "app" | "widget" }) => {
    const dl = downloading[id];
    const cls = "shrink-0 whitespace-nowrap rounded-full bg-[#e9e9ef] px-5 py-1.5 text-[13px] font-bold text-[#0a84ff]";
    if (installed.has(id)) return <button onClick={(e) => { e.stopPropagation(); onOpen(id); }} className={cls}>{kind === "widget" ? "已添加" : "打开"}</button>;
    if (dl != null) return (
      <span className="relative flex h-8 w-8 items-center justify-center">
        <svg width="30" height="30" className="-rotate-90"><circle cx="15" cy="15" r="12" fill="none" stroke="#dcdce2" strokeWidth="2.5" /><circle cx="15" cy="15" r="12" fill="none" stroke="#0a84ff" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={2 * Math.PI * 12} strokeDashoffset={2 * Math.PI * 12 * (1 - dl)} /></svg>
        <span className="absolute h-2.5 w-2.5 rounded-[1px] bg-[#0a84ff]" />
      </span>
    );
    return <button onClick={(e) => { e.stopPropagation(); getIt(id); }} className={cls}>获取</button>;
  };

  /* App 列表行 */
  const Row = ({ item }: { item: StoreItem }) => (
    <div role="button" tabIndex={0} onClick={() => setDetail(item)} className="flex cursor-pointer items-center gap-3 py-2.5 transition active:opacity-60">
      <span className="ios-icon block h-[58px] w-[58px] shrink-0 overflow-hidden">{item.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-ink">{item.label}</p>
        <p className="truncate text-[12.5px] text-ink-soft">{item.tagline}</p>
        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-soft/80">
          {item.cat} · {item.authorName || item.size}
        </p>
      </div>
      <span className="shrink-0"><Pill id={item.id} kind={item.kind} /></span>
    </div>
  );

  const results = catalog.filter((c) => !q || c.label.includes(q) || c.tagline.includes(q) || c.cat.includes(q));

  /* App 详情页：仿真 iOS App Store 产品页 */
  if (detail) {
    return <AppDetail item={detail} pill={<Pill id={detail.id} kind={detail.kind} />} onBack={() => setDetail(null)} backLabel={tab === "today" ? "今天" : tab === "search" ? "搜索" : "App"} />;
  }

  return (
    <div className="relative flex h-full flex-col bg-white">
      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto pb-20">
        {tab === "today" && (
          <div>
            <StoreHeader title="今天" kicker={storeNow.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })} onClose={onBack} />
            {/* 编辑精选大卡 */}
            <div className="space-y-4 px-4 pt-2">
              <PlayerApps variant="today" />
              {catalog.map((item) => (
                <div key={item.id} role="button" tabIndex={0} onClick={() => setDetail(item)} className="cursor-pointer transition active:scale-[0.98] overflow-hidden rounded-[18px] bg-white shadow-[0_2px_20px_rgba(0,0,0,0.1)] ring-1 ring-black/[0.04]">
                  <div className="relative h-52">
                    <img src={(item.cover) || undefined} alt={item.label} className="h-full w-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-transparent" />
                    <div className="absolute left-4 top-3 text-white drop-shadow">
                      <p className="text-[12px] font-bold uppercase tracking-widest text-white/85">{item.kicker}</p>
                      <p className="mt-0.5 max-w-[70%] text-[24px] font-extrabold leading-tight">{item.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-3.5 py-3">
                    <span className="ios-icon block h-14 w-14 shrink-0 overflow-hidden">{item.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold text-ink">{item.label}</p>
                      <p className="truncate text-[12.5px] text-ink-soft">{item.tagline}</p>
                    </div>
                    <Pill id={item.id} kind={item.kind} />
                  </div>
                  <p className="border-t border-black/[0.06] px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-soft">{item.story}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "apps" && (
          <div>
            <StoreHeader title="App" kicker="当前作品已装上的应用" onClose={onBack} />
            {/* 功能注释：App 页只列当前作品已装平台应用，行内显示作者名 */}
            <p className="px-4 pb-0 pt-3 text-[18px] font-bold text-ink">已安装</p>
            <div className="mx-4 divide-y divide-black/[0.06]">
              {catalog.filter((c) => c.core && installed.has(c.id)).length === 0 ? (
                <button
                  type="button"
                  className="w-full py-10 text-center text-[14px] font-semibold text-[#0a84ff]"
                  onClick={() => setTab("today")}
                >
                  去应用商店安装
                </button>
              ) : (
                catalog.filter((c) => c.core && installed.has(c.id)).map((item) => <Row key={item.id} item={item} />)
              )}
            </div>
            <p className="px-4 pb-0 pt-4 text-[18px] font-bold text-ink">效率与实用工具</p>
            <div className="mx-4 divide-y divide-black/[0.06]">
              {catalog.filter((c) => !c.core && c.kind !== "widget").map((item) => <Row key={item.id} item={item} />)}
            </div>
            <p className="px-4 pb-0 pt-4 text-[18px] font-bold text-ink">桌面美化小组件</p>
            <p className="px-4 text-[12.5px] text-ink-soft">添加后出现在主屏首页顶部，可放照片、便签、时钟、音乐</p>
            <div className="mx-4 divide-y divide-black/[0.06]">
              {catalog.filter((c) => c.kind === "widget").map((item) => <Row key={item.id} item={item} />)}
            </div>
            <PlayerApps variant="list" />
          </div>
        )}

        {tab === "icons" && (
          <div>
            <StoreHeader title="图标" kicker="上传图片替换主屏图标，可随时还原" onClose={onBack} />
            <div className="mx-4 divide-y divide-black/[0.06]">
              {iconApps.length === 0 && <p className="py-10 text-center text-[13px] text-ink-soft">还没有已安装的应用</p>}
              {iconApps.map((a) => {
                const custom = iconOverrides[a.id];
                return (
                  <div key={a.id} className="flex items-center gap-3 py-2.5">
                    <span className="ios-icon block h-[54px] w-[54px] shrink-0 overflow-hidden">
                      {custom ? <img src={(custom) || undefined} alt={a.label} className="h-full w-full object-cover" /> : a.node}
                    </span>
                    <span className="flex-1 text-[15px] font-medium text-ink">{a.label}</span>
                    {custom && <button onClick={() => onSetIcon(a.id, null)} className="rounded-full bg-[#e9e9ef] px-3.5 py-1.5 text-[12.5px] font-semibold text-ink-soft">还原</button>}
                    <label className="cursor-pointer rounded-full bg-[#e9e9ef] px-4 py-1.5 text-[12.5px] font-bold text-[#0a84ff]">
                      更换<input type="file" accept="image/*" className="hidden" onChange={(e) => pickIcon(a.id, e.target.files?.[0])} />
                    </label>
                  </div>
                );
              })}
            </div>
            <p className="px-4 pt-5 text-center text-[11.5px] text-ink-soft/70">自定义图标仅存于本机</p>
          </div>
        )}

        {tab === "search" && (
          <div>
            <StoreHeader title="搜索" onClose={onBack} />
            <div className="px-4">
              <div className="flex items-center gap-1.5 rounded-[10px] bg-black/[0.06] px-2.5 py-2 text-[15px] text-ink-soft">
                <IconSearch size={17} /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="游戏、App 及更多内容" className="w-full bg-transparent outline-none placeholder:text-ink-soft/70" />
                {q && <button onClick={() => setQ("")} className="text-ink-soft"><IconClose size={16} /></button>}
              </div>
            </div>
            <div className="mx-4 mt-2 divide-y divide-black/[0.06]">
              {results.length === 0 && <p className="py-10 text-center text-[13px] text-ink-soft">没有找到「{q}」相关内容</p>}
              {results.map((item) => <Row key={item.id} item={item} />)}
            </div>
          </div>
        )}
      </div>

      <StoreTabBar active={tab} onChange={setTab} />
      {/* 悬浮小珠：只活在应用商店里，退出商店即消失 */}
      {studio && <Studio key={studioInit?.id ?? "list"} initial={studioInit} onClose={() => setStudio(false)} developer={game?.player.name ?? ""} />}
    </div>
  );
}
/* —— 应用商店顶部：大标题 + 灰色副标 + 右侧圆形关闭（四个 Tab 共用同一版式） —— */
function StoreHeader({ title, kicker, onClose }: { title: string; kicker?: string; onClose: () => void }) {
  return (
    <header className="flex items-end justify-between gap-3 px-4 pb-2 pt-4">
      <div className="min-w-0">
        {kicker && <p className="truncate text-[12px] font-semibold uppercase tracking-wide text-ink-soft/70">{kicker}</p>}
        <h1 className="text-[32px] font-bold leading-[1.1] tracking-tight text-ink">{title}</h1>
      </div>
      <button onClick={onClose} aria-label="关闭应用商店" className="mb-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black/[0.06] text-ink-soft transition active:scale-90">
        <IconClose size={15} />
      </button>
    </header>
  );
}

/* —— 应用商店底部标签栏：毛玻璃底 + 选中蓝色，独立封装便于复用 —— */
type StoreTab = "today" | "apps" | "icons" | "search";
const STORE_TABS: { id: StoreTab; label: string; icon: ReactNode }[] = [
  { id: "today", label: "今天", icon: <IconSun size={22} /> },
  { id: "apps", label: "App", icon: <AppsTabGlyph /> },
  { id: "icons", label: "图标", icon: <IconsTabGlyph /> },
  { id: "search", label: "搜索", icon: <IconSearch size={22} /> },
];
function StoreTabBar({ active, onChange }: { active: StoreTab; onChange: (t: StoreTab) => void }) {
  return (
    <nav className="absolute inset-x-0 bottom-0 z-20 flex items-stretch border-t border-black/[0.08] bg-[#f9f9f9]/90 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
      {STORE_TABS.map((t) => {
        const on = active === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} aria-current={on ? "page" : undefined} className={`flex flex-1 flex-col items-center gap-0.5 pb-1 pt-1.5 text-[10px] font-medium transition-colors ${on ? "text-[#0a84ff]" : "text-[#8e8e93]"}`}>
            <span className="grid h-6 place-items-center">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function Head({ title, onBack, tint = "#111", light }: { title: string; onBack: () => void; tint?: string; light?: boolean }) {
  return (
    <div className={`flex items-center px-3 py-2.5 ${light ? "text-white" : "text-ink"}`} >
      <button onClick={onBack} className="flex w-16 items-center text-[15px]" style={{ color: light ? "rgba(255,255,255,.85)" : tint }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 5-7 7 7 7" /></svg>主屏
      </button>
      <span className="flex-1 text-center text-[16px] font-semibold">{title}</span>
      <span className="w-16" />
    </div>
  );
}

/* —— 番茄钟状态：持久化到 localStorage，按 Date.now() 推算剩余，离开 App 仍计时 —— */
const POMO_KEY = "star2005.phone.pomodoro";
const POMO_WORK = 25 * 60, POMO_BREAK = 5 * 60;
type PomoState = { mode: "work" | "break"; running: boolean; endsAt: number | null; left: number; rounds: number };
const pomoDur = (m: "work" | "break") => (m === "work" ? POMO_WORK : POMO_BREAK);
function loadPomo(): PomoState {
  return loadData<PomoState>(POMO_KEY, { mode: "work", running: false, endsAt: null, left: POMO_WORK, rounds: 0 });
}
function savePomo(p: PomoState) { saveData(POMO_KEY, p); }
/** 若已到点则推进阶段（专注完成 → 轮数+1、切到休息）。返回 [新状态, 完成的阶段或 null] */
function settlePomo(p: PomoState): [PomoState, "work" | "break" | null] {
  if (!p.running || p.endsAt == null || Date.now() < p.endsAt) return [p, null];
  const next: "work" | "break" = p.mode === "work" ? "break" : "work";
  return [{ mode: next, running: false, endsAt: null, left: pomoDur(next), rounds: p.rounds + (p.mode === "work" ? 1 : 0) }, p.mode];
}
const pomoLeft = (p: PomoState) => (p.running && p.endsAt != null ? Math.max(0, Math.ceil((p.endsAt - Date.now()) / 1000)) : p.left);

/* —— 番茄钟：25/5 循环，圆环进度，开始/暂停/重置 —— */
export function PomodoroApp({ onBack }: { onBack: () => void }) {
  const WORK = POMO_WORK, BREAK = POMO_BREAK;
  const [st, setSt] = useState<PomoState>(() => { const [p, done] = settlePomo(loadPomo()); if (done) savePomo(p); return p; });
  const [, tick] = useState(0);
  const update = (p: PomoState) => { savePomo(p); setSt(p); };
  const { mode, running, rounds } = st;
  const left = pomoLeft(st);
  const total = mode === "work" ? WORK : BREAK;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      const [p, done] = settlePomo(loadPomo());
      if (done) update(p); else tick((n) => n + 1);
    }, 500);
    return () => clearInterval(t);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  const setMode = (m: "work" | "break") => update({ ...st, mode: m, running: false, endsAt: null, left: pomoDur(m) });
  const toggle = () => update(running ? { ...st, running: false, endsAt: null, left } : { ...st, running: true, endsAt: Date.now() + left * 1000 });
  const reset = () => update({ ...st, running: false, endsAt: null, left: total });
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const pct = 1 - left / total;
  const R = 92, C = 2 * Math.PI * R;
  const accent = mode === "work" ? "#ff5a5f" : "#22b07d";

  return (
    <div className="flex h-full flex-col" style={{ background: "linear-gradient(160deg,#1c1024,#2a1530)" }}>
      <Head title="番茄钟" onBack={onBack} light />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-white">
        <div className="flex gap-2">
          {(["work", "break"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`rounded-full px-4 py-1 text-[13px] ${mode === m ? "font-semibold text-white" : "text-white/50"}`}
              style={mode === m ? { background: accent } : { background: "rgba(255,255,255,.08)" }}>
              {m === "work" ? "专注 25:00" : "休息 05:00"}
            </button>
          ))}
        </div>
        <div className="relative flex h-[220px] w-[220px] items-center justify-center">
          <svg width="220" height="220" className="-rotate-90">
            <circle cx="110" cy="110" r={R} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="10" />
            <circle cx="110" cy="110" r={R} fill="none" stroke={accent} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: "stroke-dashoffset 1s linear" }} />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-[52px] font-thin tabular-nums tracking-tight">{mm}:{ss}</span>
            <span className="text-[12px] text-white/60">已完成 {rounds} 个番茄</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={reset} className="h-12 w-12 rounded-full bg-white/10 text-[13px]">重置</button>
          <button onClick={toggle} className="h-16 w-16 rounded-full text-[15px] font-semibold text-white shadow-lg" style={{ background: accent }}>
            {running ? "暂停" : "开始"}
          </button>
          <button onClick={() => update({ mode: "work", running: false, endsAt: null, left: WORK, rounds: 0 })} className="h-12 w-12 rounded-full bg-white/10 text-[12px]">清零</button>
        </div>
      </div>
    </div>
  );
}

/* —— 时钟 / 闹钟：游戏内走时 + 可增删闹钟（本地留存） —— */
type Alarm = { id: string; h: number; m: number; on: boolean; label: string };
const ALARM_KEY = "star2005.phone.alarms";
export function ClockApp({ onBack }: { onBack: () => void }) {
  const now = useGameNow(); // 游戏内时间：闹钟按星城钟点响
  const [tab, setTab] = useState<"clock" | "alarm">("clock");
  const [alarms, setAlarms] = useState<Alarm[]>(() => {
    return loadData<Alarm[]>(ALARM_KEY, [{ id: "a1", h: 7, m: 30, on: true, label: `早${T("gig")}` }, { id: "a2", h: 23, m: 0, on: false, label: "休息" }]);
  });
  const [draft, setDraft] = useState({ h: 8, m: 0 });
  const [adding, setAdding] = useState(false);

  useEffect(() => { saveData(ALARM_KEY, alarms); }, [alarms]);

  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const secAngle = now.getSeconds() * 6, minAngle = now.getMinutes() * 6 + now.getSeconds() * 0.1, hrAngle = (now.getHours() % 12) * 30 + now.getMinutes() * 0.5;

  return (
    <div className="relative flex h-full flex-col bg-black text-white">
      <Head title="时钟" onBack={onBack} light />
      <div className="flex px-4 pb-1 text-[14px]">
        {(["clock", "alarm"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`mr-4 pb-1 ${tab === t ? "border-b-2 border-orange-400 font-semibold" : "text-white/50"}`}>{t === "clock" ? "时钟" : "闹钟"}</button>
        ))}
      </div>

      {tab === "clock" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-8">
          {/* 指针表盘 */}
          <div className="relative h-48 w-48 rounded-full border-2 border-white/15">
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={i} className="absolute left-1/2 top-1/2 h-2.5 w-[2px] -translate-x-1/2 bg-white/40" style={{ transform: `rotate(${i * 30}deg) translateY(-88px)` }} />
            ))}
            <span className="absolute left-1/2 top-1/2 h-[52px] w-[3px] -translate-x-1/2 origin-bottom rounded bg-white" style={{ transform: `translateY(-52px) rotate(${hrAngle}deg)`, transformOrigin: "bottom center" }} />
            <span className="absolute left-1/2 top-1/2 h-[70px] w-[2px] -translate-x-1/2 origin-bottom rounded bg-white" style={{ transform: `translateY(-70px) rotate(${minAngle}deg)`, transformOrigin: "bottom center" }} />
            <span className="absolute left-1/2 top-1/2 h-[76px] w-[1.5px] -translate-x-1/2 origin-bottom rounded bg-orange-400" style={{ transform: `translateY(-76px) rotate(${secAngle}deg)`, transformOrigin: "bottom center" }} />
            <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-400" />
          </div>
          <div className="text-center">
            <p className="text-[46px] font-thin tabular-nums tracking-tight">{hh}:{mm}<span className="text-[24px] text-white/50">:{ss}</span></p>
            <p className="text-[13px] text-white/55">{now.getFullYear()} 年 {now.getMonth() + 1} 月 {now.getDate()} 日</p>
          </div>
        </div>
      )}

      {tab === "alarm" && (
        <div className="flex-1 overflow-y-auto">
          <div className="flex justify-end px-4 py-2">
            <button onClick={() => setAdding(true)} className="text-orange-400"><IconPlus size={22} /></button>
          </div>
          {alarms.length === 0 && <p className="py-10 text-center text-[13px] text-white/50">还没有闹钟，点右上「＋」添加。</p>}
          {alarms.map((a) => (
            <div key={a.id} className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              <div className="flex-1">
                <p className="text-[34px] font-thin tabular-nums">{String(a.h).padStart(2, "0")}:{String(a.m).padStart(2, "0")}</p>
                <p className="text-[12px] text-white/55">{a.label || "闹钟"}</p>
              </div>
              <button onClick={() => setAlarms((l) => l.map((x) => x.id === a.id ? { ...x, on: !x.on } : x))} className={`relative h-[26px] w-[42px] rounded-full transition-colors ${a.on ? "bg-[#34c759]" : "bg-white/20"}`}>
                <span className={`absolute top-[2px] h-[22px] w-[22px] rounded-full bg-white shadow transition-all ${a.on ? "left-[18px]" : "left-[2px]"}`} />
              </button>
              <button onClick={() => setAlarms((l) => l.filter((x) => x.id !== a.id))} className="text-white/40"><IconClose size={18} /></button>
            </div>
          ))}
        </div>
      )}

      {/* 新增闹钟：时/分滚轮 */}
      {adding && (
        <div className="absolute inset-0 z-20 flex flex-col justify-end bg-black/50" onClick={() => setAdding(false)}>
          <div onClick={(e) => e.stopPropagation()} className="rounded-t-2xl bg-[#1c1c1e] px-4 py-4">
            <p className="mb-3 text-center text-[15px] font-semibold">添加闹钟</p>
            <div className="flex items-center justify-center gap-3 text-[40px] font-thin tabular-nums">
              <Stepper value={draft.h} max={23} onChange={(h) => setDraft((d) => ({ ...d, h }))} />
              <span>:</span>
              <Stepper value={draft.m} max={59} onChange={(m) => setDraft((d) => ({ ...d, m }))} />
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setAdding(false)} className="flex-1 rounded-xl bg-white/10 py-2.5 text-[14px]">取消</button>
              <button onClick={() => { setAlarms((l) => [...l, { id: `a${Date.now()}`, h: draft.h, m: draft.m, on: true, label: "闹钟" }]); setAdding(false); }} className="flex-1 rounded-xl bg-orange-500 py-2.5 text-[14px] font-semibold">保存</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
function Stepper({ value, max, onChange }: { value: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col items-center">
      <button onClick={() => onChange((value + 1) % (max + 1))} className="flex h-11 w-[70px] items-center justify-center rounded-lg text-white/50 active:bg-white/10" aria-label="增加"><IconChevronUp size={16} /></button>
      <span className="w-[70px] text-center">{String(value).padStart(2, "0")}</span>
      <button onClick={() => onChange((value - 1 + (max + 1)) % (max + 1))} className="flex h-11 w-[70px] items-center justify-center rounded-lg text-white/50 active:bg-white/10" aria-label="减少"><IconChevronDown size={16} /></button>
    </div>
  );
}

/* —— 计算器：可用四则运算，仿 iOS 键位 —— */
export function CalculatorApp({ onBack }: { onBack: () => void }) {
  const [display, setDisplay] = useState("0");
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [fresh, setFresh] = useState(true);

  const compute = (a: number, b: number, o: string) =>
    o === "+" ? a + b : o === "−" ? a - b : o === "×" ? a * b : o === "÷" ? (b === 0 ? NaN : a / b) : b;

  const inputNum = (d: string) => {
    if (fresh) { setDisplay(d === "." ? "0." : d); setFresh(false); return; }
    if (d === "." && display.includes(".")) return;
    setDisplay(display.length < 12 ? display + d : display);
  };
  const chooseOp = (o: string) => {
    const cur = Number.isFinite(parseFloat(display)) ? parseFloat(display) : 0;
    if (acc !== null && op && !fresh) { const r = compute(acc, cur, op); setAcc(r); setDisplay(String(+r.toPrecision(12))); }
    else setAcc(cur);
    setOp(o); setFresh(true);
  };
  const equals = () => {
    if (op === null || acc === null) return;
    const r = compute(acc, parseFloat(display), op);
    setDisplay(Number.isFinite(r) ? String(+r.toPrecision(12)) : "错误");
    setAcc(null); setOp(null); setFresh(true);
  };
  const clear = () => { setDisplay("0"); setAcc(null); setOp(null); setFresh(true); };
  const sign = () => setDisplay((d) => (d.startsWith("-") ? d.slice(1) : d === "0" ? d : "-" + d));
  const percent = () => setDisplay((d) => (Number.isFinite(parseFloat(d)) ? String(+(parseFloat(d) / 100).toPrecision(12)) : "0"));

  const Btn = ({ label, onClick, kind }: { label: string; onClick: () => void; kind?: "op" | "fn" | "num" }) => (
    <button onClick={onClick}
      className={`flex aspect-square max-h-[72px] w-full items-center justify-center rounded-full text-[26px] transition active:brightness-125 ${
        kind === "op" ? "text-white" : kind === "fn" ? "bg-[#a5a5a5] text-black" : "bg-[#333] text-white"
      } ${label === "0" ? "col-span-2 aspect-auto justify-start pl-7" : ""}`}
      style={kind === "op" ? { background: op === label ? "#fff" : "#ff9f0a", color: op === label ? "#ff9f0a" : "#fff" } : undefined}>
      {label}
    </button>
  );

  return (
    <div className="flex h-full flex-col bg-black text-white">
      <Head title="计算器" onBack={onBack} light />
      <div className="flex flex-1 flex-col justify-end px-4 pb-5">
        <p className={`mb-3 truncate text-right ${display.length > 7 ? "text-[44px]" : "text-[64px]"} font-thin tabular-nums leading-none`}>{display}</p>
        <div className="grid grid-cols-4 gap-2.5">
          <Btn label={acc === null && display === "0" ? "AC" : "C"} onClick={clear} kind="fn" />
          <Btn label="±" onClick={sign} kind="fn" />
          <Btn label="%" onClick={percent} kind="fn" />
          <Btn label="÷" onClick={() => chooseOp("÷")} kind="op" />
          {["7", "8", "9"].map((d) => <Btn key={d} label={d} onClick={() => inputNum(d)} kind="num" />)}
          <Btn label="×" onClick={() => chooseOp("×")} kind="op" />
          {["4", "5", "6"].map((d) => <Btn key={d} label={d} onClick={() => inputNum(d)} kind="num" />)}
          <Btn label="−" onClick={() => chooseOp("−")} kind="op" />
          {["1", "2", "3"].map((d) => <Btn key={d} label={d} onClick={() => inputNum(d)} kind="num" />)}
          <Btn label="+" onClick={() => chooseOp("+")} kind="op" />
          <Btn label="0" onClick={() => inputNum("0")} kind="num" />
          <Btn label="." onClick={() => inputNum(".")} kind="num" />
          <Btn label="=" onClick={equals} kind="op" />
        </div>
      </div>
    </div>
  );
}

/* —— 备忘录 · 日记：既可速记待办，也可写带心情的日记，本地留存 —— */
type Memo = { id: string; text: string; ts: number; mood?: string };
const MEMO_KEY = "star2005.phone.memos";
/* 全部为真实黄豆表情 */
const MOODS = ["😊", "🥰", "😌", "😎", "😢", "😤", "😴", "🤩"];
export function NotesApp({ onBack }: { onBack: () => void }) {
  const [list, setList] = useState<Memo[]>(() => {
    return loadData<Memo[]>(MEMO_KEY, [
      { id: "m1", text: "试镜清单\n· 提前一周背台词\n· 准备两套定妆造型\n· 早睡，别熬夜", ts: Date.now() },
      { id: "m2", text: "第一次进组\n今天第一次走进摄影棚，灯光亮得睁不开眼。导演说我眼睛里有故事。\n哪怕只是个小角色，也告诉自己——总有一天，今夜她是主角。", ts: Date.now() - 86400000 },
    ]);
  });
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { saveData(MEMO_KEY, list); }, [list]);

  const cur = list.find((m) => m.id === open);
  if (cur) {
    const d = new Date(cur.ts);
    return (
      <div className="flex h-full flex-col bg-[#1c1c1e] text-white">
        <div className="flex items-center px-3 py-2.5">
          <button onClick={() => { const t = cur.text.trim(); if (!t) setList((l) => l.filter((m) => m.id !== cur.id)); setOpen(null); }} className="text-[15px] text-orange-400">‹ 备忘录</button>
          <span className="flex-1" />
          <button onClick={() => { setList((l) => l.filter((m) => m.id !== cur.id)); setOpen(null); }} className="text-[13px] text-white/60">删除</button>
        </div>
        <p className="px-4 pb-1 text-[12px] font-medium tracking-wide text-white/40">
          {d.getFullYear()} 年 {d.getMonth() + 1} 月 {d.getDate()} 日 · {["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()]}
        </p>
        {/* 心情（写日记时可选） */}
        <div className="flex flex-wrap gap-1.5 px-4 py-1.5">
          {MOODS.map((m) => (
            <button key={m} onClick={() => setList((l) => l.map((x) => x.id === cur.id ? { ...x, mood: x.mood === m ? undefined : m } : x))}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-[17px] transition ${cur.mood === m ? "scale-110 bg-orange-500/90" : "bg-white/[0.07]"}`}>{m}</button>
          ))}
        </div>
        <textarea
          autoFocus value={cur.text}
          onChange={(e) => setList((l) => l.map((m) => m.id === cur.id ? { ...m, text: e.target.value, ts: Date.now() } : m))}
          className="flex-1 resize-none bg-transparent px-4 py-2 text-[15px] leading-relaxed text-white outline-none"
          placeholder="记点什么，或写写今天的心情…"
        />
      </div>
    );
  }
  return (
    <div className="relative flex h-full flex-col bg-[#1c1c1e] text-white">
      <Head title="备忘录 · 日记" onBack={onBack} light tint="#ff9f0a" />
      <div className="flex-1 overflow-y-auto px-3 pb-20">
        {list.length === 0 && <p className="py-16 text-center text-[13px] text-white/45">还没有备忘录，点右下角「＋」写一条。</p>}
        {list.map((m) => {
          const [first, ...rest] = m.text.split("\n");
          return (
            <button key={m.id} onClick={() => setOpen(m.id)} className="flex w-full items-center gap-3 border-b border-white/10 py-3 text-left">
              {m.mood && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[19px]">{m.mood}</span>}
              <span className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-medium">{first || "新备忘录"}</p>
                <p className="truncate text-[12.5px] text-white/45">{new Date(m.ts).toLocaleDateString()} {rest.join(" ") || "无更多文字"}</p>
              </span>
            </button>
          );
        })}
      </div>
      <button onClick={() => { const id = `m${Date.now()}`; setList((l) => [{ id, text: "", ts: Date.now() }, ...l]); setOpen(id); }}
        className="absolute bottom-4 right-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg"><IconPlus size={24} /></button>
    </div>
  );
}

/* —— 天气：读取游戏世界天气 + 一周预报 —— */
export function WeatherApp({ onBack }: { onBack: () => void }) {
  const { game } = useGame();
  const w = game!.world;
  const today = game!.sim.day ?? 0;
  const kinds = ["晴", "多云", "阴", "小雨", "雷阵雨"];
  const forecast = useMemo(() => {
    // 确定性预报：以生涯天数为种子的小型 PRNG，逐日平滑变化且自洽（高温≥低温）。
    // 温区随季节浮动（由当日月份派生），无季节信息时回落到 15~30℃。
    const prng = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
    return Array.from({ length: 7 }, (_, i) => {
      const day = today + i;
      const { m } = dayParts(day);
      const season = m >= 3 && m <= 5 ? [14, 26] : m >= 6 && m <= 8 ? [24, 35] : m >= 9 && m <= 11 ? [12, 24] : [2, 12];
      const [base, top] = season;
      const r = prng(day);
      const lo = Math.round(base + r * (top - base) * 0.4);
      const hi = Math.round(lo + 4 + prng(day + 1) * 8);
      const k = i === 0 ? (w.weather || "晴") : kinds[Math.floor(prng(day + 2) * kinds.length)];
      return { d: i === 0 ? "今天" : weekdayName(day), k, hi, lo };
    });
  }, [today, w.weather]);
  const hi = forecast[0].hi, lo = forecast[0].lo;
  const wMin = Math.min(...forecast.map((f) => f.lo)), wMax = Math.max(...forecast.map((f) => f.hi));
  const span = Math.max(1, wMax - wMin);

  return (
    <div className="flex h-full flex-col overflow-y-auto pb-4 text-white" style={{ background: "linear-gradient(170deg,#2b5876,#4e4376)" }}>
      <Head title="天气" onBack={onBack} light />
      <div className="flex flex-col items-center pt-4 text-center">
        <p className="text-[22px] font-medium">{w.location || `${T("city")}`}</p>
        <p className="mt-1 text-[68px] font-thin leading-none tabular-nums">{hi}°</p>
        <p className="mt-1 flex items-center gap-1.5 text-[15px]"><IconSun size={16} /> {w.weather || "晴"}</p>
        <p className="text-[13px] text-white/70">最高 {hi}° 最低 {lo}°</p>
      </div>
      <div className="mx-3 mt-6 rounded-2xl bg-white/10 p-3 backdrop-blur">
        <p className="mb-1 border-b border-white/15 pb-2 text-[12px] text-white/70">未来一周</p>
        {forecast.map((f, i) => (
          <div key={i} className="flex items-center gap-3 py-2 text-[15px]">
            <span className="w-12">{f.d}</span>
            <span className="min-w-0 flex-1 truncate text-white/80">{f.k}</span>
            <span className="w-8 text-right text-white/60 tabular-nums">{f.lo}°</span>
            <div className="relative h-1 w-16 shrink-0 overflow-hidden rounded-full bg-white/15">
              <div className="absolute inset-y-0 rounded-full bg-gradient-to-r from-sky-300 to-amber-300" style={{ left: `${((f.lo - wMin) / span) * 100}%`, width: `${((f.hi - f.lo) / span) * 100}%` }} />
            </div>
            <span className="w-8 text-right tabular-nums">{f.hi}°</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* —— 仿真 App Store 产品页（导航栏吸顶小图标 / 信息横条 / 新功能 / 预览 / 评分评论 / 隐私 / 信息 / 相关推荐） —— */
/** 功能注释：应用详情只留图标、名称、「打开」与真实简介；隐私表 / 信息表 / 推荐列表均为占位，不再渲染 */
function AppDetail({ item: d, pill, onBack, backLabel }: { item: StoreItem; pill: ReactNode; onBack: () => void; backLabel: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [more, setMore] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollTo({ top: 0 }); setMore(false); setScrolled(false); }, [d.id]);
  const shots = [
    { img: d.cover, title: d.desc, kicker: d.kicker, pos: "object-center" },
    { img: d.cover, title: d.tagline, kicker: d.cat, pos: "object-left" },
    { img: d.cover, title: "轻点一下，即刻开始", kicker: d.label, pos: "object-right" },
  ];
  const strip = [
    { k: "年龄", v: "4+", sub: "岁" },
    { k: "类别", v: d.cat.slice(0, 2), sub: d.cat },
    { k: "开发者", v: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>, sub: "STAR Studio" },
    { k: "语言", v: "ZH", sub: "+ 1 种语言" },
    { k: "大小", v: d.size.replace(/\s*MB/i, ""), sub: "MB" },
  ];
  const H = ({ t, link }: { t: string; link?: string }) => (
    <div className="flex items-baseline justify-between px-4 pb-2 pt-5">
      <p className="text-[21px] font-bold tracking-tight text-ink">{t}</p>
      {link && <span className="text-[16px] text-[#0a84ff]">{link}</span>}
    </div>
  );
  const Sep = () => <div className="mx-4 h-px bg-black/[0.1]" />;

  return (
    <div className="relative flex h-full flex-col bg-white">
      {/* 导航栏：滚过头部后显示居中小图标 + 右侧获取 */}
      <div className={`z-10 flex h-11 shrink-0 items-center justify-between px-2 transition-colors ${scrolled ? "border-b border-black/[0.08] bg-[#f9f9f9]/90 backdrop-blur" : "bg-white"}`}>
        <button onClick={onBack} className="flex items-center text-[17px] text-[#0a84ff]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m15 5-7 7 7 7" /></svg>
          {backLabel}
        </button>
        <span className={`ios-icon block h-7 w-7 overflow-hidden transition-all duration-200 ${scrolled ? "opacity-100" : "translate-y-2 opacity-0"}`}>{d.icon}</span>
        <div className={`min-w-[64px] text-right transition-opacity duration-200 ${scrolled ? "opacity-100" : "pointer-events-none opacity-0"}`}>{pill}</div>
      </div>

      <div ref={ref} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 120)} className="flex-1 overflow-y-auto pb-10">
        {/* 头部：图标、名称、「打开」 */}
        <div className="flex gap-4 px-4 pt-1">
          <span className="ios-icon block h-[100px] w-[100px] shrink-0 overflow-hidden rounded-[26px] ring-1 ring-black/[0.06]">{d.icon}</span>
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="text-[21px] font-semibold leading-tight tracking-tight text-ink">{d.label}</p>
            <p className="mt-0.5 line-clamp-2 text-[14px] leading-snug text-ink-soft">{d.tagline}</p>
            <div className="mt-auto flex items-center justify-between">
              <div className="flex flex-col items-start gap-0.5">
                {pill}
                <span className="pl-1 text-[9px] text-ink-soft/70">免费 · 无 App 内购买</span>
              </div>
            </div>
          </div>
        </div>

        {/* 信息横条 */}
        <div className="mt-5 border-y border-black/[0.08]">
          <div className="flex overflow-x-auto py-3 [scrollbar-width:none]">
            {strip.map((x, i) => (
              <div key={i} className={`flex w-[104px] shrink-0 flex-col items-center gap-1 px-2 text-center ${i ? "border-l border-black/[0.1]" : ""}`}>
                <p className="w-full truncate text-[10px] font-semibold uppercase tracking-wide text-ink-soft/60">{x.k}</p>
                <div className="flex h-6 items-center text-[20px] font-bold text-ink-soft/80">{x.v}</div>
                <div className="w-full truncate text-[11px] text-ink-soft/60">{x.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 预览：竖版 iPhone 截图 */}
        <H t="预览" />
        <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 [scrollbar-width:none]">
          {shots.map((sh, i) => (
            <div key={i} className="relative aspect-[9/19.5] w-[58%] shrink-0 snap-start overflow-hidden rounded-[22px] bg-[#f2f2f7] ring-1 ring-black/[0.08]">
              <div className="absolute inset-x-0 top-0 z-10 px-4 pt-5 text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-soft">{sh.kicker}</p>
                <p className="mt-1 text-[16px] font-extrabold leading-snug text-ink">{sh.title}</p>
              </div>
              <div className="absolute inset-x-4 bottom-0 top-[28%] overflow-hidden rounded-t-[18px] border-[5px] border-b-0 border-[#1c1c1e] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]">
                <img src={(sh.img) || undefined} alt="" className={`h-full w-full object-cover ${sh.pos}`} />
                <span className="absolute left-1/2 top-1.5 h-3 w-12 -translate-x-1/2 rounded-full bg-[#1c1c1e]" />
              </div>
            </div>
          ))}
        </div>
        <p className="flex items-center gap-1.5 px-4 pt-3 text-[13px] text-ink-soft/70">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="7" y="2" width="10" height="20" rx="2.5" /></svg>
          iPhone
        </p>
        <Sep />

        {/* 简介 */}
        <div className="px-4 pt-4 pb-6">
          <p className={`whitespace-pre-line text-[14px] leading-relaxed text-ink ${more ? "" : "line-clamp-3"}`}>{`${d.story}\n\n${d.desc}——${d.tagline}。\n\n· 轻巧：安装包仅 ${d.size}\n· 安心：所有数据仅存于本机\n· 免费：没有任何 App 内购买`}</p>
          {!more && <button onClick={() => setMore(true)} className="text-[14px] text-[#0a84ff]">更多</button>}
          <div className="mt-3 flex items-center justify-between">
            <div><p className="text-[14px] text-[#0a84ff]">STAR Studio</p><p className="text-[12px] text-ink-soft/70">开发者</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* —— 全局提醒：闹钟/番茄钟在手机任意界面响铃（挂在 Phone 外壳） —— */
function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.15, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.3);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch { /* ignore */ }
}
export function GlobalPhoneAlerts({ dnd = false }: { dnd?: boolean }) {
  const now = useGameNow();
  const [ring, setRing] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const alarms: Alarm[] = loadData<Alarm[]>(ALARM_KEY, []);
    const hm = `${now.getHours()}:${now.getMinutes()}`;
    for (const a of alarms) {
      const key = `${a.id}@${hm}`;
      if (a.on && a.h === now.getHours() && a.m === now.getMinutes() && !firedRef.current.has(key)) {
        firedRef.current.add(key); setRing(a.label || "闹钟"); beep();
      }
    }
    const [p, done] = settlePomo(loadPomo());
    // 勿扰模式：番茄钟提醒静默（不弹横幅、不响铃）；闹钟与 iOS 一致仍会响
    if (done) { savePomo(p); if (!dnd) { setBanner(done === "work" ? "专注完成，休息一下吧" : "休息结束，开始下一个番茄"); beep(); } }
  }, [now, dnd]);

  useEffect(() => { if (!banner) return; const t = setTimeout(() => setBanner(null), 4000); return () => clearTimeout(t); }, [banner]);

  const hh = String(now.getHours()).padStart(2, "0"), mm = String(now.getMinutes()).padStart(2, "0");
  return (
    <>
      {banner && (
        <div className="absolute inset-x-3 top-10 z-[48] rounded-2xl bg-black/85 px-4 py-3 text-[13.5px] text-white shadow-lg" onClick={() => setBanner(null)}>{banner}</div>
      )}
      {ring && (
        <div className="absolute inset-0 z-[48] flex flex-col items-center justify-center gap-4 bg-black/70 text-white">
          <IconClock size={64} className="text-orange-400" />
          <p className="text-[22px] font-semibold">{ring}</p>
          <p className="text-[15px] tabular-nums text-white/70">{hh}:{mm}</p>
          <button onClick={() => setRing(null)} className="mt-2 rounded-full bg-orange-500 px-8 py-2.5 text-[15px] font-semibold">停止</button>
        </div>
      )}
    </>
  );
}
