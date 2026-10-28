import { Fragment } from "react";
import DiyIcon from "./DiyIcon";
import { useState, type ReactNode } from "react";
import { useGame } from "../store/gameCtx";
import { feature, term, useMods } from "../mods/registry";
import type { TermKey } from "../mods/types";
import { IconPin, IconHeart, IconCamera, IconUser, IconSparkle, IconBook, IconClock } from "../lib/icons";
import { liveTerm as T } from "../mods/live";
import { contactsCfg, contactsTitle } from "../game/contacts";
import { navSizesFor, resolveNavSlots, type NavPoolItem } from "../lib/navTabsConfig";

export type MudTab = "home" | "sim" | "projects" | "image" | "npc" | "actions" | "phone" | "quest" | "settings";

/* ═══════════════ 水晶底栏 · 纯代码复刻 ═══════════════
 * 复刻方案：透明「矢量水晶图标」+ CSS 玻璃底板 + React 状态切换。
 *   · 美术层（图标 / 水晶渐变 / 微光高光）—— 由下方 SVG glyph 在代码里绘制
 *   · 玻璃层（底板 / 边框 / 阴影 / 顶缘高光）—— 由 CSS 绘制，随皮肤 token 呼吸
 *   · 逻辑层（点击前/点击后状态、文字、角标、换肤、功能）—— 由 React 控制
 * 全程不生成整条底栏位图，故可自由适配屏幕、切换状态、改文字、换肤。 */

export type GlyphName = "world" | "star" | "clipboard" | "people" | "book" | "gear" | "camera" | "flag";

/* 矢量水晶图标：点击前为柔白细描边，点击后换成水晶渐变描边并发光。
 * 描边式 glyph 在选中态填入 url(#crystalGrad) 渐变，未选中态用 currentColor。 */
