import { IconClose } from "../lib/icons";
import { CondRow, questOpts, sideOpts, useDraftDefaults } from "./FixedEventsPanel";
import type { FixedEvent, QuestNode, Sideline, Storyline } from "../lib/types";
import { AuditBar, AuditList, auditDomId } from "./EditorKit";
import { auditStory, issuesAt } from "../game/refAudit";
import { useDraftRefs } from "./draftRefsContext";

/* 模组编辑器 · 剧情线 · 主线：有序节点，每天结束由代码判定完成 / 失败。
 * 功能注释：主线节点只配目标说明与完成/失败条件；编辑器不再提供奖励或激活事件入口。 */
const inp = "min-w-0 w-full rounded-lg border border-line bg-paper-2 px-2 py-1 text-[12.5px] text-ink outline-none focus:border-jade";
const sel = "rounded-md border border-line bg-paper-2 px-1.5 py-0.5 text-[11.5px]";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const link = "text-[11.5px] font-semibold text-jade hover:underline";
const uid = (p: string) => `${p}_${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`;
/* 功能注释：新节点默认条件取当前作品属性（dd 带草稿引用池）；没有属性就留空不预选 */
const newNode = (dd: ReturnType<typeof useDraftDefaults>): QuestNode => ({ id: uid("qn"), name: "", desc: "", conds: [dd.cond("metric")] });

export function EventPicks({ label, ids, events, onChange }: { label: string; ids?: string[]; events: FixedEvent[]; onChange: (v?: string[]) => void }) {
  const list = ids ?? [];
  const name = (id: string) => events.find((e) => e.id === id)?.name || `已失效：${id}`;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-bold text-ink-soft">{label}</span>
      {list.map((id) => (
        <span key={id} className="inline-flex items-center gap-1 rounded-full bg-jade/10 px-2 py-0.5 text-[11px] text-jade">
          {name(id)}
          <button aria-label="移除" className="hover:text-danger" onClick={() => { const n = list.filter((x) => x !== id); onChange(n.length ? n : undefined); }}><IconClose size={14} /></button>        </span>
      ))}
      <select className={sel} value="" onChange={(e) => e.target.value && onChange([...list, e.target.value])}>
        <option value="">＋ 选择事件</option>
        {events.filter((e) => !list.includes(e.id)).map((e) => <option key={e.id} value={e.id}>{e.name || "未命名"} · {e.id}</option>)}
      </select>
    </div>
  );
}

