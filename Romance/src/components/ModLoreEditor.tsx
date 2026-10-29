import { useState } from "react";
import type { LoreChar, LoreFaction, LoreNode, LoreRegion } from "../lib/types";
import { regionFull, regionIndex } from "../game/loreContext";
import { KwInput } from "./EditorKit";

/* 模组编辑器 · 详细设定：地区 → 势力 → 角色 三层嵌套。
 * 主角所在地区发完整设定；其余地区只发名称 + 简介速查；剧情提到别处时单独补发。 */
const inp = "min-w-0 w-full rounded-lg border border-line bg-paper px-2 py-1 text-[12.5px] text-ink outline-none focus:border-jade";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const del = "rounded-full px-2 py-0.5 text-[11px] text-ink-soft transition hover:bg-danger/10 hover:text-danger";
const uid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`;
const blankNode = (p: string, name: string): LoreNode => ({ id: uid(p), name, brief: "", detail: "" });
type Ref = { id: string; name: string };

const TIER = {
  region: { tag: "地区", tone: "border-jade/40 bg-jade/5", chip: "bg-jade/15 text-jade" },
  faction: { tag: "势力", tone: "border-gold/40 bg-gold/5", chip: "bg-gold/15 text-gold" },
  char: { tag: "角色", tone: "border-line bg-paper", chip: "bg-coral/12 text-coral" },
} as const;

/* 三件套：名称 · 简介 · 完整设定（+ 别名关键词） */
function NodeFields({ n, set, tier }: { n: LoreNode; set: (p: Partial<LoreNode>) => void; tier: keyof typeof TIER }) {
  const brief = String(n.brief ?? "");
  const detail = String(n.detail ?? "");
  const miss = !brief.trim() || !detail.trim();
  return (
    <div className="space-y-1.5">
      <div className="grid gap-1.5 sm:grid-cols-[10rem_1fr]">
        <input className={`${inp} font-semibold`} value={String(n.name ?? "")} placeholder={`${TIER[tier].tag}名称`} onChange={(e) => set({ name: e.target.value })} />
        <input className={inp} value={brief} placeholder="简介：一两句话（进速查表，不在此地时也会发送）" onChange={(e) => set({ brief: e.target.value })} />
      </div>
      <textarea className={inp} rows={3} value={detail} placeholder="完整设定：只在主角身处此地、或剧情提到它时发送" onChange={(e) => set({ detail: e.target.value })} />
      <div className="flex items-center gap-2">
        <KwInput className={`${inp} text-[11.5px]`} value={n.keywords} onChange={(keywords) => set({ keywords })} placeholder="别名 / 关键词（可不填）：提到这些词也算提及" />
        <span className={`shrink-0 text-[10.5px] tabular-nums ${miss ? "text-gold" : "text-ink-soft"}`}>{miss ? "简介与完整设定都要填" : `${detail.length} 字`}</span>
      </div>
    </div>
  );
}

function CharList({ list, onChange, npcs }: { list?: LoreChar[]; onChange: (v?: LoreChar[]) => void; npcs: Ref[] }) {
  const chars = list ?? [];
  const put = (v: LoreChar[]) => onChange(v.length ? v : undefined);
  const set = (id: string, p: Partial<LoreChar>) => put(chars.map((c) => (c.id === id ? { ...c, ...p } : c)));
  return (
    <div className="space-y-1.5">
      {chars.map((c) => (
        <div key={c.id} className={`rounded-lg border p-2 ${TIER.char.tone}`}>
          <div className="mb-1 flex items-center gap-2">
            <span className={`rounded px-1.5 text-[10px] font-bold ${TIER.char.chip}`}>角色</span>
            {npcs.length > 0 && (
              <select className={`${inp} !w-auto text-[11px]`} value={c.npcId ?? ""} aria-label="关联人物" onChange={(e) => {
                const npc = npcs.find((x) => x.id === e.target.value);
                set(c.id, { npcId: e.target.value || undefined, ...(npc && !String(c.name ?? "").trim() ? { name: npc.name } : {}) });
              }}>
                <option value="">不关联地图人物</option>
                {npcs.map((p) => <option key={p.id} value={p.id}>关联：{p.name || p.id}</option>)}
              </select>
            )}
            <button type="button" className={`${del} ml-auto`} onClick={() => put(chars.filter((x) => x.id !== c.id))}>删除</button>
          </div>
          <NodeFields n={c} tier="char" set={(p) => set(c.id, p)} />
        </div>
      ))}
      <button type="button" className={btn} onClick={() => put([...chars, blankNode("lc", "")])}>＋ 角色</button>
    </div>
  );
}

function FactionList({ list, onChange, npcs }: { list?: LoreFaction[]; onChange: (v?: LoreFaction[]) => void; npcs: Ref[] }) {
  const fs = list ?? [];
  const put = (v: LoreFaction[]) => onChange(v.length ? v : undefined);
  const set = (id: string, p: Partial<LoreFaction>) => put(fs.map((f) => (f.id === id ? { ...f, ...p } : f)));
  return (
    <div className="space-y-2">
      {fs.map((f) => (
        <details key={f.id} open className={`group rounded-xl border p-2.5 ${TIER.faction.tone}`}>
          <summary className="flex cursor-pointer list-none items-center gap-2">
            <span className={`rounded px-1.5 text-[10px] font-bold ${TIER.faction.chip}`}>势力</span>
            <span className="truncate text-[12.5px] font-bold text-ink">{f.name || "（未命名势力）"}</span>
            <span className="text-[10.5px] text-ink-soft">{f.chars?.length ? `${f.chars.length} 名角色` : ""}</span>
            <button type="button" className={`${del} ml-auto`} onClick={(e) => { e.preventDefault(); put(fs.filter((x) => x.id !== f.id)); }}>删除</button>
            <span className="text-[11px] text-ink-soft transition group-open:rotate-90">›</span>
          </summary>
          <div className="mt-2 space-y-2">
            <NodeFields n={f} tier="faction" set={(p) => set(f.id, p)} />
            <div className="border-l-2 border-gold/30 pl-2.5">
              <p className="mb-1 text-[10.5px] font-bold text-ink-soft">所属角色</p>
              <CharList list={f.chars} npcs={npcs} onChange={(chars) => set(f.id, { chars })} />
            </div>
          </div>
        </details>
      ))}
      <button type="button" className={btn} onClick={() => put([...fs, blankNode("lf", "")])}>＋ 势力</button>
    </div>
  );
}

export default function ModLoreEditor({ value, onChange, rooms, npcs }: { value?: LoreRegion[]; onChange: (v?: LoreRegion[]) => void; rooms: Ref[]; npcs: Ref[] }) {
  // 功能注释：AI 常把 lore 写成 {regions:[]}；非数组时展开，禁止 forEach 崩页
  const list = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { regions?: unknown }).regions)
      ? ((value as { regions: LoreRegion[] }).regions)
      : [];
  const [open, setOpen] = useState<string | null>(list[0]?.id ?? null);
  const put = (v: LoreRegion[]) => onChange(v.length ? v : undefined);
  const set = (id: string, p: Partial<LoreRegion>) => put(list.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const move = (i: number, d: -1 | 1) => { const v = [...list]; [v[i], v[i + d]] = [v[i + d], v[i]]; put(v); };
  // 一个地点只归属一个地区：点选时从其他地区移走
  const owner = new Map<string, string>();
  list.forEach((r) => (Array.isArray(r?.rooms) ? r.rooms : []).forEach((id) => owner.set(id, r.id)));
  const toggleRoom = (rid: string, roomId: string, on: boolean) => put(list.map((x) => {
    const rest = (x.rooms ?? []).filter((y) => y !== roomId);
    const rs = x.id === rid && !on ? [...rest, roomId] : rest;
    return { ...x, rooms: rs.length ? rs : undefined };
  }));

  return (
    <div className="space-y-2.5">
      <div className="rounded-xl border border-line bg-paper-2/60 p-3 text-[11.5px] leading-relaxed text-ink-soft">
        <p>给大世界观用。每个地区、势力、角色都要填<b className="text-ink">名称、简介、完整设定</b>三项。</p>
        <p>主角<b className="text-ink">身处</b>某地区时，发送该地区的完整设定，连同下属的势力和角色；<b className="text-ink">其他地区</b>只发名称和简介，组成速查表，免得 AI 乱编；剧情里<b className="text-ink">提到</b>别处的地区、势力或角色时，再单独补发它自己的完整设定。</p>
        <p>没勾选所属地点的地区，按「当前地名里含地区名或关键词」判断；只有一个地区时始终视为身处其中。</p>
      </div>
      <button type="button" className={btn} onClick={() => { const r: LoreRegion = blankNode("lr", `地区 ${list.length + 1}`); put([...list, r]); setOpen(r.id); }}>＋ 添加地区</button>
      {!list.length && <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[12px] text-ink-soft">暂无地区 · 设定量少的世界观，直接写进①基础「剧本基调」即可</p>}

      {list.map((r, i) => {
        const isOpen = open === r.id;
        const full = regionFull(r).length;
        const others = list.filter((x) => x.id !== r.id).map(regionIndex).join("\n").length;
        const nF = r.factions?.length ?? 0;
        const nC = (r.chars?.length ?? 0) + (r.factions ?? []).reduce((a, f) => a + (f.chars?.length ?? 0), 0);
        return (
          <div key={r.id} className={`rounded-2xl border ${TIER.region.tone}`}>
            <div className="flex items-center gap-2 px-3 py-2">
              <button type="button" onClick={() => setOpen(isOpen ? null : r.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={isOpen}>
                <span className={`shrink-0 rounded px-1.5 text-[10px] font-bold ${TIER.region.chip}`}>地区</span>
                <span className="truncate text-[13px] font-bold text-ink">{r.name || "（未命名地区）"}</span>
                <span className="truncate text-[10.5px] text-ink-soft">{nF} 势力 · {nC} 角色 · 身处此地约发 {full + others} 字</span>
              </button>
              <button type="button" className={btn} disabled={i === 0} onClick={() => move(i, -1)} aria-label="上移">↑</button>
              <button type="button" className={btn} disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label="下移">↓</button>
              <button type="button" className={del} onClick={() => put(list.filter((x) => x.id !== r.id))}>删除</button>
            </div>
            {isOpen && (
              <div className="space-y-3 border-t border-jade/20 px-3 py-3">
                <NodeFields n={r} tier="region" set={(p) => set(r.id, p)} />
                {rooms.length > 0 && (
                  <div>
                    <p className="mb-1 text-[10.5px] font-bold text-ink-soft">所属地点 · 主角在这些地点即视为身处「{r.name || "本地区"}」</p>
                    <div className="flex flex-wrap gap-1">
                      {rooms.map((rm) => {
                        const on = (r.rooms ?? []).includes(rm.id);
                        const elsewhere = !on && owner.has(rm.id) ? list.find((x) => x.id === owner.get(rm.id))?.name : undefined;
                        return (
                          <button key={rm.id} type="button" aria-pressed={on} onClick={() => toggleRoom(r.id, rm.id, on)}
                            title={elsewhere ? `已属于「${elsewhere}」，点选会移到本地区` : undefined}
                            className={`rounded-full border px-2 py-0.5 text-[11px] transition ${on ? "border-jade bg-jade/15 font-semibold text-jade" : elsewhere ? "border-line bg-paper text-ink-soft/60" : "border-line bg-paper text-ink hover:border-jade/60"}`}>
                            {rm.name}{elsewhere && <span className="ml-0.5 text-[9.5px]">· {elsewhere}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="border-l-2 border-gold/30 pl-2.5">
                  <p className="mb-1 text-[10.5px] font-bold text-ink-soft">势力</p>
                  <FactionList list={r.factions} npcs={npcs} onChange={(factions) => set(r.id, { factions })} />
                </div>
                <div className="border-l-2 border-coral/30 pl-2.5">
                  <p className="mb-1 text-[10.5px] font-bold text-ink-soft">直属角色 · 不属于任何势力</p>
                  <CharList list={r.chars} npcs={npcs} onChange={(chars) => set(r.id, { chars })} />
                </div>
                <p className="text-[10.5px] text-ink-soft">身处此地时：完整设定约 {full} 字{list.length > 1 ? `，加其他地区速查约 ${others} 字` : ""}。单次上限为完整设定 3000 字、速查 1200 字，超出部分截断。</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
