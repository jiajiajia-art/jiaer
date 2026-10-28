import { useState, type ReactNode } from "react";
import type { Diary, WeekReport } from "../store/gameCtx";
import { IconHeart, IconPin, IconScroll, IconSpark, IconStar, IconUser, IconUsers } from "../lib/icons";

/* 周结算报告卡：评级横幅 → 数值变化格 → 本周纪事时间线 → 结算明细 → 预警。全部主题变量驱动。 */

const GRADE_TONE: Record<string, string> = { 完美: "gold", 大成功: "coral", 成功: "jade", 失败: "ink-soft", 糟糕: "danger" };
// 数值上升反而是坏事的项
const BAD_UP = /压力|黑粉|负债|疲劳/;
/** 功能注释：纪事标签用线性图标，禁止装饰字符 */
const TAG_ICON: Record<string, ReactNode> = {
  居家: <IconUser size={12} />,
  购物: <IconStar size={12} />,
  交涉: <IconScroll size={12} />,
  踩点: <IconPin size={12} />,
  剧情: <IconSpark size={12} />,
  情感: <IconHeart size={12} />,
  定情: <IconHeart size={12} />,
  人脉: <IconUsers size={12} />,
  纪事: <IconScroll size={12} />,
};

function parseChange(c: string) {
  const m = c.match(/^(.+?)\s*([+-])\s*([\d.,]+)(.*)$/);
  if (!m) return { label: c, sign: 0, val: "" };
  return { label: m[1].trim(), sign: m[2] === "+" ? 1 : -1, val: `${m[2]}${m[3]}${m[4]}`.trim() };
}

/* 文本里的「+3 / -5」高亮成小徽标 */
function Rich({ text }: { text: string }) {
  const parts = text.split(/([^\s，。、；·（）()]+?\s?[+-]\d+(?:\.\d+)?万?)/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^(.+?)\s?([+-])(\d+(?:\.\d+)?万?)$/);
        if (!m) return <span key={i}>{p}</span>;
        const good = (m[2] === "+") !== BAD_UP.test(m[1]);
        return (
          <b key={i} className="mx-0.5 inline-block rounded-[4px] px-1 text-[11px] font-bold" style={{ color: `var(--${good ? "jade" : "danger"})`, background: `color-mix(in srgb, var(--${good ? "jade" : "danger"}) 12%, transparent)` }}>
            {m[1]} {m[2]}{m[3]}
          </b>
        );
      })}
    </>
  );
}

type Bill = { lines: { label: string; amount: number }[]; total: number; monthEnd?: boolean } | null | undefined;
const yuan = (v: number) => `${v < 0 ? "−" : ""}¥${Math.abs(Math.round(v)).toLocaleString("zh-CN")}`;
const head = "mb-1.5 text-[10.5px] font-bold tracking-[0.25em] text-ink-soft";

