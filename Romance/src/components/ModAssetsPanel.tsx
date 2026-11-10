/* ═══ 创意工坊 · 资产面板 ═══
 * 右侧文件树：Mod 里的文件按分组列出（新增 / 覆盖原版），点开预览 JSON；
 * 「原版资源」可浏览底层世界的全部文件，一键原样复制到 Mod 同路径后再改（材质包思路）。 */
import { useMemo, useState } from "react";
import { contentToFiles, fileGroupOf, fileTree, groupLabel, listModFiles, type ModFileEntry } from "../mods/kkmod/files";
import { IconChevronDown, IconChevronRight, IconClose, IconPlus, IconSearch } from "../lib/icons";

type Content = Record<string, unknown> | undefined;

export const fileTitle = (path: string) => path.replace(/\.json$/, "").split("/").pop() ?? path;

export function FileBadge({ kind }: { kind: "new" | "override" | "added" | "modified" | "removed" }) {
  const map = {
    new: ["新增", "border-jade/40 text-jade"],
    added: ["新建", "border-jade/40 text-jade"],
    override: ["覆盖原版", "border-gold/60 text-gold"],
    modified: ["修改", "border-gold/60 text-gold"],
    removed: ["删除", "border-danger/50 text-danger"],
  } as const;
  const [label, cls] = map[kind];
  return <span className={`shrink-0 rounded-full border px-1.5 py-px text-[10px] font-semibold ${cls}`}>{label}</span>;
}

