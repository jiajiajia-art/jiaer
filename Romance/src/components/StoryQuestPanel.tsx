import { noticeDaysLeft } from "../lib/eventNotices";
import { spotName } from "../game/mapedits";
import { LIVE_LOCATIONS } from "../mods/registry";
import { IconStar, IconCheck } from "../lib/icons";
import { useEffect, useState } from "react";
import { firedOf } from "../game/mapedits";
import { useGame } from "../store/gameCtx";
import { SIDEQUESTS } from "../worlds/star2005/content";
import { dayDateLabel, startDateLabel } from "../game/logic";
import { homeMainQuest } from "../lib/homeMainQuest";
import { storylineBrief } from "../game/fixedEvents";
import { feature, getWorldSidelines, getWorldStorylines } from "../mods/registry";
import { SIDE_STATE_LABEL, visibleSidelines } from "../lib/sidelines";
import type { SideState } from "../lib/types";
import { limitDays } from "../lib/types";

/* 任务日志（仿常规 RPG）：主线 / 支线 / 回顾
 *  · 主线——当前作品主线（与顶栏同一数据源）、目标与前情提要，「继续」回到世界页；
 *  · 支线——可接取 / 已完成，点开详情再开始；
 *  · 回顾——剧情志，触发过的单篇剧情（收藏 / 删除 / 导出）。 */

const KIND_LABEL: Record<string, string> = { spot: "点位事件", quest: "支线", note: "地点备注" };
type View = "main" | "side" | "journal";
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
/* 创作者支线状态徽标：未出现 / 进行中 / 已完成 / 已失败 */
const SIDE_TONE: Record<SideState, string> = {
  pending: "bg-paper-2 text-ink-soft/80 ring-line",
  active: "bg-coral/12 text-coral ring-coral/25",
  done: "bg-jade/10 text-jade-deep ring-jade/20",
  failed: "bg-ink-soft/10 text-ink-soft ring-line",
};
function Bar({ v, max }: { v: number; max: number }) {
  return <div className="h-1.5 overflow-hidden rounded-full bg-paper-2"><div className="h-full rounded-full bg-gradient-to-r from-[var(--jade)] to-[var(--coral)] transition-[width] duration-500" style={{ width: `${max ? Math.min(100, (v / max) * 100) : 0}%` }} /></div>;
}
/* 前情提要：按「· 」拆成一条条事件，拆不开就整段显示 */
// 功能注释：AI 记忆里常夹带连贯性备注（"本应…""未核对…"），这类给模型看的句子不展示给玩家
const META_RE = /本应|应为|应当|未核对|核对|设定|不得|须|需保持|注意|系统|AI|模型|伏笔|待确认/;
function recapItems(memory: string) {
  return memory
    .split(/(?:^|\s)[·•]\s*|[。！？\n]/)
    .map((x) => x.trim().replace(/[；;，,]$/, ""))
    .filter((x) => x.length > 3 && !META_RE.test(x));
}

