import type { ScheduleCatCfg, ScheduleCatId, ScheduleSlot } from "../mods/types";
import { SCHEDULE_CAT_DEFAULTS, SCHEDULE_CAT_IDS } from "../game/scheduleCats";
import { liveTerm as T } from "../mods/live";

/* 模组编辑器 · 日程分类：玩家打开日程时「安排什么？」各分类的名称、说明、颜色、顺序与显示。
 * 默认值与局内日程板共用 game/scheduleCats；分类是固定五种，不可另建——有无活动只影响玩家侧是否露出。 */
const inp =
  "w-full min-w-0 rounded-md border border-line bg-paper-2 px-1.5 py-0.5 text-[12px] text-ink placeholder:text-ink-soft/60 focus:border-jade focus:outline-none";
const iconBtn =
  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line bg-paper text-[10.5px] text-ink-soft transition hover:border-jade hover:text-jade disabled:opacity-30";

export default function ModScheduleEditor({
  value,
  onChange,
  active,
}: {
  value?: ScheduleSlot;
  onChange: (v?: ScheduleSlot) => void;
  /** 功能注释：本作品当前每个分类下是否有活动；无活动的在局内自动隐藏，编辑器仍列出供改名/排序 */
  active?: Partial<Record<ScheduleCatId, boolean>>;
}) {
  const saved = (value?.cats ?? []).filter((c) => SCHEDULE_CAT_IDS.includes(c.id));
  const full: ScheduleCatCfg[] = [
    ...saved,
    ...SCHEDULE_CAT_IDS.filter((id) => !saved.some((c) => c.id === id)).map((id) => ({ id })),
  ];
  // 功能注释：五种固定分类全部列出；空壳标「暂无内容」，避免作者误以为只能加休息、加不了别的
  const rows = full.map((c, i) => ({ c, i, live: !!active?.[c.id] }));

  const commit = (next: ScheduleCatCfg[]) => {
    const clean = next.map(
      (c) =>
        Object.fromEntries(
          Object.entries(c).filter(([, v]) => v !== "" && v !== undefined && v !== false),
        ) as ScheduleCatCfg,
    );
    const untouched = clean.every((c, i) => Object.keys(c).length === 1 && c.id === SCHEDULE_CAT_IDS[i]);
    onChange(untouched ? undefined : { ...value, cats: clean });
  };
  const setAt = (fullIndex: number, p: Partial<ScheduleCatCfg>) =>
    commit(full.map((c, j) => (j === fullIndex ? { ...c, ...p } : c)));
  const moveRow = (rowIndex: number, d: -1 | 1) => {
    const a = rows[rowIndex];
    const b = rows[rowIndex + d];
    if (!a || !b) return;
    const n = [...full];
    [n[a.i], n[b.i]] = [n[b.i], n[a.i]];
    commit(n);
  };

  return (
    <div className="space-y-1.5">
      <p className="rounded-lg border border-line/60 bg-paper-2/50 px-2.5 py-1.5 text-[11px] leading-relaxed text-ink-soft">
        分类共五种，不能自行新增。休息因内置「休息」项会一直出现；课程 / 打工 / 外出社交等要先在上方启用玩法并添加内容，玩家日程里才会看到。这里只改名称、颜色、顺序与是否显示。
      </p>
      <ol className="schedule-cat-list space-y-1">
        {rows.map(({ c, i: fullIndex, live }, i) => {
          const d = SCHEDULE_CAT_DEFAULTS[c.id];
          const color = c.color || d.color;
          return (
            <li
              key={c.id}
              className={`schedule-cat-row rounded-lg border bg-paper px-2 py-1.5 transition ${
                c.hidden || !live ? "border-dashed border-line opacity-70" : "border-line"
              }`}
              style={{ boxShadow: `inset 3px 0 0 ${color}` }}
            >
              <div className="flex items-center gap-1.5">
                <span className="w-3 shrink-0 text-center text-[10px] font-bold tabular-nums text-ink-soft">
                  {i + 1}
                </span>
                <label
                  className="relative h-5 w-5 shrink-0 cursor-pointer overflow-hidden rounded-full border border-line"
                  style={{ background: color }}
                  title="分类颜色"
                >
                  <input
                    type="color"
                    aria-label="分类颜色"
                    value={color}
                    onChange={(e) => setAt(fullIndex, { color: e.target.value })}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
                <input
                  className={`${inp} max-w-[9.5rem] shrink-0 font-semibold sm:max-w-[11rem]`}
                  value={c.label ?? ""}
                  placeholder={d.label((k) => T(k))}
                  onChange={(e) => setAt(fullIndex, { label: e.target.value })}
                  aria-label="分类名称"
                />
                <input
                  className={`${inp} min-w-0 flex-1`}
                  value={c.hint ?? ""}
                  placeholder={d.hint}
                  onChange={(e) => setAt(fullIndex, { hint: e.target.value })}
                  aria-label="分类说明"
                />
                <label className="flex shrink-0 cursor-pointer items-center gap-1 text-[10.5px] font-semibold text-ink-soft">
                  <input
                    type="checkbox"
                    className="h-3 w-3 accent-jade"
                    checked={!c.hidden}
                    onChange={(e) => setAt(fullIndex, { hidden: !e.target.checked })}
                  />
                  显示
                </label>
                <button
                  type="button"
                  className={iconBtn}
                  disabled={i === 0}
                  onClick={() => moveRow(i, -1)}
                  aria-label="上移"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={iconBtn}
                  disabled={i === rows.length - 1}
                  onClick={() => moveRow(i, 1)}
                  aria-label="下移"
                >
                  ↓
                </button>
              </div>
              <p className="mt-0.5 truncate pl-9 text-[10px] leading-snug text-ink-soft" title={d.source}>
                {live ? d.source : `暂无内容 · ${d.source}`}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
