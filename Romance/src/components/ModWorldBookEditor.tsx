import { IconClose } from "../lib/icons";
import { useRef, useState } from "react";
import type { WorldBookEntry } from "../lib/types";
import { modeOf } from "../game/worldbookPick";
import { asTrimmedString } from "../lib/asTrimmedString";
import { keywordTexts } from "../lib/worldBookKeywords";
import { blankWorldBookEntry, withWorldBookDeps } from "../lib/worldBookDeps";
import WorldBookRules, { WorldBookModePills, wbBadges } from "./WorldBookRules";
import { AuditBadge, AuditBar, AuditList, auditDomId } from "./EditorKit";
import { auditStory, issuesAt } from "../game/refAudit";

/* 模组编辑器 · 世界书（唯一设定入口）：名称 · 正文 · 关键词；地点/人物可选。
 * 详细设定 / 节日已并入此处；开新局写入本局世界书。 */
const inp = "min-w-0 w-full rounded-lg border border-line bg-paper px-2 py-1 text-[12.5px] text-ink outline-none focus:border-jade";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";

function normalize(raw: unknown): WorldBookEntry[] {
  // 兼容数组 / {entries: [...]} / SillyTavern 的 {entries: {0: {...}}}
  const obj = raw as Record<string, unknown>;
  const list = Array.isArray(raw) ? raw : obj && typeof obj === "object" && obj.entries ? Object.values(obj.entries as object) : [];
  return list.flatMap((r) => {
    const e = r as Record<string, unknown>;
    const content = String(e.content ?? "").trim();
    if (!content) return [];
    const kw = (e.keywords ?? e.key ?? e.keys ?? []) as unknown;
    const keywords = (Array.isArray(kw) ? kw : String(kw).split(/[,，、\s]+/)).map(String).map((s) => s.trim()).filter(Boolean);
    const rooms = Array.isArray(e.bindRooms) ? e.bindRooms.map(String) : e.scope === "room" && e.scopeId ? [String(e.scopeId)] : [];
    const npcs = Array.isArray(e.bindNpcs) ? e.bindNpcs.map(String) : e.scope === "npc" && e.scopeId ? [String(e.scopeId)] : [];
    const base: WorldBookEntry = {
      id: String(e.id ?? blankWorldBookEntry().id).startsWith("wb_") ? String(e.id ?? blankWorldBookEntry().id) : blankWorldBookEntry().id,
      title: String(e.title ?? e.comment ?? e.name ?? keywords[0] ?? "导入条目"),
      keywords,
      content,
      enabled: e.enabled !== false && e.disable !== true,
      constant: Boolean(e.constant),
      order: Number(e.order ?? 100) || 100,
      probability: Math.min(100, Math.max(0, Number(e.probability ?? 100))),
      ...(["keyword", "constant", "once"].includes(String(e.mode)) ? { mode: e.mode as WorldBookEntry["mode"] } : {}),
      ...(Number(e.duration) > 1 ? { duration: Math.trunc(Number(e.duration)) } : {}),
      ...(e.group ? { group: String(e.group) } : {}),
      ...(Number(e.weight) > 0 ? { weight: Number(e.weight) } : {}),
    };
    return [withWorldBookDeps(base, rooms, npcs)];
  });
}

