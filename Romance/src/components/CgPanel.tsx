import { useState } from "react";
import { useGame } from "../store/gameCtx";
import type { CgDef, FixedCond } from "../lib/types";
import { CondRow, defaultCond } from "./FixedEventsPanel";
import { AuditBadge, AuditBar, AuditList, auditDomId, useConfirm } from "./EditorKit";
import { auditGame, issuesAt } from "../game/refAudit";
import { condsBrief } from "./ruleText";
import { hasCgImage, storeCgImage, useCgImageSrc } from "../game/cgImageStore";
import { createCgDraft, moveCg } from "../lib/cgGallery";

/* CG 编排：剧情插图 + 解锁条件（复用固定事件的条件行），满足即自动收入玩家图鉴 */
const uid = () => `cg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const inputCls = "w-full rounded-lg border border-line bg-paper-2 px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-[var(--jade)]";

function CgThumb({ cg, className = "" }: { cg: CgDef; className?: string }) {
  const src = useCgImageSrc(cg);
  return src
    ? <img src={src} alt={cg.title} className={`h-full w-full object-cover ${className}`} />
    : <span className="grid h-full w-full place-items-center text-[11px] text-ink-soft">暂无图片</span>;
}

export default function CgPanel() {
  const { game, commitGame } = useGame();
  const [openId, setOpenId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [confirm, confirmEl] = useConfirm();
  if (!game) return null;
  const list = game.cgs ?? [];
  const save = (next: CgDef[]) => commitGame({ ...game, cgs: next });
  const patch = (id: string, p: Partial<CgDef>) => save(list.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const audit = auditGame(game, { cgs: list });
  const add = () => {
    const c = createCgDraft(uid(), `CG ${list.length + 1}`);
    save([...list, c]);
    setOpenId(c.id);
  };
  const pick = async (id: string, file?: File) => {
    if (!file) return;
    setUploadError("");
    try {
      const imageFileId = await storeCgImage(file);
      patch(id, { imageFileId, image: undefined });
    } catch {
      setUploadError("图片保存失败，请重试。");
    }
  };

  // 功能注释：批量上传一图一条，标题取文件名；条件保持空白，绝不能误当成已解锁。
  const bulk = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadError("");
    try {
      const made: CgDef[] = [];
      for (const file of Array.from(files)) {
        made.push(createCgDraft(uid(), file.name.replace(/\.[^.]+$/, ""), await storeCgImage(file)));
      }
      save([...list, ...made]);
    } catch {
      setUploadError("部分图片保存失败，请重新选择。");
    }
  };
  const current = list.find((cg) => cg.id === openId) ?? null;

  return (
    <div className="space-y-3">
      {confirmEl}
      {list.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center text-[13px] leading-relaxed text-ink-soft">
          还没有 CG。点新增，上传一张剧情插图，并设定什么时候解锁。
        </div>
      )}
      {list.length > 0 && <AuditBar issues={audit.issues.filter((x) => x.at?.startsWith("cg:"))} onJump={(at) => setOpenId(at.slice(3))} />}
      {!!list.length && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {list.map((cg, index) => {
            const mine = issuesAt(audit, `cg:${cg.id}`);
            const summary = cg.conds.length ? condsBrief(cg.conds, "all", game.fixedEvents ?? []) : "";
            return (
              <button
                key={cg.id}
                id={auditDomId(`cg:${cg.id}`)}
                type="button"
                onClick={() => setOpenId(cg.id)}
                className={`group overflow-hidden rounded-xl border bg-paper text-left transition ${openId === cg.id ? "border-coral ring-2 ring-coral/20" : "border-line hover:border-coral/60"}`}
              >
                <span className="relative block aspect-[4/3] overflow-hidden bg-paper-2">
                  <CgThumb cg={cg} className="transition group-hover:scale-[1.02]" />
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white">{index + 1}</span>
                  <span className="absolute right-1.5 top-1.5"><AuditBadge issues={mine} /></span>
                </span>
                <span className="block p-2">
                  <span className="block truncate text-[13px] font-bold text-ink">{cg.title || "（未命名）"}</span>
                  {summary
                    ? <span className="mt-0.5 block line-clamp-2 text-[10.5px] leading-snug text-ink-soft">{summary}</span>
                    : <span className="mt-0.5 block text-[10.5px] font-bold text-danger">未设解锁条件，玩家看不到</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {current && (() => {
        const c = current;
        const mine = issuesAt(audit, `cg:${c.id}`);
        const index = list.findIndex((cg) => cg.id === c.id);
        return (
          <section className="space-y-2.5 rounded-2xl border border-coral/35 bg-paper p-3">
            <AuditList issues={mine} />
            <input className={inputCls} placeholder="CG 名，如「雨夜的伞」" value={c.title} maxLength={24} onChange={(e) => patch(c.id, { title: e.target.value })} />
            <label className="block cursor-pointer overflow-hidden rounded-xl border border-dashed border-line bg-paper-2">
              <span className="block aspect-video">
                <CgThumb cg={c} />
              </span>
              <span className="block px-3 py-2 text-center text-[12px] font-bold text-coral">{hasCgImage(c) ? "点图更换图片" : "上传剧情插图"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { void pick(c.id, e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            <textarea className={`${inputCls} min-h-[56px] resize-y`} placeholder="说明或这张图对应的剧情对话（可选）" value={c.desc ?? ""} maxLength={500} onChange={(e) => patch(c.id, { desc: e.target.value })} />
            <select className={inputCls} value={c.npcId ?? ""} onChange={(e) => patch(c.id, { npcId: e.target.value || undefined })}>
                  <option value="">不绑定人物</option>
                  {game.npcs.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
            <div className="flex flex-wrap gap-4 text-[12.5px] text-ink">
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={c.enabled !== false} onChange={(e) => patch(c.id, { enabled: e.target.checked })} />
                收录到作品
              </label>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" checked={!!c.hideBeforeUnlock} onChange={(e) => patch(c.id, { hideBeforeUnlock: e.target.checked || undefined })} />
                解锁前隐藏
              </label>
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-1.5 text-[12px] font-bold text-ink-soft">
                <span>解锁条件（全部满足才解锁）</span>
                <span className="flex flex-wrap gap-1">
                  {([["event", "事件"], ["rel", "好感"], ["location", "地点"], ["item", "物品"], ["flag", "剧情标记"], ["quest", "剧情进度"]] as const).map(([kind, label]) => (
                    <button type="button" key={kind} onClick={() => patch(c.id, { conds: [...c.conds, defaultCond(kind)] })} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink hover:border-coral hover:text-coral">＋{label}</button>
                  ))}
                </span>
              </div>
              {c.conds.length === 0 && <p className="text-[12px] font-bold text-danger">未设解锁条件，玩家看不到。</p>}
              {c.conds.map((cond, condIndex) => (
                <CondRow key={condIndex} c={cond} events={game.fixedEvents ?? []} selfId=""
                  onChange={(next: FixedCond) => patch(c.id, { conds: c.conds.map((item, itemIndex) => (itemIndex === condIndex ? next : item)) })}
                  onDelete={() => patch(c.id, { conds: c.conds.filter((_, itemIndex) => itemIndex !== condIndex) })} />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button type="button" disabled={index === 0} onClick={() => save(moveCg(list, c.id, -1))} className="rounded-lg border border-line px-2.5 py-1 text-[12px] disabled:opacity-35">前移</button>
              <button type="button" disabled={index === list.length - 1} onClick={() => save(moveCg(list, c.id, 1))} className="rounded-lg border border-line px-2.5 py-1 text-[12px] disabled:opacity-35">后移</button>
              <button type="button" onClick={async () => { if (!(await confirm(`确定删除「${c.title || "未命名"}」？`))) return; save(list.filter((item) => item.id !== c.id)); setOpenId(null); }} className="ml-auto rounded-lg px-2.5 py-1 text-[12px] font-bold text-danger">删除</button>
            </div>
          </section>
        );
      })()}
      {uploadError && <p className="text-[12px] font-bold text-danger">{uploadError}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={add} className="flex-1 rounded-xl border border-dashed border-line py-2.5 text-[13px] font-bold text-ink">新增 CG</button>
        <label className="flex-1 cursor-pointer rounded-xl border border-dashed border-coral/60 py-2.5 text-center text-[13px] font-bold text-coral">
          批量上传图片
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void bulk(e.target.files); e.target.value = ""; }} />
        </label>
      </div>
    </div>
  );
}
