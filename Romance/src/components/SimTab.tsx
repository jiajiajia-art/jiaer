import { lazyPanel } from "../lib/lazyPanel";
import { carShopId, locOf, transportOn, TRANSPORT } from "../game/mud";
const ImageTab = lazyPanel(() => import("./ImageTab"));
import { useId, useState, type ReactNode } from "react";
import { useGame } from "../store/gameCtx";
import { spotName } from "../game/mapedits";
import { Avatar, BlockBar, Modal, toneChip, toneColor } from "./ui";
import { STAT_LABELS, STAT_ORDER, TITLES, CARS, FAME_TIERS, ZODIACS, carById, resaleValue, statMetaLabels, statDisplay, statTiers, tierOf, statRange, statColor, looksTiers } from "../game/data";
import { computeLooks } from "../game/logic";
import Backpack from "./Backpack";
import AttrValueEdit from "./AttrValueEdit";
import { feature, term } from "../mods/registry";
import { IconCamera, IconCheck, IconChevronDown, IconStar, StatusMark } from "../lib/icons";
import { ZodiacSign } from "../lib/zodiacIcons";

function IconCrown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M3 8.5l4 3.2L12 5l5 6.7 4-3.2-1.5 10.3a1.2 1.2 0 0 1-1.19 1H5.69a1.2 1.2 0 0 1-1.19-1L3 8.5z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="3" cy="8.5" r="1.4" fill="currentColor" />
      <circle cx="21" cy="8.5" r="1.4" fill="currentColor" />
      <circle cx="12" cy="4.6" r="1.4" fill="currentColor" />
    </svg>
  );
}

function IconCar({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 16v-3.6l1.6-4.1A2 2 0 0 1 7.5 7h9a2 2 0 0 1 1.9 1.3L20 12.4V16" />
      <path d="M4 16h1.9M10 16h4M18.1 16H20M5.2 12.2h13.6" />
      <circle cx="8" cy="16.2" r="2" />
      <circle cx="16" cy="16.2" r="2" />
    </svg>
  );
}

/** 分档进度：当前档名、下一档与档内进度（0–1）；已在最高档时按 cap 计算 */
function tierStep(v: number, tiers: readonly { min: number; label: string }[], cap: number) {
  const t = [...tiers].sort((a, b) => a.min - b.min);
  let i = 0;
  t.forEach((x, j) => { if (v >= x.min) i = j; });
  const lo = t[i]?.min ?? 0;
  const next = t[i + 1];
  const hi = next?.min ?? cap;
  return { label: t[i]?.label, next, pct: hi > lo ? Math.max(0, Math.min(1, (v - lo) / (hi - lo))) : 1 };
}

/* 档案分区卡：序号 + 英文眉题 + 中文标题 + 右侧补充信息；传 onToggle 即为可折叠分区。
 * 颜色 / 阴影只用主题 token，随皮肤（宣纸 / 毛玻璃 / 可爱 / 星紫 / 玛丽）与深浅色自动换肤；
 * sim-hero / sim-card 为皮肤钩子，主题若要单独装扮人物档案，可在 index.css 写 .skin-xxx .sim-card。 */
function Sec({ no, title, en, meta, open, onToggle, children }: {
  no: string; title: string; en?: string; meta?: ReactNode; open?: boolean; onToggle?: () => void; children: ReactNode;
}) {
  const head = (
    <>
      <span aria-hidden className="font-serif text-[24px] font-bold leading-[0.8] tabular-nums text-jade/30">{no}</span>
      <span className="shrink-0">
        {en && <span className="block text-[9px] font-bold uppercase leading-none tracking-[0.3em] text-jade/75">{en}</span>}
        <span className="mt-[5px] block font-serif text-[15px] font-bold leading-none tracking-[0.1em] text-ink">{title}</span>
      </span>
      {meta != null && <span className="ml-auto min-w-0 pl-2 text-right text-[11px] leading-tight text-ink-soft">{meta}</span>}
      {onToggle && (
        <IconChevronDown width={15} height={15} aria-hidden className={`shrink-0 text-ink-soft transition-transform duration-200 ${meta != null ? "" : "ml-auto"} ${open ? "rotate-180" : ""}`} />
      )}
    </>
  );
  return (
    <section className="sim-card relative overflow-hidden rounded-[22px] border border-line/75 bg-paper/90 shadow-[var(--shadow-ui)]">
      {onToggle ? (
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-end gap-2.5 px-4 py-3.5 text-left transition hover:bg-paper-2/40 sm:px-5">
          {head}
        </button>
      ) : (
        <header className="flex items-end gap-2.5 px-4 pt-3.5 sm:px-5">{head}</header>
      )}
      {(!onToggle || open) && (
        <div className={`px-4 pb-4 sm:px-5 ${onToggle ? "" : "pt-3"}`}>
          <div aria-hidden className="mb-3.5 h-px bg-gradient-to-r from-line via-line/50 to-transparent" />
          {children}
        </div>
      )}
    </section>
  );
}

