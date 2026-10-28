/* 世界书条目 · 细化设定（模组编辑器与游戏内世界书共用）：
 * 注入模式 · 有效期 · 绑定范围 · 互斥组 · 检索权重。规则实现见 game/worldbookPick。 */
import type { WorldBookEntry, WorldBookMode } from "../lib/types";
import { modeOf } from "../game/worldbookPick";

type Opt = { id: string; name: string };
const field = "w-full min-w-0 rounded-full border border-line bg-paper-2 px-3 py-1 text-[12px] text-ink outline-none focus:border-jade";
const lab = "mb-0.5 block text-[10.5px] font-bold tracking-[0.12em] text-ink-soft";
const MODES: { k: WorldBookMode; t: string; d: string }[] = [
  { k: "keyword", t: "检索命中", d: "上下文出现关键词才注入" },
  { k: "constant", t: "每轮全局", d: "每一轮都注入，请精简" },
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
      <p className="text-[10.5px] text-ink-soft">{MODES.find((x) => x.k === m)?.d}{m === "once" && !e.keywords.length ? "；未填关键词时下一轮直接注入" : ""}</p>
    </div>
  );
}

export default function WorldBookRules({ e, onChange, npcs, rooms, groups }: { e: WorldBookEntry; onChange: (p: Partial<WorldBookEntry>) => void; npcs: Opt[]; rooms: Opt[]; groups: string[] }) {
  const scope = e.scope ?? "global";
  const opts = scope === "npc" ? npcs : scope === "room" ? rooms : [];
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
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
      <label className="block">
        <span className={lab}>绑定范围</span>
        <select className={field} value={scope} onChange={(x) => onChange({ scope: x.target.value === "global" ? undefined : (x.target.value as "npc" | "room"), scopeId: undefined })}>
          <option value="global">全局世界书</option>
          <option value="npc">绑定角色卡（在场 / 私聊时）</option>
          <option value="room">绑定房间（含其子地点）</option>
        </select>
      </label>
      {scope !== "global" ? (
        <label className="block">
          <span className={lab}>{scope === "npc" ? "角色" : "房间"}</span>
          <select className={`${field} ${e.scopeId ? "" : "!border-danger"}`} value={e.scopeId ?? ""} onChange={(x) => onChange({ scopeId: x.target.value || undefined })}>
            <option value="">请选择…（未选 = 按全局处理）</option>
            {opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
      ) : (
        <label className="block">
          <span className={lab}>互斥组（同组只注入一条）</span>
          <input className={field} list="wb-groups" value={e.group ?? ""} placeholder="如：掌门身份" onChange={(x) => onChange({ group: x.target.value.trim() ? x.target.value : undefined })} />
        </label>
      )}
      {scope !== "global" && (
        <label className="block sm:col-span-2">
          <span className={lab}>互斥组（同组只注入一条）</span>
          <input className={field} list="wb-groups" value={e.group ?? ""} placeholder="如：掌门身份" onChange={(x) => onChange({ group: x.target.value.trim() ? x.target.value : undefined })} />
        </label>
      )}
      <datalist id="wb-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
    </div>
  );
}

/* 列表摘要用的短标签 */
export function wbBadges(e: WorldBookEntry): string[] {
  const m = modeOf(e);
  const out = [m === "constant" ? "每轮" : m === "once" ? "一次性" : "检索"];
  if (e.duration && e.duration > 1) out.push(`持续${e.duration}轮`);
  if (e.scope && e.scope !== "global" && e.scopeId) out.push(e.scope === "npc" ? "角色" : "房间");
  if (e.group) out.push(`组·${e.group}`);
  return out;
}
