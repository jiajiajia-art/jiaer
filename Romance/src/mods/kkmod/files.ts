/**
 * 文件 SDK：把模组内容映射成「材质包式」虚拟目录。
 *
 * 规则（与引擎加载顺序一致：原版世界在前、玩法 Mod 在后，后者覆盖前者）：
 *   - 带 id 的列表字段 → 文件夹，每个条目一个文件：  npcs/dwarf.json、trainings/meditate.json
 *   - 以 id 为键的表（rooms 等）→ 文件夹：           rooms/home.json
 *   - 其余字段 → 单个文件：                           tuning.json、terms.json
 * 同路径 = 覆盖原版那个文件；新路径 = 新增。Mod 只放改过 / 新增的文件，没放的文件保持原版。
 * 覆盖时只需写要改的字段，其余字段自动从原版文件复制（等同「把原版文件原样拿出来再改」）。
 */

export type ModFiles = Record<string, unknown>;
export type FileGroupId = "attrs" | "grow" | "events" | "rules" | "world" | "creation" | "copy" | "other";

export const FILE_GROUPS: { id: FileGroupId; label: string; slots: string[] }[] = [
  { id: "attrs", label: "属性", slots: ["customAttrs", "stats"] },
  { id: "grow", label: "养成", slots: ["titles", "trainings", "sideJobs", "weekendActs", "meals", "bills", "cars", "fameTiers", "gigs"] },
  { id: "events", label: "事件", slots: ["fixedEvents", "events", "encounters", "sideQuests", "sideQuestCast", "endings", "storylines", "sidelines"] },
  { id: "rules", label: "规则", slots: ["gameRules", "income", "lookRules", "tuning", "features", "pregnancy", "worldRules", "timeLimit", "gradeDims", "growModules"] },
  { id: "world", label: "世界", slots: ["rooms", "startRoom", "locations", "npcs", "items", "startMet", "worldBook", "lore", "festivals", "map", "worldMaps", "calendar", "travel", "relations"] },
  { id: "creation", label: "建角", slots: ["creation", "identities", "styles", "backgrounds", "directions", "parentJobs", "school", "npcPool", "zodiacs"] },
  { id: "copy", label: "文案", slots: ["prompt", "terms", "opening", "help", "weeklyPaper"] },
];
const GROUP_OF = new Map(FILE_GROUPS.flatMap((g) => g.slots.map((s) => [s, g.id] as const)));
export const fileGroupOf = (path: string): FileGroupId => GROUP_OF.get(slotOfPath(path)) ?? "other";
export const groupLabel = (id: FileGroupId) => FILE_GROUPS.find((g) => g.id === id)?.label ?? "其他";

/** 以 id 为键的表字段（值是对象而非数组） */
const RECORD_SLOTS = new Set(["rooms", "sideQuestCast"]);

const isRec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isIdList = (v: unknown): v is { id: string }[] =>
  Array.isArray(v) && v.length > 0 && v.every((x) => isRec(x) && typeof x.id === "string" && !!x.id);
const safeName = (id: string) => String(id).replace(/[\\/]/g, "_");

export const slotOfPath = (path: string) => path.replace(/\.json$/, "").split("/")[0];
export const idOfPath = (path: string): string | null => {
  const parts = path.replace(/\.json$/, "").split("/");
  return parts.length > 1 ? parts.slice(1).join("/") : null;
};

/** 内容 → 虚拟文件表 */
export function contentToFiles(content: Record<string, unknown> | undefined): ModFiles {
  const out: ModFiles = {};
  if (!content) return out;
  for (const slot of Object.keys(content)) {
    const v = content[slot];
    // 功能注释：空列表 / 空表不成文件，避免原版资源里出现一堆空壳
    if (v === undefined || (Array.isArray(v) && !v.length) || (RECORD_SLOTS.has(slot) && isRec(v) && !Object.keys(v).length)) continue;
    if (RECORD_SLOTS.has(slot) && isRec(v)) {
      for (const [id, x] of Object.entries(v)) out[`${slot}/${safeName(id)}.json`] = x;
    } else if (isIdList(v)) {
      for (const x of v) out[`${slot}/${safeName(x.id)}.json`] = x;
    } else out[`${slot}.json`] = v;
  }
  return out;
}

/** 虚拟文件表 → 内容（打包 / 导入时还原） */
export function filesToContent(files: ModFiles): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const path of Object.keys(files).sort()) {
    const slot = slotOfPath(path);
    const id = idOfPath(path);
    const v = files[path];
    if (id === null) { out[slot] = v; continue; }
    if (RECORD_SLOTS.has(slot)) out[slot] = { ...(isRec(out[slot]) ? out[slot] : {}), [id]: v };
    else out[slot] = [...(Array.isArray(out[slot]) ? (out[slot] as unknown[]) : []), isRec(v) ? { ...v, id: v.id ?? id } : v];
  }
  return out;
}

export type FileStatus = "new" | "override";
export type ModFileEntry = { path: string; group: FileGroupId; status: FileStatus; value: unknown };

/** Mod 文件清单：每个文件标出是新增还是覆盖原版 */
export function listModFiles(modContent: Record<string, unknown> | undefined, baseContent?: Record<string, unknown>): ModFileEntry[] {
  const base = contentToFiles(baseContent);
  const files = contentToFiles(modContent);
  return Object.keys(files).sort().map((path) => ({ path, group: fileGroupOf(path), status: path in base ? "override" : "new", value: files[path] }));
}

