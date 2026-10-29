import { IconStar, IconCheck } from "../lib/icons";
import { useState } from "react";
import { firedOf } from "../game/mapedits";
import { useGame } from "../store/gameCtx";
import { SIDEQUESTS } from "../worlds/star2005/content";
import { dayDateLabel, ROMANCE_ARCS, arcView, startDateLabel } from "../game/logic";
import { homeMainQuest } from "../lib/homeMainQuest";
import { storylineBrief } from "../game/fixedEvents";
import { getWorldStorylines } from "../mods/registry";
import { limitDays } from "../lib/types";
import { Avatar, Modal } from "./ui";
import { openPerson } from "./NpcTab";

/* 任务日志（仿常规 RPG）：主线 / 羁绊 / 支线 / 回顾
 *  · 主线——当前章节、目标与前情提要，「继续」回到世界页；
 *  · 羁绊——人物情感线的阶段进度与解锁条件；
 *  · 支线——可接取 / 已完成，点开详情再开始；
 *  · 回顾——剧情志，触发过的单篇剧情（收藏 / 删除 / 导出）。 */

const KIND_LABEL: Record<string, string> = { spot: "点位事件", quest: "支线", note: "地点备注" };
type View = "main" | "bond" | "side" | "journal";
const go = (tab: string) => window.dispatchEvent(new CustomEvent("star:navtab", { detail: tab }));