/* 单项数值卡：名称 · 最强 · 分档 · 数值 + 进度条（自定义属性，及能力项不足 3 项时的列表） */
function StatRow({ label, value, tierLabel, showNum, tone, min, max, flash, numNode, top }: {
  label: string; value: number; tierLabel?: string; showNum: boolean; tone?: string; min: number; max?: number; flash?: boolean; numNode?: ReactNode; top?: boolean;
}) {
  return (
    <div className={`min-w-0 rounded-2xl border px-3 py-2.5 transition ${top ? "border-gold/45 bg-gold/[0.06]" : "border-line/60 bg-paper-2/40"}`}>
      <div className="mb-2 flex items-center gap-1.5 text-[12px]">
        <span className={`min-w-0 truncate ${top ? "font-bold text-ink" : "font-medium text-ink/90"}`}>{label}</span>
        {top && <span className="shrink-0 text-[10px] font-bold text-gold"><StatusMark kind="star">最强</StatusMark></span>}
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {tierLabel && <span className="rounded-full border px-1.5 text-[10px] font-bold leading-[1.5]" style={toneChip(tone)}>{tierLabel}</span>}
          {showNum && (numNode ?? <span className={`inline-block font-serif text-[14px] font-black tabular-nums text-ink ${flash ? "animate-flash" : ""}`}>{value}</span>)}
        </span>
      </div>
      {max ? <BlockBar value={value} min={min} max={max} tone={tone} /> : null}
    </div>
  );
}

/* 环形状态仪：细圆环示进度，中心为数值，下方名称 · 档位 · 小注 */
function Gauge({ label, value, pct, color, note, hint, tip, flash }: {
  label: string; value: number; pct: number; color: string; note?: string; hint?: string; tip?: string; flash?: boolean;
}) {
  const r = 27;
  const len = 2 * Math.PI * r;
  const arc = len * Math.max(0.03, Math.min(1, pct));
  return (
    <div className="flex min-w-0 flex-col items-center px-1.5 pb-3.5 pt-4 text-center" title={tip}>
      <div className="relative h-[68px] w-[68px]">
        <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx={32} cy={32} r={r} fill="none" strokeWidth={3} style={{ stroke: `color-mix(in srgb, ${color} 16%, transparent)` }} />
          <circle cx={32} cy={32} r={r} fill="none" strokeWidth={3} strokeLinecap="round" strokeDasharray={`${arc} ${len}`} style={{ stroke: color, transition: "stroke-dasharray 0.7s ease" }} />
        </svg>
        <span className={`absolute inset-0 grid place-items-center font-serif text-[20px] font-black tabular-nums text-ink ${flash ? "animate-flash" : ""}`}>{value}</span>
      </div>
      <p className="mt-2 pl-[0.16em] text-[12px] font-bold tracking-[0.16em] text-ink">{label}</p>
      {note && (
        <p className="mt-1 flex max-w-full items-center gap-1 text-[10.5px] font-semibold text-ink-soft">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
          <span className="truncate">{note}</span>
        </p>
      )}
      {hint && <p className="mt-0.5 max-w-full truncate text-[10px] text-ink-soft/75">{hint}</p>}
    </div>
  );
}

