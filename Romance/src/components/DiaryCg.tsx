import { useState } from "react";
import { useGame } from "../store/gameCtx";
import type { CgDef } from "../lib/types";
import { Modal } from "./ui";
import { IconSpark } from "../lib/icons";

/* TA 的日记：AI 在角色心绪起伏时以第一人称写下的日记，倒序展示，默认只露最新一篇 */
export function NpcDiary({ pid }: { pid: string }) {
  const { game } = useGame();
  const [all, setAll] = useState(false);
  const list = (game?.diaries ?? []).filter((d) => d.npcId === pid).slice().reverse();
  if (!list.length) return null;
  const shown = all ? list : list.slice(0, 1);
  return (
    <section className="mb-4">
      <p className="mb-1.5 flex items-center justify-between text-[13px] font-bold text-coral">
        <span>TA 的日记 · {list.length}</span>
        {list.length > 1 && <button onClick={() => setAll((v) => !v)} className="text-[11.5px] font-semibold text-ink-soft hover:text-coral">{all ? "收起" : "翻看全部"}</button>}
      </p>
      <div className="space-y-2">
        {shown.map((d) => (
          <article key={d.id} className="rounded-xl border border-coral/25 bg-[repeating-linear-gradient(transparent_0_25px,color-mix(in_srgb,var(--coral)_10%,transparent)_25px_26px)] bg-paper-2 px-3.5 py-2.5">
            <p className="mb-1 text-[11px] tracking-wider text-ink-soft">{d.time}</p>
            <p className="story-prose whitespace-pre-wrap text-[13px] leading-[26px] text-ink/90">{d.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/* 与 TA 相关的 CG：已解锁显示缩略图，未解锁显示剪影 */
export function NpcCgStrip({ pid }: { pid: string }) {
  const { game } = useGame();
  const list = (game?.cgs ?? []).filter((c) => c.enabled !== false && c.npcId === pid);
  if (!list.length) return null;
  return (
    <section className="mb-4">
      <p className="mb-1.5 text-[13px] font-bold text-coral">CG · {list.filter((c) => game?.cgUnlocked?.[c.id]).length}/{list.length}</p>
      <CgGrid list={list} />
    </section>
  );
}

export function CgGrid({ list }: { list: CgDef[] }) {
  const { game } = useGame();
  const [view, setView] = useState<CgDef | null>(null);
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {list.map((c) => {
          const at = game?.cgUnlocked?.[c.id];
          return (
            <button key={c.id} disabled={!at} onClick={() => setView(c)} className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-line bg-paper-2 text-left">
              {at && c.image
                ? <img src={(c.image) || undefined} alt={c.title} className="h-full w-full object-cover transition group-hover:scale-105" />
                : <span className="grid h-full w-full place-items-center bg-gradient-to-br from-ink/10 to-coral/10 text-[22px] text-ink-soft/50">{at ? "" : "?"}</span>}
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1 pt-4 text-[11px] font-bold text-white">{at ? c.title : "未解锁"}</span>
            </button>
          );
        })}
      </div>
      {view && (
        <Modal title={view.title || "CG"} onClose={() => setView(null)}>
          {view.image && <img src={(view.image) || undefined} alt={view.title} className="w-full rounded-xl" />}
          {view.desc && <p className="story-prose mt-3 text-[13.5px] leading-relaxed text-ink/90">{view.desc}</p>}
          <p className="mt-2 text-[11.5px] text-ink-soft">解锁于 {game?.cgUnlocked?.[view.id]}</p>
        </Modal>
      )}
    </>
  );
}

/* 玩家侧：CG 图鉴（全部），可按 全部 / 已解锁 / 未解锁 筛选 */
export function CgGallery() {
  const { game } = useGame();
  const [f, setF] = useState<"all" | "on" | "off">("all");
  const list = (game?.cgs ?? []).filter((c) => c.enabled !== false);
  if (!list.length) return <p className="py-10 text-center text-[13px] text-ink-soft">这个故事还没有可收集的 CG。</p>;
  const on = list.filter((c) => game?.cgUnlocked?.[c.id]);
  const off = list.filter((c) => !game?.cgUnlocked?.[c.id]);
  const tabs = [["all", "全部", list.length], ["on", "已解锁", on.length], ["off", "未解锁", off.length]] as const;
  const shown = f === "on" ? on : f === "off" ? off : list;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-coral transition-all" style={{ width: `${(on.length / list.length) * 100}%` }} />
        </div>
        <span className="text-[12px] font-bold tabular-nums text-ink">{Math.round((on.length / list.length) * 100)}%</span>
      </div>
      <div className="mb-3 flex gap-1.5">
        {tabs.map(([k, l, n]) => (
          <button key={k} onClick={() => setF(k)} className={`flex-1 rounded-full border px-2 py-1.5 text-[12.5px] font-semibold transition ${f === k ? "border-coral bg-coral/10 text-coral" : "border-line text-ink-soft"}`}>
            {l} <b className="tabular-nums">{n}</b> 张
          </button>
        ))}
      </div>
      {shown.length ? <CgGrid list={shown} /> : <p className="py-8 text-center text-[12.5px] text-ink-soft">{f === "on" ? "还没有解锁任何 CG。" : "已经全部解锁啦！"}</p>}
    </div>
  );
}
