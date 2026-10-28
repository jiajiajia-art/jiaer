import AiImageGen from "./AiImageGen";
import { useState } from "react";
import { useGame } from "../store/gameCtx";
import type { CgDef, FixedCond } from "../lib/types";
import { CondRow, defaultCond } from "./FixedEventsPanel";
import { AuditBadge, AuditBar, AuditList, EmptyState, ScopeBanner, auditDomId, useConfirm } from "./EditorKit";
import { auditGame, issuesAt } from "../game/refAudit";

/* CG 编排：剧情插图 + 解锁条件（复用固定事件的条件行），满足即自动收入玩家图鉴 */
const uid = () => `cg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const inputCls = "w-full rounded-lg border border-line bg-paper-2 px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-[var(--jade)]";

export default function CgPanel() {
  const { game, commitGame } = useGame();
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirm, confirmEl] = useConfirm();
  if (!game) return null;
  const list = game.cgs ?? [];
  const save = (next: CgDef[]) => commitGame({ ...game, cgs: next });
  const patch = (id: string, p: Partial<CgDef>) => save(list.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const audit = auditGame(game, { cgs: list });
  const add = () => {
    const c: CgDef = { id: uid(), title: `CG ${list.length + 1}`, image: "", conds: [defaultCond("rel")] };
    save([...list, c]);
    setOpenId(c.id);
  };
  const pick = (id: string, file?: File) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => patch(id, { image: String(r.result) });
    r.readAsDataURL(file);
  };

  // 批量上传：每张图生成一个 CG（标题取文件名），条件默认一条好感，作者再细调
  const bulk = async (files: FileList | null) => {
    if (!files?.length) return;
    const read = (f: File) => new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(f); });
    const made: CgDef[] = [];
    for (const f of Array.from(files)) made.push({ id: uid(), title: f.name.replace(/\.[^.]+$/, "").slice(0, 24), image: await read(f), conds: [defaultCond("rel")] });
    save([...list, ...made]);
  };

  return (
    <div className="space-y-3">
      {confirmEl}
      <ScopeBanner scope="save">CG 是关键剧情的插图（一幕场景），不是人物立绘：条件全部满足时自动解锁，玩家可在菜单「CG 图鉴」与人物资料里查看。</ScopeBanner>
      {list.length === 0 && <EmptyState>还没有 CG。点下方「新增 CG」，上传一张立绘并设定解锁条件。</EmptyState>}
      {list.length > 0 && <AuditBar issues={audit.issues.filter((x) => x.at?.startsWith("cg:"))} onJump={(at) => setOpenId(at.slice(3))} />}
      {list.map((c) => {
        const open = openId === c.id;
        const mine = issuesAt(audit, `cg:${c.id}`);
        const got = !!game.cgUnlocked?.[c.id];
        return (
          <div key={c.id} id={auditDomId(`cg:${c.id}`)} className={`scroll-mt-3 rounded-xl border border-line bg-paper ${c.enabled === false ? "opacity-55" : ""}`}>
            <button onClick={() => setOpenId(open ? null : c.id)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left">
              <span className="h-11 w-9 shrink-0 overflow-hidden rounded-md border border-line bg-paper-2">
                {c.image && <img src={(c.image) || undefined} alt="" className="h-full w-full object-cover" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-bold text-ink">{c.title || "（未命名）"}</span>
                <span className="block text-[11.5px] text-ink-soft">{game.npcs.find((n) => n.id === c.npcId)?.name ?? "不绑定人物"} · {c.conds.length} 个条件</span>
              </span>
              <AuditBadge issues={mine} />
              <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: got ? "var(--jade)" : "var(--coral)", border: `1px solid ${got ? "var(--jade)" : "var(--coral)"}` }}>{got ? "已解锁" : "未解锁"}</span>
            </button>
            {open && (
              <div className="space-y-2.5 border-t border-line px-3 py-3">
                <AuditList issues={mine} />
                <input className={inputCls} placeholder="CG 名，如「雨夜的伞」" value={c.title} maxLength={24} onChange={(e) => patch(c.id, { title: e.target.value })} />
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line px-3 py-2 text-[12.5px] text-ink-soft hover:border-coral">
                  {c.image ? <img src={(c.image) || undefined} alt="" className="h-16 w-12 rounded object-cover" /> : <span className="grid h-16 w-12 place-items-center rounded bg-paper-2 text-[18px]">＋</span>}
                  <span>{c.image ? "点击更换立绘" : "上传立绘（建议竖图）"}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => pick(c.id, e.target.files?.[0])} />
                </label>
                <AiImageGen onPick={(image) => patch(c.id, { image })} placeholder="描述这张 CG 的画面：人物、动作、场景、光线……" />
                <select className={inputCls} value={c.npcId ?? ""} onChange={(e) => patch(c.id, { npcId: e.target.value || undefined })}>
                  <option value="">不绑定人物</option>
                  {game.npcs.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
                <textarea className={`${inputCls} min-h-[56px] resize-y`} placeholder="解锁后展示的一段文字（可选）" value={c.desc ?? ""} maxLength={200} onChange={(e) => patch(c.id, { desc: e.target.value })} />
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5 text-[12px] font-bold text-ink-soft">
                    <span className="shrink-0">解锁条件（全部满足）</span>
                    <span className="flex flex-wrap gap-1">
                      {([["rel", "好感"], ["location", "地点"], ["stat", "属性"], ["metric", "数值"], ["item", "道具"], ["event", "事件"]] as const).map(([k, l]) => (
                        <button key={k} onClick={() => patch(c.id, { conds: [...c.conds, defaultCond(k)] })} className="rounded-full border border-line px-2 py-0.5 text-[11.5px] text-ink hover:border-coral hover:text-coral">＋{l}</button>
                      ))}
                    </span>
                  </div>
                  {c.conds.length === 0 && <p className="text-[12px] text-danger">至少需要一个条件，否则不会解锁。</p>}
                  {c.conds.map((k, ci) => (
                    <CondRow key={ci} c={k} events={game.fixedEvents ?? []} selfId=""
                      onChange={(nc: FixedCond) => patch(c.id, { conds: c.conds.map((x, xi) => (xi === ci ? nc : x)) })}
                      onDelete={() => patch(c.id, { conds: c.conds.filter((_, xi) => xi !== ci) })} />
                  ))}
                </div>
                <div className="flex items-center gap-3 pt-1 text-[12.5px] text-ink">
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={c.enabled !== false} onChange={(e) => patch(c.id, { enabled: e.target.checked })} />启用</label>
                  {got && <button onClick={() => { const u = { ...(game.cgUnlocked ?? {}) }; delete u[c.id]; commitGame({ ...game, cgUnlocked: u }); }} className="rounded-lg border border-line px-2.5 py-1 text-[12px]">重置为未解锁</button>}
                  <button onClick={async () => { if (!(await confirm(`确定删除「${c.title || "未命名"}」？`))) return; save(list.filter((x) => x.id !== c.id)); setOpenId(null); }} className="ml-auto rounded-lg px-2.5 py-1 text-[12px] font-bold" style={{ color: "var(--coral)" }}>删除</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <div className="flex gap-2">
        <button onClick={add} className="flex-1 rounded-xl border border-dashed border-line py-2.5 text-[13px] font-bold text-ink">＋ 新增 CG</button>
        <label className="flex-1 cursor-pointer rounded-xl border border-dashed border-coral/60 py-2.5 text-center text-[13px] font-bold text-coral">
          批量上传图片
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { bulk(e.target.files); e.target.value = ""; }} />
        </label>
      </div>
    </div>
  );
}
