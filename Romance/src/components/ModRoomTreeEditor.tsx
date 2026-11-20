/* 场景地点树编辑器
 * 大地图 → 地点树：作品可有多张大地图，每张下挂一棵地点树（parent 空 = 该图顶层）。
 * 「从地点库添加」复制运营库大地图 + 整棵地点树进本作品；打开编辑器不会自动写入库条目。 */
import { useMemo, useState, type DragEvent, type JSX } from "react";
import type { RoomContent, Requirement } from "../worlds/star2005/content";
import { childrenOf, pathOf, rootsOf, subtreeOf, wouldCycle } from "../game/roomTree";
import { EmptyState, Help, SearchBox, matches } from "./EditorKit";
import ImagePicker from "./ImagePicker";
import MapPlacer, { useImageRatio } from "./MapPlacer";
import ModBatchImageGen from "./ModBatchImageGen";
import { applyBatchPatch, type BatchApplyPatch } from "../lib/imageGenBatchPlan";
import CreatorAssetLibrary from "./CreatorAssetLibrary";
import { IconChevronDown } from "../lib/icons";
import {
  LOCATION_SCENE_GEN_SIZE,
  WORLD_MAP_GEN_SIZE,
  buildLocationScenePromptParts,
  buildWorldMapPromptParts,
  type WorkImageGenBinding,
} from "../lib/editorImagePrompts";
import {
  resolvePlatformLocationImageUrl,
  type PlatformLocationItem,
} from "../lib/platformLocationLibrary";
import {
  ensureWorldMaps,
  importLibraryMapTree,
  newWorldMapId,
  parseLibraryMapTree,
  roomsOfMap,
  childIsInsideParent,
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
/** 功能注释：<select> 的 value 必须是标量；脏数据里 parent/bgm/op 可能是数组或对象，直接塞会控制台红字。 */
const selectStr = (v: unknown): string => (typeof v === "string" || typeof v === "number" ? String(v) : "");
const reqOp = (v: unknown): Requirement["op"] => (v === "lte" ? "lte" : "gte");
const asReqList = (raw: unknown): Requirement[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => {
    const r = x && typeof x === "object" ? (x as Partial<Requirement>) : {};
    return {
      metric: typeof r.metric === "string" ? r.metric : "",
      op: reqOp(r.op),
      value: typeof r.value === "number" && Number.isFinite(r.value) ? r.value : Number(r.value) || 0,
      hint: typeof r.hint === "string" ? r.hint : "",
    };
  });
};

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
  const [tab, setTab] = useState<"base" | "flags">("base");
  const [q, setQ] = useState("");
  const [drag, setDrag] = useState<string | null>(null);
  const [libOpen, setLibOpen] = useState(false);
  // 功能注释：大地图标点——选中待摆放的顶层地点；为空时点空白处新建地点
  const [pinTarget, setPinTarget] = useState<string | null>(null);
  // 功能注释：子地点在父地点内部地图上的待摆放目标
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
    const name = parent ? "新下级地点" : "新地点";
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

  // 功能注释：地点整包走统一素材库的「地点整包」Tab，不再在编辑器里直连运营列表
  const libPicker = libOpen ? (
    <CreatorAssetLibrary
      onClose={() => setLibOpen(false)}
      initialTab="locationPack"
      initialScope="mine"
      pickMode="locationPack"
      onPickLocationPack={addFromLibrary}
    />
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
        <button type="button" {...dragProps(id, mapRooms[id].parent)} aria-pressed={on} onClick={() => { setSel(id); setTab("base"); }}
          style={{ paddingLeft: 8 + depth * 14 }}
          className={`flex w-full items-center gap-1.5 rounded-full py-1 pr-2 text-left text-[12.5px] transition ${on ? "bg-jade text-paper-2" : "text-ink hover:bg-jade/10"} ${drag === id ? "opacity-40" : ""}`}>
          <span className={`shrink-0 text-[10px] ${on ? "text-paper-2/80" : "text-ink-soft"}`} aria-hidden>{kids.length ? <IconChevronDown size={10} /> : "•"}</span>
          <span className="min-w-0 flex-1 truncate">{nm(id)}</span>
          {id === startRoom && <span className={`shrink-0 rounded-full border px-1.5 text-[9.5px] font-bold leading-[14px] ${on ? "border-white/60 text-white" : "border-gold/40 bg-gold/15 text-gold"}`}>开局</span>}
          {mapRooms[id].locked && <span className="shrink-0 text-[10px]" title="上锁">锁</span>}
          {mapRooms[id].hidden && <span className="shrink-0 text-[10px]" title="隐藏">隐</span>}
        </button>
        {!!kids.length && <ul>{kids.map((k) => tree(k, depth + 1))}</ul>}
      </li>
    );
  };

  // 功能注释：C1.1 批量生图结果一次性写回 room.bg / map.bg，走同一个 commit 保证 ensureWorldMaps 归一化
  const applyBatchImages = (patch: BatchApplyPatch) => {
    const next = applyBatchPatch(allRooms, maps, patch);
    if (next.changed > 0) commit(next.rooms, startRoom, next.maps);
  };
  const batchPanel = (
    <ModBatchImageGen rooms={allRooms} maps={maps} curMapId={curMapId} imageGen={imageGen} onApply={applyBatchImages} />
  );

  const mapBar = (
    <div className="space-y-1.5 rounded-2xl border border-line bg-paper-2 p-2">
      <p className="flex items-baseline justify-between gap-2 px-1 text-[11px] text-ink-soft"><b className="text-[12px] text-ink">地图 · {maps.length} 张</b><span>一个世界可放多张地图，每张各自挂地点</span></p>
      {/* 功能注释：大地图页签与「＋新大地图 / 从地点库添加」同一行 */}
      <div className="flex flex-wrap items-center gap-1.5">
        {maps.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => { setMapId(m.id); setSel(null); }}
            className={`rounded-full px-3 py-1 text-[12px] font-bold transition ${m.id === curMapId ? "bg-ink text-paper-2" : "bg-paper text-ink-soft hover:text-ink"}`}
          >
            {m.name || m.id}
            <span className="ml-1 font-normal opacity-60">{Object.keys(roomsOfMap(allRooms, m.id)).length}</span>
          </button>
        ))}
        <button type="button" className={pill} onClick={addMap}>＋ 新大地图</button>
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
          {/* 功能注释：大地图图统一竖版 9:16 / 1080×1920；界面文案对创作者白话说明 */}
          <div className="block">
            <span className={lbl}>大地图封面（竖版，可上传 / AI 生成 / 素材库）</span>
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
                placeholder: "写清这张地图叫什么、上面有哪些地点…",
                initialParts: buildWorldMapPromptParts(
                  { name: curMap.name, places: Object.values(mapRooms).map((x) => x.name || ""), desc: curMap.desc },
                  imageGen?.settings,
                ),
                onPartsCommit: imageGen?.onCommit,
              }}
            />
          </div>
          {/* 功能注释：上传大地图图后直接在图上点点位 */}
          {curMap.bg ? (() => {
            const tops = Object.entries(mapRooms).filter(([, x]) => !x.parent);
            const target = pinTarget && mapRooms[pinTarget] && !mapRooms[pinTarget].parent ? pinTarget : null;
            return (
              <div className="space-y-1.5" data-map-pins>
                <span className={lbl}>大地图标点：先选地点，再点图。点空白处可新建。下级地点不在这张大地图上标。</span>
                <div className="flex flex-wrap gap-1">
                  {tops.map(([id, x]) => {
                    const placed = typeof x.mapX === "number" && typeof x.mapY === "number";
                    const on = target === id;
                    return (
                      <button key={id} type="button" onClick={() => { setPinTarget(on ? null : id); setSel(id); }}
                        className={`rounded-full border px-2.5 py-0.5 text-[11.5px] ${on ? "border-coral bg-coral text-white" : placed ? "border-jade/50 bg-jade/10 text-jade" : "border-dashed border-line text-ink-soft"}`}>
                        {x.name || id}{placed ? "" : " · 未放"}
                      </button>
                    );
                  })}
                </div>
                <div className="mx-auto w-full max-w-[280px]">
                  <MapPlacer
                    bg={curMap.bg}
                    aspect="aspect-[9/16]"
                    dots={tops.filter(([, x]) => typeof x.mapX === "number" && typeof x.mapY === "number").map(([id, x]) => ({ id, x: x.mapX!, y: x.mapY!, label: x.name || id }))}
                    activeId={target}
                    onPick={(id) => { setPinTarget(id); setSel(id); }}
                    onPlace={(id, x, y) => { set(id, { mapX: x, mapY: y }); setPinTarget(null); }}
                    onBlank={(x, y) => {
                      const id = rid();
                      const name = "新地点";
                      commit({ ...allRooms, [id]: { name, desc: sceneDescFallback(name), exits: {}, mapId: curMapId, mapX: x, mapY: y } });
                      setSel(id);
                      setTab("base");
                    }}
                  />
                </div>
                {target && (
                  <p className="text-[10.5px] text-ink-soft">
                    点地图，把「{mapRooms[target]?.name || target}」放到这里
                    {typeof mapRooms[target]?.mapX === "number" && (
                      <button type="button" className="ml-2 text-coral underline" onClick={() => { set(target, { mapX: undefined, mapY: undefined }); setPinTarget(null); }}>移除标记</button>
                    )}
                  </p>
                )}
              </div>
            );
          })() : (
            <p className="text-[10.5px] text-ink-soft">有了封面图后，点一下图就能标出地点位置。</p>
          )}
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
          <button data-author-field="author-field-rooms" className={pill} onClick={() => add()}>＋ 添加地点</button>
          <button type="button" className={pill} onClick={() => setLibOpen(true)}>从地点库添加</button>
        </div>
        {libPicker}
      </div>
    );
  }

  const kids = cur ? childrenOf(mapRooms, cur) : [];
  const path = cur ? pathOf(mapRooms, cur) : [];
  const parentOpts = cur ? ids.filter((x) => !wouldCycle(mapRooms, cur, x)) : [];
  const parentVal = selectStr(r?.parent);
  const bgmVal = selectStr(r?.bgm);
  const reqs = asReqList(r?.access?.requires);
  const setReqs = (next: Requirement[]) => cur && set(cur, { access: next.length || r?.access?.note ? { note: r?.access?.note ?? "", requires: next.length ? next : undefined } : undefined });

  return (
    <div className="space-y-2">
      {mapBar}
      <div className="grid items-start gap-2 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
        <div className="min-w-0 rounded-2xl border border-line bg-paper-2 p-1.5">
          <p className="px-2 pb-1 text-[11px] leading-snug text-ink-soft">
            <b className="text-ink">地点 · {curMap?.name || "当前大地图"}</b>
            <span className="mt-0.5 block">直属地点显示在大地图上。缩进为下级地点，进入上级后才到达。可拖动调整顺序。</span>
          </p>
          {ids.length > 6 && <SearchBox value={q} onChange={setQ} placeholder="搜索地点" />}
          <ul aria-label="地点列表" className="max-h-28 space-y-0.5 overflow-y-auto sm:max-h-[22rem]">
            {sortedRoots.map((x) => tree(x, 0))}
            {orphans.map((x) => tree(x, 0))}
          </ul>
          <div className="mt-1.5 grid gap-1">
            <button type="button" className={`${pill} w-full`} onClick={() => add()}>＋ 添加地点</button>
          </div>
        </div>

        {cur && r && (
          <div className="min-w-0 space-y-2 rounded-2xl border border-line bg-paper-2 p-2">
            <p className="break-words px-1 text-[12px] font-bold leading-snug text-ink">
              当前地点 · {path.map(nm).join(" › ")}
            </p>
            {path.length > 1 && (
              <button type="button" onClick={() => setSel(path[path.length - 2]!)} className="text-left text-[12px] font-bold text-jade">
                ← 回到「{nm(path[path.length - 2]!)}」
              </button>
            )}
            <div className="grid grid-cols-2 gap-1" role="tablist" aria-label="地点内容">
              {(["base", "flags"] as const).map((k) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                  className={`flex min-h-9 min-w-0 items-center justify-center rounded-xl px-1 py-1.5 text-center text-[12px] font-bold leading-snug transition ${tab === k ? "bg-ink !text-white" : "border border-[#e4d0d4] bg-white text-ink"}`}>
                  {k === "base" ? "地点信息" : "进入条件"}
                </button>
              ))}
            </div>

            {tab === "base" && (
              <div className="space-y-1.5">
                <div className="flex min-w-0 items-end gap-1.5">
                  <label className="min-w-0 flex-1">
                    <span className={lbl}>地点名称</span>
                    <input className={`${inp} min-w-0`} value={r.name ?? ""} placeholder="如：禅房" onChange={(e) => set(cur, { name: e.target.value })} />
                  </label>
                  <button type="button" className={`${pill} mb-1 shrink-0 !border-danger/40 !text-danger hover:!bg-danger/10`} onClick={() => onDelete(cur)}>删除</button>
                </div>
                <div className="rounded-2xl border border-line bg-paper px-2.5 py-2">
                  <label className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-[12px] font-bold text-ink">所属</span>
                    <select className={`${inp} min-w-0`} value={parentVal} onChange={(e) => {
                      const p = e.target.value || undefined;
                      if (wouldCycle(mapRooms, cur, p)) return;
                      set(cur, { parent: p, order: p ? childrenOf(mapRooms, p).length : undefined, mapId: curMapId });
                    }}>
                      <option value="">大地图直属</option>
                      {parentOpts.filter((x) => x !== cur).map((x) => <option key={x} value={x}>「{pathOf(mapRooms, x).map(nm).join(" › ")}」的下级</option>)}
                    </select>
                  </label>
                  {parentVal && !childIsInsideParent(String(r.name || ""), nm(parentVal)) && (
                    <p className="mt-1 text-[11px] leading-snug text-coral">不像「{nm(parentVal)}」的下级。街区、学校、另一栋建筑请改回「大地图直属」。</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    <span className="shrink-0 text-[11px] font-bold text-ink-soft">下级</span>
                    {kids.map((k) => (
                      <button key={k} type="button" onClick={() => { setSel(k); setTab("base"); }} className="max-w-full truncate rounded-full border border-line bg-paper-2 px-2 py-0.5 text-[11.5px] text-ink hover:border-jade hover:text-jade">{nm(k)}</button>
                    ))}
                    <button type="button" className={pill} onClick={() => add(cur)}>+ 下级</button>
                  </div>
                </div>
                <label className="block">
                  <span className={lbl}>地点描述 *</span>
                  <textarea className={`${area} block resize-y leading-relaxed ${String(r.desc ?? "").trim() ? "" : "!border-danger"}`} rows={5} value={String(r.desc ?? "")} placeholder="玩家走进这里时看到的描述" onChange={(e) => set(cur, { desc: e.target.value })} />
                </label>
                <div className="grid gap-2 rounded-2xl border border-line bg-paper px-2.5 py-2">
                  <div className="min-w-0"><span className={lbl}>背景图（竖版）</span>
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
                        placeholder: "写这个地点的空间：布局、光线、陈设…",
                        initialParts: buildLocationScenePromptParts(
                          { name: r.name, scenePrompt: r.scenePrompt || r.desc },
                          imageGen?.settings,
                        ),
                        onPartsCommit: imageGen?.onCommit,
                      }}
                    />
                  </div>
                  <label className="block"><span className={lbl}>背景音乐（走进这里时切换）</span>
                    <select className={inp} value={bgmVal} onChange={(e) => set(cur, { bgm: e.target.value || undefined })}>
                      <option value="">不切换</option>
                      {tracks.map((t) => {
                        const id = selectStr(t?.id);
                        if (!id) return null;
                        return <option key={id} value={id}>{selectStr(t?.name) || id}</option>;
                      })}
                    </select>
                  </label>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink">
                  <input data-author-field="author-field-start-room" type="radio" className="accent-jade" checked={startRoom === cur} onChange={() => commit(allRooms, cur)} />设为开局落脚点<span className="text-ink-soft">（玩家一开局就在这里）</span>
                </label>
              </div>
            )}

            {tab === "flags" && (
              <div className="space-y-1.5">
                <div className="grid gap-1 sm:grid-cols-2">
                  {([
                    ["hidden", "先藏起来", "平时不在列表里出现，去过或解锁后才显示"],
                    ["locked", "需要解锁才能进", "未解锁时玩家进不来；解锁上级地点不会自动解开这里"],
                    ["noNpcVisit", "人物不会自己走进来", "四处走动的 NPC 不会主动到这里"],
                    ["inheritEvents", "也显示上级地点的活动", "默认各自独立；勾选后会带上上级可做的事"],
                  ] as const).map(([k, t, d]) => (
                    <label key={k} className="flex cursor-pointer items-start gap-2 rounded-2xl border border-line bg-paper px-3 py-2 text-[12px] text-ink">
                      <input type="checkbox" className="mt-0.5 accent-jade" checked={!!r[k]} onChange={(e) => set(cur, { [k]: e.target.checked || undefined })} />
                      <span><b>{t}</b><span className="block text-[11px] text-ink-soft">{d}</span></span>
                    </label>
                  ))}
                </div>
                {r.locked && <input className={inp} value={r.lockNote ?? ""} placeholder="上锁提示，如：小阁的门上了铜锁，钥匙不知在谁手里。" onChange={(e) => set(cur, { lockNote: e.target.value || undefined })} />}
                <div className="space-y-1 rounded-2xl border border-line bg-paper p-2">
                  <p className="text-[12px] font-bold text-ink">进入条件 <span className="font-normal text-ink-soft">· 下面都满足才能进来</span></p>
                  {reqs.map((q2, i) => (
                    <div key={i} className="flex flex-wrap gap-1">
                      <input className={`${inp} !w-36 font-mono`} value={q2.metric} placeholder="fame / c:属性 / flag:变量" onChange={(e) => setReqs(reqs.map((x, j) => (j === i ? { ...x, metric: e.target.value } : x)))} />
                      <select className={`${inp} !w-16`} value={reqOp(q2.op)} onChange={(e) => setReqs(reqs.map((x, j) => (j === i ? { ...x, op: reqOp(e.target.value) } : x)))}>
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
                <Help>条件键：fame、reputation、stats.<i>x</i>、c:<i>属性id</i>、flag:<i>计数器</i>、at:<i>地点id</i>（正好在此）、in:<i>地点id</i>（在这一枝里）。事件、对话、结局的条件同样可以用 at: / in: 判断玩家在哪一层子地点。</Help>
              </div>
            )}
          </div>
        )}
        {!cur && (
          <EmptyState>这张大地图还没有地点。点「＋ 添加地点」，或从地点库整图导入。</EmptyState>
        )}
        {/* 功能注释：批量生图属于地点区，跨两栏铺开，展开后不挤在窄列表里 */}
        <div className="sm:col-span-2">{batchPanel}</div>
      </div>
      {libPicker}
    </div>
  );
}

