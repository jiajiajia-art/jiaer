/* 场景地点树编辑器
 * 大地图 → 地点树：作品可有多张大地图，每张下挂一棵地点树（parent 空 = 该图顶层）。
 * 「从地点库添加」复制运营库大地图 + 整棵地点树进本作品；打开编辑器不会自动写入库条目。 */
import { useEffect, useMemo, useState, type DragEvent, type JSX } from "react";
import type { RoomContent, Requirement } from "../worlds/star2005/content";
import { childrenOf, cloneBranch, pathOf, rootsOf, subtreeOf, wouldCycle } from "../game/roomTree";
import { EmptyState, Help, SearchBox, matches } from "./EditorKit";
import ImagePicker from "./ImagePicker";
import { Modal } from "./ui";
import { IconChevronDown } from "../lib/icons";
import {
  LOCATION_SCENE_GEN_SIZE,
  WORLD_MAP_GEN_SIZE,
  buildLocationScenePromptParts,
  buildWorldMapPromptParts,
  type WorkImageGenBinding,
} from "../lib/editorImagePrompts";
import {
  listActivePlatformLocations,
  resolvePlatformLocationImageUrl,
  type PlatformLocationItem,
} from "../lib/platformLocationLibrary";
import {
  ensureWorldMaps,
  importLibraryMapTree,
  newWorldMapId,
  parseLibraryMapTree,
  roomsOfMap,
  type WorldMapDef,
} from "../lib/worldMaps";

type Rooms = Record<string, RoomContent>;
const inp = "w-full rounded-full border border-line bg-paper px-3 py-1.5 text-[12.5px] text-ink outline-none focus:border-jade";
const area = "w-full rounded-2xl border border-line bg-paper px-3 py-2 text-[12.5px] text-ink outline-none focus:border-jade";
const pill = "rounded-full border border-line bg-paper px-3 py-1 text-[12px] text-ink transition hover:border-jade hover:text-jade";
const lbl = "mb-0.5 block text-[11px] text-ink-soft";
const rid = () => `room_${Math.random().toString(36).slice(2, 8)}`;
/** 功能注释：地点库 / 手工添加时若缺场景描述，用地名补一句，避免必填框交白卷。 */
const sceneDescFallback = (name: string) => `你来到了「${name}」。`;