type Axis = { key: string; label: string; value: number; min: number; max: number; pct: number; tier?: string; showNum: boolean; tone?: string; flash?: boolean; top?: boolean };

/* 能力雷达：同心刻度环 + 数值多边形；顶点外的名称与数值用 HTML 绘制（字体清晰、可带变化闪烁），最强项以金星点亮 */
function Radar({ axes }: { axes: Axis[] }) {
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const n = axes.length;
  const R = 30; // 外环半径（占边长的百分比）
  const LR = 42.5; // 标签所在半径
  const at = (i: number, r: number): [number, number] => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
  };
  const poly = (rs: number[]) => rs.map((r, i) => at(i, r).map((v) => v.toFixed(2)).join(",")).join(" ");
  const shape = axes.map((a) => R * Math.max(0.05, a.pct));
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[300px]">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        <defs>
          <linearGradient id={`radar-${gid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: "var(--jade)", stopOpacity: 0.32 }} />
            <stop offset="1" style={{ stopColor: "var(--coral)", stopOpacity: 0.2 }} />
          </linearGradient>
        </defs>
        {[1, 0.75, 0.5, 0.25].map((f) => (
          <polygon key={f} points={poly(axes.map(() => R * f))} className={f === 1 ? "fill-paper-2/60 stroke-line" : "fill-none stroke-line/60"} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        {axes.map((a, i) => {
          const [x, y] = at(i, R);
          return <line key={a.key} x1={50} y1={50} x2={x} y2={y} className="stroke-line/55" strokeWidth={1} vectorEffect="non-scaling-stroke" />;
        })}
        <polygon points={poly(shape)} fill={`url(#radar-${gid})`} className="stroke-jade" strokeWidth={1.6} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {axes.map((a, i) => {
          const [x, y] = at(i, shape[i]);
          return <circle key={a.key} cx={x} cy={y} r={a.top ? 1.9 : 1.3} className={a.top ? "fill-gold stroke-paper-2" : "fill-paper-2 stroke-jade"} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />;
        })}
      </svg>
      {axes.map((a, i) => {
        const [x, y] = at(i, LR);
        return (
          <div key={a.key} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center whitespace-nowrap text-center" style={{ left: `${x}%`, top: `${y}%` }}>
            <span className={`text-[11px] leading-tight ${a.top ? "font-bold text-gold" : "font-medium text-ink-soft"}`}>{a.top && <IconStar size={10} className="mr-0.5 inline" />}{a.label}</span>
            <span className={`inline-block font-serif text-[14px] font-black leading-tight tabular-nums ${a.top ? "text-jade-deep" : "text-ink"} ${a.flash ? "animate-flash" : ""}`}>{a.showNum ? a.value : a.tier}</span>
            {a.showNum && a.tier && <span className="text-[9.5px] font-bold leading-tight" style={{ color: toneColor(a.tone) }}>{a.tier}</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function SimTab({ embedded = false }: { embedded?: boolean }) {
  const { game, equipTitle, setActiveCar, setPlayerAvatar, lastChanges } = useGame();
  const [openHistory, setOpenHistory] = useState(false);
  const [openTitles, setOpenTitles] = useState(false); // 头衔弹窗
  const [openImage, setOpenImage] = useState(false); // 形象弹窗（原「形象」页签）
  if (!game || !game.sim) return null;
  const s = game.sim;
  const p = game.player;
  const changedLabels = new Set(lastChanges.map((c) => c.replace(/\s*[+-]?\d+$/, "").replace(/好感.*/, "").trim()));
  const extra = p.extra.filter((e) => e.label !== "父亲职业" && e.label !== "母亲职业"); // 父母职业在「双亲档案」里
  const ex = (l: string) => extra.find((e) => e.label === l)?.value;

  // 身份速览条：年龄 · 性别 · 生日 · 星座（配线稿星座符号）；其余设定进「基本资料」逐行列出
  const birthday = ex("生日");
  const sign = ex("星座");
  const zodiac = sign ? ZODIACS.find((z) => z.name === sign) : undefined;
  const facts = [
    p.age ? { k: "年龄", v: p.age, unit: "岁" } : null,
    p.gender ? { k: "性别", v: p.gender } : null,
    birthday ? { k: "生日", v: birthday } : null,
    sign ? { k: "星座", v: sign, icon: zodiac ? <ZodiacSign id={zodiac.id} width={14} height={14} className="shrink-0 text-gold" /> : undefined } : null,
  ].filter(Boolean) as { k: string; v: string; unit?: string; icon?: ReactNode }[];
  const rows: [string, string][] = [
    ...(p.background ? [["家世", p.background] as [string, string]] : []),
    ...extra.filter((e) => e.label !== "生日" && e.label !== "星座").map((e) => [e.label, e.value] as [string, string]),
  ];
  const earnedTitles = TITLES.filter((t) => s.titles.includes(t.id));
  const wornTitle = earnedTitles.find((t) => t.id === s.equippedTitle) ?? null;
  const showCars = feature("cars") && transportOn() && CARS.length > 0 && TRANSPORT.some((m) => m.ownCar) && (!!(s.cars ?? []).length || (!!carShopId() && !!locOf(carShopId()!)));
  const cars = s.cars ?? [];
  const shop = carShopId() ? locOf(carShopId()!) : undefined;
  const shopName = shop ? (spotName(game, shop.id) ?? shop.name) : undefined;

  // 核心状态：名气 / 容貌的圆环表示「距下一档」的档内进度，压力按 0–100
  const looks = computeLooks(s);
  const fameStep = tierStep(s.fame, FAME_TIERS, 999);
  const looksStep = tierStep(looks, looksTiers(), 999);
  const toNext = (v: number, st: ReturnType<typeof tierStep>) => (st.next ? `距下一档 ${st.next.min - v}` : "已达最高档");
  const gauges: { k: string; v: number; pct: number; c: string; note?: string; hint?: string; tip?: string }[] = [
    { k: statMetaLabels().fame, v: s.fame, pct: fameStep.pct, c: "var(--gold)", note: fameStep.label, hint: toNext(s.fame, fameStep), tip: fameStep.next && `下一档「${fameStep.next.label}」· ${fameStep.next.min}` },
    { k: statMetaLabels().looks, v: looks, pct: looksStep.pct, c: "var(--coral)", note: looksStep.label, hint: toNext(looks, looksStep), tip: looksStep.next && `下一档「${looksStep.next.label}」· ${looksStep.next.min}` },
    {
      k: statMetaLabels().stress, v: s.stress, pct: s.stress / 100,
      c: s.stress >= 75 ? "var(--danger)" : s.stress >= 50 ? "var(--gold)" : "var(--jade)",
      note: s.stress >= 75 ? "濒临崩溃" : s.stress >= 50 ? "有些吃力" : "状态良好",
      hint: s.stress >= 75 ? "容貌受影响" : "警戒线 75",
    },
  ];

  // 能力雷达：各项按自身取值范围归一；各项范围一致时（常见），满格刻度随当前最高值放大到整数档，成长初期的形状也清晰可读
  const ranges = STAT_ORDER.map((k) => statRange(k));
  const r0 = ranges[0];
  const uniform = !!r0 && ranges.every((r) => r.min === r0.min && r.max === r0.max);
  const vals = STAT_ORDER.map((k) => s.stats[k]);
  const peak = Math.max(0, ...vals);
  const scale = uniform ? Math.min(r0.max, [50, 100, 150, 200, 300, 400, 500, 600, 800, 1000].find((v) => v >= r0.min + (peak - r0.min) * 1.15) ?? r0.max) : undefined;
  const hasTop = vals.some((v) => v !== vals[0]);
  const axes: Axis[] = STAT_ORDER.map((k, i) => {
    const { min, max } = ranges[i];
    const v = s.stats[k];
    const tl = statDisplay() !== "num" ? tierOf(v, statTiers()[k]) : undefined;
    return {
      key: k, label: STAT_LABELS[k], value: v, min, max, pct: Math.max(0, Math.min(1, (v - min) / Math.max(1, (scale ?? max) - min))),
      tier: tl, showNum: !tl || statDisplay() === "both", tone: statColor(k), flash: changedLabels.has(STAT_LABELS[k]), top: hasTop && v === peak,
    };
  });
  const ranked = [...axes].sort((a, b) => b.value - a.value);
  const topNames = axes.filter((a) => a.top).map((a) => a.label);
  const avg = Math.round(vals.reduce((t, v) => t + v, 0) / Math.max(1, vals.length));

  let secNo = 0;
  const no = () => String(++secNo).padStart(2, "0");

  return (
    <div className={embedded ? "w-full" : "w-full pb-5"}>
      {openImage && <Modal title={term("tabImage", "形象")} wide onClose={() => setOpenImage(false)}><ImageTab /></Modal>}
      <div className={`mx-auto max-w-2xl space-y-3.5 ${embedded ? "pt-1" : "px-4 py-4"}`}>

      {/* ═══ 档案头卡：艺人小卡 ═══ */}
      <section className="sim-hero relative overflow-hidden rounded-[26px] border border-line/80 bg-paper shadow-[var(--shadow-ui-lift)]">
        {/* 顶部柔光：右上玫瑰 + 左上流金两点晕染 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-48"
          style={{ background: "radial-gradient(110% 85% at 100% 0%, color-mix(in srgb, var(--coral) 22%, transparent), transparent 62%), radial-gradient(80% 75% at 0% 0%, color-mix(in srgb, var(--gold) 13%, transparent), transparent 60%)" }}
        />

        <div className="relative px-4 pt-4 sm:px-6 sm:pt-5">
          <div className="flex items-start gap-4">
            {/* 小卡相框：细线内框 + 四角金色取景角 */}
            <div className="relative shrink-0 p-[5px]">
              {[
                "left-0 top-0 rounded-tl-[16px] border-l-[1.5px] border-t-[1.5px]",
                "right-0 top-0 rounded-tr-[16px] border-r-[1.5px] border-t-[1.5px]",
                "bottom-0 left-0 rounded-bl-[16px] border-b-[1.5px] border-l-[1.5px]",
                "bottom-0 right-0 rounded-br-[16px] border-b-[1.5px] border-r-[1.5px]",
              ].map((c) => <span key={c} aria-hidden className={`pointer-events-none absolute h-5 w-5 border-gold/65 ${c}`} />)}
              <div className="rounded-[19px] border border-jade/20 bg-paper-2/80 p-[3px]">
                <Avatar src={p.avatar} name={p.name} size={84} square onPick={setPlayerAvatar} />
              </div>
            </div>

            <div className="min-w-0 flex-1 pt-0.5">
              {/* 眉题行：佩戴中的头衔（或佩戴入口） + 形象入口 */}
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                <button
                  type="button"
                  onClick={() => setOpenTitles(true)}
                  aria-label="查看头衔"
                  className={`inline-flex min-w-0 items-center gap-1 text-[11px] font-bold tracking-[0.06em] text-gold transition hover:opacity-75 ${wornTitle ? "rounded-full border border-gold/40 bg-gradient-to-r from-gold/15 to-gold/[0.04] px-2 py-[2px]" : ""}`}
                >
                  <IconCrown className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{wornTitle ? wornTitle.name : `佩戴头衔${earnedTitles.length ? ` · ${earnedTitles.length}` : ""}`}</span>
                  {!wornTitle && <span aria-hidden className="opacity-60">›</span>}
                </button>
                {feature("imageCrisis") && (
                  <button
                    type="button"
                    onClick={() => setOpenImage(true)}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-[3px] text-[11px] font-bold transition ${s.crisis ? "border-danger/45 bg-danger/10 text-danger" : "border-jade/35 text-jade-deep hover:bg-jade/[0.07]"}`}
                  >
                    <IconCamera width={12} height={12} />
                    <span>{term("tabImage", "形象")}</span>
                    {s.crisis ? <span className="rounded-full bg-danger px-1.5 text-[9.5px] leading-[1.6] text-white">危机</span> : <span aria-hidden className="opacity-60">›</span>}
                  </button>
                )}
              </div>

              <h2 className="mt-1.5 font-serif text-[26px] font-black leading-[1.15] tracking-[0.06em] text-ink [overflow-wrap:anywhere]">{p.name}</h2>
              {(p.identity || p.klass) && (
                <p className="mt-1.5 flex min-w-0 items-center gap-2 text-[12px] font-bold tracking-[0.06em] text-jade-deep">
                  <span aria-hidden className="h-px w-4 shrink-0 bg-gradient-to-r from-jade/70 to-jade/10" />
                  <span className="truncate">{[p.identity, p.klass].filter(Boolean).join(" · ")}</span>
                </p>
              )}

            </div>
          </div>

          {/* 身份速览条：发丝线分栏 */}
          {facts.length > 0 && (
            <dl className="mt-4 grid divide-x divide-line/60 border-y border-line/60" style={{ gridTemplateColumns: `repeat(${facts.length}, minmax(0, 1fr))` }}>
              {facts.map((f) => (
                <div key={f.k} className="min-w-0 px-0.5 py-2.5 text-center">
                  <dt className="pl-[0.2em] text-[10px] font-medium tracking-[0.2em] text-ink-soft/80">{f.k}</dt>
                  <dd className="mt-1 flex items-baseline justify-center gap-1 font-serif text-[13px] font-bold text-ink sm:text-[14px]">
                    {f.icon && <span className="self-center">{f.icon}</span>}
                    <span className="truncate">{f.v}</span>
                    {f.unit && <span className="text-[11px] font-medium text-ink-soft">{f.unit}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {/* 人物小传：左侧渐隐细线引文 */}
          {p.description && (
            <blockquote className="relative mt-4 pl-4">
              <span aria-hidden className="absolute bottom-1 left-0 top-1 w-[2px] rounded-full bg-gradient-to-b from-jade/60 via-coral/40 to-transparent" />
              <p className="font-serif text-[13px] leading-[1.85] text-ink/85">{p.description}</p>
            </blockquote>
          )}
        </div>

        {/* 核心状态：名气 · 容貌 · 压力 */}
        <div className="relative mt-4 grid grid-cols-3 divide-x divide-line/50 border-t border-line/60 bg-gradient-to-b from-transparent to-jade/[0.035]">
          {gauges.map((g) => (
            <Gauge key={g.k} label={g.k} value={g.v} pct={g.pct} color={g.c} note={g.note} hint={g.hint} tip={g.tip} flash={changedLabels.has(g.k)} />
          ))}
        </div>
      </section>

      {/* ═══ 基本资料：发丝线条目表 ═══ */}
      {rows.length > 0 && (
        <Sec no={no()} title="基本资料" en="PROFILE">
          <dl className="-my-1.5 grid gap-x-8 sm:grid-cols-2 [&>*:first-child]:border-t-0 sm:[&>*:nth-child(2)]:border-t-0">
            {rows.map(([k, v]) => (
              <div key={k} className="flex min-w-0 items-baseline gap-3 border-t border-dashed border-line/70 py-2.5">
                <dt className="min-w-[4.5em] shrink-0 text-[11px] font-medium tracking-[0.14em] text-ink-soft">{k}</dt>
                <dd className="min-w-0 flex-1 font-serif text-[13.5px] font-bold leading-snug text-ink">{v || "—"}</dd>
              </div>
            ))}
          </dl>
        </Sec>
      )}

      {/* ═══ 个人能力：雷达图（宽屏右侧附排名） ═══ */}
      {axes.length > 0 && (
        <Sec no={no()} title="个人能力" en="APTITUDE" meta={`${axes.length} 项 · 均值 ${avg}`}>
          {axes.length >= 3 ? (
            <div className="sm:grid sm:grid-cols-[minmax(0,280px)_minmax(0,1fr)] sm:items-center sm:gap-6">
              <div>
                <Radar axes={axes} />
                {(topNames.length > 0 || scale != null) && (
                  <p className="mt-1 flex flex-wrap items-center justify-center gap-x-2 text-center text-[10.5px] text-ink-soft/80">
                    {topNames.length > 0 && <span><b className="inline-flex items-center gap-0.5 font-bold text-gold"><IconStar size={12} /> 最强</b> {topNames.join("、")}</span>}
                    {topNames.length > 0 && scale != null && <span aria-hidden className="text-line">|</span>}
                    {scale != null && <span>满格 {scale}</span>}
                  </p>
                )}
              </div>
              <ol className="hidden min-w-0 sm:block">
                {ranked.map((a, i) => (
                  <li key={a.key} className="flex items-center gap-2.5 border-b border-dashed border-line/50 py-[7px] last:border-b-0">
                    <span className="w-4 shrink-0 text-right font-serif text-[11px] tabular-nums text-ink-soft/60">{i + 1}</span>
                    <span className={`w-14 shrink-0 truncate text-[12.5px] ${a.top ? "font-bold text-ink" : "text-ink/85"}`}>{a.label}</span>
                    <span className="relative h-[5px] min-w-0 flex-1 overflow-hidden rounded-full bg-line/35">
                      <span className={`absolute inset-y-0 left-0 rounded-full ${a.top ? "bg-gold" : "bg-jade/75"}`} style={{ width: `${Math.max(4, a.pct * 100)}%` }} />
                    </span>
                    <span className={`min-w-[2.5em] shrink-0 text-right font-serif text-[13.5px] font-black tabular-nums ${a.top ? "text-jade-deep" : "text-ink"}`}>{a.showNum ? a.value : a.tier}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {axes.map((a) => (
                <StatRow key={a.key} label={a.label} value={a.value} tierLabel={a.tier} showNum={a.showNum} tone={a.tone} min={a.min} max={a.max} flash={a.flash} top={a.top} />
              ))}
            </div>
          )}
        </Sec>
      )}

      {/* 自定义属性（模组「角色属性」定义，AI 随剧情增减） */}
      {(game.attrDefs?.length ?? 0) > 0 && (
        <Sec no={no()} title="角色属性" en="ATTRIBUTES" meta="点数值可直接修改">
          <div className="grid grid-cols-2 gap-2.5">
            {game.attrDefs!.map((d) => {
              const v = game.player.attrs.find((a) => a.key === d.id)?.value ?? d.init;
              const mode = d.display ?? "both";
              const tl = mode !== "num" ? tierOf(v, d.tiers) : undefined;
              return (
                <div key={d.id} title={d.desc}>
                  <StatRow label={`${d.icon ? `${d.icon} ` : ""}${d.label}`} value={v} tierLabel={tl} showNum={!tl || mode === "both"} tone={d.color ?? "coral"}
                    min={d.min ?? 0} max={d.max || undefined} numNode={<AttrValueEdit def={d} flash={changedLabels.has(d.label)} />} />
                </div>
              );
            })}
          </div>
        </Sec>
      )}

      {/* ═══ 随身：行囊 + 座驾 ═══ */}
      <Sec no={no()} title="随身" en="BELONGINGS" meta={`行囊 ${(s.bag ?? []).length + (game.contract ? 1 : 0)} 件 · 点选使用 / 赠予`}>
        <Backpack embedded />
        {showCars && (
          <div className="mt-4 border-t border-dashed border-line/60 pt-3.5">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="font-serif text-[13px] font-bold tracking-[0.08em] text-ink">私人座驾</span>
              <span className="text-[8.5px] font-bold uppercase tracking-[0.3em] text-jade/70">GARAGE</span>
              <span aria-hidden className="h-px min-w-4 flex-1 bg-gradient-to-r from-line to-transparent" />
              {cars.length > 0 && <span className="shrink-0 text-[10.5px] text-ink-soft">点选设为出行座驾</span>}
            </div>
            {cars.length ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {cars.map((id) => {
                  const c = carById(id);
                  if (!c) return null;
                  const on = s.activeCar === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setActiveCar(on ? null : id)}
                      aria-pressed={on}
                      title={`${c.desc} · 回收价 ¥${resaleValue(c).toLocaleString("zh-CN")}`}
                      className={`relative flex min-w-0 items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition ${on ? "border-jade/55 bg-jade/[0.07]" : "border-line/70 bg-paper-2/40 hover:border-jade/40"}`}
                    >
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${on ? "bg-jade/15 text-jade" : "bg-ink/[0.04] text-ink-soft"}`}><IconCar /></span>
                      <span className="min-w-0">
                        <span className={`block truncate text-[13px] font-bold ${on ? "text-jade-deep" : "text-ink"}`}>{c.name}</span>
                        <span className="block truncate text-[10.5px] text-ink-soft">{on ? "出行座驾 · 免费" : c.tag}</span>
                      </span>
                      {on && <IconCheck width={13} height={13} className="absolute right-2 top-2 text-jade" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line/80 px-3.5 py-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-jade/25 bg-jade/[0.06] text-jade"><IconCar /></span>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-bold text-ink">车位还空着</p>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-ink-soft">
                    {shopName ? <>去「<b className="font-semibold text-jade-deep">{shopName}</b>」挑一辆（共 {CARS.length} 款），</> : null}有车后出行免费又自在。
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </Sec>

      {/* ═══ 背景履历：可折叠时间线，最新在上 ═══ */}
      <Sec no={no()} title="背景履历" en="CHRONICLE" meta={`${p.history.length} 条`} open={openHistory} onToggle={() => setOpenHistory((v) => !v)}>
        {p.history.length ? (
          <div className="relative">
            <span aria-hidden className="absolute bottom-2 left-[5px] top-2 w-px bg-gradient-to-b from-jade/50 via-line to-transparent" />
            <ol className="space-y-4 pl-6">
              {[...p.history].reverse().map((h, i) => (
                <li key={i} className="relative">
                  <span aria-hidden className={`absolute -left-6 top-[3px] grid h-[11px] w-[11px] place-items-center rounded-full border bg-paper-2 ${i === 0 ? "border-jade" : "border-line"}`}>
                    {i === 0 && <span className="h-[5px] w-[5px] rounded-full bg-jade" />}
                  </span>
                  <p className="flex flex-wrap items-center gap-x-1.5 text-[10.5px] tracking-wide text-ink-soft">
                    <span>{h.time}</span>
                    <span aria-hidden className="text-line">·</span>
                    <span>第 {h.turn} 回合</span>
                    {i === 0 && <span className="rounded-full border border-jade/30 px-1.5 text-[9.5px] font-bold leading-[1.5] text-jade">最新</span>}
                  </p>
                  <p className="mt-1 font-serif text-[13.5px] font-bold leading-snug text-ink">{h.title}</p>
                  {h.detail && <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">{h.detail}</p>}
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <p className="py-3 text-center text-[12.5px] text-ink-soft">履历还是空白，等你去书写。</p>
        )}
      </Sec>


      {/* 头衔弹窗：由头部皇冠按钮唤出 */}
      {openTitles && (
        <Modal title="我的头衔" onClose={() => setOpenTitles(false)}>
          {earnedTitles.length ? (
            <>
              <p className="mb-3 text-[12px] text-ink-soft">已解锁 {earnedTitles.length} 枚 · 点选佩戴 / 摘下，佩戴的头衔会展示在名字旁。</p>
              <div className="flex flex-wrap gap-2">
                {earnedTitles.map((t) => {
                  const worn = s.equippedTitle === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => equipTitle(t.id)}
                      title={t.desc}
                      aria-pressed={worn}
                      className={`rounded-sm border px-3 py-1.5 text-left transition ${
                        worn ? "border-solid border-gold bg-gold/12" : "border-dashed border-line hover:border-gold/60 hover:bg-gold/5"
                      }`}
                    >
                      <span className={`block text-[13px] font-bold ${worn ? "text-gold" : "text-ink"}`}>
                        {worn ? <span className="inline-flex items-center gap-1"><IconCheck size={12} />{t.name}</span> : t.name}
                      </span>
                      <span className="block text-[10.5px] text-ink-soft">{t.tier} · {t.desc}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <IconCrown className="h-10 w-10 text-gold/70" />
              <p className="text-[14px] font-bold text-ink">尚未解锁头衔</p>
              <p className="max-w-xs text-[12.5px] leading-relaxed text-ink-soft">
                尚未解锁头衔——在名气、口碑、作品与奖项上争一席之地，达标即可获得并佩戴。
              </p>
            </div>
          )}
        </Modal>
      )}

      </div>
    </div>
  );
}
