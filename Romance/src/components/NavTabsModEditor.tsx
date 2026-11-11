/**
 * 模组编辑器 · 底栏页签：顶部实时预览（机身宽 / 字体 / 线性 SVG / 选中态对齐局内 MudChrome），
 * 下方改名 · 拖拽排序 · 显隐；名称过长或超出格数即时提示。仅预览布局，不进完整游戏。
 */
import { Fragment, useMemo, useRef, useState } from "react";
import type { FeatureFlags, Terminology } from "../mods/types";
import {
  NAV_MAX_LABEL,
  buildNavPool,
  compactNavConfig,
  editorNavList,
  navConfigWarnings,
  navSizesFor,
  navTabsFromTerms,
  resolveNavSlots,
  termsFromNavTabs,
  type NavGlyphName,
  type NavTabCfg,
  type NavTabId,
} from "../lib/navTabsConfig";
import { NavGlyph } from "./MudChrome";

type Props = {
  terms?: Terminology;
  features?: FeatureFlags;
  navTabs?: NavTabCfg[];
  navSize?: 4 | 6 | 8;
  onChange: (next: {
    terms?: Terminology;
    navTabs?: NavTabCfg[];
    navSize?: 4 | 6 | 8;
  }) => void;
};

export default function NavTabsModEditor({ terms, features, navTabs, navSize, onChange }: Props) {
  // 功能注释：仅有 terms、尚未写 navTabs 时，用术语表种子列表，避免预览空档
  const seeded = useMemo(
    () => navTabs ?? navTabsFromTerms(terms),
    [navTabs, terms],
  );
  const pool = useMemo(() => buildNavPool(features, terms), [features, terms]);
  const sizes = navSizesFor(pool.length);
  const size = (sizes.includes(navSize as 4 | 6 | 8) ? navSize : sizes[0] ?? 4) as 4 | 6 | 8;
  const list = editorNavList(pool, seeded, size);
  const slots = resolveNavSlots(pool, seeded, size);
  const warnings = navConfigWarnings(list, size, pool.length);
  const [active, setActive] = useState<NavTabId>(slots[0]?.id ?? "home");
  const dragId = useRef<string | null>(null);

  const commit = (nextTabs: NavTabCfg[], nextSize = size) => {
    const packed = compactNavConfig(nextTabs, nextSize, pool.length);
    const nextTerms = termsFromNavTabs(nextTabs, terms);
    onChange({
      terms: nextTerms,
      navTabs: packed.navTabs,
      navSize: packed.navSize,
    });
  };

  const setSize = (n: 4 | 6 | 8) => {
    // 功能注释：改格数时按当前顺序保留前 n 个为显示，其余隐藏
    const ordered = list.map((x, i) => ({
      id: x.id,
      label: x.label || undefined,
      on: i < n,
    }));
    commit(ordered, n);
  };

  const setLabel = (id: string, label: string) => {
    const next = list.map((x) =>
      x.id === id ? { id: x.id, label: label || undefined, on: x.on } : { id: x.id, label: x.label || undefined, on: x.on },
    );
    commit(next, size);
  };

  const toggle = (id: string, on: boolean) => {
    if (id === "home") return;
    const onCount = list.filter((x) => x.on).length;
    if (on && onCount >= size) return;
    const next = list.map((x) =>
      x.id === id ? { id: x.id, label: x.label || undefined, on } : { id: x.id, label: x.label || undefined, on: x.on },
    );
    commit(next, size);
  };

  const reorder = (fromId: string, toId: string) => {
    if (fromId === "home" || toId === "home" || fromId === toId) return;
    const ids = list.map((x) => x.id);
    const from = ids.indexOf(fromId as NavTabId);
    const to = ids.indexOf(toId as NavTabId);
    if (from < 1 || to < 1) return;
    const nextIds = [...ids];
    nextIds.splice(from, 1);
    nextIds.splice(to, 0, fromId as NavTabId);
    const next = nextIds.map((id) => {
      const x = list.find((r) => r.id === id)!;
      return { id, label: x.label || undefined, on: x.on };
    });
    commit(next, size);
  };

  const dense = slots.length > 4;
  const half = Math.ceil(slots.length / 2);
  const left = slots.slice(0, half);
  const right = slots.slice(half);

  const SlotBtn = ({
    id,
    glyph,
    label,
    selected,
  }: {
    id: NavTabId;
    glyph: NavGlyphName;
    label: string;
    selected: boolean;
  }) => (
    <button
      type="button"
      onClick={() => setActive(id)}
      aria-current={selected || undefined}
      className={`group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 ${
        dense ? "px-0" : "px-1"
      } pb-2 pt-2 transition-colors duration-200 active:scale-95 ${
        selected ? "text-jade-deep" : "text-ink-soft hover:text-ink"
      }`}
    >
      <span className="relative grid h-7 w-12 place-items-center">
        <span
          aria-hidden
          className={`nav-hl pointer-events-none absolute inset-0 rounded-full transition-all duration-300 ${
            selected
              ? "nav-hl-on nav-pill bg-gradient-to-r from-jade/22 to-coral/18 opacity-100 shadow-[0_0_14px_-3px_var(--crystal-glow)]"
              : "scale-75 opacity-0 group-hover:scale-90 group-hover:bg-ink-soft/8 group-hover:opacity-100"
          }`}
        />
        <span className={`nav-ico relative grid place-items-center ${selected ? "nav-ico-on drop-shadow-[0_2px_6px_var(--crystal-glow)]" : ""}`}>
          <NavGlyph name={glyph} active={selected} size={20} />
        </span>
      </span>
      <span
        className={`nav-txt relative max-w-full truncate ${selected ? "nav-label nav-txt-on" : ""} ${
          dense ? "text-[10px] tracking-normal" : "text-[11px] tracking-wide"
        } leading-none transition-all ${selected ? "font-bold text-jade-deep" : "font-medium text-ink-soft/90"}`}
      >
        {label}
      </span>
    </button>
  );

  return (
    <div className="space-y-3">
      <p className="text-[11.5px] leading-relaxed text-ink-soft">
        上方实时预览与玩家底栏同宽、同字体、同线性图标与选中态；改名 / 排序 / 显隐即时同步。档案与支线是本体入口，不在此列表。此处只预览布局，完整试玩请用编辑器顶部「预览」。
      </p>

      {/* —— 顶部：与局内 MudChrome 同结构的底栏预览 —— */}
      <div
        className="overflow-hidden rounded-2xl border border-line shadow-sm"
        style={{ ["--crystal-a" as string]: "var(--jade)", ["--crystal-b" as string]: "var(--coral)", ["--crystal-glow" as string]: "rgba(196,150,255,0.45)" }}
      >
        <div className="border-b border-line/60 bg-paper px-3 py-1.5 text-[10.5px] font-bold tracking-[0.12em] text-ink-soft">
          底栏实时预览 · 点页签看选中态
        </div>
        <nav className="relative z-10 shrink-0">
          {/* NavGlyph 选中态使用 url(#crystalGrad)；预览区内自备同名渐变，与局内视觉一致 */}
          <svg width="0" height="0" className="absolute" aria-hidden>
            <defs>
              <linearGradient id="crystalGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="var(--crystal-a)" />
                <stop offset="1" stopColor="var(--coral)" />
              </linearGradient>
            </defs>
          </svg>
          <div className="relative overflow-visible bg-paper-2/88 shadow-[0_-10px_28px_-18px_var(--crystal-glow)] backdrop-blur-2xl backdrop-saturate-150">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--jade)_45%,var(--line))] to-transparent"
            />
            <div className="relative mx-auto flex max-w-3xl items-stretch text-ink">
              <div className="flex flex-1 items-stretch">
                {left.map((x) => (
                  <Fragment key={x.id}>
                    <SlotBtn id={x.id} glyph={x.glyph} label={x.label} selected={active === x.id} />
                  </Fragment>
                ))}
              </div>
              {/* 中央「日程」主行动位（预览不可推进） */}
              <div className="relative flex w-[72px] shrink-0 flex-col items-center justify-end pb-2">
                <span className="pointer-events-none mt-auto h-[11px]" aria-hidden />
                <div
                  title="正式游戏中由此打开日程；预览区不可推进"
                  className="group absolute -top-4 grid h-[56px] w-[56px] place-items-center rounded-full bg-paper-2 p-[3px] shadow-[0_8px_20px_-8px_var(--coral),0_0_0_4px_color-mix(in_srgb,var(--paper-2)_88%,transparent)]"
                >
                  <span aria-hidden className="advance-conic pointer-events-none absolute inset-0 rounded-full opacity-70" />
                  <span className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[var(--coral)] via-[color-mix(in_srgb,var(--coral)_55%,var(--jade))] to-[var(--jade)] text-white">
                    <span aria-hidden className="pointer-events-none absolute inset-x-2 top-0.5 h-[45%] rounded-t-full bg-gradient-to-b from-white/45 to-transparent" />
                    <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h12M13 6l6 6-6 6" />
                    </svg>
                    <span className="relative mt-0.5 font-serif text-[11.5px] font-black leading-none tracking-[0.2em] pl-[0.2em]">
                      日程
                    </span>
                  </span>
                </div>
              </div>
              <div className="flex flex-1 items-stretch">
                {right.map((x) => (
                  <Fragment key={x.id}>
                    <SlotBtn id={x.id} glyph={x.glyph} label={x.label} selected={active === x.id} />
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        </nav>
      </div>

      {warnings.length > 0 ? (
        <ul className="space-y-1 rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2 text-[11.5px] leading-relaxed text-amber-900">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}

      {/* 格数 */}
      <div>
        <p className="mb-1.5 text-[10.5px] font-bold tracking-[0.12em] text-ink-soft">格数（不含中间「日程」）</p>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.max(1, sizes.length)}, minmax(0, 1fr))` }}>
          {sizes.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setSize(n)}
              className={`rounded-xl border py-2 text-[13px] font-bold transition ${
                size === n ? "border-jade bg-jade/10 text-jade-deep" : "border-line bg-paper text-ink-soft hover:border-jade/50"
              }`}
            >
              {n} 格
            </button>
          ))}
        </div>
        <p className="mt-1 text-[10.5px] text-ink-soft">
          已显示 <b className="text-jade-deep">{list.filter((x) => x.on).length}</b> / {size} · 可用牌位 {pool.length}
        </p>
      </div>

      {/* 列表：拖拽排序 · 改名 · 显隐 */}
      <ul className="space-y-1.5">
        {list.map((row) => {
          const base = pool.find((p) => p.id === row.id)!;
          // 功能注释：AI/脏会话可能把 label 写成非字符串，禁止直接 .trim()
          const tooLong = String(row.label ?? "").trim().length > NAV_MAX_LABEL;
          return (
            <li
              key={row.id}
              draggable={row.id !== "home"}
              onDragStart={() => {
                dragId.current = row.id;
              }}
              onDragOver={(e) => {
                if (row.id === "home") return;
                e.preventDefault();
              }}
              onDrop={() => {
                const from = dragId.current;
                dragId.current = null;
                if (from) reorder(from, row.id);
              }}
              className={`flex items-center gap-2 rounded-2xl border px-2.5 py-2 ${
                row.on ? "border-jade/40 bg-paper" : "border-line bg-paper/50 opacity-70"
              } ${row.id !== "home" ? "cursor-grab active:cursor-grabbing" : ""}`}
            >
              {row.id === "home" ? (
                <span className="grid w-8 shrink-0 place-items-center text-[10.5px] font-bold leading-tight text-jade-deep">
                  固定
                  <br />
                  首位
                </span>
              ) : (
                <span className="grid w-8 shrink-0 place-items-center text-ink-soft" title="拖拽排序" aria-hidden>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="9" cy="6" r="1.6" />
                    <circle cx="15" cy="6" r="1.6" />
                    <circle cx="9" cy="12" r="1.6" />
                    <circle cx="15" cy="12" r="1.6" />
                    <circle cx="9" cy="18" r="1.6" />
                    <circle cx="15" cy="18" r="1.6" />
                  </svg>
                </span>
              )}
              <span className="grid h-8 w-8 shrink-0 place-items-center text-ink-soft">
                <NavGlyph name={base.glyph} active={false} size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <input
                  value={String(row.label ?? "")}
                  placeholder={row.placeholder}
                  maxLength={NAV_MAX_LABEL + 2}
                  onChange={(e) => setLabel(row.id, e.target.value)}
                  className={`w-full rounded-xl border bg-paper-2 px-3 py-1.5 text-[13px] font-bold text-ink outline-none focus:border-jade ${
                    tooLong ? "border-amber-400" : "border-line"
                  }`}
                />
                <p className={`mt-0.5 px-1 text-[10.5px] ${tooLong ? "font-semibold text-amber-700" : "text-ink-soft"}`}>
                  原名：{base.label}（最多 {NAV_MAX_LABEL} 字
                  {tooLong ? " · 已超长" : ""}）
                </p>
              </div>
              <button
                type="button"
                disabled={row.id === "home" || (!row.on && list.filter((x) => x.on).length >= size)}
                onClick={() => toggle(row.id, !row.on)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold transition disabled:opacity-40 ${
                  row.on ? "bg-jade text-white" : "border border-line text-ink-soft"
                }`}
              >
                {row.on ? "显示" : "隐藏"}
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => onChange({ terms: stripTabTerms(terms), navTabs: undefined, navSize: undefined })}
        className="w-full rounded-xl border border-line py-2 text-[12.5px] text-ink-soft transition hover:border-jade hover:text-jade"
      >
        恢复默认底部栏
      </button>

      <p className="text-[10.5px] leading-relaxed text-ink-soft">
        货币、名气、通告、作品等叫法请分别在「建角 / 通告库 / 成长规则 / 作品系统」里配置；旧模组术语字段仍会读取。
      </p>
    </div>
  );
}

/** 清除页签类术语键，保留其它旧术语 */
function stripTabTerms(terms?: Terminology): Terminology | undefined {
  if (!terms) return undefined;
  const next = { ...terms };
  for (const k of ["tabWorld", "tabIndustry", "tabNpc", "tabPhone", "tabImage", "tabSim"] as const) {
    delete next[k];
  }
  return Object.keys(next).length ? next : undefined;
}
