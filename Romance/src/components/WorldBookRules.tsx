/* 世界书条目 · 细化设定（模组编辑器与游戏内世界书共用）：
 * 依赖地点 / 人物（必填）· 有效期 · 互斥组 · 检索权重。规则实现见 game/worldbookPick。 */
import type { WorldBookEntry, WorldBookMode } from "../lib/types";
import { keywordTexts } from "../lib/worldBookKeywords";
import { worldBookBindNpcs, worldBookBindRooms, worldBookHasDeps, withWorldBookDeps } from "../lib/worldBookDeps";
import { modeOf } from "../game/worldbookPick";

type Opt = { id: string; name: string };
const field = "w-full min-w-0 rounded-full border border-line bg-paper-2 px-3 py-1 text-[12px] text-ink outline-none focus:border-jade";
const lab = "mb-0.5 block text-[10.5px] font-bold tracking-[0.12em] text-ink-soft";
const MODES: { k: WorldBookMode; t: string; d: string }[] = [
  { k: "keyword", t: "检索命中", d: "上下文出现关键词才注入（有依赖时：在地点 / 人物在场也会注入）" },
  { k: "constant", t: "每轮全局", d: "旧条目兼容：无依赖时每轮注入；新条目请挂地点或人物" },
  { k: "once", t: "一次性", d: "注入一次后标记消耗，不再触发" },
];

export function WorldBookModePills({ e, onChange }: { e: WorldBookEntry; onChange: (p: Partial<WorldBookEntry>) => void }) {
  const m = modeOf(e);
  return (
    <div className="space-y-1">
      <div className="inline-flex flex-wrap gap-1 rounded-full border border-line bg-paper-2 p-0.5" role="radiogroup" aria-label="注入模式">
        {MODES.map((x) => (
          <button key={x.k} type="button" role="radio" aria-checked={m === x.k} onClick={() => onChange({ mode: x.k, constant: x.k === "constant" })}
            className={`rounded-full px-3 py-1 text-[11.5px] font-bold transition ${m === x.k ? "bg-ink text-paper-2" : "text-ink-soft hover:text-ink"}`}>{x.t}</button>
        ))}
      </div>
      <p className="text-[10.5px] text-ink-soft">{MODES.find((x) => x.k === m)?.d}{m === "once" && keywordTexts(e.keywords).length === 0 ? "；未填关键词时下一轮直接注入" : ""}</p>
    </div>
  );
}

