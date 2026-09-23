import { useState } from "react";
import { useGame } from "../store/gameCtx";
import { weekdayName } from "../game/logic";
import { IconPin, IconHeart, IconCamera, IconSparkle, IconBook, IconClock, IconScroll, IconSettings } from "../lib/icons";

export type MudTab = "quest" | "settings" | "home" | "sim" | "projects" | "image" | "npc" | "actions" | "phone";

export const BOTTOM_TAB_IDS: readonly MudTab[] = ["home", "actions", "quest", "npc", "phone", "settings"];

/* 导航定义；菜单只显示底栏未包含的入口。 */
export const MENU: { id: MudTab; label: string; icon: typeof IconBook; hint: string }[] = [
  { id: "quest", label: "任务", icon: IconScroll, hint: "支线剧情 · 收藏" },
  { id: "settings", label: "设置", icon: IconSettings, hint: "界面皮肤 · 字体 · 版式" },
  { id: "home", label: "世界", icon: IconPin, hint: "星城舆图 · 出行探访" },
  { id: "image", label: "形象", icon: IconCamera, hint: "公开人设 · 舆情危机" },
  { id: "npc", label: "人脉", icon: IconHeart, hint: "圈中往来 · 流言私信" },
  { id: "actions", label: "娱乐圈", icon: IconSparkle, hint: "人气榜 · 票房代言 · 机遇抉择" },
  { id: "phone", label: "手机", icon: IconClock, hint: "微信 · 短信 · 电话 · 微博 · 直播 · 票务" },
];

/* 底栏时辰盘：常用石牌快捷位 + 中央度日圆牌。完整牌位由右上角 ☰ 菜单呈现。
 * 度日走稳定的 endDayNow（幂等推进），不承载任何叙事计算。 */