export default function StoryQuestPanel({ onNavigate }: { onNavigate?: () => void } = {}) {
  const { game, toggleFav, removeJournal, exportJournal, playEventNotice, simMove, busy } = useGame();
  const [moveNote, setMoveNote] = useState<{ id: string; text: string } | null>(null);
  // 功能注释：点「前往」后等主角真的到了发生地，再回主界面让玩家在地点里点「!」触发；没到就留在这里显示原因
  const [pendingRoom, setPendingRoom] = useState<string | null>(null);
  const curRoom = game?.sim.room;
  useEffect(() => {
    if (!pendingRoom || curRoom !== pendingRoom) return;
    setPendingRoom(null);
    setMoveNote(null);
    onNavigate?.();
    go("home");
  }, [curRoom, pendingRoom, onNavigate]);
  const [view, setView] = useState<View>("main");
  const [readId, setReadId] = useState<string | null>(null);
  const [recapAll, setRecapAll] = useState(false);
  if (!game) return null;

  const s = game.sim;
  const journal = game.journal ?? [];
  const doneQuests = new Set(firedOf(game, "quest"));
  const favCount = journal.filter((e) => e.fav).length;
  const lim = limitDays(game.timeLimit, game.startDate || startDateLabel());
  const triggered = SIDEQUESTS.filter((x) => doneQuests.has(x.id));
  const hiddenCount = SIDEQUESTS.length - triggered.length;
  // 功能注释：创作者支线——隐藏支线触发前不显示；进行中排最前，未出现的排最后
  const SIDE_ORDER: Record<SideState, number> = { active: 0, done: 1, failed: 2, pending: 3 };
  const sides = visibleSidelines(getWorldSidelines(), s).sort((a, b) => SIDE_ORDER[a.state] - SIDE_ORDER[b.state]);
  // 功能注释：特殊事件——进行中排前（带倒计时），已展开 / 过期 / 失败标灰留档（最近 12 条）
  const notices = [...(game.eventNotices ?? [])].reverse();
  const openNotices = notices.filter((n) => n.status === "open");
  const pastNotices = notices.filter((n) => n.status !== "open").slice(0, 12);
  const sideCount = openNotices.length + triggered.length + sides.filter((x) => x.state !== "pending").length;
  // 功能注释：主线与顶栏同一数据源（homeMainQuest / getWorldStorylines），没有章节设定就不硬造章号
  const mainQuest = homeMainQuest(s, getWorldStorylines(), dayDateLabel(s.day ?? 0));
  const mainLineName = mainQuest?.lineName ?? (getWorldStorylines().find((l) => l.enabled !== false && l.name?.trim())?.name?.trim() || "主线");
  const mainStepName = mainQuest?.stepName;
  const mainStatus = game.ended ? "已完成" : "进行中";
  // 功能注释：前情提要优先取玩家亲历的剧情（回顾里的单篇），没有时才退回清洗过的记忆摘要
  type RecapItem = { title: string; meta?: string };
  const recap: RecapItem[] = journal.length
    ? journal.map((e) => ({ title: e.title, meta: [e.when, e.location].filter(Boolean).join(" · ") }))
    : game.memory?.trim() ? recapItems(game.memory).map((t) => ({ title: t })) : [];
  const recapShown = recapAll ? recap : recap.slice(-4);
  // 功能注释：名气 / 口碑 / 作品只在本作品确有「事业」玩法时才显示，其它作品不画无意义三格
  const showCareerStats = feature("career");
  const stats = !showCareerStats ? [] : [
    { label: "名气", en: "FAME", v: s.fame, tone: "var(--coral)" },
    { label: "口碑", en: "REPUTE", v: s.reputation, tone: "var(--jade)" },
    { label: "作品", en: "WORKS", v: s.works, tone: "var(--gold)" },
  ];

  return (
    <div className="w-full pb-5">
      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-3">
      {/* 分类页签 */}
      <div className="ui-card grid grid-cols-3 gap-1 p-1">
        {([["main", "主线", 0], ["side", "支线", sideCount], ["journal", "回顾", journal.length]] as const).map(([id, label, n]) => {
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
        <article className="ui-card overflow-hidden">
          {/* 主线卷首：标题取当前作品主线，不写死章节 */}
          <header className="relative overflow-hidden border-b border-line/60 bg-[linear-gradient(160deg,color-mix(in_srgb,var(--coral)_14%,var(--paper))_0%,var(--paper)_75%)] px-5 pb-4 pt-4">
            <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-coral/15 blur-2xl" />
            <div className="relative flex items-center gap-2">
              <span className="h-3.5 w-1 rounded-full bg-coral" />
              <span className="text-[11.5px] font-semibold tracking-[0.18em] text-coral">主线</span>
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-paper/80 px-2.5 py-0.5 text-[11px] font-semibold text-ink-soft ring-1 ring-line/70">
                <span className={`h-1.5 w-1.5 rounded-full ${game.ended ? "bg-jade" : "animate-pulse bg-coral"}`} />{mainStatus}
              </span>
            </div>
            <h3 className="relative mt-2.5 font-serif text-[22px] font-bold leading-snug tracking-[0.03em] text-ink">
              {mainLineName}
              {mainStepName ? <span className="ml-2 text-[15px] font-medium text-ink-soft">{mainStepName}</span> : null}
            </h3>
            <p className="relative mt-1 text-[12px] text-ink-soft">第 {s.week} 周 · 第 {s.day + 1} 天</p>
          </header>

          <div className="space-y-4 px-4 pb-4 pt-4">
            {/* 章节目标 */}
            <div className="flex gap-3 rounded-2xl bg-paper-2/60 px-3.5 py-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-coral/12 text-coral">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" />
                </svg>
              </span>
              <div className="min-w-0">
                <p className="text-[10.5px] font-bold tracking-[0.2em] text-coral">当前目标</p>
                {(() => {
                  // 功能注释：任务页也只展示创作者主线，不再塞引擎日程/通告占位提醒
                  const q = mainQuest;
                  if (q) {
                    return (<>
                      <p className="mt-0.5 text-[14px] font-bold leading-snug text-ink">{q.lineName} · {q.stepName}</p>
                      {q.waitLabel ? <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">{q.waitLabel}</p> : null}
                      {q.stepDesc ? <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">{q.stepDesc}</p> : null}
                    </>);
                  }
                  const brief = storylineBrief(s).trim();
                  if (brief) return <p className="mt-0.5 whitespace-pre-line text-[12px] leading-relaxed text-ink-soft">{brief}</p>;
                  // 功能注释：已有主线（顶栏同源）时不说「尚未配置」，只在确实没有任何主线时才提示
                  if (getWorldStorylines().some((l) => l.enabled !== false && l.nodes?.length)) {
                    return <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">{mainStatus === "已完成" ? "主线已全部完成。" : "主线进行中，留意剧情推进。"}</p>;
                  }
                  return <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">创作者尚未配置主线目标。</p>;
                })()}
              </div>
            </div>

            {/* 核心数值：仅事业类作品显示 */}
            {stats.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {stats.map((x) => (
                <div key={x.label} className="rounded-2xl bg-paper-2/60 px-3 py-2.5 text-center">
                  <p className="font-serif text-[20px] font-bold leading-tight text-ink tabular-nums">{x.v}</p>
                  <p className="mt-0.5 flex items-center justify-center gap-1 text-[11px] text-ink-soft">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: x.tone }} />{x.label}
                  </p>
                </div>
              ))}
            </div>
            )}

            {lim > 0 && (
              <div className="rounded-[var(--radius-ui)] border border-line/70 px-3.5 py-2.5">
                <div className="mb-1.5 flex justify-between text-[11px] text-ink-soft">
                  <span className="font-semibold">本局时限 · 结算倒计时</span>
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
                        <p className={`text-[13px] leading-relaxed ${latest ? "font-semibold text-ink" : "text-ink/75"}`}>{t.title}</p>
                        {t.meta ? <p className="mt-0.5 text-[11px] text-ink-soft">{t.meta}</p> : null}
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

      {view === "side" && (
        <div className="space-y-2">
          {(openNotices.length > 0 || pastNotices.length > 0) && (
            <section className="space-y-2">
              <p className="px-1 text-[11px] font-bold tracking-[0.2em] text-ink-soft">特殊事件</p>
              {openNotices.map((n) => {
                const left = noticeDaysLeft(n, s.day ?? 0);
                const place = n.room ? spotName(game, n.room) || LIVE_LOCATIONS.find((l) => l.id === n.room)?.name : undefined;
                return (
                  <div key={n.id} className="ui-card flex items-center gap-3 border-coral/40 px-3.5 py-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-coral text-[14px] font-black text-white">!</span>
                    <div className="min-w-0 flex-1">
                      <b className="block truncate text-[14px] text-ink">{n.name}</b>
                      {n.summary && n.summary !== n.name && <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-ink-soft">{n.summary}</p>}
                      <p className="mt-1 text-[11px] font-semibold text-coral">
                        {left != null ? `剩 ${left} 天` : "仅本回合，下回合过期"}{place ? ` · ${n.room === s.room ? "就在这里" : `去「${place}」触发`}` : ""}
                      </p>
                      {moveNote?.id === n.id && <p className="mt-1 text-[11px] text-danger">{moveNote.text}</p>}
                    </div>
                    {/* 功能注释：只能在发生地触发——在这里就展开，不在就按正常出行前往 */}
                    {!n.room || n.room === s.room ? (
                      <button type="button" disabled={busy} onClick={() => { playEventNotice(n.id); onNavigate?.(); }} className="ui-btn ui-btn-sm ui-btn-primary shrink-0" style={{ ["--tone" as string]: "var(--coral)" }}>
                        展开
                      </button>
                    ) : (
                      <button type="button" disabled={busy} onClick={() => {
                        setPendingRoom(n.room!);
                        const msgs = simMove(n.room!);
                        setMoveNote({ id: n.id, text: msgs.join(" ") || "暂时去不了那里。" });
                      }} className="ui-btn ui-btn-sm shrink-0">
                        前往
                      </button>
                    )}
                  </div>
                );
              })}
              {pastNotices.map((n) => (
                <div key={n.id} className="ui-card flex items-center gap-3 px-3.5 py-2.5 opacity-60">
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-[13px] text-ink-soft">{n.name}</b>
                    {n.summary && n.summary !== n.name && <p className="mt-0.5 truncate text-[11px] text-ink-soft">{n.summary}</p>}
                  </div>
                  <span className="shrink-0 rounded-full bg-ink-soft/10 px-2 py-0.5 text-[10.5px] font-semibold text-ink-soft">
                    {n.status === "played" ? "已展开" : n.status === "failed" ? "超时失败" : "已过期"}
                  </span>
                </div>
              ))}
            </section>
          )}
          {sides.map(({ line, state }) => (
            <div key={line.id} className="ui-card flex items-center gap-3 px-3.5 py-3">
              <div className="min-w-0 flex-1">
                <b className="block truncate text-[14px] text-ink">{line.name || line.id}</b>
                {line.desc ? <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-ink-soft">{line.desc}</p> : null}
              </div>
              <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ${SIDE_TONE[state]}`}>{SIDE_STATE_LABEL[state]}</span>
            </div>
          ))}
          {triggered.length === 0 && sides.length === 0 && (
            <p className="ui-card px-4 py-8 text-center text-[12.5px] leading-relaxed text-ink-soft">
              还没有触发过支线。<br />满足特定条件，或在行动 / 台词里聊到相关话题时，支线会自动展开。
            </p>
          )}
          {triggered.map((x) => {
            const entry = journal.find((e) => e.kind === "quest" && e.title.includes(x.title));
            return (
              <button key={x.id} onClick={() => { if (entry) { setView("journal"); setReadId(entry.id); } }}
                className="ui-card flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:border-jade/50">
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
                className="rounded-[var(--radius-ui)] border border-jade/50 bg-jade/10 px-3 py-1.5 text-[12px] font-bold text-jade-deep transition hover:bg-jade/20"
              >
                导出收藏
              </button>
              <button
                onClick={() => exportJournal(false)}
                className="rounded-[var(--radius-ui)] border border-line px-3 py-1.5 text-[12px] font-semibold text-ink-soft transition hover:text-ink"
              >
                导出全部
              </button>
            </div>
          </div>

          {journal.length === 0 && (
            <p className="rounded-[var(--radius-ui)] border border-dashed border-line bg-paper/40 px-4 py-8 text-center text-[12.5px] text-ink-soft">
              还没有留存的剧情。在地图点位或上方支线里触发几段吧——每一次都会独立收进这里。
            </p>
          )}

          {journal.map((e) => {
            const open = readId === e.id;
            return (
              <div key={e.id} className={`overflow-hidden rounded-[var(--radius-ui)] border transition ${e.fav ? "border-gold/50 bg-gold/[0.05]" : "border-line bg-paper/40"}`}>
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
                    className="mt-0.5 shrink-0 rounded-[var(--radius-ui-sm)] border border-line px-2 py-1 text-[11px] text-ink-soft transition hover:border-danger/60 hover:text-danger"
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
