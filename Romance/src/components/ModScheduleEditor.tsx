import type { ScheduleCatCfg, ScheduleCatId, ScheduleSlot } from "../mods/types";

/* 模组编辑器 · 日程分类：日程弹窗里「安排什么？」各分类的名称、说明、颜色、显示顺序与隐藏。
 * 留空的字段沿用内置默认；各分类下有哪些活动由「培训课程」「打工 · 周末活动」决定。 */
const inp = "w-full min-w-0 rounded-lg border border-line bg-paper-2 px-2 py-1 text-[12px] text-ink placeholder:text-ink-soft/70 focus:border-jade focus:outline-none";
const btn = "rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";

const DEFAULTS: { id: ScheduleCatId; label: string; hint: string; color: string; src: string }[] = [
  { id: "work", label: "拍摄通告", hint: "接戏拍摄，赚片酬涨名气", color: "#e0533d", src: "接下通告后自动出现" },
  { id: "lesson", label: "才艺课程", hint: "分级授课 · 级别越高上限越高、单次加成越少", color: "#c79a3a", src: "来自「培训课程」" },
  { id: "job", label: "打工赚钱", hint: "分级零工 · 名气越高价码越高", color: "#b3823c", src: "来自「打工」" },
  { id: "rest", label: "休息调整", hint: "回血减压，保住状态", color: "#3a9d78", src: "内置「休息」+ 归入此类的周末活动" },
  { id: "social", label: "外出社交", hint: "自由活动可踩地图 · 人脉与心情", color: "#d76d77", src: "归入此类的周末活动" },
];

export default function ModScheduleEditor({ value, onChange }: { value?: ScheduleSlot; onChange: (v?: ScheduleSlot) => void }) {
  const saved = (value?.cats ?? []).filter((c) => DEFAULTS.some((d) => d.id === c.id));
  const list: ScheduleCatCfg[] = [...saved, ...DEFAULTS.filter((d) => !saved.some((c) => c.id === d.id)).map((d) => ({ id: d.id }))];
  const commit = (next: ScheduleCatCfg[]) => {
    const clean = next.map((c) => Object.fromEntries(Object.entries(c).filter(([, v]) => v !== "" && v !== undefined && v !== false)) as ScheduleCatCfg);
    const untouched = clean.every((c, i) => Object.keys(c).length === 1 && c.id === DEFAULTS[i].id);
    onChange(untouched ? undefined : { ...value, cats: clean });
  };
  const set = (i: number, p: Partial<ScheduleCatCfg>) => commit(list.map((c, j) => (j === i ? { ...c, ...p } : c)));
  const move = (i: number, d: -1 | 1) => { const n = [...list]; [n[i], n[i + d]] = [n[i + d], n[i]]; commit(n); };

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-ink-soft">顺序即玩家在日程里看到的顺序；留空沿用默认文案。</p>
      {list.map((c, i) => {
        const d = DEFAULTS.find((x) => x.id === c.id)!;
        return (
          <div key={c.id} className={`space-y-1.5 rounded-xl border border-line bg-paper p-2.5 ${c.hidden ? "opacity-60" : ""}`}>
            <div className="flex items-center gap-1.5">
              <input type="color" aria-label="分类颜色" value={c.color || d.color} onChange={(e) => set(i, { color: e.target.value })} className="h-7 w-7 shrink-0 cursor-pointer rounded border border-line bg-paper-2 p-0.5" />
              <input className={inp} value={c.label ?? ""} placeholder={d.label} onChange={(e) => set(i, { label: e.target.value })} aria-label="分类名称" />
              <button className={`${btn} shrink-0`} disabled={i === 0} onClick={() => move(i, -1)} aria-label="上移">↑</button>
              <button className={`${btn} shrink-0`} disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="下移">↓</button>
              <label className="flex shrink-0 items-center gap-1 text-[11px] text-ink-soft">
                <input type="checkbox" checked={!c.hidden} onChange={(e) => set(i, { hidden: !e.target.checked })} />显示
              </label>
            </div>
            <input className={inp} value={c.hint ?? ""} placeholder={d.hint} onChange={(e) => set(i, { hint: e.target.value })} aria-label="分类说明" />
            <p className="text-[10.5px] text-ink-soft">活动：{d.src}</p>
          </div>
        );
      })}
    </div>
  );
}