export default function ModRoomTreeEditor({ rooms, worldMaps, startRoom, tracks, emptyHint, imageGen, onChange, onDelete, onRename: _onRename }: {
  rooms: Rooms;
  worldMaps?: WorldMapDef[];
  startRoom?: string;
  tracks: { id: string; name: string }[];
  emptyHint: string;
  /** 功能注释：作品级画风 / 负面词与保存回调；地点 / 大地图生图共用 */
  imageGen?: WorkImageGenBinding;
  onChange: (rooms: Rooms, startRoom?: string, worldMaps?: WorldMapDef[]) => void;
  onDelete: (id: string) => void;
  /** 功能注释：房间 id 不再在编辑页手改，保留回调以免改动父组件签名。 */
  onRename: (oldId: string, raw: string) => void;
}) {
  const ensured = useMemo(() => ensureWorldMaps(rooms, worldMaps), [rooms, worldMaps]);
  const maps = ensured.worldMaps;
  const allRooms = ensured.rooms;
  const [mapId, setMapId] = useState(maps[0]?.id ?? "");
  const curMapId = maps.some((m) => m.id === mapId) ? mapId : (maps[0]?.id ?? "");
  const mapRooms = useMemo(() => roomsOfMap(allRooms, curMapId), [allRooms, curMapId]);
  const ids = Object.keys(mapRooms);
  const [sel, setSel] = useState<string | null>(ids[0] ?? null);
  const [tab, setTab] = useState<"base" | "kids" | "flags">("base");
  const [q, setQ] = useState("");
  const [drag, setDrag] = useState<string | null>(null);
  const [libOpen, setLibOpen] = useState(false);
  const [libQ, setLibQ] = useState("");
  const [libLoading, setLibLoading] = useState(false);
  const [libErr, setLibErr] = useState("");
  const [libItems, setLibItems] = useState<PlatformLocationItem[]>([]);
  const cur = sel && mapRooms[sel] ? sel : ids[0] ?? null;
  const r = cur ? mapRooms[cur] : undefined;
  const nm = (id: string) => allRooms[id]?.name || id;
  const curMap = maps.find((m) => m.id === curMapId);

  const commit = (nextRooms: Rooms, nextStart = startRoom, nextMaps = maps) => {
    const e = ensureWorldMaps(nextRooms, nextMaps);
    onChange(e.rooms, nextStart, e.worldMaps);
  };
  const set = (id: string, p: Partial<RoomContent>) => commit({ ...allRooms, [id]: { ...allRooms[id], ...p } });
  const patchMap = (id: string, p: Partial<WorldMapDef>) => {
    commit(allRooms, startRoom, maps.map((m) => (m.id === id ? { ...m, ...p } : m)));
  };
  const addMap = () => {
    const id = newWorldMapId();
    const next = [...maps, { id, name: `大地图 ${maps.length + 1}`, order: maps.length }];
    commit(allRooms, startRoom, next);
    setMapId(id);
    setSel(null);
  };
  const delMap = (id: string) => {
    if (maps.length <= 1) return;
    const rest = maps.filter((m) => m.id !== id);
    const drop = new Set(Object.keys(roomsOfMap(allRooms, id)));
    const nextRooms: Rooms = {};
    for (const [rid2, room] of Object.entries(allRooms)) if (!drop.has(rid2)) nextRooms[rid2] = room;
    const nextStart = startRoom && drop.has(startRoom) ? undefined : startRoom;
    commit(nextRooms, nextStart, rest);
    setMapId(rest[0]?.id ?? "");
  };
  const add = (parent?: string) => {
    if (!curMapId) return;
    const id = rid();
    const order = parent ? childrenOf(mapRooms, parent).length : undefined;
    const name = parent ? "新子地点" : "新地点";
    // 功能注释：新增地点挂在当前大地图；不自动冒充开局；描述预填一句
    commit({
      ...allRooms,
      [id]: { name, desc: sceneDescFallback(name), exits: {}, mapId: curMapId, ...(parent ? { parent, order } : {}) },
    }, startRoom);
    setSel(id); setTab("base");
  };
  // 功能注释：从运营库复制一整张大地图 + 地点树进本作品
  const addFromLibrary = (item: PlatformLocationItem) => {
    const tree = parseLibraryMapTree(item.treeJson);
    const { map, rooms: added, rootId } = importLibraryMapTree({
      mapName: item.name,
      mapDesc: item.description,
      mapBg: resolvePlatformLocationImageUrl(item.imageUrl) || undefined,
      tree,
      existingRooms: allRooms,
      newRoomId: rid,
    });
    commit({ ...allRooms, ...added }, startRoom, [...maps, map]);
    setMapId(map.id);
    if (rootId) { setSel(rootId); setTab("base"); }
    setLibOpen(false);
  };

  useEffect(() => {
    if (!libOpen) return;
    let cancelled = false;
    setLibLoading(true);
    setLibErr("");
    void listActivePlatformLocations(libQ)
      .then((rows) => { if (!cancelled) setLibItems(rows); })
      .catch((e) => { if (!cancelled) { setLibItems([]); setLibErr(e instanceof Error ? e.message : "加载失败"); } })
      .finally(() => { if (!cancelled) setLibLoading(false); });
    return () => { cancelled = true; };
  }, [libOpen, libQ]);

  const libPicker = libOpen ? (
    <Modal title="从地点库添加" onClose={() => setLibOpen(false)}>
      <p className="mb-2 text-[12px] leading-relaxed text-ink-soft">
        地点库装的是「大地图 + 地点树」整包。选中后复制进本作品（名称、层级、场景描述一并带入），原包不改。下架条目不会出现。
      </p>
      <SearchBox value={libQ} onChange={setLibQ} placeholder="搜索名称 / 作者库兰号 / 标签" />
      {libErr ? <p className="mt-2 text-[12px] text-danger">{libErr}</p> : null}
      {libLoading ? <p className="mt-3 text-[12px] text-ink-soft">加载中…</p> : null}
      {!libLoading && !libErr && !libItems.length ? <EmptyState>地点库暂无可用条目，请联系运营在后台配置。</EmptyState> : null}
      <ul className="mt-2 max-h-[22rem] space-y-1.5 overflow-y-auto">
        {libItems.map((item) => {
          const img = resolvePlatformLocationImageUrl(item.imageUrl);
          const tree = parseLibraryMapTree(item.treeJson);
          const n = tree?.rooms.length ?? 1;
          const tags = Array.isArray(item.tags) ? item.tags.filter(Boolean) : [];
          return (
            <li key={item.id}>
              <button
                type="button"
                className="flex w-full items-start gap-2 rounded-2xl border border-line bg-paper p-2 text-left transition hover:border-jade"
                onClick={() => addFromLibrary(item)}
              >
                {img ? <img src={img} alt="" className="h-14 w-9 shrink-0 rounded-lg object-cover" /> : <span className="h-14 w-9 shrink-0 rounded-lg bg-paper-2" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-ink">{item.name}</span>
                  <span className="mt-0.5 line-clamp-2 text-[11.5px] text-ink-soft">{item.description || "（无说明）"}</span>
                  <span className="mt-0.5 block text-[10.5px] text-ink-soft">
                    含 {n} 个地点
                    {item.authorKul ? ` · 库兰 ${item.authorKul}` : ""}
                    {tags.length ? ` · ${tags.slice(0, 4).join("、")}` : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  ) : null;

  const reorder = (parent: string | undefined, src: string, target: string) => {
    if (src === target) return;
    const sibs = (parent ? childrenOf(mapRooms, parent) : rootsOf(mapRooms)).filter((x) => x !== src);
    const at = sibs.indexOf(target);
    if (at < 0) return;
    sibs.splice(at, 0, src);
    const next = { ...allRooms };
    sibs.forEach((x, i) => { next[x] = { ...next[x], order: i }; });
    commit(next, startRoom);
  };
  const copyBranch = (id: string) => {
    const { added, rootId } = cloneBranch(mapRooms, id, () => rid());
    const stamped: Rooms = {};
    for (const [k, v] of Object.entries(added)) stamped[k] = { ...v, mapId: curMapId };
    commit({ ...allRooms, ...stamped }, startRoom);
    setSel(rootId);
  };
  const sortedRoots = useMemo(() => rootsOf(mapRooms).map((x, i) => [x, mapRooms[x].order ?? i] as const).sort((a, b) => a[1] - b[1]).map(([x]) => x), [mapRooms]);
  const reachable = new Set(sortedRoots.flatMap((x) => subtreeOf(mapRooms, x)));
  const orphans = ids.filter((x) => !reachable.has(x));

  const dragProps = (id: string, parent: string | undefined) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => { setDrag(id); e.dataTransfer.effectAllowed = "move"; },
    onDragEnd: () => setDrag(null),
    onDragOver: (e: DragEvent) => { if (drag && drag !== id && mapRooms[drag]?.parent === parent) e.preventDefault(); },
    onDrop: (e: DragEvent) => { e.preventDefault(); if (drag) reorder(parent, drag, id); setDrag(null); },
  });

  const tree = (id: string, depth: number): JSX.Element | null => {
    const kids = childrenOf(mapRooms, id);
    const hit = !String(q ?? "").trim() || subtreeOf(mapRooms, id).some((x) => matches(q, x, mapRooms[x].name, mapRooms[x].desc));
    if (!hit) return null;
    const on = id === cur;
    return (
      <li key={id}>
        <button type="button" {...dragProps(id, mapRooms[id].parent)} onClick={() => setSel(id)}
          style={{ paddingLeft: 8 + depth * 14 }}
          className={`flex w-full items-center gap-1.5 rounded-full py-1 pr-2 text-left text-[12.5px] transition ${on ? "bg-jade text-paper-2" : "text-ink hover:bg-jade/10"} ${drag === id ? "opacity-40" : ""}`}>
          <span className={`shrink-0 text-[10px] ${on ? "text-paper-2/80" : "text-ink-soft"}`} aria-hidden>{kids.length ? <IconChevronDown size={10} /> : "•"}</span>
          <span className="min-w-0 flex-1 truncate">{nm(id)}</span>
          {id === startRoom && <span className={`shrink-0 rounded-full px-1.5 text-[9.5px] ${on ? "bg-paper-2/20" : "bg-gold/15 text-gold"}`}>开局</span>}
          {mapRooms[id].locked && <span className="shrink-0 text-[10px]" title="上锁">锁</span>}
          {mapRooms[id].hidden && <span className="shrink-0 text-[10px]" title="隐藏">隐</span>}
        </button>
        {!!kids.length && <ul>{kids.map((k) => tree(k, depth + 1))}</ul>}
      </li>
    );
  };

  const mapBar = (
    <div className="space-y-1.5 rounded-2xl border border-line bg-paper-2 p-2">
      <p className="px-1 text-[11px] font-bold text-ink-soft">大地图 · 每张下面一棵地点树</p>
      {/* 功能注释：大地图页签与「＋大地图 / 从地点库添加」同一行，删掉单独一行按钮区 */}
      <div className="flex flex-wrap items-center gap-1.5">
        {maps.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => { setMapId(m.id); setSel(null); }}
            className={`rounded-full px-3 py-1 text-[12px] font-bold transition ${m.id === curMapId ? "bg-ink text-paper-2" : "bg-paper text-ink-soft hover:text-ink"}`}
          >
            {m.name || m.id}
          </button>
        ))}
        <button type="button" className={pill} onClick={addMap}>＋ 大地图</button>
        <button type="button" className={pill} onClick={() => setLibOpen(true)}>从地点库添加</button>
        {maps.length > 1 && curMapId ? (
          <button type="button" className={`${pill} !text-danger`} onClick={() => delMap(curMapId)}>删除当前大地图</button>
        ) : null}
      </div>
      {curMap && (
        <div className="space-y-1.5">
          <label className="block">
            <span className={lbl}>大地图名称</span>
            <input className={inp} value={curMap.name} onChange={(e) => patchMap(curMap.id, { name: e.target.value })} placeholder="如：雾色旅馆" />
          </label>
          {/* 功能注释：大地图图统一竖版 9:16；生图/上传/素材库/链接入库前都裁成竖图预览 */}
          <div className="block">
            <span className={lbl}>大地图图 · 竖版 9:16 · 可生图、上传或从素材库选图</span>
            <ImagePicker
              value={curMap.bg}
              onChange={(bg) => patchMap(curMap.id, { bg: bg || undefined })}
              label={`${curMap.name || "大地图"}图`}
              max={1920}
              thumb="aspect-[9/16] h-auto w-14"
              scenePortrait
              platformAssetPurpose="world_map"
              aiGen={{
                size: WORLD_MAP_GEN_SIZE,
                placeholder: "只写这张地图：名称与包含的地点（9:16 竖版）…",
                initialParts: buildWorldMapPromptParts(
                  { name: curMap.name, places: Object.values(mapRooms).map((x) => x.name || ""), desc: curMap.desc },
                  imageGen?.settings,
                ),
                onPartsCommit: imageGen?.onCommit,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );

  if (!Object.keys(allRooms).length && !ids.length) {
    return (
      <div className="space-y-2">
        {mapBar}
        <EmptyState>{emptyHint}</EmptyState>
        <div className="flex flex-wrap gap-1.5">
          <button data-author-field="author-field-rooms" className={pill} onClick={() => add()}>＋ 添加顶层地点</button>
          <button type="button" className={pill} onClick={() => setLibOpen(true)}>从地点库添加</button>
        </div>
        {libPicker}
      </div>
    );
  }

  const kids = cur ? childrenOf(mapRooms, cur) : [];
  const path = cur ? pathOf(mapRooms, cur) : [];
  const parentOpts = cur ? ids.filter((x) => !wouldCycle(mapRooms, cur, x)) : [];
  const reqs = r?.access?.requires ?? [];
  const setReqs = (next: Requirement[]) => cur && set(cur, { access: next.length || r?.access?.note ? { note: r?.access?.note ?? "", requires: next.length ? next : undefined } : undefined });

  return (
    <div className="space-y-2">
      {mapBar}
      {ids.length > 6 && <SearchBox value={q} onChange={setQ} placeholder="搜索地点" />}
      <div className="grid gap-2 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-line bg-paper-2 p-1.5">
          <p className="px-2 pb-1 text-[11px] font-bold text-ink-soft">地点树 · {curMap?.name || "当前大地图"} · 拖拽同级顺序</p>
          <ul className="max-h-[22rem] space-y-0.5 overflow-y-auto">
            {sortedRoots.map((x) => tree(x, 0))}
            {orphans.map((x) => tree(x, 0))}
          </ul>
          <div className="mt-1.5 grid gap-1">
            <button className={`${pill} w-full`} onClick={() => add()}>＋ 顶层地点</button>
          </div>
        </div>

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
                  <button className={`${pill} shrink-0`} onClick={() => onDelete(cur)} aria-label="删除地点">×</button>
                </div>
                <label className="block">
                  <span className={lbl}>父地点 · 空 = 本大地图顶层（不能选自己或自己的下级）</span>
                  <select className={inp} value={r.parent ?? ""} onChange={(e) => {
                    const p = e.target.value || undefined;
                    if (wouldCycle(mapRooms, cur, p)) return;
                    set(cur, { parent: p, order: p ? childrenOf(mapRooms, p).length : undefined, mapId: curMapId });
                  }}>
                    <option value="">（顶层地点）</option>
                    {parentOpts.filter((x) => x !== cur).map((x) => <option key={x} value={x}>{pathOf(mapRooms, x).map(nm).join(" › ")}</option>)}
                  </select>
                </label>
                <textarea className={`${area} ${String(r.desc ?? "").trim() ? "" : "!border-danger"}`} rows={3} value={String(r.desc ?? "")} placeholder="进入此地时的场景描述（必填）" onChange={(e) => set(cur, { desc: e.target.value })} />
                {/* 功能注释：画面描述只喂场景生图（空间布局/光线/陈设），与上面玩家可见的进入叙事分开 */}
                <label className="block">
                  <span className={lbl}>画面描述 · 只给场景生图用（空间布局 / 光线 / 陈设），不写进入叙事</span>
                  <textarea className={area} rows={2} value={String(r.scenePrompt ?? "")} placeholder="如：木质回廊，午后斜阳，靠窗长桌，墙上挂着旧地图（可空）" onChange={(e) => set(cur, { scenePrompt: e.target.value || undefined })} />
                </label>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  <div className="block"><span className={lbl}>场景背景图（进入此地显示 · 9:16 / 1080×1920）</span>
                    <ImagePicker
                      value={r.bg}
                      onChange={(bg) => set(cur, { bg })}
                      label="场景图"
                      max={1920}
                      thumb="aspect-[9/16] h-auto w-14"
                      scenePortrait
                      platformAssetPurpose="location_scene"
                      aiGen={{
                        size: LOCATION_SCENE_GEN_SIZE,
                        placeholder: "只写这个地点的空间：布局、光线、陈设（9:16 竖图）…",
                        initialParts: buildLocationScenePromptParts(
                          { name: r.name, scenePrompt: r.scenePrompt },
                          imageGen?.settings,
                        ),
                        onPartsCommit: imageGen?.onCommit,
                      }}
                    />
                  </div>
                  <label className="block"><span className={lbl}>BGM（进入此地自动切换）</span>
                    <select className={inp} value={r.bgm ?? ""} onChange={(e) => set(cur, { bgm: e.target.value || undefined })}>
                      <option value="">不切换</option>
                      {tracks.map((t) => <option key={t.id} value={t.id}>{t.name || t.id}</option>)}
                    </select>
                  </label>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink">
                  <input data-author-field="author-field-start-room" type="radio" className="accent-jade" checked={startRoom === cur} onChange={() => commit(allRooms, cur)} />设为开局地点<span className="text-ink-soft">（可以是任意一层子地点）</span>
                </label>
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
                        {!!childrenOf(mapRooms, k).length && <span className="ml-1 text-[11px] text-ink-soft">· {subtreeOf(mapRooms, k).length - 1} 个下级</span>}
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
        {!cur && (
          <EmptyState>当前大地图还没有地点。点左侧「＋ 顶层地点」，或从地点库添加一张带地点树的大地图。</EmptyState>
        )}
      </div>
      {libPicker}
    </div>
  );
}
