import type { NpcTimelineEntry } from "../lib/types";
import { isDated, sortTimeline, statusOf, type TimelineStatus } from "../game/npcTimeline";

/* 人物时间线编辑：日期（YYYY.MM.DD 或自由文字）· 地点 · 事情。
 * 传入 today（当前游戏日期）时显示每条的状态：已发生 / 今天 / 近期 / 未来。 */
const STATUS: Record<TimelineStatus, { l: string; c: string }> = {
  past: { l: "已发生", c: "bg-ink-soft/10 text-ink-soft" },
  today: { l: "今天", c: "bg-coral/15 text-coral" },
  soon: { l: "近期", c: "bg-gold/15 text-gold" },
  future: { l: "未来", c: "bg-jade/12 text-jade" },
};
const uid = () => `tl_${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 4)}`;

export default function TimelineEditor({ value, onChange, today, compact }: { value?: NpcTimelineEntry[]; onChange: (v?: NpcTimelineEntry[]) => void; today?: string; compact?: boolean }) {
  const list = value ?? [];
  const commit = (n: NpcTimelineEntry[]) => onChange(n.length ? n : undefined);
  const set = (id: string, p: Partial<NpcTimelineEntry>) => commit(list.map((e) => (e.id === id ? { ...e, ...p } : e)));
  const inp = `w-full min-w-0 rounded-lg border border-line bg-paper px-2 ${compact ? "py-1 text-[12px]" : "py-1.5 text-[13px]"} text-ink outline-none placeholder:text-ink-soft/60 focus:border-jade`;
  const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade";

  return (
    <div className="space-y-1.5">
      {list.length === 0 && <p className="text-[11.5px] leading-relaxed text-ink-soft">还没有时间线。写下 TA 过去的经历（会写进 TA 的记忆，扮演 TA 时 AI 会记得），也可以写带日期的未来安排：到了当天写进剧情，7 天内作为伏笔，更远的先不透露。</p>}
      {list.map((e) => {
        const st = today && isDated(e.when) ? statusOf(e, today) : null;
        const bad = !!e.when.trim() && /^\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}$/.test(e.when.trim()) && !isDated(e.when);
        return (
          <div key={e.id} className="space-y-1 rounded-xl border border-line bg-paper-2/60 p-2">
            <div className="flex items-center gap-1.5">
              <input className={`${inp} w-32 shrink-0 font-mono ${bad ? "!border-danger" : ""}`} value={e.when} placeholder="2003年 / 2005.03.14"
                onChange={(x) => set(e.id, { when: x.target.value })}
                onBlur={(x) => { const m = /^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/.exec(x.target.value.trim()); if (m) set(e.id, { when: `${m[1]}.${m[2].padStart(2, "0")}.${m[3].padStart(2, "0")}` }); }} />
              <input className={inp} value={e.place ?? ""} placeholder="地点（可选）" onChange={(x) => set(e.id, { place: x.target.value || undefined })} />
              {st && <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-bold ${STATUS[st].c}`}>{STATUS[st].l}</span>}
              <button className={`${btn} shrink-0`} onClick={() => commit(list.filter((x) => x.id !== e.id))} aria-label="删除这条">×</button>
            </div>
            <textarea className={`${inp} resize-y`} rows={compact ? 1 : 2} value={e.text} placeholder="如：大学时和主角的哥哥是室友，毕业那年因一场误会断了联系"
              onChange={(x) => set(e.id, { text: x.target.value })} />
          </div>
        );
      })}
      <div className="flex flex-wrap gap-1.5">
        <button className={btn} onClick={() => commit([...list, { id: uid(), when: "", text: "" }])}>＋ 添加经历</button>
        {today && <button className={btn} onClick={() => commit([...list, { id: uid(), when: today, text: "" }])}>＋ 添加安排（从今天起）</button>}
        {list.length > 1 && <button className={btn} onClick={() => commit(sortTimeline(list))}>按时间排序</button>}
      </div>
      <p className="text-[10.5px] text-ink-soft">写「2003年」「童年」「大学时」等自由文字 = 过往经历，全部进入 TA 的记忆；写 YYYY.MM.DD 会随游戏日期推进，早于今天的同样算作经历。</p>
    </div>
  );
}
