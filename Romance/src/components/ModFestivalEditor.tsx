import type { Festival } from "../lib/types";
import { KwInput } from "./EditorKit";

/* 模组编辑器 · 节日：平时只发名称与日期；临近 / 正值节日、或剧情提到关键词时发送完整设定 */
const inp = "min-w-0 w-full rounded-lg border border-line bg-paper px-2 py-1 text-[12.5px] text-ink outline-none focus:border-jade";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const lbl = "block text-[10.5px] font-bold text-ink-soft";
const uid = () => `fe_${Math.random().toString(36).slice(2, 8)}`;
const pad = (n: number) => String(n).padStart(2, "0");
const md = (date: string): [number, number] => { const m = /^(\d{1,2})-(\d{1,2})$/.exec(date); return m ? [+m[1], +m[2]] : [1, 1]; };
const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export default function ModFestivalEditor({ value, onChange }: { value?: Festival[]; onChange: (v?: Festival[]) => void }) {
  const list = value ?? [];
  const put = (v: Festival[]) => onChange(v.length ? v : undefined);
  const set = (id: string, p: Partial<Festival>) => put(list.map((f) => (f.id === id ? { ...f, ...p } : f)));
  const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-2.5">
      <p className="text-[11px] leading-relaxed text-ink-soft">
        每回合只发一行节日速查（名称 + 日期）。临近节日（按「提前天数」）到节日结束期间，或剧情里提到节日名称 / 关键词时，才发送完整设定。未到日子也能靠关键词拿到资料。
      </p>
      <button type="button" className={btn} onClick={() => put([...list, { id: uid(), name: "", date: "01-01", detail: "" }])}>＋ 添加节日</button>
      {!list.length && <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[12px] text-ink-soft">暂无节日 · 适合写本世界特有的节庆、习俗与禁忌</p>}
      {list.length > 1 && <p className="text-[11px] text-ink-soft">速查：{sorted.map((f) => `${f.name || "未命名"}（${f.date}）`).join("、")}</p>}

      {list.map((f) => {
        const [m, d] = md(f.date);
        return (
          <div key={f.id} className="space-y-2 rounded-xl border border-line bg-paper p-2.5">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-end">
              <label className={lbl}>节日名称<input className={`${inp} mt-0.5 font-semibold`} value={f.name} placeholder="如：灯会" onChange={(e) => set(f.id, { name: e.target.value })} /></label>
              <label className={lbl}>日期
                <span className="mt-0.5 flex gap-1">
                  <select className={`${inp} !w-auto`} value={m} aria-label="月" onChange={(e) => set(f.id, { date: `${pad(+e.target.value)}-${pad(Math.min(d, DAYS_IN[+e.target.value - 1]))}` })}>
                    {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1} 月</option>)}
                  </select>
                  <select className={`${inp} !w-auto`} value={d} aria-label="日" onChange={(e) => set(f.id, { date: `${pad(m)}-${pad(+e.target.value)}` })}>
                    {Array.from({ length: DAYS_IN[m - 1] }, (_, i) => <option key={i} value={i + 1}>{i + 1} 日</option>)}
                  </select>
                </span>
              </label>
              <label className={lbl}>持续（天）<input type="number" min={1} max={60} className={`${inp} mt-0.5 !w-16`} value={f.days ?? 1} onChange={(e) => set(f.id, { days: Math.max(1, +e.target.value || 1) === 1 ? undefined : Math.max(1, +e.target.value) })} /></label>
              <label className={lbl}>提前（天）<input type="number" min={0} max={60} className={`${inp} mt-0.5 !w-16`} value={f.lead ?? 3} onChange={(e) => set(f.id, { lead: Math.max(0, +e.target.value || 0) === 3 ? undefined : Math.max(0, +e.target.value || 0) })} /></label>
              <button type="button" className="rounded-full px-2 py-1 text-[11px] text-ink-soft transition hover:bg-danger/10 hover:text-danger" onClick={() => put(list.filter((x) => x.id !== f.id))}>删除</button>
            </div>
            <input className={inp} value={f.brief ?? ""} placeholder="简介（可不填）：一句话说明这是什么节日" onChange={(e) => set(f.id, { brief: e.target.value || undefined })} />
            <textarea className={inp} rows={3} value={f.detail} placeholder="完整设定：习俗、氛围、禁忌、当天会发生什么……" onChange={(e) => set(f.id, { detail: e.target.value })} />
            <KwInput className={`${inp} text-[11.5px]`} value={f.keywords} onChange={(keywords) => set(f.id, { keywords })} placeholder="关键词（可不填）：剧情提到这些词时也发送完整设定，如：花灯、猜灯谜" />
            {!String(f.detail ?? "").trim() && <p className="text-[10.5px] text-gold">完整设定为空：到了日子也只会发名称。</p>}
          </div>
        );
      })}
    </div>
  );
}
