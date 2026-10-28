/* 场景地点库 · 多级嵌套子地点编辑器
 * 地点 = 树：每条地点记录可设 parent（空 = 顶层），层级不限。左侧树状预览，右侧编辑选中节点：
 * 基本 · 子地点管理（新增 / 拖拽排序 / 跳转编辑 / 复制整枝）· 标记与准入。禁止循环嵌套。 */
import { useMemo, useState, type DragEvent, type JSX } from "react";
import type { Dir, RoomContent, Requirement } from "../worlds/star2005/content";
import { childrenOf, cloneBranch, pathOf, rootsOf, subtreeOf, wouldCycle } from "../game/roomTree";
import { EmptyState, Help, SearchBox, matches } from "./EditorKit";
import ImagePicker from "./ImagePicker";
import { IconChevronDown } from "../lib/icons";

type Rooms = Record<string, RoomContent>;
const inp = "w-full rounded-full border border-line bg-paper px-3 py-1.5 text-[12.5px] text-ink outline-none focus:border-jade";
const area = "w-full rounded-2xl border border-line bg-paper px-3 py-2 text-[12.5px] text-ink outline-none focus:border-jade";
const pill = "rounded-full border border-line bg-paper px-3 py-1 text-[12px] text-ink transition hover:border-jade hover:text-jade";
const lbl = "mb-0.5 block text-[11px] text-ink-soft";
const DIRS: { d: Dir; t: string }[] = [
  { d: "n", t: "北" }, { d: "s", t: "南" }, { d: "e", t: "东" }, { d: "w", t: "西" },
  { d: "ne", t: "东北" }, { d: "nw", t: "西北" }, { d: "se", t: "东南" }, { d: "sw", t: "西南" },
];
const rid = () => `room_${Math.random().toString(36).slice(2, 8)}`;