export default function ModAssetsPanel({ modContent, baseContent, baseName, selected, onSelect, onCopyBase, onRemove }: {
  modContent: Content;
  baseContent?: Content;
  baseName?: string;
  selected: string | null;
  onSelect: (path: string | null) => void;
  onCopyBase?: (path: string) => void;
  onRemove: (path: string) => void;
}) {
  const entries = useMemo(() => listModFiles(modContent, baseContent), [modContent, baseContent]);
  const tree = useMemo(() => fileTree(entries), [entries]);
  const baseFiles = useMemo(() => contentToFiles(baseContent), [baseContent]);
  const modFiles = useMemo(() => contentToFiles(modContent), [modContent]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [showBase, setShowBase] = useState(false);
  const [q, setQ] = useState("");
  const overrides = entries.filter((e) => e.status === "override").length;

  const basePaths = useMemo(() => {
    const k = q.trim().toLowerCase();
    return Object.keys(baseFiles).sort().filter((p) => !k || p.toLowerCase().includes(k) || JSON.stringify(baseFiles[p] ?? "").toLowerCase().includes(k));
  }, [baseFiles, q]);

  const preview = selected ? (selected in modFiles ? modFiles[selected] : baseFiles[selected]) : undefined;
  const previewFromBase = !!selected && !(selected in modFiles);

  return (
    <aside className="flex min-h-0 flex-col gap-2 rounded-2xl border border-line bg-paper-2/60 p-3 text-ink">
      <div className="flex items-center gap-2">
        <p className="text-[14px] font-bold">资产</p>
        <span className="ml-auto text-[11px] text-ink-soft">{entries.length} 个文件{overrides ? ` · 覆盖原版 ${overrides}` : ""}</span>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-[11.5px] leading-relaxed text-ink-soft">
          还没有文件。在对话里描述玩法，或从下方「原版资源」复制文件来改。
        </p>
      ) : (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-paper">
          {tree.map((g) => {
            const isOpen = open[g.id] ?? true;
            return (
              <div key={g.id}>
                <button type="button" onClick={() => setOpen({ ...open, [g.id]: !isOpen })} className="flex w-full items-center gap-1.5 px-2.5 py-2 text-left text-[12.5px] font-semibold hover:bg-paper-2">
                  {isOpen ? <IconChevronDown size={13} /> : <IconChevronRight size={13} />}
                  {g.label}
                  <span className="ml-auto text-[11px] font-normal text-ink-soft">{g.files.length}</span>
                </button>
                {isOpen && (
                  <ul className="pb-1">
                    {g.files.map((f: ModFileEntry) => (
                      <li key={f.path}>
                        <button type="button" onClick={() => onSelect(selected === f.path ? null : f.path)}
                          className={`flex w-full items-center gap-1.5 px-3 py-1 text-left text-[11.5px] transition hover:bg-paper-2 ${selected === f.path ? "bg-jade/10 text-jade" : ""}`}>
                          <span className="min-w-0 flex-1 truncate font-mono">{f.path}</span>
                          <FileBadge kind={f.status} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selected && preview !== undefined && (
        <div className="flex min-h-0 flex-col rounded-xl border border-line bg-paper">
          <div className="flex items-center gap-1.5 border-b border-line px-2.5 py-1.5">
            <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] font-semibold">{selected}</span>
            <span className="text-[10.5px] text-ink-soft">{groupLabel(fileGroupOf(selected))}{previewFromBase ? " · 原版" : ""}</span>
            <button type="button" aria-label="关闭预览" onClick={() => onSelect(null)} className="text-ink-soft hover:text-ink"><IconClose size={13} /></button>
          </div>
          <pre className="max-h-[260px] overflow-auto px-2.5 py-2 font-mono text-[11px] leading-relaxed text-ink">{JSON.stringify(preview, null, 2)}</pre>
          <div className="flex gap-1.5 border-t border-line px-2.5 py-1.5">
            {previewFromBase && onCopyBase ? (
              <button type="button" onClick={() => onCopyBase(selected)} className="rounded-full bg-jade px-2.5 py-1 text-[11px] font-bold text-white">复制到 Mod（同路径覆盖）</button>
            ) : (
              <button type="button" onClick={() => { onRemove(selected); onSelect(null); }} className="rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-ink-soft hover:border-danger hover:text-danger">
                {selected in baseFiles ? "移除覆盖（恢复原版）" : "删除这个文件"}
              </button>
            )}
          </div>
        </div>
      )}

      {onCopyBase && (
        <div className="rounded-xl border border-line bg-paper">
          <button type="button" onClick={() => setShowBase(!showBase)} className="flex w-full items-center gap-1.5 px-2.5 py-2 text-left text-[12.5px] font-semibold hover:bg-paper-2">
            {showBase ? <IconChevronDown size={13} /> : <IconChevronRight size={13} />}
            原版资源{baseName ? ` · ${baseName}` : ""}
            <span className="ml-auto text-[11px] font-normal text-ink-soft">{Object.keys(baseFiles).length}</span>
          </button>
          {showBase && (
            <div className="border-t border-line p-2">
              <label className="mb-1.5 flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-ink-soft focus-within:border-jade">
                <IconSearch size={12} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索文件或内容" className="min-w-0 flex-1 bg-transparent text-[11.5px] text-ink outline-none" />
              </label>
              {basePaths.length === 0 ? (
                <p className="px-1 py-2 text-[11px] text-ink-soft">{Object.keys(baseFiles).length ? "没有匹配的文件" : "原版世界还没有内容"}</p>
              ) : (
                <ul className="max-h-[220px] overflow-y-auto">
                  {basePaths.map((p) => (
                    <li key={p} className="flex items-center gap-1">
                      <button type="button" onClick={() => onSelect(p)} className={`min-w-0 flex-1 truncate rounded px-1.5 py-0.5 text-left font-mono text-[11px] hover:bg-paper-2 ${selected === p ? "text-jade" : ""}`}>{p}</button>
                      {p in modFiles ? <FileBadge kind="override" /> : (
                        <button type="button" aria-label={`复制 ${p} 到 Mod`} title="复制到 Mod" onClick={() => onCopyBase(p)} className="rounded-full p-0.5 text-ink-soft hover:text-jade"><IconPlus size={12} /></button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
