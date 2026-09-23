import { useState } from "react";
import { useGame } from "../store/gameCtx";
import { SIDEQUESTS } from "../worlds/star2005/content";

/* 剧情事件系统 · 剧情志
 * 两栏：
 *  · 支线剧情——从内容池选一段桥段交 AI 演绎，每次独立成篇；
 *  · 剧情志——记录每一次触发过的剧情（含地图点位事件），可收藏、删除、导出。
 * 主线沿用「世界」页的故事流；此处专收可自由触发、收藏、导出的单篇剧情。 */

const KIND_LABEL: Record<string, string> = { spot: "点位事件", quest: "支线", note: "地点备注" };

export default function StoryQuestPanel() {
  const { game, busy, playQuest, toggleFav, removeJournal, exportJournal } = useGame();
  const [view, setView] = useState<"quests" | "journal">("quests");
  const [readId, setReadId] = useState<string | null>(null);
  if (!game) return null;

  const journal = game.journal ?? [];
  const favCount = journal.filter((e) => e.fav).length;

  return (
    <div className="space-y-4">
      <p className="text-[12.5px] leading-relaxed text-ink-soft">
        主线沿着「世界」页的故事自然推进。这里收录可自由触发的支线桥段——每演绎一次都独立成篇，
        连同你在地图点位埋下的剧情，一起进「剧情志」，随时收藏、导出留存。
      </p>

      {/* 分栏切换 */}
      <div className="flex gap-1.5 rounded-2xl border border-line bg-paper/40 p-1">
        {([["quests", "支线剧情"], ["journal", `剧情志${journal.length ? ` · ${journal.length}` : ""}`]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`flex-1 rounded-xl px-3 py-2 text-[13px] font-bold transition ${
              view === id ? "bg-gradient-to-r from-[var(--jade)] to-[var(--coral)] text-white shadow-sm" : "text-ink-soft hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "quests" && (
        <div className="space-y-2.5">
          {SIDEQUESTS.map((q) => (
            <div key={q.id} className="overflow-hidden rounded-2xl border border-line bg-paper/40">
              <div className="flex items-start gap-2.5 px-3.5 py-3">
                <span className="mt-0.5 shrink-0 rounded-full border border-coral/40 bg-coral/10 px-2 py-0.5 text-[9.5px] font-bold text-coral">{q.code}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-ink">{q.title}</p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-soft">{q.condition}</p>
                </div>
                <button
                  onClick={() => { if (!busy) playQuest(q.id); }}
                  disabled={busy}
                  className="shrink-0 rounded-xl bg-gradient-to-br from-[var(--jade)] to-[var(--coral)] px-3.5 py-1.5 text-[12.5px] font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
                >
                  演绎
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {view === "journal" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-ink-soft">共 <b className="text-ink">{journal.length}</b> 篇 · 收藏 <b className="text-jade-deep">{favCount}</b> 篇</span>
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => exportJournal(true)}
                className="rounded-xl border border-jade/50 bg-jade/10 px-3 py-1.5 text-[12px] font-bold text-jade-deep transition hover:bg-jade/20"
              >
                导出收藏
              </button>
              <button
                onClick={() => exportJournal(false)}
                className="rounded-xl border border-line px-3 py-1.5 text-[12px] font-semibold text-ink-soft transition hover:text-ink"
              >
                导出全部
              </button>
            </div>
          </div>

          {journal.length === 0 && (
            <p className="rounded-2xl border border-dashed border-line bg-paper/40 px-4 py-8 text-center text-[12.5px] text-ink-soft">
              还没有留存的剧情。在地图点位或上方支线里触发几段吧——每一次都会独立收进这里。
            </p>
          )}

          {journal.map((e) => {
            const open = readId === e.id;
            return (
              <div key={e.id} className={`overflow-hidden rounded-2xl border transition ${e.fav ? "border-gold/50 bg-gold/[0.05]" : "border-line bg-paper/40"}`}>
                <div className="flex items-start gap-2 px-3.5 py-3">
                  <button
                    onClick={() => toggleFav(e.id)}
                    aria-label={e.fav ? "取消收藏" : "收藏"}
                    className={`mt-0.5 shrink-0 text-[17px] leading-none transition ${e.fav ? "text-gold" : "text-ink-soft/40 hover:text-gold"}`}
                  >
                    {e.fav ? "★" : "☆"}
                  </button>
                  <button onClick={() => setReadId(open ? null : e.id)} className="min-w-0 flex-1 text-left">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13.5px] font-bold text-ink">{e.title}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-ink-soft">
                      {KIND_LABEL[e.kind] ?? e.kind}{e.location ? ` · ${e.location}` : ""}{e.when ? ` · ${e.when}` : ""}
                    </span>
                  </button>
                  <button
                    onClick={() => removeJournal(e.id)}
                    aria-label="删除"
                    className="mt-0.5 shrink-0 rounded-md border border-line px-2 py-1 text-[11px] text-ink-soft transition hover:border-danger/60 hover:text-danger"
                  >
                    删除
                  </button>
                </div>
                {open && (
                  <div className="border-t border-line/60 px-3.5 py-3">
                    {e.annotation && <p className="mb-2 text-[11.5px] italic text-ink-soft">{e.annotation}</p>}
                    <p className="story-prose whitespace-pre-wrap text-[13px] leading-relaxed text-ink/90">{e.text || e.seed}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
