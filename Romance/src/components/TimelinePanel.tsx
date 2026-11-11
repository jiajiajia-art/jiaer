/* 主线复盘时间线：自动记录的关键变动；可回到历史时间点，或从那里开平行分支（当前进度先存进空存档位）。 */
import { useEffect, useState } from "react";
import type { TimelineKind } from "../lib/types";
import { useGame } from "../store/gameCtx";
import { EmptyState, useConfirm } from "./EditorKit";
import { TIMELINE_KIND_LABEL } from "../game/timeline";
import { getCheckpoint, listCheckpointIds } from "../lib/storage";
import { listManualSaves, saveToSlot, MAX_SLOTS } from "../lib/store";

const KIND_CLS: Record<TimelineKind, string> = {
  time: "bg-ink-soft/10 text-ink-soft", place: "bg-jade/12 text-jade", rel: "bg-coral/12 text-coral", stat: "bg-gold/15 text-gold",
  event: "bg-jade/12 text-jade", quest: "bg-coral/15 text-coral", faction: "bg-gold/15 text-gold",
};

export default function TimelinePanel({ onLeave }: { onLeave?: () => void }) {
  const { game, loadState } = useGame();
  const [filter, setFilter] = useState<TimelineKind | "all">("all");
  const [cps, setCps] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState("");
  const [confirm, confirmEl] = useConfirm();
  useEffect(() => { if (game) void listCheckpointIds(game.id).then(setCps); }, [game?.id, game?.timeline?.length]);
  if (!game) return null;
  const list = [...(game.timeline ?? [])].reverse();
  const shown = filter === "all" ? list : list.filter((e) => e.items.some((i) => i.kind === filter));

  const restore = async (cp: string, branch: boolean) => {
    const st = await getCheckpoint(game.id, cp);
    if (!st) { setMsg("这个时间点的检查点已被清理。"); return; }
    if (branch) {
      const used = new Set((await listManualSaves()).map((s) => s.id));
      const free = Array.from({ length: MAX_SLOTS }, (_, i) => `slot-${i + 1}`).find((id) => !used.has(id));
      if (!free) { setMsg(`手动存档位已满（${MAX_SLOTS} 个），先腾出一个再开分支。`); return; }
      if (!(await saveToSlot(free, game, `分支前 · ${game.world.time || "当前进度"}`))) { setMsg("保存当前进度失败，未开分支。"); return; }
    } else if (!(await confirm("回到这个时间点？之后的进度会被覆盖（自动存档），建议先手动存档，或改用「开平行分支」。"))) return;
    loadState(st);
    onLeave?.();
  };

  return (
    <div className="space-y-3">
      {confirmEl}
      <p className="text-[12.5px] leading-relaxed text-ink-soft">
        自动记录时间、地点、好感、属性、事件与目标的变化，同一回合合并成一条。带「检查点」的时间点可以回到当时，
        或开<b className="text-ink">平行分支</b>：当前进度先存进一个空的手动存档位，再从那一刻继续，适合测试不同剧情走向。每局保留最近 40 个检查点。
      </p>
      <div className="flex flex-wrap gap-1.5">
        {(["all", ...Object.keys(TIMELINE_KIND_LABEL)] as (TimelineKind | "all")[]).map((k) => (
          <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k}
            className={`rounded-full px-3 py-1 text-[12px] font-bold transition ${filter === k ? "bg-jade text-white shadow" : "bg-paper-2 text-ink-soft ring-1 ring-line hover:text-ink"}`}>
            {k === "all" ? "全部" : TIMELINE_KIND_LABEL[k]}
          </button>
        ))}
      </div>
      {msg && <p role="status" className="rounded-xl bg-danger/10 px-3 py-2 text-[12.5px] font-semibold text-danger">{msg}</p>}
      {shown.length === 0 && <EmptyState>{list.length ? "没有这一类变动。" : "还没有记录。开始游玩后，关键变动会自动出现在这里。"}</EmptyState>}
      <ol className="relative space-y-2 border-l-2 border-line/80 pl-4">
        {shown.map((e) => {
          const items = filter === "all" ? e.items : e.items.filter((i) => i.kind === filter);
          const can = !!e.cp && cps.has(e.cp);
          return (
            <li key={e.id} className="relative rounded-2xl border border-line bg-paper-2/60 px-3.5 py-2.5">
              <span className="absolute -left-[23px] top-3.5 h-3 w-3 rounded-full border-2 border-paper bg-jade" aria-hidden />
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[13px] font-bold text-ink">{e.time || "—"}</span>
                <span className="text-[11.5px] text-ink-soft">第 {e.turn} 轮 · {e.location || "未知地点"}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {items.map((it, i) => <span key={i} className={`rounded px-1.5 py-px text-[11px] font-semibold ${KIND_CLS[it.kind]}`}>{it.text}</span>)}
              </div>
              {can && (
                <div className="mt-2 flex gap-2">
                  <button onClick={() => void restore(e.cp!, true)} className="rounded-full bg-jade px-3 py-1 text-[11.5px] font-bold text-white transition hover:opacity-90">开平行分支</button>
                  <button onClick={() => void restore(e.cp!, false)} className="rounded-full border border-line px-3 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade">回到此刻</button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
