import type { ScheduleCatCfg, ScheduleCatId, ScheduleSlot } from "../mods/types";
import { SCHEDULE_CAT_DEFAULTS, SCHEDULE_CAT_IDS } from "../game/scheduleCats";
import { liveTerm as T } from "../mods/live";

/* 模组编辑器 · 日程分类：玩家打开日程时「安排什么？」各分类的名称、说明、颜色、顺序与显示。
 * 默认值与局内日程板共用 game/scheduleCats；分类里有哪些活动由各养成子系统决定。 */
const inp = "w-full min-w-0 rounded-xl border border-line bg-paper-2 px-3 py-1.5 text-[12.5px] text-ink placeholder:text-ink-soft/60 transition focus:border-jade focus:outline-none focus:ring-2 focus:ring-jade/20";
const iconBtn = "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-paper text-[12px] text-ink-soft transition hover:border-jade hover:text-jade disabled:opacity-30";

export default function ModScheduleEditor({ value, onChange, active }: {
  value?: ScheduleSlot;
  onChange: (v?: ScheduleSlot) => void;
  /** 功能注释：本作品当前每个分类下是否有活动；没有的分类局内自动隐藏，这里如实标出 */
  active?: Partial<Record<ScheduleCatId, boolean>>;
}) {
  const saved = (value?.cats ?? []).filter((c) => SCHEDULE_CAT_IDS.includes(c.id));
  const list: ScheduleCatCfg[] = [...saved, ...SCHEDULE_CAT_IDS.filter((id) => !saved.some((c) => c.id === id)).map((id) => ({ id }))];
  const commit = (next: ScheduleCatCfg[]) => {
    const clean = next.map((c) => Object.fromEntries(Object.entries(c).filter(([, v]) => v !== "" && v !== undefined && v !== false)) as ScheduleCatCfg);
    const untouched = clean.every((c, i) => Object.keys(c).length === 1 && c.id === SCHEDULE_CAT_IDS[i]);
    onChange(untouched ? undefined : { ...value, cats: clean });
  };
  const set = (i: number, p: Partial<ScheduleCatCfg>) => commit(list.map((c, j) => (j === i ? { ...c, ...p } : c)));
  const move = (i: number, d: -1 | 1) => { const n = [...list]; [n[i], n[i + d]] = [n[i + d], n[i]]; commit(n); };

  return (
    <ol className="space-y-2">
      {list.map((c, i) => {
        const d = SCHEDULE_CAT_DEFAULTS[c.id];
        const color = c.color || d.color;
        const live = active?.[c.id] !== false;
        return (
          <li key={c.id} className={`rounded-2xl border bg-paper p-3 transition ${c.hidden ? "border-dashed border-line opacity-60" : "border-line"}`} style={{ boxShadow: `inset 3px 0 0 ${color}` }}>
            <div className="flex items-center gap-2">
              <span className="w-4 shrink-0 text-center text-[11px] font-bold tabular-nums text-ink-soft">{i + 1}</span>
              <label className="relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-full border border-line" style={{ background: color }} title="分类颜色">
                <input type="color" aria-label="分类颜色" value={color} onChange={(e) => set(i, { color: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
              </label>
              <input className={`${inp} font-semibold`} value={c.label ?? ""} placeholder={d.label((k) => T(k))} onChange={(e) => set(i, { label: e.target.value })} aria-label="分类名称" />
              <button type="button" className={iconBtn} disabled={i === 0} onClick={() => move(i, -1)} aria-label="上移">↑</button>
              <button type="button" className={iconBtn} disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="下移">↓</button>
            </div>
            <div className="mt-2 pl-6">
              <input className={inp} value={c.hint ?? ""} placeholder={d.hint} onChange={(e) => set(i, { hint: e.target.value })} aria-label="分类说明" />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11px] text-ink-soft">
                  <span className={`rounded-full px-2 py-px text-[10.5px] font-semibold ${live ? "bg-jade/12 text-jade" : "bg-paper-2 text-ink-soft"}`}>
                    {live ? "有活动" : "暂无活动 · 局内不显示"}
                  </span>
                  {d.source}
                </span>
                <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] font-semibold text-ink-soft">
                  <input type="checkbox" className="h-3.5 w-3.5 accent-jade" checked={!c.hidden} onChange={(e) => set(i, { hidden: !e.target.checked })} />
                  对玩家显示
                </label>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