export default function MudChrome({ tab, setTab }: { tab: MudTab; setTab: (t: MudTab) => void }) {
  const { game, endDayNow, busy } = useGame();
  const [flash, setFlash] = useState(false);
  if (!game) return null;

  const s = game.sim;
  const advance = () => {
    if (busy) return;
    endDayNow();
    setFlash(true);
    setTimeout(() => setFlash(false), 600);
  };

  // 底栏角标：手机未读消息数 · 形象页舆情危机（在场徽记，提示玩家该去哪一格）
  const phoneUnread = (game.phone?.threads ?? []).reduce((n, t) => n + (t.unread ?? 0), 0);
  const badgeOf = (id: MudTab): number | "!" | null =>
    id === "phone" ? (phoneUnread > 0 ? phoneUnread : null)
    : id === "npc" ? (s.crisis ? "!" : null)
    : null;

  const Slot = ({ id }: { id: MudTab }) => {
    const item = MENU.find((m) => m.id === id);
    if (!item) return null;
    const active = tab === id;
    const badge = badgeOf(id);
    return (
      <button
        onClick={() => setTab(id)}
        aria-current={active}
          className={`dream-bottom-slot group relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 font-serif transition-all duration-200 ${
          active ? "-translate-y-1 text-jade-deep" : "text-ink-soft hover:-translate-y-0.5 hover:text-ink"
        }`}
      >
        {/* 猫耳选中框：不改变按钮尺寸与点击范围。 */}
        <span
            className={`relative grid h-9 w-11 place-items-center rounded-2xl transition-all duration-200 ${
            active
              ? "bg-gradient-to-br from-white via-coral/20 to-jade/25 text-jade shadow-[0_8px_16px_-9px_var(--jade-deep)] ring-1 ring-white/80"
              : "group-hover:bg-jade/8"
          }`}
        >
          {active ? (
            <svg viewBox="0 0 40 36" className="relative h-9 w-10 drop-shadow-[0_2px_3px_rgba(235,133,168,0.35)]" aria-hidden="true">
              <defs>
                <linearGradient id={`paw-${id}`} x1="0" y1="0" x2="0.2" y2="1">
                  <stop stopColor="#fff5fa" />
                  <stop offset=".5" stopColor="#ffb6d1" />
                  <stop offset="1" stopColor="#e878aa" />
                </linearGradient>
              </defs>
              <g fill={`url(#paw-${id})`} stroke="#fff" strokeOpacity=".6" strokeWidth=".7">
                <ellipse cx="7.5" cy="16" rx="4.3" ry="5.2" transform="rotate(-30 7.5 16)" />
                <ellipse cx="15.2" cy="8.3" rx="4.2" ry="5.2" transform="rotate(-11 15.2 8.3)" />
                <ellipse cx="24.8" cy="8.3" rx="4.2" ry="5.2" transform="rotate(11 24.8 8.3)" />
                <ellipse cx="32.5" cy="16" rx="4.3" ry="5.2" transform="rotate(30 32.5 16)" />
                <path d="M20 17.2c-4.8 0-6.2 3.9-9.9 7.1-4.3 3.8-1 9.9 4.7 8.8 3.5-.7 6.9-.7 10.4 0 5.7 1.1 9-5 4.7-8.8-3.7-3.2-5.1-7.1-9.9-7.1Z" />
              </g>
            </svg>
          ) : <item.icon width={18} height={18} className="relative transition-opacity duration-200" />}
          {/* 未读/预警角标：浮于图标右上角 */}
          {badge != null && (
            <span className={`pointer-events-none absolute -right-1 -top-1 grid min-w-[16px] place-items-center rounded-full px-1 text-[9px] font-black leading-none text-white shadow-[0_2px_6px_-1px_rgba(0,0,0,0.4)] ring-[1.5px] ring-white/85 ${badge === "!" ? "h-4 bg-danger animate-pulse" : "h-4 bg-gradient-to-br from-[var(--coral)] to-[var(--jade)]"}`}>
              {badge === "!" ? "!" : badge > 99 ? "99+" : badge}
            </span>
          )}
          </span>
        <span className={`relative whitespace-nowrap rounded-full px-2 py-1 text-[11px] leading-none tracking-[0.04em] transition-colors duration-200 ${active ? "bg-white/65 font-bold text-jade-deep shadow-sm" : "border border-transparent"}`}>{active && <span className="mr-0.5 text-[9px] text-coral" aria-hidden>✦</span>}{item.label}</span>
      </button>
    );
  };

  return (
    <nav aria-label="游戏主导航" className="z-20 shrink-0">
      <div className="dream-bottom-nav relative w-full overflow-hidden border-t border-line/70 bg-gradient-to-b from-paper-2 to-paper px-1.5 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] font-serif shadow-[0_-4px_18px_-12px_var(--jade)] backdrop-blur-2xl">
        {/* 顶缘高光细线 + 中央柔光晕，抬升玻璃质感 */}
        <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" aria-hidden />
        <span className="pointer-events-none absolute left-1/2 top-0 h-16 w-24 -translate-x-1/2 rounded-full bg-[var(--jade)]/12 blur-2xl" aria-hidden />
        <div className="relative mx-auto grid max-w-3xl grid-cols-7 items-stretch gap-0.5">
          {BOTTOM_TAB_IDS.slice(0, 3).map(id => <Slot key={id} id={id} />)}

          {/* 度日推进 —— 中央时辰盘（走稳定 endDayNow，不承载叙事计算） */}
          <button
            onClick={advance}
            disabled={busy}
            title="推进"
            aria-label={busy ? "正在处理，请稍候" : `推进，当前第${s.week}周${weekdayName(s.day)}`}
            className={`dream-advance group relative isolate mx-auto flex h-[62px] w-full max-w-[58px] self-center flex-col items-center justify-center overflow-hidden rounded-[18px] border border-gold/50 bg-[linear-gradient(155deg,color-mix(in_srgb,var(--jade)_60%,white)_0%,var(--jade)_45%,var(--jade-deep)_72%,var(--coral)_100%)] text-white shadow-[0_6px_16px_-5px_color-mix(in_srgb,var(--jade)_55%,transparent),inset_0_1px_2px_rgba(255,255,255,0.8),inset_0_-2px_4px_color-mix(in_srgb,var(--jade-deep)_20%,transparent)] transition duration-200 hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jade active:scale-95 disabled:cursor-wait disabled:opacity-60 motion-reduce:transform-none ${flash ? "animate-flash" : ""}`}
          >
            <span className="pointer-events-none absolute inset-[3px] rounded-[14px] border border-white/30" aria-hidden />
            <span className="pointer-events-none absolute -top-6 left-0 h-16 w-full rounded-full bg-white/25 blur-xl" aria-hidden />
            <span className="pointer-events-none absolute inset-y-0 -left-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-[400%] motion-reduce:hidden" aria-hidden />
            <span className="relative grid h-9 w-9 place-items-center [text-shadow:0_1px_3px_color-mix(in_srgb,var(--jade-deep)_50%,black)]">
              {busy ? <span className="text-[11px] font-black">…</span> : (
                <svg viewBox="0 0 24 24" className="h-6 w-6 drop-shadow-[0_1px_2px_rgba(70,40,130,0.45)]" aria-hidden="true">
                  <path d="M4 12h14M13 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
          </button>

          {BOTTOM_TAB_IDS.slice(3).map(id => <Slot key={id} id={id} />)}
        </div>
      </div>
    </nav>
  );
}