/** 功能注释：只列出本作品地点 / 人物；空列表时提示先去对应栏目添加，绝不回退娱乐圈地点 */
export function WorldBookDepsPicker({
  e,
  onChange,
  npcs,
  rooms,
  requireDeps = true,
}: {
  e: WorldBookEntry;
  onChange: (p: Partial<WorldBookEntry>) => void;
  npcs: Opt[];
  rooms: Opt[];
  requireDeps?: boolean;
}) {
  const roomIds = worldBookBindRooms(e);
  const npcIds = worldBookBindNpcs(e);
  const toggle = (kind: "room" | "npc", id: string, on: boolean) => {
    const nextRooms = kind === "room" ? (on ? roomIds.filter((x) => x !== id) : [...roomIds, id]) : roomIds;
    const nextNpcs = kind === "npc" ? (on ? npcIds.filter((x) => x !== id) : [...npcIds, id]) : npcIds;
    onChange(withWorldBookDeps(e, nextRooms, nextNpcs));
  };
  const chip = (on: boolean, orphan?: boolean) =>
    `rounded-full border px-2 py-0.5 text-[11px] transition ${on ? "border-jade bg-jade/15 font-semibold text-jade" : orphan ? "border-danger/40 bg-danger/5 text-danger" : "border-line bg-paper text-ink hover:border-jade/60"}`;

  return (
    <div className="space-y-2 sm:col-span-2">
      <div>
        <p className={lab}>所属地点 · 主角在这些地点时注入</p>
        {rooms.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-2.5 py-2 text-[11.5px] text-ink-soft">还没有地点。请先去「地点」添加，这里只列出本作品自己的地点。</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {rooms.map((rm) => {
              const on = roomIds.includes(rm.id);
              return (
                <button key={rm.id} type="button" aria-pressed={on} onClick={() => toggle("room", rm.id, on)} className={chip(on)}>
                  {rm.name || rm.id}
                </button>
              );
            })}
          </div>
        )}
        {/* 已挂但地点表里已删掉的 id：仍显示，便于作者发现失效依赖 */}
        {roomIds.filter((id) => !rooms.some((r) => r.id === id)).map((id) => (
          <button key={id} type="button" aria-pressed className={`${chip(true, true)} mt-1`} onClick={() => toggle("room", id, true)} title="地点已不存在，点击取消">
            {id}（已失效）
          </button>
        ))}
      </div>
      <div>
        <p className={lab}>所属人物 · 该人物在场时注入</p>
        {npcs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-2.5 py-2 text-[11.5px] text-ink-soft">还没有人物。请先去「人物」添加，这里只列出本作品自己的人物。</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {npcs.map((n) => {
              const on = npcIds.includes(n.id);
              return (
                <button key={n.id} type="button" aria-pressed={on} onClick={() => toggle("npc", n.id, on)} className={chip(on)}>
                  {n.name || n.id}
                </button>
              );
            })}
          </div>
        )}
        {npcIds.filter((id) => !npcs.some((n) => n.id === id)).map((id) => (
          <button key={id} type="button" aria-pressed className={`${chip(true, true)} mt-1`} onClick={() => toggle("npc", id, true)} title="人物已不存在，点击取消">
            {id}（已失效）
          </button>
        ))}
      </div>
      {requireDeps && !worldBookHasDeps(e) && (
        <p className="text-[11px] text-danger">必须挂至少一个地点或人物，否则不能保存。</p>
      )}
    </div>
  );
}

export default function WorldBookRules({ e, onChange, npcs, rooms, groups, requireDeps = true }: {
  e: WorldBookEntry;
  onChange: (p: Partial<WorldBookEntry>) => void;
  npcs: Opt[];
  rooms: Opt[];
  groups: string[];
  requireDeps?: boolean;
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      <WorldBookDepsPicker e={e} onChange={onChange} npcs={npcs} rooms={rooms} requireDeps={requireDeps} />
      <label className="block">
        <span className={lab}>有效期（轮）</span>
        <input type="number" min={0} max={99} className={field} value={e.duration ?? ""} placeholder="只在命中的这一轮"
          onChange={(x) => { const n = Math.max(0, Math.min(99, Math.trunc(Number(x.target.value) || 0))); onChange({ duration: n > 1 ? n : undefined }); }} />
      </label>
      <label className="block">
        <span className={lab}>检索权重（同组比拼 · 长词优先）</span>
        <input type="number" min={1} max={1000} className={field} value={e.weight ?? 100}
          onChange={(x) => { const n = Math.max(1, Math.min(1000, Math.trunc(Number(x.target.value) || 100))); onChange({ weight: n === 100 ? undefined : n }); }} />
      </label>
      <label className="block sm:col-span-2">
        <span className={lab}>互斥组（同组只注入一条）</span>
        <input className={field} list="wb-groups" value={e.group ?? ""} placeholder="如：掌门身份" onChange={(x) => onChange({ group: x.target.value.trim() ? x.target.value : undefined })} />
      </label>
      <datalist id="wb-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
    </div>
  );
}

/* 列表摘要用的短标签 */
export function wbBadges(e: WorldBookEntry): string[] {
  const m = modeOf(e);
  const out = [m === "constant" ? "每轮" : m === "once" ? "一次性" : "检索"];
  if (e.duration && e.duration > 1) out.push(`持续${e.duration}轮`);
  const nR = worldBookBindRooms(e).length;
  const nN = worldBookBindNpcs(e).length;
  if (nR) out.push(`地点×${nR}`);
  if (nN) out.push(`人物×${nN}`);
  if (e.group) out.push(`组·${e.group}`);
  return out;
}