/* 周结算报告：一张卡讲清楚——总评 → 预警 → 数值（起止） → 收支账单 → 纪事（可展开） → 结算备注 */
export default function WeekReportCard({ report: r, changes, diary, bill, earned, onNext }: { report: WeekReport; changes: string[]; diary?: Diary; bill?: Bill; earned?: number; onNext?: () => void }) {
  const [allEvents, setAllEvents] = useState(false);
  const tone = (r.grade && GRADE_TONE[r.grade]) || "jade";
  const cs = changes.map(parseChange);
  const good = cs.filter((c) => c.sign && (c.sign > 0) !== BAD_UP.test(c.label)).length;
  const bad = cs.filter((c) => c.sign && (c.sign > 0) === BAD_UP.test(c.label)).length;
  const verdict = r.warnings.length ? { t: "下周需要调整", c: "danger" }
    : good > bad ? { t: `收获颇丰的${r.span ?? "一周"}`, c: "jade" } : bad > good ? { t: `有些吃力的${r.span ?? "一周"}`, c: "coral" } : { t: `平稳度过的${r.span ?? "一周"}`, c: "ink-soft" };
  const rows = diary?.rows ?? [];
  const fmt = (label: string, v: number) => (label === "资金" ? yuan(v) : String(v));
  const upGood = (label: string, from: number, to: number) => (BAD_UP.test(label) ? to < from : to > from);
  const shown = allEvents ? r.events : r.events.slice(0, 3);
  const showBill = !r.span && !!bill;
  return (
    <div className="space-y-4">
      {/* 总评 */}
      <div className="flex items-center gap-3 rounded-[12px] border border-line px-4 py-3" style={{ background: `linear-gradient(135deg, color-mix(in srgb, var(--${tone}) 14%, var(--paper-2)), var(--paper-2))` }}>
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[10px] font-serif text-white shadow-sm" style={{ background: `var(--${tone})` }}>
          <span className={`font-black leading-none ${r.span ? "text-[13px]" : "text-[20px]"}`}>{r.span ?? r.week}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-[17px] font-black leading-tight" style={{ color: `var(--${verdict.c === "ink-soft" ? "ink" : verdict.c})` }}>{verdict.t}</p>
          <p className="mt-0.5 text-[11.5px] text-ink-soft">
            {r.span ? `第 ${r.week}～${r.weekTo ?? r.week} 周` : `第 ${r.week} 周结算`}{diary ? ` · ${diary.date} · ${diary.season}` : ""}{r.grade && <span className="ml-1.5 font-bold" style={{ color: `var(--${tone})` }}>{r.grade}</span>}
          </p>
        </div>
      </div>

      {/* 预警：一行标题 + 一行建议 */}
      {r.warnings.map((w, i) => {
        const [title, ...rest] = w.replace(/^\s*/, "").split(/——/);
        return (
          <div key={i} className="flex gap-2.5 rounded-[10px] px-3 py-2.5" style={{ background: "color-mix(in srgb, var(--danger) 8%, transparent)" }}>
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-black text-white" style={{ background: "var(--danger)" }}>!</span>
            <div className="min-w-0 text-[12.5px] leading-relaxed">
              <p className="font-bold" style={{ color: "var(--danger)" }}>{title}</p>
              {rest.length > 0 && <p className="text-ink-soft">{rest.join("——")}</p>}
            </div>
          </div>
        );
      })}

      {/* 数值：有手记时给出起止值，否则退回变化格 */}
      {rows.length > 0 ? (
        <section>
          <p className={head}>数值</p>
          <ul className="divide-y divide-dashed divide-line rounded-[10px] border border-line bg-paper-2 px-3">
            {rows.map((x) => {
              const g = upGood(x.label, x.from, x.to);
              const d = x.to - x.from;
              return (
                <li key={x.label} className="flex items-center gap-2 py-1.5 text-[12.5px]">
                  <span className="w-10 shrink-0 font-bold text-ink">{x.label}</span>
                  <span className="min-w-0 flex-1 truncate tabular-nums text-ink-soft">{fmt(x.label, x.from)} → <b className="text-ink">{fmt(x.label, x.to)}</b></span>
                  <span className="shrink-0 font-mono text-[12px] font-bold" style={{ color: `var(--${g ? "jade" : "danger"})` }}>{d > 0 ? "+" : "−"}{x.label === "资金" ? yuan(Math.abs(d)).replace("¥", "¥") : Math.abs(d)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : cs.length > 0 && (
        <section>
          <p className={head}>{r.span ? "期间变化" : "数值"}</p>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {cs.map((c, i) => {
              const g = c.sign === 0 ? null : (c.sign > 0) !== BAD_UP.test(c.label);
              return (
                <div key={i} className="rounded-[8px] border border-line bg-paper-2 px-2 py-1.5 text-center">
                  <p className="truncate text-[10.5px] text-ink-soft">{c.label}</p>
                  <p className="font-serif text-[15px] font-black tabular-nums" style={{ color: `var(--${g === null ? "ink-soft" : g ? "jade" : "danger"})` }}>{c.val || "—"}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 收支账单：解释资金为什么变了 */}
      {showBill && (
        <section>
          <p className={head}>本周收支{bill!.monthEnd ? " · 含月度账单" : ""}</p>
          <div className="rounded-[10px] border border-line bg-paper-2 px-3 py-1.5 text-[12.5px]">
            {!!earned && <div className="flex justify-between py-1"><span className="text-ink-soft">通告 / 打工进账</span><span className="font-mono font-semibold text-jade">+{yuan(earned)}</span></div>}
            {bill!.lines.map((l, i) => (
              <div key={i} className="flex justify-between py-1"><span className="text-ink-soft">{l.label}</span><span className="font-mono font-semibold text-ink">−{yuan(l.amount)}</span></div>
            ))}
            <div className="mt-0.5 flex justify-between border-t border-dashed border-line py-1 font-bold"><span className="text-ink">结算合计</span><span className="font-mono" style={{ color: `var(--${(earned ?? 0) - bill!.total < 0 ? "danger" : "jade"})` }}>{(earned ?? 0) - bill!.total < 0 ? "" : "+"}{yuan((earned ?? 0) - bill!.total)}</span></div>
          </div>
        </section>
      )}

      {/* 本周纪事：默认 3 条，可展开 */}
      {r.events.length > 0 && (
        <section>
          <p className={head}>{r.span ? "期间纪事" : "本周纪事"} · {r.events.length}</p>
          <ul className="space-y-1.5">
            {shown.map((e, i) => (
              <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-ink">
                <span className="mt-[3px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-coral/12 text-coral" title={e.tag}>{TAG_ICON[e.tag] ?? <IconScroll size={12} />}</span>
                <span className="min-w-0"><Rich text={e.text} /></span>
              </li>
            ))}
          </ul>
          {r.events.length > 3 && (
            <button type="button" onClick={() => setAllEvents((v) => !v)} className="mt-1.5 text-[11.5px] font-semibold text-jade">
              {allEvents ? "收起" : `展开其余 ${r.events.length - 3} 条`}
            </button>
          )}
        </section>
      )}

      {/* 结算备注 */}
      {r.settle.length > 0 && (
        <section className="flex flex-wrap gap-1.5">
          {r.settle.map((x, i) => <span key={i} className="rounded-full border border-line bg-paper-2 px-2.5 py-1 text-[11.5px] text-ink"><Rich text={x} /></span>)}
        </section>
      )}

      {onNext && (
        <button type="button" onClick={onNext} className="w-full rounded-[10px] py-2.5 text-[14px] font-bold text-white shadow-sm transition hover:brightness-110 active:scale-[0.99]" style={{ background: "linear-gradient(90deg, var(--jade), var(--coral))" }}>
          开启第 {(r.weekTo ?? r.week) + 1} 周 →
        </button>
      )}
    </div>
  );
}
