import { IconClose } from "../lib/icons";
/* NPC 知识库查看器：看每位 NPC 记住了什么、自己经历了什么、听别人说了什么；作者可增删记忆 */
import { timelineBuckets } from "../game/npcTimeline";
import { useState } from "react";
import { useGame } from "../store/gameCtx";
import { gameTimeLabel } from "../game/phone";
import { kbOf, type KbMem, type NpcKnowledge } from "../game/npcKnowledge";

type Kind = "playerMemory" | "selfMemory" | "heard";
const KINDS: { k: Kind; label: string; hint: string }[] = [
  { k: "playerMemory", label: "与主角", hint: "TA 和你之间发生过的事" },
  { k: "selfMemory", label: "自身近况", hint: "TA 自己的生活事件" },
  { k: "heard", label: "听说", hint: "从别的 NPC 那里听来的传闻" },
];

/* 单个 NPC 的记忆编辑（嵌在「人物」面板里，与人设同页） */
export function NpcMemory({ pid }: { pid: string }) {
  const { game, commitGame } = useGame();
  const [kind, setKind] = useState<Kind>("playerMemory");
  const [draft, setDraft] = useState("");
  if (!game) return null;
  const kb = kbOf(game, pid);
  const list: KbMem[] = (kind === "heard" ? kb.heard : kb[kind]) ?? [];
  const write = (next: KbMem[]) => commitGame({ ...game, npcKb: { ...(game.npcKb ?? {}), [pid]: { ...kb, [kind]: next } } });
  const add = () => { const t = draft.trim(); if (!t) return; write([...list, { t: gameTimeLabel(game), text: t.slice(0, 160) }]); setDraft(""); };
  const summary = kind === "playerMemory" ? kb.playerSummary : kind === "selfMemory" ? kb.selfSummary : undefined;
  return (
    <div className="space-y-2.5">
      <div className="flex gap-1 rounded-full bg-paper p-1">
        {KINDS.map((x) => {
          const n = ((x.k === "heard" ? kb.heard : kb[x.k]) ?? []).length;
          return (
            <button key={x.k} onClick={() => setKind(x.k)} className={`flex-1 rounded-full px-2 py-1 text-[12px] font-semibold transition ${kind === x.k ? "bg-gradient-to-r from-[var(--jade)] to-[var(--coral)] text-white shadow-sm" : "text-ink-soft hover:text-ink"}`}>
              {x.label}<span className="ml-1 tabular-nums opacity-70">{n}</span>
            </button>
          );
        })}
      </div>
      <p className="text-[11.5px] text-ink-soft">{KINDS.find((x) => x.k === kind)!.hint} · 只在扮演 TA 时交给 AI</p>
      {kind === "selfMemory" && (() => {
        const tl = timelineBuckets({ id: pid, persona: game.npcs.find((n) => n.id === pid)?.persona }, game.sim?.day ?? 0);
        const rows = [...tl.past.map((e) => ({ e, tag: "" })), ...tl.now.map((e) => ({ e, tag: "今天" })), ...tl.soon.map((e) => ({ e, tag: "近期" }))];
        if (!rows.length) return null;
        return (
          <div className="rounded-xl border border-jade/30 bg-jade/5 p-2.5">
            <p className="text-[11.5px] font-bold text-jade">过往经历 · 来自时间线 <span className="font-normal text-ink-soft">（TA 记得这些事；在「固定人物」里修改）</span></p>
            <ul className="mt-1 space-y-0.5">
              {rows.map(({ e, tag }) => (
                <li key={e.id} className="text-[12px] leading-relaxed text-ink">
                  <span className="mr-1.5 text-[11px] tabular-nums text-gold">{e.when}</span>{e.place && <span className="mr-1 text-[11px] text-ink-soft">@{e.place}</span>}{e.text}
                  {tag && <span className="ml-1.5 rounded bg-coral/12 px-1 text-[10px] font-bold text-coral">{tag}</span>}
                </li>
              ))}
            </ul>
          </div>
        );
      })()}
      {summary && <p className="rounded-xl bg-ink/[0.04] p-2 text-[11.5px] leading-relaxed text-ink-soft">（较早·已压缩）{summary}</p>}
      <ul className="space-y-1.5">
        {list.length === 0 && <li className="rounded-xl border border-dashed border-line py-4 text-center text-[12px] text-ink-soft">还没有记录</li>}
        {list.map((m, i) => (
          <li key={i} className="flex items-start gap-2 rounded-xl border border-line bg-paper px-2.5 py-2">
            <span className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-ink">
              {m.t && <span className="mr-1.5 font-sans text-[11px] tabular-nums text-ink-soft" style={{ fontFamily: "'Sarasa Gothic Rounded', 'Source Han Rounded SC', 'PingFang SC', 'Microsoft YaHei', sans-serif" }}>{m.t}</span>}{m.text}
            </span>
            <button onClick={() => write(list.filter((_, j) => j !== i))} aria-label="删除" className="shrink-0 text-[12px] text-ink-soft hover:text-coral"><IconClose size={14} /></button>          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} maxLength={160}
          placeholder="手动写入一条记忆…" className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-2.5 py-2 text-[13px] text-ink outline-none focus:border-jade" />
        <button onClick={add} disabled={!draft.trim()} className="shrink-0 rounded-xl bg-jade px-3 text-[12.5px] font-semibold text-white disabled:opacity-40">写入</button>
      </div>
    </div>
  );
}

export default function NpcKbPanel() {
  const { game, commitGame } = useGame();
  const [pid, setPid] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("playerMemory");
  const [draft, setDraft] = useState("");
  if (!game) return null;
  const count = (kb: NpcKnowledge) => kb.playerMemory.length + kb.selfMemory.length + (kb.heard?.length ?? 0);

  if (!pid) {
    return (
      <div className="space-y-1.5">
        <p className="pb-1 text-[12px] leading-relaxed text-ink-soft">每位 NPC 有一份私有知识库，只在扮演 TA 时交给 AI。同处一地的 NPC 会闲聊互传听闻。</p>
        {game.npcs.map((n) => {
          const kb = kbOf(game, n.id);
          return (
            <button key={n.id} onClick={() => setPid(n.id)} className="flex w-full items-center gap-3 rounded-sm border border-line px-3 py-2.5 text-left transition hover:border-jade/60 hover:bg-jade/5">
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[13.5px] text-ink">{n.name}</b>
                <span className="block truncate text-[11.5px] text-ink-soft">{kb.profile.identity || kb.profile.relation || "—"}</span>
              </span>
              <span className="shrink-0 rounded-full bg-jade/10 px-2 py-0.5 text-[11px] font-semibold text-jade">{count(kb)} 条</span>
              <span className="text-ink-soft">›</span>
            </button>
          );
        })}
      </div>
    );
  }

  const kb = kbOf(game, pid);
  const list: KbMem[] = (kind === "heard" ? kb.heard : kb[kind]) ?? [];
  const write = (next: KbMem[]) => commitGame({ ...game, npcKb: { ...(game.npcKb ?? {}), [pid]: { ...kb, [kind]: next } } });
  const add = () => { const t = draft.trim(); if (!t) return; write([...list, { t: gameTimeLabel(game), text: t.slice(0, 160) }]); setDraft(""); };
  const p = kb.profile;
  const summary = kind === "playerMemory" ? kb.playerSummary : kind === "selfMemory" ? kb.selfSummary : undefined;

  return (
    <div className="space-y-3">
      <button onClick={() => setPid(null)} className="text-[12px] text-ink-soft hover:text-ink">‹ 全部人物</button>
      <div className="rounded-sm border border-line p-3">
        <b className="text-[15px] text-ink">{p.name}</b>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
          {[p.age && `${p.age}岁`, p.job, p.identity, p.relation, p.wealth && `家境·${p.wealth}`, p.personality].filter(Boolean).join(" · ") || "（无档案）"}
        </p>
        {p.bio && <p className="mt-1.5 line-clamp-3 text-[12px] leading-relaxed text-ink">{p.bio}</p>}
      </div>
      <div className="flex gap-1.5">
        {KINDS.map((x) => {
          const n = ((x.k === "heard" ? kb.heard : kb[x.k]) ?? []).length;
          return (
            <button key={x.k} onClick={() => setKind(x.k)} className={`flex-1 rounded-full border px-2 py-1.5 text-[12px] font-medium transition ${kind === x.k ? "border-jade bg-jade/10 text-jade" : "border-line text-ink-soft hover:border-ink/40"}`}>
              {x.label} {n}
            </button>
          );
        })}
      </div>
      <p className="text-[11.5px] text-ink-soft">{KINDS.find((x) => x.k === kind)!.hint}</p>
      {summary && <p className="rounded-sm bg-ink/[0.04] p-2 text-[11.5px] leading-relaxed text-ink-soft">（较早·已压缩）{summary}</p>}
      <ul className="space-y-1.5">
        {list.length === 0 && <li className="py-3 text-center text-[12px] text-ink-soft">还没有记录</li>}
        {list.map((m, i) => (
          <li key={i} className="flex items-start gap-2 rounded-sm border border-dashed border-line px-2.5 py-2">
            <span className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-ink">
              {m.t && <span className="mr-1.5 text-[11px] text-ink-soft">[{m.t}]</span>}{m.text}
            </span>
            <button onClick={() => write(list.filter((_, j) => j !== i))} aria-label="删除" className="shrink-0 text-[12px] text-ink-soft hover:text-coral"><IconClose size={14} /></button>          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} maxLength={160}
          placeholder="手动写入一条记忆…" className="min-w-0 flex-1 rounded-sm border border-line bg-transparent px-2.5 py-2 text-[13px] text-ink outline-none focus:border-jade" />
        <button onClick={add} disabled={!draft.trim()} className="shrink-0 rounded-sm border border-jade bg-jade/10 px-3 text-[12.5px] font-semibold text-jade disabled:opacity-40">写入</button>
      </div>
    </div>
  );
}
