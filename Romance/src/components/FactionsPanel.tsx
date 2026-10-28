import { IconChevronDown, IconChevronUp, IconClose } from "../lib/icons";
/* 阵营派系：自定义阵营、成员立场、控制地点；声望影响成员态度、店铺价格与事件 / 结局分支。
 * 同时阵营名与标签作为世界书关键词注入剧情（数值与关键词始终结合）。 */
import { useState } from "react";
import type { Faction, FactionStance } from "../lib/types";
import { useGame } from "../store/gameCtx";
import { AuditBadge, AuditBar, AuditList, KwInput, EmptyState, ScopeBanner, auditDomId, useConfirm } from "./EditorKit";
import { auditGame, issuesAt } from "../game/refAudit";
import { LIVE_LOCATIONS as LOCATIONS } from "../mods/registry";
import { STANCE_LABEL, STANCE_SPILL, factionFlag, repOf, repPriceMult, repTier, syncFactions, REP_MIN, REP_MAX } from "../game/factions";

const uid = () => `fa_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const box = "w-full rounded-lg border border-line bg-paper-2 px-2.5 py-1.5 text-[13px] text-ink";
const sel = "rounded-lg border border-line bg-paper-2 px-2 py-1 text-[12.5px] text-ink";

export default function FactionsPanel() {
  const { game, commitGame } = useGame();
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirm, confirmEl] = useConfirm();
  if (!game) return null;
  const list = game.factions ?? [];
  const lore = false;
  const audit = auditGame(game, { factions: list });
  const save = (factions: Faction[], extra: Partial<typeof game> = {}) => {
    const next = { ...game, ...extra, factions: factions.length ? factions : undefined };
    syncFactions(next);
    commitGame(next);
  };
  const patch = (id: string, p: Partial<Faction>) => save(list.map((f) => (f.id === id ? { ...f, ...p } : f)));
  const setRep = (id: string, v: number) => commitGame({ ...game, sim: { ...game.sim, flags: { ...(game.sim.flags ?? {}), [factionFlag(id)]: Math.max(REP_MIN, Math.min(REP_MAX, v)) } } });

  return (
    <div className="space-y-4">
      {confirmEl}
      <ScopeBanner scope="save">阵营只作用于当前存档，修改即时保存。</ScopeBanner>
      <p className="rounded-2xl border border-line bg-paper-2/60 px-4 py-3 text-[12px] leading-relaxed text-ink-soft">
        阵营名与标签是世界书关键词：剧情里提到时自动注入阵营设定、成员与当前声望。同时声望 -100~100 参与数值：变动时按立场波及成员好感（核心 50% · 成员 30% · 亲近 15%）；在阵营控制的地点购物按声望调价（+100 打八折，-100 贵五成）；事件、主线、结局条件都可以读取声望。
      </p>

      {list.length === 0 && <EmptyState>还没有阵营。点下方「＋ 新增阵营」开始。</EmptyState>}

      {list.length > 0 && <AuditBar issues={audit.issues.filter((x) => x.at?.startsWith("faction:"))} onJump={(at) => setOpenId(at.slice(8))} />}
      {list.map((f) => {
        const open = openId === f.id;
        const mine = issuesAt(audit, `faction:${f.id}`);
        const rep = repOf(game.sim, f.id);
        const members = f.members ?? [];
        const ids = new Set(members.map((m) => m.npc));
        return (
          <div key={f.id} id={auditDomId(`faction:${f.id}`)} className="scroll-mt-3 overflow-hidden rounded-2xl border border-line bg-paper-2/60">
            <button onClick={() => setOpenId(open ? null : f.id)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-bold text-ink">{f.name || "（未命名阵营）"}</span>
                <span className="block truncate text-[11px] text-ink-soft">{members.length} 名成员{f.tags?.length ? ` · 标签：${f.tags.join("、")}` : ""}</span>
              </span>
              {!lore && (
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${rep >= 25 ? "bg-jade/12 text-jade" : rep <= -25 ? "bg-danger/12 text-danger" : "bg-ink-soft/10 text-ink-soft"}`}>{repTier(rep)} {rep}</span>
              )}
              <AuditBadge issues={mine} />
              <span className="inline-flex shrink-0 items-center gap-0.5 text-[12px] text-ink-soft">{open ? <>收起 <IconChevronUp size={12} /></> : <>展开 <IconChevronDown size={12} /></>}</span>
            </button>
            {open && (
              <div className="space-y-3 border-t border-line px-4 py-3">
                <AuditList issues={mine} />
                <input className={`${box} ${f.name.trim() ? "" : "!border-danger"}`} value={f.name} maxLength={20} placeholder="阵营名，如：星耀传媒" onChange={(e) => patch(f.id, { name: e.target.value })} />
                <textarea className={`${box} resize-y leading-relaxed`} rows={2} value={f.desc ?? ""} placeholder="阵营设定：立场、作风、与其他阵营的关系（作为世界书正文注入）" onChange={(e) => patch(f.id, { desc: e.target.value || undefined })} />
                <div>
                  <p className="mb-1 text-[11px] font-bold text-ink-soft">标签 / 别称（世界书关键词）</p>
                  <KwInput value={f.tags} onChange={(tags) => patch(f.id, { tags })} placeholder="如：星耀、老东家" />
                </div>

                <div>
                  <p className="mb-1 text-[11px] font-bold text-ink-soft">成员与立场</p>
                  <div className="space-y-1.5">
                    {members.map((m, i) => (
                      <div key={m.npc} className="flex items-center gap-2 rounded-lg bg-paper/50 px-2 py-1.5 text-[12.5px]">
                        <span className="min-w-0 flex-1 truncate text-ink">{game.npcs.find((n) => n.id === m.npc)?.name ?? m.npc}</span>
                        <select className={sel} value={m.stance} onChange={(e) => patch(f.id, { members: members.map((x, j) => (j === i ? { ...x, stance: e.target.value as FactionStance } : x)) })}>
                          {(Object.keys(STANCE_LABEL) as FactionStance[]).map((k) => <option key={k} value={k}>{STANCE_LABEL[k]}{lore ? "" : `（波及 ${STANCE_SPILL[k] * 100}%）`}</option>)}
                        </select>
                        <button onClick={() => patch(f.id, { members: members.filter((_, j) => j !== i) })} className="px-1 text-[12px] font-bold text-danger" aria-label="移出阵营"><IconClose size={14} /></button>                      </div>
                    ))}
                    <select className={sel} value="" onChange={(e) => e.target.value && patch(f.id, { members: [...members, { npc: e.target.value, stance: "member" }] })}>
                      <option value="">＋ 加入成员…</option>
                      {game.npcs.filter((n) => !ids.has(n.id)).map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                    </select>
                  </div>
                </div>

                {!lore && (<>
                  <div>
                    <p className="mb-1 text-[11px] font-bold text-ink-soft">控制的地点（在此购物按声望调价，含子地点）</p>
                    <div className="flex flex-wrap gap-1.5">
                      {LOCATIONS.map((l) => { const on = (f.rooms ?? []).includes(l.id); return (
                        <button key={l.id} aria-pressed={on} onClick={() => { const n = on ? f.rooms!.filter((x) => x !== l.id) : [...(f.rooms ?? []), l.id]; patch(f.id, { rooms: n.length ? n : undefined }); }}
                          className={`rounded-full border px-2.5 py-1 text-[12px] transition ${on ? "border-transparent bg-jade text-white" : "border-line bg-paper-2 text-ink-soft"}`}>{l.name}</button>
                      ); })}
                    </div>
                  </div>
                  <label className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink">
                    当前声望
                    <input type="range" min={REP_MIN} max={REP_MAX} value={rep} onChange={(e) => setRep(f.id, Number(e.target.value))} className="w-40 accent-[var(--jade)]" />
                    <span className="tabular-nums font-bold">{rep}</span>
                    <span className="text-[11px] text-ink-soft">{repTier(rep)} · 价格 ×{repPriceMult(rep).toFixed(2)} · 规则变量 <code className="text-jade">{factionFlag(f.id)}</code></span>
                  </label>
                </>)}

                <div className="flex justify-end border-t border-line pt-3">
                  <button onClick={async () => { if (await confirm(`确定删除阵营「${f.name || "未命名"}」？引用它的条件将失效。`)) save(list.filter((x) => x.id !== f.id)); }}
                    className="rounded-lg border border-danger/50 px-3 py-1.5 text-[12.5px] font-bold text-danger transition hover:bg-danger/10">删除阵营</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button onClick={() => { const f: Faction = { id: uid(), name: "" }; save([...list, f]); setOpenId(f.id); }}
        className="w-full rounded-2xl border border-dashed border-jade/60 bg-jade/5 py-3 text-[13px] font-bold text-jade transition hover:bg-jade/10">＋ 新增阵营</button>
    </div>
  );
}