export type FileChange = { path: string; change: "added" | "modified" | "removed"; overridesBase: boolean };

/** 两版草稿之间的文件变化（「这一轮的产出」） */
export function diffModFiles(prev: Record<string, unknown> | undefined, next: Record<string, unknown> | undefined, baseContent?: Record<string, unknown>): FileChange[] {
  const a = contentToFiles(prev), b = contentToFiles(next), base = contentToFiles(baseContent);
  const out: FileChange[] = [];
  for (const p of Object.keys(b)) {
    if (!(p in a)) out.push({ path: p, change: "added", overridesBase: p in base });
    else if (JSON.stringify(a[p]) !== JSON.stringify(b[p])) out.push({ path: p, change: "modified", overridesBase: p in base });
  }
  for (const p of Object.keys(a)) if (!(p in b)) out.push({ path: p, change: "removed", overridesBase: p in base });
  return out.sort((x, y) => x.path.localeCompare(y.path));
}

/**
 * 覆盖即复制：补丁里写到的条目若是原版已有、而草稿里还没有的，先把原版文件整份拷进来再叠加改动。
 * 这样作者 / AI 只写要改的字段，打包出来的仍是完整文件，加载时整条覆盖原版。
 */
export function materializeOverrides(patch: Record<string, unknown>, draft: Record<string, unknown> | undefined, baseContent?: Record<string, unknown>): Record<string, unknown> {
  if (!baseContent) return patch;
  const out: Record<string, unknown> = { ...patch };
  for (const [slot, v] of Object.entries(patch)) {
    const baseV = baseContent[slot];
    const draftV = draft?.[slot];
    if (RECORD_SLOTS.has(slot) && isRec(v) && isRec(baseV)) {
      const d = isRec(draftV) ? draftV : {};
      out[slot] = Object.fromEntries(Object.entries(v).map(([id, x]) => [id, !(id in d) && isRec(baseV[id]) && isRec(x) ? { ...structuredClone(baseV[id] as object), ...x } : x]));
    } else if (Array.isArray(v) && Array.isArray(baseV)) {
      const has = new Set((Array.isArray(draftV) ? draftV : []).map((x) => (isRec(x) ? x.id : undefined)));
      const baseById = new Map(baseV.filter(isRec).map((x) => [x.id, x]));
      out[slot] = v.map((x) => (isRec(x) && typeof x.id === "string" && !has.has(x.id) && baseById.has(x.id) ? { ...structuredClone(baseById.get(x.id) as object), ...x } : x));
    }
  }
  return out;
}

/** 从原版复制一个文件到 Mod（同路径，内容原样） */
export function copyBaseFile(path: string, draft: Record<string, unknown>, baseContent: Record<string, unknown>): Record<string, unknown> {
  const v = contentToFiles(baseContent)[path];
  if (v === undefined) return draft;
  const files = { ...contentToFiles(draft), [path]: structuredClone(v) };
  return filesToContent(files);
}

/** 从 Mod 删除一个文件（恢复为原版 / 去掉新增） */
export function removeModFile(path: string, draft: Record<string, unknown>): Record<string, unknown> {
  const files = contentToFiles(draft);
  delete files[path];
  return filesToContent(files);
}

export type FileTreeGroup = { id: FileGroupId; label: string; files: ModFileEntry[] };
/** 按分组整理成右侧「资产」树 */
export function fileTree(entries: ModFileEntry[]): FileTreeGroup[] {
  const groups: FileTreeGroup[] = [...FILE_GROUPS.map((g) => ({ id: g.id, label: g.label, files: [] as ModFileEntry[] })), { id: "other" as const, label: "其他", files: [] }];
  for (const e of entries) groups.find((g) => g.id === e.group)!.files.push(e);
  return groups.filter((g) => g.files.length);
}

/** 给 AI 的目录说明：原版有哪些文件、怎么覆盖 / 新增 */
export function filesPromptSpec(baseContent: Record<string, unknown> | undefined, modContent: Record<string, unknown> | undefined, max = 160): string {
  const base = Object.keys(contentToFiles(baseContent)).sort();
  const mine = listModFiles(modContent, baseContent);
  const baseList = base.length ? base.slice(0, max).join("、") + (base.length > max ? ` …共 ${base.length} 个` : "") : "（原版为空）";
  const mineList = mine.length ? mine.map((e) => `${e.path}${e.status === "override" ? "(覆盖原版)" : "(新增)"}`).join("、") : "（还没有文件）";
  return `【文件规范 · 创意工坊】
玩法 Mod 像材质包：内容按「字段/条目id.json」组成目录，Mod 只放改过或新增的文件，加载时同路径覆盖原版，优先级永远高于原版。
  - 覆盖原版：用原版里同一个 id（同路径），只写要改的字段，其余字段会自动从原版文件复制。
  - 新增：用新的 id。删除 Mod 里的文件用 remove:{字段:[id]}（原版文件不会被删，只是恢复原版）。
原版文件：${baseList}
本 Mod 已有文件：${mineList}`;
}

/** .kkmod 载荷里的文件目录（与 payload.mod 并存，旧版本仍读 payload.mod） */
export const packModFiles = (content: Record<string, unknown> | undefined) => ({ format: "kkmod-files@1", files: contentToFiles(content) });