export function NavGlyph({ name, active, size = 20 }: { name: GlyphName; active: boolean; size?: number }) {
  const stroke = active ? "url(#crystalGrad)" : "currentColor";
  const common = { fill: "none", stroke, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<GlyphName, ReactNode> = {
    world: (
      <g {...common}>
        <circle cx="12" cy="12" r="8.6" />
        <path d="M3.4 12h17.2" />
        <path d="M12 3.4c2.6 2.7 2.6 15.5 0 17.2M12 3.4c-2.6 2.7-2.6 15.5 0 17.2" />
      </g>
    ),
    star: (
      <path {...common} d="M12 3.6l2.55 5.17 5.7.83-4.12 4.02.97 5.68L12 16.99 6.9 19.3l.97-5.68L3.75 9.6l5.7-.83z" />
    ),
    clipboard: (
      <g {...common}>
        <path d="M9 4.4h6a1 1 0 011 1v.3a2 2 0 01-2 2H10a2 2 0 01-2-2v-.3a1 1 0 011-1z" />
        <path d="M8 5.6H5.6a1.2 1.2 0 00-1.2 1.2v12.4a1.2 1.2 0 001.2 1.2h12.8a1.2 1.2 0 001.2-1.2V6.8a1.2 1.2 0 00-1.2-1.2H16" />
        <path d="M8.4 12h7.2M8.4 15.6h4.8" />
      </g>
    ),
    people: (
      <g {...common}>
        <circle cx="9" cy="8.4" r="2.6" />
        <path d="M4 19c0-2.9 2.24-5.2 5-5.2s5 2.3 5 5.2" />
        <path d="M15.6 6.3a2.4 2.4 0 010 4.7M16.4 14.1c2.3.5 3.9 2.4 3.9 4.9" />
      </g>
    ),
    book: (
      <g {...common}>
        <path d="M12 6.1c-1.7-1.25-3.85-1.9-6.4-1.9V17c2.55 0 4.7.65 6.4 1.9 1.7-1.25 3.85-1.9 6.4-1.9V4.2c-2.55 0-4.7.65-6.4 1.9z" />
        <path d="M12 6.1v12.8" />
      </g>
    ),
    camera: (
      <g {...common}>
        <path d="M4.2 8.2a1.4 1.4 0 011.4-1.4h2.2l1.4-2h5.6l1.4 2h2.2a1.4 1.4 0 011.4 1.4v9.6a1.4 1.4 0 01-1.4 1.4H5.6a1.4 1.4 0 01-1.4-1.4z" />
        <circle cx="12" cy="12.8" r="3.3" />
      </g>
    ),
    flag: (
      <g {...common}>
        <path d="M6 20.4V4" />
        <path d="M6 4.8h10.6l-2.2 3.9 2.2 3.9H6" />
      </g>
    ),
    gear: (
      <g {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3.6v2.1M12 18.3v2.1M20.4 12h-2.1M5.7 12H3.6M17.94 6.06l-1.48 1.48M7.54 16.46l-1.48 1.48M17.94 17.94l-1.48-1.48M7.54 7.54L6.06 6.06" />
      </g>
    ),
  };
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={`relative transition-transform duration-300 ${active ? "scale-110 drop-shadow-[0_0_6px_var(--crystal-glow)]" : "group-hover:scale-105"}`} aria-hidden>
      {paths[name]}
    </svg>
  );
}

/* 每个牌位的图标与文案（底栏快捷位取用；完整列表由右上角 ☰ 菜单浮层呈现） */
export const MENU: { id: MudTab; label: string; icon: typeof IconBook; hint: string }[] = [
  { id: "home", label: "世界", icon: IconPin, get hint() { return `${T("city")}舆图 · 出行探访`; } },
  { id: "sim", label: "人物", icon: IconUser, get hint() { return `身世属性 · 日程养成 · ${T("gig")}履历`; } },
  { id: "image", label: "形象", icon: IconCamera, hint: "公开人设 · 舆情危机" },
  { id: "npc", get label() { return contactsTitle(); }, icon: IconHeart, get hint() { return [contactsCfg().subtitle, "流言私信"].filter(Boolean).join(" · "); } },
  { id: "actions", get label() { return `${T("industry")}`; }, icon: IconSparkle, hint: "人气榜 · 票房代言 · 机遇抉择" },
  { id: "phone", label: "手机", icon: IconClock, hint: "微信 · 短信 · 电话 · 微博 · 直播 · 票务" },
];

/* 按当前世界观模组翻译术语、按功能开关过滤后的牌位（引擎读这里，MENU 为默认叫法） */
const MENU_TERMS: Record<string, [TermKey, TermKey]> = {
  home: ["tabWorld", "hintWorld"], sim: ["tabSim", "hintSim"], image: ["tabImage", "hintImage"],
  npc: ["tabNpc", "hintNpc"], actions: ["tabIndustry", "hintIndustry"], phone: ["tabPhone", "hintPhone"],
};
export function menuItems() {
  return MENU.filter((m) => m.id !== "npc" && m.id !== "image" && m.id !== "sim").filter((m) =>
    m.id === "actions" ? feature("industryTab") : m.id === "image" ? feature("imageCrisis") : m.id === "phone" ? feature("phone") : true,
  ).map((m) => {
    const [l, h] = MENU_TERMS[m.id] ?? [];
    return { ...m, label: l ? term(l, m.label) : m.label, hint: h ? term(h, m.hint) : m.hint };
  });
}

/* 底栏可选牌位（渲染与编辑器共用；按模组功能开关过滤） */
export function navPool(): { id: MudTab; label: string; glyph: GlyphName }[] {
  return ([
    { id: "home", glyph: "world", label: term("tabWorld", "世界"), on: true },
    { id: "actions", glyph: "star", label: term("tabIndustry", "娱乐圈"), on: feature("industryTab") },
    { id: "sim", glyph: "clipboard", label: term("tabSim", "档案"), on: true },
    { id: "npc", glyph: "people", label: contactsTitle(), on: true },
    { id: "phone", glyph: "book", label: term("tabPhone", "手机"), on: feature("phone") },
    { id: "image", glyph: "camera", label: term("tabImage", "形象"), on: feature("imageCrisis") },
    { id: "quest", glyph: "flag", label: "支线", on: true },
    { id: "settings", glyph: "gear", label: "设置", on: true },
  ] as { id: MudTab; glyph: GlyphName; label: string; on: boolean }[]).filter((x) => x.on).map(({ id, label, glyph }) => ({ id, label, glyph }));
}

/* 可选格数：2 的倍数且不小于 4，受可用牌位数量约束（与 lib/navTabsConfig 同源） */
export const navSizes = (poolLen: number): (4 | 6 | 8)[] => navSizesFor(poolLen);

/* 解析底栏：委托纯函数，保证与模组编辑器预览一致；「世界」固定首位 */
export function resolveNav(navTabs: { id: string; label?: string; on?: boolean }[] | undefined, size?: number) {
  const pool = navPool() as NavPoolItem[];
  return resolveNavSlots(pool, navTabs, size);
}

/* 编辑器：组合底部栏——选格数（4 / 6 / 8）、勾选放哪些、排序、改名（随存档保存） */
export function NavTabsEditor() {
  const { game, commitGame } = useGame();
  if (!game) return null;
  const pool = navPool();
  const sizes = navSizes(pool.length);
  const size = sizes.includes(game.navSize as 4 | 6 | 8) ? game.navSize! : sizes[0] ?? 4;
  const shown = resolveNav(game.navTabs, size).map((x) => x.id as string);
  // 编辑列表：已显示的按底栏顺序在前，其余在后
  const cfg = [...shown, ...pool.map((p) => p.id as string).filter((id) => !shown.includes(id))].map((id) => ({
    id, label: game.navTabs?.find((c) => c.id === id)?.label, on: shown.includes(id),
  }));
  const save = (next: typeof cfg, nextSize = size) => commitGame({ ...game, navTabs: next, navSize: nextSize as 4 | 6 | 8 });
  const onCount = shown.length;
  const move = (i: number, d: number) => { const j = i + d; if (j < 1 || i < 1 || j >= cfg.length) return; const n = [...cfg]; [n[i], n[j]] = [n[j], n[i]]; save(n); };
  const toggle = (id: string, on: boolean) => {
    if (on && onCount >= size) return;
    save(cfg.map((x) => (x.id === id ? { ...x, on } : x)));
  };
  const btn = "grid h-8 w-8 place-items-center rounded-lg border border-line bg-paper text-[13px] text-ink-soft transition hover:border-jade hover:text-jade disabled:opacity-30";
  return (
    <div className="space-y-2.5">
      <p className="rounded-2xl bg-paper-2/70 px-3 py-2 text-[12px] leading-relaxed text-ink-soft">先选底部栏放几格，再勾选要放的功能、调整顺序和名字。中间的「日程」按钮固定不动，左右各分一半。没勾满时会按默认顺序自动补位；隐藏的功能仍可从 菜单进入。</p>
      <div>
        <p className="mb-1.5 px-1 text-[11px] font-bold tracking-[0.12em] text-ink-soft">格数（不含中间「日程」）</p>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(1, sizes.length)}, minmax(0, 1fr))` }}>
          {sizes.map((n) => (
            <button key={n} type="button" onClick={() => save(cfg.map((c, i) => ({ ...c, on: i < n })), n)}
              className={`rounded-xl border py-2 text-[13px] font-bold transition ${size === n ? "border-jade bg-jade/10 text-jade-deep" : "border-line bg-paper text-ink-soft hover:border-jade/50"}`}>
              {n} 格
            </button>
          ))}
        </div>
        {sizes.length < 3 && <p className="mt-1 px-1 text-[10.5px] text-ink-soft">当前世界观可用功能共 {pool.length} 个，最多放 {sizes[sizes.length - 1] ?? pool.length} 格。</p>}
      </div>
      <p className="px-1 text-[11px] text-ink-soft">已放 <b className="text-jade-deep">{onCount}</b> / {size} 格</p>
      {cfg.map((c, i) => {
        const base = pool.find((p) => p.id === c.id)!;
        const on = c.on;
        return (
          <div key={c.id} className={`flex items-center gap-2 rounded-2xl border px-2.5 py-2 ${on ? "border-jade/40 bg-paper" : "border-line bg-paper/50 opacity-70"}`}>
            {c.id === "home" ? (
              <span className="grid w-8 shrink-0 place-items-center text-[10.5px] font-bold leading-tight text-jade-deep">固定<br />首位</span>
            ) : (
              <div className="flex flex-col gap-1">
                <button type="button" className={btn} disabled={i <= 1} onClick={() => move(i, -1)} aria-label="上移">↑</button>
                <button type="button" className={btn} disabled={i === cfg.length - 1} onClick={() => move(i, 1)} aria-label="下移">↓</button>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <input value={c.label ?? ""} placeholder={base.label} maxLength={4}
                onChange={(e) => save(cfg.map((x) => (x.id === c.id ? { ...x, label: e.target.value } : x)))}
                className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-[14px] font-bold text-ink outline-none focus:border-jade" />
              <p className="mt-0.5 px-1 text-[10.5px] text-ink-soft">原名：{base.label}（最多 4 字，留空用原名）</p>
            </div>
            <button type="button" disabled={c.id === "home" || (!on && onCount >= size)} onClick={() => toggle(c.id, !on)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold transition disabled:opacity-40 ${on ? "bg-jade text-white" : "border border-line text-ink-soft"}`}>
              {on ? "显示" : "隐藏"}
            </button>
          </div>
        );
      })}
      <button type="button" onClick={() => commitGame({ ...game, navTabs: undefined, navSize: undefined })} className="w-full rounded-xl border border-line py-2 text-[12.5px] text-ink-soft transition hover:border-jade hover:text-jade">恢复默认底部栏</button>
    </div>
  );
}