function NodeCard({ n, idx, total, events, quests, sides, onChange, onMove, onDelete }: {
  n: QuestNode; idx: number; total: number; events: FixedEvent[]; quests: ReturnType<typeof questOpts>; sides: ReturnType<typeof sideOpts>;
  onChange: (n: QuestNode) => void; onMove: (d: -1 | 1) => void; onDelete: () => void;
}) {
  const dd = useDraftDefaults();
  return (
    <div className={`space-y-1.5 rounded-xl border-l-[3px] bg-paper/60 py-2 pl-3 pr-2 ${n.optional ? "border-gold/70" : "border-jade/70"}`}>
      <div className="flex items-center gap-2">
        <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-black ${n.optional ? "bg-gold/15 text-gold" : "bg-jade/15 text-jade"}`}>{n.optional ? "可选目标" : `第 ${idx + 1} 步`}</span>
        <input className={inp} value={n.name} maxLength={24} placeholder="节点名称（如：拿下首个主角）" onChange={(e) => onChange({ ...n, name: e.target.value })} />
        <label className="flex shrink-0 items-center gap-1 text-[11px] text-ink-soft">
          <input type="checkbox" checked={!!n.optional} onChange={(e) => onChange({ ...n, optional: e.target.checked || undefined })} />可选
        </label>
        <button className="text-[12px] text-ink-soft hover:text-jade disabled:opacity-30" disabled={idx === 0} onClick={() => onMove(-1)} aria-label="上移">↑</button>
        <button className="text-[12px] text-ink-soft hover:text-jade disabled:opacity-30" disabled={idx === total - 1} onClick={() => onMove(1)} aria-label="下移">↓</button>
        <button className="text-[12px] text-ink-soft hover:text-danger" onClick={onDelete} aria-label="删除节点"><IconClose size={14} /></button>
      </div>
      <input className={inp} value={n.desc ?? ""} maxLength={80} placeholder="目标说明（给玩家与 AI 看，如：在年底前拿下第一个主角）" onChange={(e) => onChange({ ...n, desc: e.target.value || undefined })} />

      <div className="flex items-center gap-2 pt-0.5">
        <p className="text-[11px] font-bold text-ink-soft">完成条件</p>
        {(n.conds ?? []).length > 1 && (
          <select className={sel} value={n.match ?? "all"} onChange={(e) => onChange({ ...n, match: e.target.value as "all" | "any" })}>
            <option value="all">全部满足</option><option value="any">任一满足</option>
          </select>
        )}
      </div>
      {(n.conds ?? []).map((c, i) => (
        <CondRow key={i} c={c} events={events} selfId="" quests={quests} sides={sides} onChange={(x) => onChange({ ...n, conds: (n.conds ?? []).map((y, j) => (j === i ? x : y)) })} onDelete={() => onChange({ ...n, conds: (n.conds ?? []).filter((_, j) => j !== i) })} />
      ))}
      <button className={link} onClick={() => onChange({ ...n, conds: [...(n.conds ?? []), dd.cond("metric")] })}>＋ 完成条件</button>
      {!(n.conds ?? []).length && <p className="text-[11px] text-danger">没有完成条件的节点不会自动完成</p>}

      <p className="pt-0.5 text-[11px] font-bold text-ink-soft">失败条件（任一满足即失败，可留空）</p>
      {(n.failConds ?? []).map((c, i) => (
        <CondRow key={i} c={c} events={events} selfId="" quests={quests} sides={sides} onChange={(x) => onChange({ ...n, failConds: n.failConds!.map((y, j) => (j === i ? x : y)) })} onDelete={() => { const f = n.failConds!.filter((_, j) => j !== i); onChange({ ...n, failConds: f.length ? f : undefined }); }} />
      ))}
      <button className={link} onClick={() => onChange({ ...n, failConds: [...(n.failConds ?? []), dd.cond("time")] })}>＋ 失败条件</button>
    </div>
  );
}

export default function StorylinesEditor({ value, sidelines, events = [], onChange }: { value?: Storyline[]; sidelines?: Sideline[]; events?: FixedEvent[]; onChange: (v?: Storyline[]) => void }) {
  const dd = useDraftDefaults();
  const list = value ?? [];
  const quests = questOpts(list);
  const sides = sideOpts(sidelines ?? []);
  const draftRefs = useDraftRefs();
  // 功能注释：主线节点的人物/地点/物品引用也要校验，只认当前表单（空就是空），不再 skip
  const audit = auditStory({
    draft: true, storylines: list, sidelines: sidelines ?? [], events,
    npcIds: (draftRefs?.people ?? []).map((p) => p.id), roomIds: (draftRefs?.rooms ?? []).map((r) => r.id), itemIds: (draftRefs?.items ?? []).map((i) => i.id),
    people: draftRefs?.people, factions: draftRefs?.factions?.map((f) => ({ id: f.id, name: f.name, members: [] })),
    skip: ["flag"],
  });
  const commit = (n: Storyline[]) => onChange(n.length ? n : undefined);
  const set = (id: string, p: Partial<Storyline>) => commit(list.map((l) => (l.id === id ? { ...l, ...p } : l)));
  const setNodes = (l: Storyline, nodes: QuestNode[]) => set(l.id, { nodes });

  return (
    <div className="space-y-2.5">
      <p className="text-[11px] leading-relaxed text-ink-soft">
        建议只配一条主线：按顺序排好节点，每个节点写清目标说明与完成条件。前面的必做节点完成后，下一步才开始判定；可选目标不阻塞主线。
        每天结束由代码判定完成 / 失败。必做节点全部完成 = 主线完成；任一必做节点失败 = 主线中断。主线节点不配奖励、不激活事件。
      </p>
      <button className={btn} onClick={() => commit([...list, { id: uid("sl"), name: "主线", nodes: [newNode(dd)] }])}>＋ 新建主线</button>
      {list.length > 0 && <AuditBar issues={audit.issues.filter((x) => x.at?.startsWith("quest:"))} onJump={() => undefined} />}
      {!list.length && <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-[12px] text-ink-soft">还没有主线 · 新建一条，再按顺序添加节点</p>}
      {list.map((l) => (
        <div key={l.id} id={auditDomId(`quest:${l.id}`)} className={`scroll-mt-3 space-y-2 rounded-2xl border border-line bg-paper-2/60 p-2.5 ${l.enabled === false ? "opacity-60" : ""}`}>
          <div className="flex items-center gap-2">
            <input className={`${inp} !text-[13px] font-bold`} value={String(l.name ?? "")} maxLength={24} placeholder="主线名称" onChange={(e) => set(l.id, { name: e.target.value })} />
            <label className="flex shrink-0 items-center gap-1 text-[11px] text-ink-soft">
              <input type="checkbox" checked={l.enabled !== false} onChange={(e) => set(l.id, { enabled: e.target.checked ? undefined : false })} />启用
            </label>
            <button className="shrink-0 text-[12px] text-ink-soft hover:text-danger" onClick={() => commit(list.filter((x) => x.id !== l.id))} aria-label="删除主线"><IconClose size={14} /></button>          </div>
          <AuditList issues={issuesAt(audit, `quest:${l.id}`)} />
          <input className={inp} value={l.desc ?? ""} maxLength={120} placeholder="主线简介（可留空）" onChange={(e) => set(l.id, { desc: e.target.value || undefined })} />
          <p className="text-[10.5px] text-ink-soft">ID：{l.id} · {(l.nodes ?? []).filter((n) => !n.optional).length} 个必做节点 · {(l.nodes ?? []).filter((n) => n.optional).length} 个可选目标</p>
          {(l.nodes ?? []).map((n, i) => (
            <NodeCard key={n.id} n={n} idx={i} total={(l.nodes ?? []).length} events={events} quests={quests} sides={sides}
              onChange={(x) => setNodes(l, (l.nodes ?? []).map((y) => (y.id === n.id ? x : y)))}
              onMove={(d) => { const a = [...(l.nodes ?? [])]; [a[i], a[i + d]] = [a[i + d], a[i]]; setNodes(l, a); }}
              onDelete={() => setNodes(l, (l.nodes ?? []).filter((y) => y.id !== n.id))} />
          ))}
          <button className={link} onClick={() => setNodes(l, [...(l.nodes ?? []), newNode(dd)])}>＋ 添加节点</button>
        </div>
      ))}
    </div>
  );
}
