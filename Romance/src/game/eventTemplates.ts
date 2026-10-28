/* 事件模板：作者把事件另存为模板（跨存档、跨模组，存在本机），新建同类剧情时一键套用 */
import type { FixedEvent } from "../lib/types";
import { loadGlobal, saveGlobal } from "../lib/saveScope";

export type EventTemplate = { id: string; name: string; ev: FixedEvent; ts: number };
const KEY = "ai-sim:event-templates";

export function loadTemplates(): EventTemplate[] {
  const v = loadGlobal<EventTemplate[]>(KEY, []);
  return Array.isArray(v) ? v : [];
}
function store(list: EventTemplate[]) { saveGlobal(KEY, list); } // 模板 = 作者素材（全局公共数据）；存储已满时静默放弃

/** 另存为模板：去掉存档相关的引用（后续事件 / 选项激活的 id 在别处无意义） */
export function saveTemplate(ev: FixedEvent, name?: string): EventTemplate[] {
  const clean: FixedEvent = structuredClone(ev);
  delete clean.nextIds;
  clean.choices = clean.choices?.map((c) => ({ ...c, nextIds: undefined, failNextIds: undefined }));
  const t: EventTemplate = { id: `tpl_${Date.now().toString(36)}`, name: name?.trim() || ev.name || "未命名模板", ev: clean, ts: Date.now() };
  const list = [t, ...loadTemplates()];
  store(list);
  return list;
}
export function removeTemplate(id: string): EventTemplate[] { const list = loadTemplates().filter((t) => t.id !== id); store(list); return list; }

/** 套用模板：生成新事件 id 与选项 id */
export function fromTemplate(t: EventTemplate, newId: string): FixedEvent {
  const ev = structuredClone(t.ev);
  return { ...ev, id: newId, choices: ev.choices?.map((c) => ({ ...c, id: `ch_${Math.random().toString(36).slice(2, 7)}` })) };
}