export default function ModRoomTreeEditor({ rooms, startRoom, tracks, emptyHint, onChange, onDelete, onRename }: {
  rooms: Rooms;
  startRoom?: string;
  tracks: { id: string; name: string }[];
  emptyHint: string;
  onChange: (rooms: Rooms, startRoom?: string) => void;
  onDelete: (id: string) => void;
  onRename: (oldId: string, raw: string) => void;
}) {
  const ids = Object.keys(rooms);
  const [sel, setSel] = useState<string | null>(ids[0] ?? null);
  const [tab, setTab] = useState<"base" | "kids" | "flags">("base");
  const [q, setQ] = useState("");
  const [drag, setDrag] = useState<string | null>(null);
  const cur = sel && rooms[sel] ? sel : ids[0] ?? null;
  const r = cur ? rooms[cur] : undefined;
  const nm = (id: string) => rooms[id]?.name || id;

  const set = (id: string, p: Partial<RoomContent>) => onChange({ ...rooms, [id]: { ...rooms[id], ...p } }, startRoom);
  const add = (parent?: string) => {
    const id = rid();
    const order = parent ? childrenOf(rooms, parent).length : undefined;
    onChange({ ...rooms, [id]: { name: parent ? "新子地点" : "新地点", desc: "", exits: {}, ...(parent ? { parent, order } : {}) } }, startRoom ?? id);
    setSel(id); setTab("base");
  };
  // 同级排序：把 src 挪到 target 之前，重写这一层的 order
  const reorder = (parent: string | undefined, src: string, target: string) => {
    if (src === target) return;
    const sibs = (parent ? childrenOf(rooms, parent) : rootsOf(rooms)).filter((x) => x !== src);
    const at = sibs.indexOf(target);
    if (at < 0) return;
    sibs.splice(at, 0, src);
    const next = { ...rooms };
    sibs.forEach((x, i) => { next[x] = { ...next[x], order: i }; });
    onChange(next, startRoom);
  };
  const copyBranch = (id: string) => {
    const { added, rootId } = cloneBranch(rooms, id, () => rid());
    onChange({ ...rooms, ...added }, startRoom);
    setSel(rootId);
  };
  const sortedRoots = useMemo(() => rootsOf(rooms).map((x, i) => [x, rooms[x].order ?? i] as const).sort((a, b) => a[1] - b[1]).map(([x]) => x), [rooms]);
  // 不在任何根下的（坏数据成环）也要露出来，方便修复
  const reachable = new Set(sortedRoots.flatMap((x) => subtreeOf(rooms, x)));
  const orphans = ids.filter((x) => !reachable.has(x));

  const dragProps = (id: string, parent: string | undefined) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => { setDrag(id); e.dataTransfer.effectAllowed = "move"; },
    onDragEnd: () => setDrag(null),
    onDragOver: (e: DragEvent) => { if (drag && drag !== id && rooms[drag]?.parent === parent) e.preventDefault(); },
    onDrop: (e: DragEvent) => { e.preventDefault(); if (drag) reorder(parent, drag, id); setDrag(null); },
  });

  const tree = (id: string, depth: number): JSX.Element | null => {
    const kids = childrenOf(rooms, id);
    const hit = !String(q ?? "").trim() || subtreeOf(rooms, id).some((x) => matches(q, x, rooms[x].name, rooms[x].desc));
    if (!hit) return null;
    const on = id === cur;
    return (
      <li key={id}>
        <button type="button" {...dragProps(id, rooms[id].parent)} onClick={() => setSel(id)}
          style={{ paddingLeft: 8 + depth * 14 }}
          className={`flex w-full items-center gap-1.5 rounded-full py-1 pr-2 text-left text-[12.5px] transition ${on ? "bg-jade text-paper-2" : "text-ink hover:bg-jade/10"} ${drag === id ? "opacity-40" : ""}`}>
          <span className={`shrink-0 text-[10px] ${on ? "text-paper-2/80" : "text-ink-soft"}`} aria-hidden>{kids.length ? <IconChevronDown size={10} /> : "•"}</span>
          <span className="min-w-0 flex-1 truncate">{nm(id)}</span>
          {id === startRoom && <span className={`shrink-0 rounded-full px-1.5 text-[9.5px] ${on ? "bg-paper-2/20" : "bg-gold/15 text-gold"}`}>开局</span>}
          {rooms[id].locked && <span className="shrink-0 text-[10px]" title="上锁">锁</span>}
          {rooms[id].hidden && <span className="shrink-0 text-[10px]" title="隐藏">隐</span>}
        </button>
        {!!kids.length && <ul>{kids.map((k) => tree(k, depth + 1))}</ul>}
      </li>
    );
  };

  if (!ids.length) return (
    <div className="space-y-2">
      <EmptyState>{emptyHint}</EmptyState>
      <button className={pill} onClick={() => add()}>＋ 添加顶层地点</button>
    </div>
  );

  const kids = cur ? childrenOf(rooms, cur) : [];
  const path = cur ? pathOf(rooms, cur) : [];
  const parentOpts = cur ? ids.filter((x) => !wouldCycle(rooms, cur, x)) : [];
  const reqs = r?.access?.requires ?? [];
  const setReqs = (next: Requirement[]) => cur && set(cur, { access: next.length || r?.access?.note ? { note: r?.access?.note ?? "", requires: next.length ? next : undefined } : undefined });

  return (
    <div className="space-y-2">
      {ids.length > 6 && <SearchBox value={q} onChange={setQ} placeholder="搜索地点" />}
      <div className="grid gap-2 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
        {/* 树状预览 */}
        <div className="rounded-2xl border border-line bg-paper-2 p-1.5">
          <p className="px-2 pb-1 text-[11px] font-bold text-ink-soft">地点树 · 拖拽调整同级顺序</p>
          <ul className="max-h-[22rem] space-y-0.5 overflow-y-auto">
            {sortedRoots.map((x) => tree(x, 0))}
            {orphans.map((x) => tree(x, 0))}
          </ul>
          <button className={`${pill} mt-1.5 w-full`} onClick={() => add()}>＋ 顶层地点</button>
        </div>

        {/* 选中节点 */}
        {cur && r && (
          <div className="min-w-0 space-y-2 rounded-2xl border border-line bg-paper-2 p-2">
            <nav aria-label="层级" className="flex flex-wrap items-center gap-1 text-[11.5px]">
              {path.map((x, i) => (
                <span key={x} className="flex items-center gap-1">
                  <button type="button" onClick={() => setSel(x)} className={`rounded-full border px-2.5 py-0.5 ${x === cur ? "border-jade bg-jade/10 font-bold text-jade" : "border-line bg-paper text-ink-soft hover:text-jade"}`}>{nm(x)}</button>
                  {i < path.length - 1 && <span className="text-ink-soft" aria-hidden>›</span>}
                </span>
              ))}
            </nav>
            <div className="flex flex-wrap gap-1" role="tablist">
              {([["base", "基本"], ["kids", `子地点管理 · ${kids.length}`], ["flags", "标记与准入"]] as const).map(([k, t]) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                  className={`rounded-full px-3 py-1 text-[12px] font-bold transition ${tab === k ? "bg-ink text-paper-2" : "bg-paper text-ink-soft hover:text-ink"}`}>{t}</button>
              ))}
            </div>

            {tab === "base" && (
              <div className="space-y-1.5">
                <div className="flex gap-1.5">
                  <input className={inp} value={r.name ?? ""} placeholder="地点名，如：禅房" onChange={(e) => set(cur, { name: e.target.value })} />
                  <input className={`${inp} !w-28 shrink-0 font-mono`} key={cur} defaultValue={cur} title="地点 id（失焦后生效）" onBlur={(e) => { onRename(cur, e.target.value); e.target.value = cur; }} />
                  <button className={`${pill} shrink-0`} onClick={() => onDelete(cur)} aria-label="删除地点">×</button>
                </div>
                <label className="block">
                  <span className={lbl}>父地点 · 空 = 顶层地点（不能选自己或自己的下级，防止循环嵌套）</span>
                  <select className={inp} value={r.parent ?? ""} onChange={(e) => {
                    const p = e.target.value || undefined;
                    if (wouldCycle(rooms, cur, p)) return;
                    set(cur, { parent: p, order: p ? childrenOf(rooms, p).length : undefined });
                  }}>
                    <option value="">（顶层地点）</option>
                    {parentOpts.filter((x) => x !== cur).map((x) => <option key={x} value={x}>{pathOf(rooms, x).map(nm).join(" › ")}</option>)}
                  </select>
                </label>
                <textarea className={`${area} ${String(r.desc ?? "").trim() ? "" : "!border-danger"}`} rows={3} value={String(r.desc ?? "")} placeholder="进入此地时的场景描述（必填）" onChange={(e) => set(cur, { desc: e.target.value })} />
                <div className="grid gap-1.5 sm:grid-cols-2">
                  <div className="block"><span className={lbl}>场景背景图（进入此地显示）</span>
                    <ImagePicker value={r.bg} onChange={(bg) => set(cur, { bg })} label="背景图" max={1920} thumb="h-12 w-20" hint="可上传本地图片、从素材库挑选或粘贴链接" />
                  </div>
                  <label className="block"><span className={lbl}>BGM（进入此地自动切换）</span>
                    <select className={inp} value={r.bgm ?? ""} onChange={(e) => set(cur, { bgm: e.target.value || undefined })}>
                      <option value="">不切换</option>
                      {tracks.map((t) => <option key={t.id} value={t.id}>{t.name || t.id}</option>)}
                    </select>
                  </label>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink">
                  <input type="radio" className="accent-jade" checked={startRoom === cur} onChange={() => onChange(rooms, cur)} />设为开局地点<span className="text-ink-soft">（可以是任意一层子地点）</span>
                </label>
                <details className="rounded-2xl border border-line bg-paper p-2">
                  <summary className="cursor-pointer text-[12px] font-bold text-ink">方向出口 <span className="font-normal text-ink-soft">· 同级地点之间的东南西北通路（上下层由树自动连通）</span></summary>
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {DIRS.map(({ d, t }) => (
                      <label key={d} className="flex items-center gap-1 text-[11px] text-ink-soft">
                        <span className="w-5 shrink-0">{t}</span>
                        <select className={`${inp} !px-2 !py-0.5 text-[11.5px]`} value={r.exits?.[d] ?? ""}
                          onChange={(e) => { const ex = { ...r.exits }; if (e.target.value) ex[d] = e.target.value; else delete ex[d]; set(cur, { exits: ex }); }}>
                          <option value="">—</option>
                          {ids.filter((x) => x !== cur).map((x) => <option key={x} value={x}>{nm(x)}</option>)}
                        </select>
                      </label>
                    ))}
                  </div>
                  <Help>出口是单向的：A 的「东」指向 B，记得给 B 的「西」也指回 A。</Help>
                </details>
              </div>
            )}

            {tab === "kids" && (
              <div className="space-y-1.5">
                {!kids.length && <EmptyState>「{nm(cur)}」下还没有子地点。</EmptyState>}
                <ul className="space-y-1">
                  {kids.map((k) => (
                    <li key={k} {...dragProps(k, cur)}
                      className={`flex items-center gap-1.5 rounded-full border border-line bg-paper py-1 pl-3 pr-1 ${drag === k ? "opacity-40" : ""}`}>
                      <span className="cursor-grab select-none text-ink-soft" aria-hidden title="拖拽排序">⋮⋮</span>
                      <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{nm(k)}
                        {!!childrenOf(rooms, k).length && <span className="ml-1 text-[11px] text-ink-soft">· {subtreeOf(rooms, k).length - 1} 个下级</span>}
                      </span>
                      <button className={pill} onClick={() => copyBranch(k)} title="连同全部下级复制一份">复制整枝</button>
                      <button className={`${pill} !border-jade/40 !text-jade`} onClick={() => { setSel(k); setTab("base"); }}>编辑 ›</button>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-1.5">
                  <button className={pill} onClick={() => add(cur)}>＋ 新增子地点</button>
                  <button className={pill} onClick={() => copyBranch(cur)}>复制「{nm(cur)}」整枝</button>
                </div>
                <label className="block"><span className={lbl}>返回上层的文案（留空 = 「返回{r.parent ? nm(r.parent) : "上层"}」）</span>
                  <input className={inp} value={r.upLabel ?? ""} placeholder={`走出${nm(cur)}，回到${r.parent ? nm(r.parent) : "上层"}`} disabled={!r.parent} onChange={(e) => set(cur, { upLabel: e.target.value || undefined })} />
                </label>
                <Help>玩家在「{nm(cur)}」里会看到这些子地点的入口胶囊，点击逐层进入；同一棵树内走动不收路费、不扣行动点。</Help>
              </div>
            )}

            {tab === "flags" && (
              <div className="space-y-1.5">
                <div className="grid gap-1 sm:grid-cols-2">
                  {([
                    ["hidden", "隐藏", "不在上层入口里出现，到访过或已解锁后才显示"],
                    ["locked", "上锁 / 需单独解锁", `规则变量 unlock:${cur} ≥ 1 才能进入；解锁父地点不连带`],
                    ["noNpcVisit", "不允许 NPC 自主到访", "漫游的人物不会走进来"],
                    ["inheritEvents", "沿用父地点的活动", "缺省各层独立；勾选后叠加上层的可执行活动"],
                  ] as const).map(([k, t, d]) => (
                    <label key={k} className="flex cursor-pointer items-start gap-2 rounded-2xl border border-line bg-paper px-3 py-2 text-[12px] text-ink">
                      <input type="checkbox" className="mt-0.5 accent-jade" checked={!!r[k]} onChange={(e) => set(cur, { [k]: e.target.checked || undefined })} />
                      <span><b>{t}</b><span className="block text-[11px] text-ink-soft">{d}</span></span>
                    </label>
                  ))}
                </div>
                {r.locked && <input className={inp} value={r.lockNote ?? ""} placeholder="上锁提示，如：小阁的门上了铜锁，钥匙不知在谁手里。" onChange={(e) => set(cur, { lockNote: e.target.value || undefined })} />}
                <div className="space-y-1 rounded-2xl border border-line bg-paper p-2">
                  <p className="text-[12px] font-bold text-ink">准入条件 <span className="font-normal text-ink-soft">· 全部满足才能进入</span></p>
                  {reqs.map((q2, i) => (
                    <div key={i} className="flex flex-wrap gap-1">
                      <input className={`${inp} !w-36 font-mono`} value={q2.metric} placeholder="fame / c:属性 / flag:变量" onChange={(e) => setReqs(reqs.map((x, j) => (j === i ? { ...x, metric: e.target.value } : x)))} />
                      <select className={`${inp} !w-16`} value={q2.op} onChange={(e) => setReqs(reqs.map((x, j) => (j === i ? { ...x, op: e.target.value as Requirement["op"] } : x)))}>
                        <option value="gte">≥</option><option value="lte">≤</option>
                      </select>
                      <input type="number" className={`${inp} !w-20`} value={q2.value} onChange={(e) => setReqs(reqs.map((x, j) => (j === i ? { ...x, value: Number(e.target.value) || 0 } : x)))} />
                      <input className={`${inp} min-w-0 flex-1`} value={q2.hint} placeholder="提示，如：名气 30" onChange={(e) => setReqs(reqs.map((x, j) => (j === i ? { ...x, hint: e.target.value } : x)))} />
                      <button className={pill} onClick={() => setReqs(reqs.filter((_, j) => j !== i))} aria-label="删除条件">×</button>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-1.5">
                    <button className={pill} onClick={() => setReqs([...reqs, { metric: "", op: "gte", value: 1, hint: "" }])}>＋ 条件</button>
                    {!!reqs.length && <input className={`${inp} min-w-0 flex-1`} value={r.access?.note ?? ""} placeholder="未达标时的说明，如：庵主不许外人入内" onChange={(e) => set(cur, { access: { requires: reqs, note: e.target.value } })} />}
                  </div>
                </div>
                <Help>条件键：fame、reputation、stats.<i>x</i>、c:<i>属性id</i>、flag:<i>规则变量</i>、at:<i>地点id</i>（正好在此）、in:<i>地点id</i>（在这一枝里）。事件、对话、结局的条件同样可以用 at: / in: 判断玩家在哪一层子地点。</Help>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