/* 底栏：常用水晶石牌快捷位 + 中央度日水晶星章。完整牌位由右上角 ☰ 菜单呈现。
 * 度日走稳定的 endDayNow（幂等推进），不承载任何叙事计算。 */
export default function MudChrome({ tab, setTab }: { tab: MudTab; setTab: (t: MudTab) => void }) {
  const { game, busy, look: theme } = useGame(); // 实际生效外观（含剧情美化）
  const nav = theme.navActive ?? {};
  useMods();
  const [flash, setFlash] = useState(false);
  if (!game) return null;

  const s = game.sim;
  const advance = () => {
    if (busy) return;
    // 推进 = 打开本周日程板，在板内排程并「推进一天 / 过完本周」
    window.dispatchEvent(new CustomEvent("star:navschedule"));
    setFlash(true);
    setTimeout(() => setFlash(false), 600);
  };

  // 底栏角标：手机未读消息数 · 形象页舆情危机（在场徽记，提示玩家该去哪一格）
  const phoneUnread = (game.phone?.threads ?? []).reduce((n, t) => n + (t.unread ?? 0), 0);
  const badgeOf = (id: MudTab): number | "!" | null =>
    id === "phone" ? (phoneUnread > 0 ? phoneUnread : null)
    : id === "sim" ? (s.crisis && feature("imageCrisis") ? "!" : null)
    : null;

  /* 通用石牌位：分割块卡片 + 选中激活高亮 */
  const SegmentSlot = ({
    id,
    glyph,
    label,
    active,
    badge,
    onClick,
    current,
    dense,
  }: {
    id: string;
    glyph: GlyphName;
    label: string;
    active: boolean;
    badge?: number | "!" | null;
    onClick?: () => void;
    current?: boolean;
    dense?: boolean;
  }) => (
    <button
      onClick={onClick}
      aria-current={current}
      className={`group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 ${dense ? "px-0" : "px-1"} pb-2 pt-2 transition-colors duration-200 active:scale-95 ${
        active ? "text-jade-deep" : "text-ink-soft hover:text-ink"
      }`}
    >
      {/* 选中态：只在图标后衬一枚柔光胶囊，干净不抢眼 */}
      <span className="relative grid h-7 w-12 place-items-center">
        <span aria-hidden className={`nav-hl pointer-events-none absolute inset-0 rounded-full transition-all duration-300 ${active ? "nav-hl-on nav-pill bg-gradient-to-r from-jade/22 to-coral/18 opacity-100 shadow-[0_0_14px_-3px_var(--crystal-glow)]" : "scale-75 opacity-0 group-hover:scale-90 group-hover:bg-ink-soft/8 group-hover:opacity-100"}`} />
        {/* 选中瞬间：一圈水晶光晕向外扩散后消失 */}
        {active && nav.ripple !== false && <span aria-hidden className="nav-ripple pointer-events-none absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,var(--crystal-glow),transparent_70%)]" />}
        <span className={`nav-ico relative grid place-items-center ${active ? "nav-ico-on drop-shadow-[0_2px_6px_var(--crystal-glow)]" : ""}`}>
          {(() => {
            // 自定义图标：选中 / 未选中各一张；只设了一张时两态共用（未选中略降透明度）
            const ic = nav.icons?.[id];
            const src = active ? ic?.on || ic?.off : ic?.off || ic?.on;
            const sz = nav.iconSize ?? (src ? 24 : 20);
            return src
              ? <img src={src} alt="" style={{ width: sz, height: sz }} className={`object-contain ${active || ic?.off ? "" : "opacity-60 grayscale"}`} />
              : <NavGlyph name={glyph} active={active} size={sz} />;
          })()}
        </span>
        {badge != null && (
          <span className={`pointer-events-none absolute right-0.5 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full px-1 text-[9px] font-black leading-none text-white shadow-sm ring-2 ring-paper-2 ${badge === "!" ? "bg-danger animate-pulse" : "bg-coral"}`}>
            {badge === "!" ? "!" : badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span className={`nav-txt relative max-w-full truncate ${active ? "nav-label nav-txt-on" : ""} ${dense ? "text-[10px] tracking-normal" : "text-[11px] tracking-wide"} leading-none transition-all ${active ? "font-bold text-jade-deep" : "font-medium text-ink-soft/90"}`}>
        {label}
      </span>
    </button>
  );

  /* 按模组功能动态排位：关掉的玩法不占格，自动用「档案」补位，左右两组始终平衡 */
  const slots = resolveNav(game.navTabs, game.navSize);
  const dense = slots.length > 4;
  const half = Math.ceil(slots.length / 2);
  const left = slots.slice(0, half), right = slots.slice(half);
  const renderSlot = (x: (typeof slots)[number]) => (
    // 以函数方式调用（而非 <SegmentSlot/>），避免父组件每次重渲染都重挂载按钮、反复重播点击动画
    <Fragment key={x.id}>{SegmentSlot({ id: x.id, glyph: x.glyph, label: x.label, active: tab === x.id, badge: badgeOf(x.id), onClick: () => setTab(x.id), current: tab === x.id, dense })}</Fragment>
  );

  return (
    <nav className="z-20 shrink-0 [--crystal-a:var(--jade)] [--crystal-b:var(--coral)] [--crystal-glow:rgba(196,150,255,0.45)]">
      {/* 共享的水晶渐变 */}
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <linearGradient id="crystalGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--crystal-a)" />
            <stop offset="1" stopColor="var(--coral)" />
          </linearGradient>
        </defs>
      </svg>

      {/* 7 段式分割底栏 (完全复刻原型截图结构：分割线线框 + 居中行动星章按钮) */}
      <div className="relative">

        <div className="relative overflow-visible bg-paper-2/88 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_28px_-18px_var(--crystal-glow)] backdrop-blur-2xl backdrop-saturate-150 transition-all duration-300">
          {/* 顶缘水晶细光：渐隐分割线替代硬边框 */}
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--jade)_45%,var(--line))] to-transparent" />
          <div className="relative mx-auto flex max-w-3xl items-stretch text-ink">
            {/* 左组 */}
            <div className="flex flex-1 items-stretch">{left.map(renderSlot)}</div>

            {/* 中央「日程」：嵌于底栏内部的主行动位（打开本周日程板） */}
            <div className="relative flex w-[72px] shrink-0 flex-col items-center justify-end pb-2">
              <span className="pointer-events-none mt-auto h-[11px]" aria-hidden />
            <button
              onClick={advance}
              disabled={busy}
              data-tour="advance"
              title="打开本周日程：排程并推进"
              className={`group absolute -top-4 grid h-[56px] w-[56px] place-items-center rounded-full bg-paper-2 p-[3px] shadow-[0_8px_20px_-8px_var(--coral),0_0_0_4px_color-mix(in_srgb,var(--paper-2)_88%,transparent)] transition-all duration-300 hover:-translate-y-0.5 active:scale-95 disabled:opacity-60 ${flash ? "animate-flash" : ""}`}
            >
              {/* 外圈流光 */}
              <span aria-hidden className="advance-conic pointer-events-none absolute inset-0 rounded-full opacity-70 [animation-duration:10s] group-hover:opacity-100" />
              <span className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[var(--coral)] via-[color-mix(in_srgb,var(--coral)_55%,var(--jade))] to-[var(--jade)] text-white">
                <span aria-hidden className="pointer-events-none absolute inset-x-2 top-0.5 h-[45%] rounded-t-full bg-gradient-to-b from-white/45 to-transparent" />
                <span className={`relative transition-transform duration-300 group-hover:translate-x-0.5 ${busy ? "animate-pulse" : ""}`}>
                <DiyIcon slot="adv.arrow" size={16}>
                <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h12M13 6l6 6-6 6" />
                </svg>
                </DiyIcon>
                </span>
                <span className="relative mt-0.5 font-serif text-[11.5px] font-black leading-none tracking-[0.2em] pl-[0.2em]">
                  {term("advance", "日程")}
                </span>
              </span>
            </button>
            </div>

            {/* 右组 */}
            <div className="flex flex-1 items-stretch">{right.map(renderSlot)}</div>
          </div>
        </div>
      </div>
    </nav>
  );
}