export default function ModWorldBookEditor({ value, onChange, npcs = [], rooms = [] }: { value?: WorldBookEntry[]; onChange: (v?: WorldBookEntry[]) => void; npcs?: { id: string; name: string }[]; rooms?: { id: string; name: string }[] }) {
  const list = value ?? [];
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const file = useRef<HTMLInputElement>(null);
  // 功能注释：草稿审计——绑定的人物/地点只认本作品传入的列表；列表为空时任何绑定都报「已不存在」，不借内置世界放行
  const audit = auditStory({ draft: true, worldBook: list, npcIds: npcs.map((n) => n.id), roomIds: rooms.map((r) => r.id), itemIds: [] });
  const groups = Array.from(new Set(list.map((e) => asTrimmedString(e.group)).filter(Boolean)));
  const commit = (next: WorldBookEntry[]) => onChange(next.length ? next : undefined);
  const set = (id: string, p: Partial<WorldBookEntry>) => commit(list.map((e) => (e.id === id ? { ...e, ...p } : e)));

  const importFile = async (f?: File) => {
    if (!f) return;
    try {
      const got = normalize(JSON.parse(await f.text()));
      if (!got.length) throw new Error("没有可用条目");
      commit([...list, ...got]);
      setErr(`已导入 ${got.length} 条`);
    } catch (e) { setErr(`导入失败：${(e as Error).message}`); }
    if (file.current) file.current.value = "";
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] leading-relaxed text-ink-soft">
        一条设定写一遍即可（名称 · 正文 · 关键词）。必须挂本作品的地点或人物：玩家在该地点、该人物在场，或正文提到关键词时，才发给 AI。
        始终生效的铁律请写进「①基础 · 剧本基调」。
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button className={btn} onClick={() => { const e = blankWorldBookEntry((list[list.length - 1]?.order ?? 90) + 10); commit([...list, e]); setOpen(e.id); }}>＋ 添加条目</button>
        <button className={btn} onClick={() => file.current?.click()}>导入 JSON</button>
        <button className={btn} disabled={!list.length} onClick={() => {
          const url = URL.createObjectURL(new Blob([JSON.stringify(list, null, 2)], { type: "application/json" }));
          Object.assign(document.createElement("a"), { href: url, download: "worldbook.json" }).click();
          URL.revokeObjectURL(url);
        }}>导出</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => importFile(e.target.files?.[0])} />
      </div>
      {err && <p className="text-[11px] text-coral">{err}</p>}
      {list.length > 0 && <AuditBar issues={audit.issues.filter((x) => x.at?.startsWith("wb:"))} onJump={(at) => setOpen(at.slice(3))} />}
      {!list.length && <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[12px] text-ink-soft">暂无条目 · 适合地图规则、势力背景、节日习俗、禁忌话题等设定</p>}

      {list.map((e) => {
        const isOpen = open === e.id;
        const title = asTrimmedString(e.title);
        const keys = keywordTexts(e.keywords);
        const body = asTrimmedString(e.content);
        return (
          <div key={e.id} id={auditDomId(`wb:${e.id}`)} className={`scroll-mt-3 rounded-lg border ${e.enabled ? "border-line" : "border-line/50 opacity-60"} bg-paper`}>
            <div className="flex items-center gap-2 px-2.5 py-2">
              <input type="checkbox" checked={e.enabled} onChange={(x) => set(e.id, { enabled: x.target.checked })} className="accent-jade" aria-label="启用" />
              <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(isOpen ? null : e.id)}>
                <p className="truncate text-[12.5px] font-bold">{title || "未命名"}</p>
                <p className="truncate text-[10.5px] text-ink-soft">
                  {modeOf(e) === "constant" ? "每轮注入" : keys.length ? keys.join(" · ") : modeOf(e) === "once" ? "下一轮注入一次" : "无关键词 · 可选手动挂地点/人物"}
                </p>
              </button>
              <AuditBadge issues={issuesAt(audit, `wb:${e.id}`)} />
              <span className="flex shrink-0 flex-wrap justify-end gap-1">{wbBadges(e).map((b) => <span key={b} className="rounded-full bg-jade/10 px-1.5 py-0.5 text-[10px] font-bold text-jade">{b}</span>)}</span>
              <button className="text-[12px] text-ink-soft hover:text-coral" onClick={() => commit(list.filter((x) => x.id !== e.id))} aria-label="删除"><IconClose size={14} /></button>
            </div>
            {isOpen && (
              <div className="space-y-1.5 border-t border-line px-2.5 py-2">
                <AuditList issues={issuesAt(audit, `wb:${e.id}`)} />
                <input className={inp} value={title} onChange={(x) => set(e.id, { title: x.target.value })} placeholder="名称" />
                <WorldBookModePills e={e} onChange={(p) => set(e.id, p)} />
                <input className={inp} value={keys.join("，")} disabled={modeOf(e) === "constant"}
                  onChange={(x) => set(e.id, { keywords: x.target.value.split(/[,，、]/).map((s) => s.trim()).filter(Boolean) })}
                  placeholder="关键词，用逗号分隔（正文会出现的词）" />
                <textarea className={inp} rows={4} value={body} onChange={(x) => set(e.id, { content: x.target.value })} placeholder="设定正文" />
                <div className="grid grid-cols-2 gap-1.5 text-[11px] text-ink-soft">
                  <label>顺序<input type="number" className={inp} value={e.order ?? 100} onChange={(x) => set(e.id, { order: Number(x.target.value) || 0 })} /></label>
                  <label>概率%<input type="number" min={0} max={100} className={inp} value={e.probability ?? 100} onChange={(x) => set(e.id, { probability: Math.min(100, Math.max(0, Number(x.target.value) || 0)) })} /></label>
                </div>
                <WorldBookRules e={e} onChange={(p) => set(e.id, p)} npcs={npcs} rooms={rooms} groups={groups} />
                <p className="text-right text-[10.5px] text-ink-soft">{body.length} 字</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