function Status({ k }: { k: "doing" | "done" | "lock" }) {
  const m = {
    doing: ["进行中", "bg-coral/12 text-coral ring-coral/25", "bg-coral animate-pulse"],
    done: ["已完成", "bg-jade/10 text-jade-deep ring-jade/20", "bg-jade"],
    lock: ["未解锁", "bg-paper-2 text-ink-soft/80 ring-line", "bg-ink-soft/40"],
  }[k];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ${m[1]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m[2]}`} />{m[0]}
    </span>
  );
}
function Bar({ v, max }: { v: number; max: number }) {
  return <div className="h-1.5 overflow-hidden rounded-full bg-paper-2"><div className="h-full rounded-full bg-gradient-to-r from-[var(--jade)] to-[var(--coral)] transition-[width] duration-500" style={{ width: `${max ? Math.min(100, (v / max) * 100) : 0}%` }} /></div>;
}
/* 1–99 转中文数字：第一章 / 第十二章 */
const CN = "零一二三四五六七八九";
function cnNum(n: number) {
  if (n < 10) return CN[n];
  const t = Math.floor(n / 10), o = n % 10;
  return `${t > 1 ? CN[t] : ""}十${o ? CN[o] : ""}`;
}
/* 前情提要：按「· 」拆成一条条事件，拆不开就整段显示 */
function recapItems(memory: string) {
  const parts = memory.split(/(?:^|\s)[·•]\s*/).map((x) => x.trim()).filter(Boolean);
  return parts.length ? parts : [memory.trim()];
}

export default function StoryQuestPanel({ onNavigate }: { onNavigate?: () => void } = {}) {
  const { game, toggleFav, removeJournal, exportJournal } = useGame();
  const [view, setView] = useState<View>("main");
  const [readId, setReadId] = useState<string | null>(null);
  const [recapAll, setRecapAll] = useState(false);
  if (!game) return null;

  const s = game.sim;
  const journal = game.journal ?? [];
  const doneQuests = new Set(firedOf(game, "quest"));
  const favCount = journal.filter((e) => e.fav).length;
  const lim = limitDays(game.timeLimit, game.startDate || startDateLabel());
  const bonds = Object.keys(ROMANCE_ARCS).filter((id) => s.metPeople.includes(id)).map((id) => ({ id, npc: game.npcs.find((n) => n.id === id), v: arcView(s, id) })).filter((b) => b.v);
  const triggered = SIDEQUESTS.filter((x) => doneQuests.has(x.id));
  const hiddenCount = SIDEQUESTS.length - triggered.length;
  const chapter = Math.max(1, Math.ceil(s.week / 4));
  const recap = game.memory?.trim() ? recapItems(game.memory) : [];
  const recapShown = recapAll ? recap : recap.slice(-4);
  const stats = [
    { label: "名气", en: "FAME", v: s.fame, tone: "var(--coral)" },
    { label: "口碑", en: "REPUTE", v: s.reputation, tone: "var(--jade)" },
    { label: "作品", en: "WORKS", v: s.works, tone: "var(--gold)" },
  ];

  return (
    <div className="w-full pb-5">
      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-3">
      {/* 分类页签 */}
      <div className="grid grid-cols-4 gap-1 rounded-2xl border border-line/60 bg-paper-2/60 p-1">
        {([["main", "主线", 0], ["bond", "羁绊", bonds.length], ["side", "支线", triggered.length], ["journal", "回顾", journal.length]] as const).map(([id, label, n]) => {
          const on = view === id;
          return (
            <button key={id} onClick={() => setView(id)} aria-pressed={on}
              className={`flex items-center justify-center gap-1 rounded-xl py-1.5 text-[13px] transition ${on ? "bg-paper font-bold text-ink shadow-[0_4px_14px_-8px_rgba(120,80,180,0.55)] ring-1 ring-line/70" : "font-medium text-ink-soft hover:text-ink"}`}>
              {label}
              {n ? <span className={`min-w-[16px] rounded-full px-1 text-[10px] font-bold leading-4 tabular-nums ${on ? "bg-gradient-to-r from-[var(--jade)] to-[var(--coral)] text-white" : "bg-ink-soft/10"}`}>{n}</span> : null}
            </button>
          );
        })}
      </div>

      {view === "main" && (
        <article className="overflow-hidden rounded-3xl border border-line/70 bg-paper shadow-[0_18px_40px_-28px_rgba(110,70,170,0.6)]">
          {/* 章节卷首 */}
          <header className="relative overflow-hidden bg-gradient-to-br from-[var(--jade)] via-[color-mix(in_srgb,var(--jade)_45%,var(--coral))] to-[var(--coral)] px-5 pb-5 pt-4 text-white">
            <span aria-hidden className="pointer-events-none absolute -right-3 -top-6 select-none font-serif text-[112px] font-black leading-none text-white/12 tabular-nums">{String(chapter).padStart(2, "0")}</span>
            <span aria-hidden className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-[0.32em] text-white/75">MAIN STORY · CH.{String(chapter).padStart(2, "0")}</span>
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/18 px-2 py-0.5 text-[10.5px] font-semibold ring-1 ring-white/30 backdrop-blur">
                <span className={`h-1.5 w-1.5 rounded-full bg-white ${game.ended ? "" : "animate-pulse"}`} />{game.ended ? "已完成" : "进行中"}
              </span>
            </div>
            <h3 className="relative mt-2 font-serif text-[24px] font-black leading-tight tracking-[0.04em]">
              星途<span className="mx-2 font-normal text-white/60">·</span>第{cnNum(chapter)}章
            </h3>
            <p className="relative mt-1.5 text-[11.5px] text-white/80">第 {s.week} 周 · 第 {s.day + 1} 天</p>
          </header>

          <div className="space-y-4 px-4 pb-4 pt-4">
            {/* 章节目标 */}
            <div className="flex gap-3 rounded-2xl border border-coral/20 bg-coral/[0.05] px-3.5 py-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[var(--jade)] to-[var(--coral)] text-white shadow-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-[10.5px] font-bold tracking-[0.2em] text-coral">本章目标</p>
                {(() => {
                  // 功能注释：任务页也只展示创作者主线，不再塞引擎日程/通告占位提醒
                  const q = homeMainQuest(s, getWorldStorylines(), dayDateLabel(s.day ?? 0));
                  if (q) {
                    return (<>
                      <p className="mt-0.5 text-[14px] font-bold leading-snug text-ink">{q.lineName} · {q.stepName}</p>
                      {q.waitLabel ? <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">{q.waitLabel}</p> : null}
                      {q.stepDesc ? <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">{q.stepDesc}</p> : null}
                    </>);
                  }
                  const brief = storylineBrief(s).trim();
                  if (brief) return <p className="mt-0.5 whitespace-pre-line text-[12px] leading-relaxed text-ink-soft">{brief}</p>;
                  return <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">创作者尚未配置主线目标。</p>;
                })()}
              </div>
            </div>

            {/* 核心数值 */}
            <div className="grid grid-cols-3 gap-2">
              {stats.map((x) => (
                <div key={x.label} className="relative overflow-hidden rounded-2xl border border-line/70 bg-paper-2/50 px-3 py-2.5">
                  <span aria-hidden className="absolute inset-x-0 top-0 h-0.5" style={{ background: x.tone }} />
                  <p className="flex items-baseline justify-between text-[11px] font-semibold text-ink-soft">
                    {x.label}<span className="text-[8.5px] font-bold tracking-[0.18em] opacity-60">{x.en}</span>
                  </p>
                  <p className="mt-0.5 font-serif text-[22px] font-black leading-tight text-ink tabular-nums">{x.v}</p>
                </div>
              ))}
            </div>

            {lim > 0 && (
              <div className="rounded-2xl border border-line/70 px-3.5 py-2.5">
                <div className="mb-1.5 flex justify-between text-[11px] text-ink-soft">
                  <span className="font-semibold">主线时限</span>
                  <span className="tabular-nums"><b className="text-ink">{Math.min(s.day, lim)}</b> / {lim} 天</span>
                </div>
                <Bar v={s.day} max={lim} />
              </div>
            )}

            {/* 前情提要：时间线 */}
            {recap.length > 0 && (
              <section>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[12px] font-bold tracking-[0.12em] text-ink">前情提要</span>
                  <span className="h-px flex-1 bg-gradient-to-r from-line to-transparent" />
                  {recap.length > 4 && (
                    <button onClick={() => setRecapAll((v) => !v)} className="text-[11px] font-semibold text-jade hover:underline">
                      {recapAll ? "收起" : `全部 ${recap.length} 条`}
                    </button>
                  )}
                </div>
                <ol className="relative space-y-2.5 pl-5">
                  <span aria-hidden className="absolute bottom-1.5 left-[5px] top-1.5 w-px bg-gradient-to-b from-jade/50 via-coral/30 to-transparent" />
                  {recapShown.map((t, i) => {
                    const latest = i === recapShown.length - 1;
                    return (
                      <li key={i} className="relative">
                        <span aria-hidden className={`absolute -left-5 top-[5px] h-[11px] w-[11px] rounded-full border-2 ${latest ? "border-coral bg-coral/25" : "border-jade/60 bg-paper"}`} />
                        <p className={`text-[12.5px] leading-relaxed ${latest ? "text-ink" : "text-ink/75"}`}>{t}</p>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}

            <button onClick={() => { onNavigate?.(); go("home"); }}
              className="group flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[var(--jade)] to-[var(--coral)] py-2.5 text-[13.5px] font-bold tracking-[0.08em] text-white shadow-[0_10px_22px_-12px_rgba(200,90,140,0.8)] transition hover:brightness-105 active:scale-[0.98]">
              继续主线
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition group-hover:translate-x-0.5" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          </div>
        </article>
      )}

      {view === "bond" && (
        <div className="space-y-2.5">
          {bonds.length === 0 && <p className="rounded-2xl border border-line bg-paper/40 px-4 py-8 text-center text-[12.5px] text-ink-soft">还没有开启的羁绊。结识重要人物后，这里会出现你们的故事线。</p>}
          {bonds.map(({ id, npc, v }) => {
            const vv = v!;
            const k = vv.isDating || (vv.done >= vv.total && !vv.datingReady) ? "done" : vv.locked ? "lock" : "doing";
            return (
              <button key={id} onClick={() => openPerson(id)} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-paper/60 p-3 text-left shadow-sm transition hover:border-jade/50">
                <Avatar src={npc?.avatar} name={npc?.name ?? id} size={44} editable={false} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><b className="truncate text-[14px] text-ink">{npc?.name ?? id}</b><Status k={k} /></div>
                  <p className="mt-0.5 truncate text-[11.5px] text-ink-soft">
                    {vv.isDating ? "已确认交往" : vv.stage ? `第 ${vv.done + 1} 段 · ${vv.stage.name}` : vv.datingReady ? "可确认关系" : vv.total ? "故事线已走完" : `条件养成 · ${vv.confirmReq}`}
                  </p>
                  {vv.locked && vv.reason && <p className="mt-0.5 truncate text-[11px] text-coral/80">解锁条件：{vv.reason}</p>}
                  {vv.total > 0 && <div className="mt-1.5"><Bar v={vv.done} max={vv.total} /></div>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {view === "side" && (
        <div className="space-y-2">
          {triggered.length === 0 && (
            <p className="rounded-2xl border border-line bg-paper/40 px-4 py-8 text-center text-[12.5px] leading-relaxed text-ink-soft">
              还没有触发过支线。<br />满足特定条件，或在行动 / 台词里聊到相关话题时，支线会自动展开。
            </p>
          )}
          {triggered.map((x) => {
            const entry = journal.find((e) => e.kind === "quest" && e.title.includes(x.title));
            return (
              <button key={x.id} onClick={() => { if (entry) { setView("journal"); setReadId(entry.id); } }}
                className="flex w-full items-center gap-3 rounded-2xl border border-line bg-paper/60 px-3.5 py-3 text-left shadow-sm transition hover:border-jade/50">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-jade/12 text-[15px] text-jade-deep"></span>
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-[14px] text-ink">{x.title}</b>
                  <p className="mt-0.5 truncate text-[11.5px] text-ink-soft">{entry ? "点开回顾这段剧情" : x.condition}</p>
                </div>
                <Status k="done" />
              </button>
            );
          })}
          {hiddenCount > 0 && <p className="pt-1 text-center text-[11px] text-ink-soft/70">还有 {hiddenCount} 段支线等待触发</p>}
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
                    {e.fav ? <IconStar size={14} /> : <IconStar size={14} className="opacity-30" />}
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
    </div>
  );
}
