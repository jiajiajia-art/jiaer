import { useRef, useState } from "react";
import { useGame } from "../store/gameCtx";
import { roomDesc } from "../game/mud";
import type { CustomSpotAct, CustomSpotItem, MapEdits, MapSpotEdit, ShopGood, SpotEvent } from "../lib/types";
import { LIVE_LOCATIONS as LOCATIONS } from "../mods/registry";
import { MAIN_SHEET, mapSheets, sheetOf } from "../game/mapSheets";
import MapSheetsEditor from "./MapSheetsEditor";
import MapSpotExtras from "./MapSpotExtras";
import MapPlacer from "./MapPlacer";
import { spotPos } from "../game/mapPos";
import { getWorldMap, worldActivitiesOfRoom } from "../mods/registry";
import { DEFAULT_ACT_AP } from "../game/mapedits";
import { BonusRow, BONUS_EXTRA } from "./ModCarsEditor";
import { STAT_LABELS, STAT_ORDER } from "../game/data";
import { addSpots, parseSpots } from "../game/publicMaps";
import MapLibraryPanel from "./MapLibraryPanel";
import { EmptyState, ScopeBanner, SearchBox, matches, useConfirm } from "./EditorKit";
import { IconSpark } from "../lib/icons";

/* 地图编辑器：玩家为地图上的每个点位覆写「名称 / 场景描述 / 背景图」，
 * 并新增可在场景里拾取、收进行囊的「点位物件」。所有覆写以点位 id 存入 GameState.mapEdits，
 * 留空即回落到世界内容池的默认值——与题材解耦，任何世界都通用。 */
/* 本地上传的地点图：缩到长边 1280 并转 JPEG，避免存档里塞进原图体积 */
const shrinkImage = (file: File, max = 1280): Promise<string> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });

const newItem = (): CustomSpotItem => ({
  id: `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  name: "",
  desc: "",
  icon: "",
  prompt: "",
});

const newAct = (): CustomSpotAct => ({
  id: `act_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  label: "",
  hint: "",
  cost: 1,
  prompt: "",
});

const newEvent = (): SpotEvent => ({
  id: `evt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  title: "",
  annotation: "",
  seed: "",
  once: false,
});

/* 是否还有任何内容（含刚添加、尚未填写的物件/行动/事件草稿）——只有全空才清掉覆写 */
const isBlank = (e: MapSpotEdit) =>
  !e.custom && !e.name && !e.desc && !e.background && !e.sheet && !e.jumpTo && e.x == null && e.y == null
  && !e.items?.length && !e.acts?.length && !e.events?.length && !e.shop?.length
  && !e.icon && !e.start && !e.startFor?.length && !e.unlock && !e.unlockConds?.length && !e.arrivals?.length;

const hasEdit = (e?: MapSpotEdit) =>
  !!e && (
    !!e.name?.trim() || !!e.desc?.trim() || !!e.background?.trim() || !!e.sheet || !!e.jumpTo || e.x != null || e.y != null
    || !!e.icon || !!e.start || !!e.startFor?.length || !!e.unlock || !!e.arrivals?.length
    || (e.items ?? []).some((it) => it.name.trim())
    || (e.acts ?? []).some((a) => a.label.trim())
    || (e.shop ?? []).some((it) => it.name.trim())
    || (e.events ?? []).some((ev) => ev.title.trim() || ev.seed.trim())
  );

export default function MapEditorPanel() {
  const { game, setMapEdits } = useGame();
  const [openId, setOpenId] = useState<string | null>(null);
  const [spotTab, setSpotTab] = useState<"base" | "look" | "items" | "story">("base");
  const bgFileRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [onlyEdited, setOnlyEdited] = useState(false);
  const [confirm, confirmEl] = useConfirm();
  const [curSheet, setCurSheet] = useState(MAIN_SHEET);
  const [parseOpen, setParseOpen] = useState(false);
  const [parseText, setParseText] = useState("");
  if (!game) return null;

  const edits: MapEdits = game.mapEdits ?? {};
  const editedCount = LOCATIONS.filter((l) => hasEdit(edits[l.id])).length;

  const sheets = mapSheets(edits._config);
  const sheet = sheets.find((x) => x.id === curSheet) ?? sheets[0];
  const multi = sheets.length > 1;
  // 主地图底图仍存 _config.bgUrl（兼容旧存档）；其余底图存 sheets[].bgUrl
  const saveSheets = (next: typeof sheets, base: MapEdits = edits) => {
    const main = next.find((x) => x.id === MAIN_SHEET);
    const cfg = { ...(base._config ?? {}), bgUrl: main?.bgUrl, sheets: next.map((x) => (x.id === MAIN_SHEET ? { id: x.id, name: x.name } : x)) };
    setMapEdits({ ...base, _config: cfg });
  };
  const removeSheet = async (id: string) => {
    const n = LOCATIONS.filter((l) => sheetOf(edits, l.id, sheets) === id).length;
    if (!(await confirm(`删除底图「${sheets.find((x) => x.id === id)?.name}」？${n ? `其上 ${n} 个地点将回到主地图。` : ""}`, { ok: "删除" }))) return;
    const base: MapEdits = { ...edits };
    for (const k of Object.keys(base)) {
      const v = base[k] as MapSpotEdit;
      if (k === "_config" || !v) continue;
      if (v.sheet === id || v.jumpTo === id) base[k] = { ...v, sheet: v.sheet === id ? undefined : v.sheet, jumpTo: v.jumpTo === id ? undefined : v.jumpTo };
    }
    setCurSheet(MAIN_SHEET);
    saveSheets(sheets.filter((x) => x.id !== id), base);
  };
  const visible = LOCATIONS.filter((l) => (!multi || sheetOf(edits, l.id, sheets) === sheet.id) && (!onlyEdited || hasEdit(edits[l.id])) && matches(q, l.name, l.func, (edits[l.id] as MapSpotEdit | undefined)?.name));
  const badUrl = (u?: string) => !!u?.trim() && !/^(https?:|data:image\/|\/|blob:)/.test(u.trim());

  const patch = (roomId: string, part: Partial<MapSpotEdit>) => {
    const nextSpot: MapSpotEdit = { ...(edits[roomId] ?? {}), ...part };
    // 清掉全空的覆写，保持存档干净
    const clean = isBlank(nextSpot) ? undefined : nextSpot;
    const next: MapEdits = { ...edits };
    if (clean) next[roomId] = clean;
    else delete next[roomId];
    setMapEdits(next);
  };
  // 默认开局起点全图唯一：设一个即清掉其余
  const setStart = (roomId: string, on: boolean) => {
    const next: MapEdits = { ...edits };
    for (const k of Object.keys(next)) {
      const v = next[k] as MapSpotEdit;
      if (k !== "_config" && v?.start) { const { start: _s, ...rest } = v; if (isBlank(rest)) delete next[k]; else next[k] = rest; }
    }
    if (on) next[roomId] = { ...(next[roomId] ?? {}), start: true, unlock: undefined };
    setMapEdits(next);
  };
  const startId = Object.keys(edits).find((k) => k !== "_config" && (edits[k] as MapSpotEdit)?.start);
  const startName = startId ? ((edits[startId] as MapSpotEdit).name?.trim() || LOCATIONS.find((l) => l.id === startId)?.name) : undefined;
  const setItems = (roomId: string, items: CustomSpotItem[]) => patch(roomId, { items });
  const setActs = (roomId: string, acts: CustomSpotAct[]) => patch(roomId, { acts });
  const setEvents = (roomId: string, events: SpotEvent[]) => patch(roomId, { events });
  const resetSpot = async (roomId: string) => {
    if (!(await confirm("清除此点位的全部自定义（名称/描述/背景/物件/事件）？", { ok: "清除" }))) return;
    const next = { ...edits };
    delete next[roomId];
    setMapEdits(next);
  };

  return (
    <div className="space-y-4">
      {confirmEl}
      <div className="flex items-center justify-between gap-2 text-[12px] text-ink-soft">
        <span>共 <b className="text-ink">{LOCATIONS.length}</b> 个点位 · 已改 <b className="text-jade-deep">{editedCount}</b> 个 · 仅本存档</span>
        <span className="truncate">{startId ? <>开局：<b className="text-coral">{startName}</b></> : "开局：沿用默认"}</span>
      </div>

      <Fold title="地图库" note="保存 · 套用 · 分享">
        <MapLibraryPanel edits={edits} apply={setMapEdits} confirm={confirm} />
      </Fold>

      <Fold title="呈现方式与底图" note={`一屏全貌 · ${sheets.length} 张底图`}>

        <MapSheetsEditor
          sheets={sheets}
          cur={sheet.id}
          setCur={setCurSheet}
          onChange={(next) => saveSheets(next)}
          countOf={(id) => LOCATIONS.filter((l) => sheetOf(edits, l.id, sheets) === id).length}
          onRemove={removeSheet}
        />
      </Fold>

      {multi && <p className="text-[11.5px] font-bold text-jade-deep">选择地点 · 当前底图「{sheet.name}」</p>}
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1"><SearchBox value={q} onChange={setQ} placeholder="搜索点位名 / 功能" count={visible.length} /></div>
        <label className="flex shrink-0 items-center gap-1 text-[11.5px] text-ink-soft"><input type="checkbox" checked={onlyEdited} onChange={(ev) => setOnlyEdited(ev.target.checked)} />仅已改</label>
      </div>
      {/* 直接在底图上标点 */}
      <div className="space-y-1.5">
        <MapPlacer
          bg={sheet.bgUrl || (sheet.id === MAIN_SHEET ? getWorldMap().background : undefined)}
          dots={visible.map((l) => { const p = spotPos(edits, l.id, edits._config?.mode ?? "panorama"); return { id: l.id, ...p, label: (edits[l.id] as MapSpotEdit | undefined)?.name?.trim() || l.name }; })}
          activeId={openId && visible.some((l) => l.id === openId) ? openId : null}
          onPick={(id) => setOpenId(id)}
          onPlace={(id, x, y) => patch(id, { x, y })}
        />
        <p className="text-[11px] leading-relaxed text-ink-soft">{openId && visible.some((l) => l.id === openId) ? "拖动图钉调整位置，或点地图空白处把选中的地点放过去。" : "点图钉选中地点，拖动即可调整位置。"}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => {
          const next = addSpots(edits, [{ name: "新地点", desc: "", x: 50, y: 50 }], { sheet: sheet.id, link: startId });
          setMapEdits(next);
          setOpenId(Object.keys(next).find((k) => !(k in edits)) ?? null);
        }} className="rounded-xl border border-dashed border-jade/50 bg-jade/5 py-2 text-[12.5px] font-bold text-jade-deep hover:bg-jade/10">＋ 添加地点</button>
        <button type="button" onClick={() => setParseOpen(!parseOpen)} className={`rounded-xl border border-dashed py-2 text-[12.5px] font-bold transition ${parseOpen ? "border-jade bg-jade/10 text-jade-deep" : "border-line text-ink-soft hover:border-jade/50"}`}>从文本解析</button>
      </div>
      {parseOpen && (() => {
        const got = parseSpots(parseText);
        return (
          <div className="space-y-2 rounded-xl border border-jade/40 bg-jade/[0.03] p-2.5">
            <textarea value={parseText} onChange={(ev) => setParseText(ev.target.value)} rows={5}
              placeholder={"每行一个地点，可带备注：\n悯世宗：正道魁首，山门在云海之上\n合欢宗 - 魔道，擅长双修\n也可一行用顿号分隔：京城、云家、道馆"}
              className="w-full resize-y rounded-lg border border-line bg-paper-2 px-2.5 py-2 text-[12.5px] leading-relaxed text-ink focus:border-jade focus:outline-none" />
            {got.length > 0 && <p className="text-[11px] text-ink-soft">将添加 {got.length} 个地点到「{sheet.name}」：{got.map((x) => x.name).join("、")}</p>}
            <button type="button" disabled={!got.length} onClick={() => {
              setMapEdits(addSpots(edits, got, { sheet: sheet.id, link: startId }));
              setParseText(""); setParseOpen(false);
            }} className="w-full rounded-lg bg-jade py-1.5 text-[12.5px] font-bold text-white disabled:opacity-40">添加这 {got.length} 个地点</button>
            <p className="text-[10.5px] text-ink-soft">解析出的地点会自动排布并依次相连，之后可在图上拖到准确位置。</p>
          </div>
        );
      })()}
      {LOCATIONS.length === 0 && <EmptyState>当前世界观没有地图点位。</EmptyState>}
      {LOCATIONS.length > 0 && visible.length === 0 && <EmptyState>没有符合条件的点位。</EmptyState>}

      <div className="space-y-2.5">
        {visible.map((loc) => {
          const e: MapSpotEdit = (edits[loc.id] as MapSpotEdit | undefined) ?? {};
          const items: CustomSpotItem[] = e.items ?? [];
          const acts: CustomSpotAct[] = e.acts ?? [];
          const events: SpotEvent[] = e.events ?? [];
          const open = openId === loc.id;
          const edited = hasEdit(e);
          const displayName = e.name?.trim() || loc.name;
          return (
            <div key={loc.id} className={`overflow-hidden rounded-2xl border transition ${edited ? "border-jade/50 bg-jade/[0.04]" : "border-line bg-paper/40"}`}>
              <button
                onClick={() => setOpenId(open ? null : loc.id)}
                className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left"
              >
                <span className="text-[15px] leading-none">{loc.icon || <IconSpark size={16} />}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-bold text-ink">{displayName}</span>
                    {startId === loc.id && <span className="shrink-0 rounded-full bg-coral px-1.5 py-px text-[9.5px] font-bold text-white">开局</span>}
                    {e.unlock && e.unlock !== "open" && <span className="shrink-0 rounded-full border border-gold/50 px-1.5 py-px text-[9.5px] font-bold text-gold">{e.unlock === "story" ? "叙事揭示" : "条件解锁"}</span>}
                    {edited && <span className="shrink-0 rounded-full border border-jade/40 bg-jade/10 px-1.5 py-px text-[9.5px] font-bold text-jade-deep">已自定义</span>}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-ink-soft">
                    {loc.func}{items.length > 0 ? ` · ${items.length} 件物件` : ""}{acts.length > 0 ? ` · ${acts.length} 项行动` : ""}{events.length > 0 ? ` · ${events.length} 段剧情` : ""}
                  </span>
                </span>
                <span className={`shrink-0 text-[12px] text-ink-soft transition ${open ? "rotate-90" : ""}`}>›</span>
              </button>

              {open && (
                <div className="space-y-3 border-t border-line/60 px-3.5 py-3.5">
                  <div className="-mx-1 flex gap-1 overflow-x-auto rounded-xl bg-paper-2 p-1 [scrollbar-width:none]">
                    {([["base", "基本 · 描述"], ["look", "图标 · 开局 · 解锁"], ["items", `物件 · 行动${items.length + acts.length ? " " + (items.length + acts.length) : ""}`], ["story", `剧情${events.length ? " " + events.length : ""}`]] as const).map(([k, l]) => (
                      <button key={k} type="button" onClick={() => setSpotTab(k)}
                        className={`shrink-0 flex-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12px] font-bold transition ${spotTab === k ? "bg-paper text-jade shadow-sm" : "text-ink-soft hover:text-ink"}`}>{l}</button>
                    ))}
                  </div>
                  {spotTab === "base" && (<>
                  <div>
                    <label className="mb-1 block text-[10.5px] font-bold tracking-[0.16em] text-ink-soft">点位名称</label>
                    <input
                      value={e.name ?? ""}
                      onChange={(ev) => patch(loc.id, { name: ev.target.value })}
                      placeholder={loc.name}
                      className="w-full rounded-lg border border-line bg-paper-2 px-2.5 py-1.5 text-[13.5px] font-bold text-ink placeholder:font-normal placeholder:text-ink-soft/70 focus:border-jade focus:outline-none"
                    />
                  </div>

                  {e.x != null && (
                    <button type="button" onClick={() => patch(loc.id, { x: undefined, y: undefined })} className="text-[11px] text-ink-soft hover:text-jade hover:underline">↺ 位置恢复默认</button>
                  )}
                  {e.custom && (
                    <div className="flex items-end gap-2">
                      <label className="block min-w-0 flex-1 text-[10.5px] font-bold tracking-[0.16em] text-ink-soft">连通到（玩家从这里走过来）
                        <select value={e.link ?? ""} onChange={(ev) => patch(loc.id, { link: ev.target.value || undefined })}
                          className="mt-1 w-full rounded-lg border border-line bg-paper-2 px-2 py-1.5 text-[12.5px] font-normal tracking-normal text-ink">
                          <option value="">开局地点</option>
                          {LOCATIONS.filter((l) => l.id !== loc.id).map((l) => <option key={l.id} value={l.id}>{(edits[l.id] as MapSpotEdit | undefined)?.name?.trim() || l.name}</option>)}
                        </select>
                      </label>
                      <button type="button" onClick={async () => {
                        if (!(await confirm(`删除自建地点「${displayName}」？`, { ok: "删除" }))) return;
                        const next: MapEdits = { ...edits };
                        delete next[loc.id];
                        for (const k of Object.keys(next)) { const v = next[k] as MapSpotEdit; if (k !== "_config" && v?.link === loc.id) next[k] = { ...v, link: e.link }; }
                        setMapEdits(next); setOpenId(null);
                      }} className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-[12px] text-ink-soft hover:border-danger/60 hover:text-danger">删除地点</button>
                    </div>
                  )}
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <label className="text-[10.5px] font-bold tracking-[0.16em] text-ink-soft">地点描述 · 进入此地时的旁白</label>
                      <span className="text-[10px] text-ink-soft">{(e.desc ?? "").length} 字</span>
                    </div>
                    <textarea
                      value={e.desc ?? ""}
                      onChange={(ev) => patch(loc.id, { desc: ev.target.value || undefined })}
                      placeholder={roomDesc(loc.id) || "写下这里的样子：光线、气味、常来的人、能做的事……留空则沿用默认描述"}
                      rows={4}
                      className="w-full resize-y rounded-lg border border-line bg-paper-2 px-2.5 py-2 text-[13px] leading-relaxed text-ink placeholder:text-ink-soft/70 focus:border-jade focus:outline-none"
                    />
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {roomDesc(loc.id) && !e.desc && <button type="button" onClick={() => patch(loc.id, { desc: roomDesc(loc.id) })} className="rounded-full border border-line px-2.5 py-0.5 text-[11px] text-ink-soft hover:border-jade hover:text-jade">填入默认描述再改</button>}
                      {e.desc && <button type="button" onClick={() => patch(loc.id, { desc: undefined })} className="rounded-full border border-line px-2.5 py-0.5 text-[11px] text-ink-soft hover:border-danger/60 hover:text-danger">恢复默认</button>}
                    </div>
                    <p className="mt-1 text-[10.5px] text-ink-soft">AI 会把这段当作此地设定来写剧情。</p>
                  </div>
                  </>)}
                  {spotTab === "look" && (<>
                  <MapSpotExtras e={e} name={displayName} isStart={startId === loc.id} patch={(p) => patch(loc.id, p)} setStart={(on) => setStart(loc.id, on)} />
                  </>)}
                  {spotTab === "base" && (<>
                  {multi && (
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block text-[10.5px] font-bold tracking-[0.16em] text-ink-soft">所属底图
                        <select value={sheetOf(edits, loc.id, sheets)} onChange={(ev) => patch(loc.id, { sheet: ev.target.value === MAIN_SHEET ? undefined : ev.target.value })}
                          className="mt-1 w-full rounded-lg border border-line bg-paper-2 px-2 py-1.5 text-[12.5px] font-normal tracking-normal text-ink">
                          {sheets.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                        </select>
                      </label>
                      <label className="block text-[10.5px] font-bold tracking-[0.16em] text-ink-soft">点击跳转
                        <select value={e.jumpTo ?? ""} onChange={(ev) => patch(loc.id, { jumpTo: ev.target.value || undefined })}
                          className="mt-1 w-full rounded-lg border border-line bg-paper-2 px-2 py-1.5 text-[12.5px] font-normal tracking-normal text-ink">
                          <option value="">不跳转（正常前往）</option>
                          {sheets.filter((x) => x.id !== sheetOf(edits, loc.id, sheets)).map((x) => <option key={x.id} value={x.id}>进入「{x.name}」</option>)}
                        </select>
                      </label>
                    </div>
                  )}

                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="block text-[10.5px] font-bold tracking-[0.16em] text-ink-soft">地点图片</label>
                      <div className="flex items-center gap-1.5">
                        <label className="cursor-pointer rounded-md border border-line bg-paper-2 px-2 py-0.5 text-[11px] text-ink hover:border-jade">
                          上传图片
                          <input type="file" accept="image/*" className="hidden" onChange={async (ev) => {
                            const f = ev.target.files?.[0]; ev.target.value = "";
                            if (!f) return;
                            try { patch(loc.id, { background: await shrinkImage(f) }); } catch { /* 读取失败则保持原值 */ }
                          }} />
                        </label>
                        {e.background?.trim() && (
                          <button type="button" onClick={() => patch(loc.id, { background: undefined })}
                            className="rounded-md border border-line px-2 py-0.5 text-[11px] text-ink-soft hover:text-danger">清除</button>
                        )}
                      </div>
                    </div>
                    <input
                      value={e.background?.startsWith("data:") ? "（已上传本地图片）" : (e.background ?? "")}
                      readOnly={!!e.background?.startsWith("data:")}
                      onChange={(ev) => patch(loc.id, { background: ev.target.value })}
                      placeholder="上传图片，或贴一张 https:// 图片直链；留空用默认实景"
                      className="w-full rounded-lg border border-line bg-paper-2 px-2.5 py-1.5 font-mono text-[11.5px] text-ink placeholder:font-sans placeholder:text-ink-soft/70 focus:border-jade focus:outline-none"
                    />
                    {badUrl(e.background) && <p className="mt-0.5 text-[11px] text-danger">看起来不是有效的图片地址（需以 http(s):// 开头）。</p>}
                    {e.background?.trim() && !badUrl(e.background) && (
                      <div className="mt-2 overflow-hidden rounded-lg border border-line bg-jade-deep/10">
                        <img src={(e.background) || undefined} alt="背景预览" className="h-24 w-full object-cover" loading="lazy" />
                      </div>
                    )}
                  </div>
                  </>)}

                  {spotTab === "base" && worldActivitiesOfRoom(loc.id).length > 0 && (
                    <div>
                      <label className="mb-1.5 block text-[10.5px] font-bold tracking-[0.16em] text-ink-soft">地点活动 · 行动点消耗</label>
                      <div className="space-y-1.5">
                        {worldActivitiesOfRoom(loc.id).map((a) => {
                          const v = e.actCost?.[a.id] ?? DEFAULT_ACT_AP;
                          const set = (n: number) => patch(loc.id, { actCost: { ...(e.actCost ?? {}), [a.id]: Math.max(0, Math.min(20, Math.round(n) || 0)) } });
                          return (
                            <div key={a.id} className="flex items-center gap-2 rounded-[8px] border border-line bg-paper-2 px-2.5 py-1.5">
                              <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink" title={a.desc}>{a.name}</span>
                              <button type="button" onClick={() => set(v - 1)} disabled={v <= 0} className="grid h-6 w-6 place-items-center rounded-[6px] border border-line text-[13px] text-ink-soft disabled:opacity-30">−</button>
                              <input type="number" min={0} max={20} value={v} onChange={(ev) => set(Number(ev.target.value))}
                                className="w-12 rounded-[6px] border border-line bg-paper px-1 py-0.5 text-center text-[12.5px] tabular-nums text-ink focus:border-jade focus:outline-none" />
                              <button type="button" onClick={() => set(v + 1)} disabled={v >= 20} className="grid h-6 w-6 place-items-center rounded-[6px] border border-line text-[13px] text-ink-soft disabled:opacity-30">＋</button>
                              <span className="w-8 text-[11px] text-ink-soft">点</span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="mt-1 text-[10.5px] text-ink-soft">玩家在此地做该活动时扣除的行动点（0 = 免费）。每回合行动点上限在「出行」设置里调整。</p>
                    </div>
                  )}

                  {spotTab === "items" && (<>
                  {/* 点位物件：可在场景里拾取、收进行囊，拾取与使用均接入 AI 演绎 */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <label className="text-[10.5px] font-bold tracking-[0.16em] text-ink-soft">点位物件（可拾取入行囊 · 接入 AI 演绎）</label>
                      <span className="text-[10px] text-jade-deep/80">拾取 / 使用均交 AI 续写</span>
                    </div>
                    {items.length === 0 && <p className="text-[11.5px] text-ink-soft">暂无物件。物件名为空的不会出现在场景里。</p>}
                    <div className="space-y-2">
                      {items.map((it, i) => (
                        <div key={it.id} className="rounded-xl border border-line bg-paper-2 p-2.5">
                          <div className="mb-1.5 flex items-center gap-2">
                            <input
                              value={it.icon ?? ""}
                              onChange={(ev) => setItems(loc.id, items.map((x, j) => (j === i ? { ...x, icon: ev.target.value } : x)))}
                              placeholder=""
                              aria-label="物件图标"
                              className="h-8 w-9 shrink-0 rounded-md border border-line bg-paper text-center text-[15px] focus:border-jade focus:outline-none"
                            />
                            <input
                              value={it.name}
                              onChange={(ev) => setItems(loc.id, items.map((x, j) => (j === i ? { ...x, name: ev.target.value } : x)))}
                              placeholder="物件名（如：一封旧信 / 练功木剑）"
                              className="min-w-0 flex-1 rounded-md border border-line bg-paper px-2.5 py-1.5 text-[13px] font-semibold text-ink placeholder:font-normal placeholder:text-ink-soft/70 focus:border-jade focus:outline-none"
                            />
                            <button
                              onClick={async () => { if (!it.name.trim() || (await confirm(`删除物件「${it.name}」？`))) setItems(loc.id, items.filter((x) => x.id !== it.id)); }}
                              aria-label="删除该物件"
                              className="shrink-0 rounded-md border border-line px-2 py-1 text-[11.5px] text-ink-soft transition hover:border-danger/60 hover:text-danger"
                            >
                              删除
                            </button>
                          </div>
                          <textarea
                            value={it.desc}
                            onChange={(ev) => setItems(loc.id, items.map((x, j) => (j === i ? { ...x, desc: ev.target.value } : x)))}
                            placeholder="物件外观与来历描述（AI 可见）……"
                            rows={2}
                            className="w-full resize-y rounded-md border border-line bg-paper px-2.5 py-1.5 text-[12.5px] leading-relaxed text-ink placeholder:text-ink-soft/70 focus:border-jade focus:outline-none"
                          />
                          <input
                            value={it.prompt ?? ""}
                            onChange={(ev) => setItems(loc.id, items.map((x, j) => (j === i ? { ...x, prompt: ev.target.value } : x)))}
                            placeholder="拾取或使用时的 AI 剧情提示（可选，如：拆信看到某人的秘密 / 服下后灵力暴涨）"
                            className="mt-1.5 w-full rounded-md border border-line bg-paper px-2.5 py-1.5 text-[12px] text-ink placeholder:text-ink-soft/65 focus:border-jade focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setItems(loc.id, [...items, newItem()])}
                      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-jade/50 bg-jade/5 py-2 text-[12.5px] font-bold text-jade-deep transition hover:bg-jade/10"
                    >
                      <span className="text-[15px] leading-none">＋</span>添加物件
                    </button>
                  </div>

                  {/* 点位日常行动：在此地可随时执行的自定义行动，点击后接入 AI 演绎 */}
                  <div className="pt-2 border-t border-line/50">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <label className="text-[10.5px] font-bold tracking-[0.16em] text-ink-soft">点位专属行动（在「行动」菜单中随时可执行 · 接入 AI）</label>
                      <span className="text-[10px] text-jade-deep/80">点击即交 AI 演绎</span>
                    </div>
                    {acts.length === 0 && <p className="text-[11.5px] text-ink-soft">暂无自定义行动。可添加在此地常做的事（如：练声、泡温泉、查阅卷宗、打坐）。</p>}
                    <div className="space-y-2">
                      {acts.map((ac, i) => (
                        <div key={ac.id} className="rounded-xl border border-jade/35 bg-jade/[0.03] p-2.5">
                          <div className="mb-1.5 flex items-center gap-2">
                            <span className="text-[13px] font-bold text-jade"></span>
                            <input
                              value={ac.label}
                              onChange={(ev) => setActs(loc.id, acts.map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)))}
                              placeholder="行动名称（如：练声 / 泡温泉 / 翻阅古籍）"
                              className="min-w-0 flex-1 rounded-md border border-line bg-paper px-2.5 py-1.5 text-[13px] font-semibold text-ink placeholder:font-normal placeholder:text-ink-soft/70 focus:border-jade focus:outline-none"
                            />
                            <label className="flex shrink-0 items-center gap-1 text-[11px] text-ink-soft" title="消耗行动点">
                              <span>耗点</span>
                              <input
                                type="number"
                                min={0}
                                max={10}
                                value={ac.cost ?? 1}
                                onChange={(ev) => setActs(loc.id, acts.map((x, j) => (j === i ? { ...x, cost: Math.max(0, Math.min(10, Math.round(Number(ev.target.value) || 0))) } : x)))}
                                className="w-11 rounded-md border border-line bg-paper px-1.5 py-1 text-center text-[12px] tabular-nums text-ink focus:border-jade focus:outline-none"
                              />
                            </label>
                            <button
                              onClick={async () => { if (!ac.label.trim() || (await confirm(`删除行动「${ac.label}」？`))) setActs(loc.id, acts.filter((x) => x.id !== ac.id)); }}
                              aria-label="删除该行动"
                              className="shrink-0 rounded-md border border-line px-2 py-1 text-[11.5px] text-ink-soft transition hover:border-danger/60 hover:text-danger"
                            >
                              删除
                            </button>
                          </div>
                          <input
                            value={ac.hint ?? ""}
                            onChange={(ev) => setActs(loc.id, acts.map((x, j) => (j === i ? { ...x, hint: ev.target.value } : x)))}
                            placeholder="行动说明（显示在按钮下方，如：放松身心，可能偶遇熟人）"
                            className="mb-1.5 w-full rounded-md border border-line bg-paper px-2.5 py-1.5 text-[12px] text-ink placeholder:text-ink-soft/65 focus:border-jade focus:outline-none"
                          />
                          <textarea
                            value={ac.prompt ?? ""}
                            onChange={(ev) => setActs(loc.id, acts.map((x, j) => (j === i ? { ...x, prompt: ev.target.value } : x)))}
                            placeholder="AI 演绎提示词（可选：写下做这件事时的氛围、可能增长的能力或偶遇的人，AI 会据此演绎正文并结算）……"
                            rows={2}
                            className="w-full resize-y rounded-md border border-line bg-paper px-2.5 py-1.5 text-[12px] leading-relaxed text-ink placeholder:text-ink-soft/65 focus:border-jade focus:outline-none"
                          />
                          <div className="mt-1.5 text-[11px] text-ink-soft">
                            <span className="mb-1 block">数值效果（每次执行固定结算；资金填负数即收费，钱不够时无法执行）</span>
                            <BonusRow
                              value={ac.effects}
                              keys={{ ...Object.fromEntries(STAT_ORDER.map((k) => [k, STAT_LABELS[k]])), ...BONUS_EXTRA }}
                              onChange={(v) => setActs(loc.id, acts.map((x, j) => (j === i ? { ...x, effects: v } : x)))}
                            />
                          </div>
                          <div className="mt-1.5 text-[11px] text-ink-soft">
                            <span className="mb-1 block">执行门槛（各项需达到该值才能进行，如 名气 ≥ 50）</span>
                            <BonusRow
                              value={ac.require}
                              keys={{ ...Object.fromEntries(STAT_ORDER.map((k) => [k, STAT_LABELS[k]])), fame: "名气", ...BONUS_EXTRA }}
                              onChange={(v) => setActs(loc.id, acts.map((x, j) => (j === i ? { ...x, require: v } : x)))}
                            />
                          </div>
                          <label className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-soft">
                            每周最多
                            <input
                              type="number" min={0} max={99}
                              value={ac.perWeek ?? 0}
                              onChange={(ev) => setActs(loc.id, acts.map((x, j) => (j === i ? { ...x, perWeek: Math.max(0, Math.round(Number(ev.target.value) || 0)) || undefined } : x)))}
                              className="w-12 rounded-md border border-line bg-paper px-1.5 py-0.5 text-center text-[12px] tabular-nums text-ink focus:border-jade focus:outline-none"
                            />
                            次（0 = 不限）
                          </label>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setActs(loc.id, [...acts, newAct()])}
                      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-jade/50 bg-jade/5 py-2 text-[12.5px] font-bold text-jade-deep transition hover:bg-jade/10"
                    >
                      <span className="text-[15px] leading-none">＋</span>添加专属行动
                    </button>
                  </div>

                  {/* ── 地点商店：商品 = 0 行动点的购买行动 ── */}
                  {(() => {
                    const shop: ShopGood[] = e.shop ?? [];
                    const setShop = (next: ShopGood[]) => patch(loc.id, { shop: next.length ? next : undefined });
                    const put = (i: number, p: Partial<ShopGood>) => setShop(shop.map((x, j) => (j === i ? { ...x, ...p } : x)));
                    const keys = { ...Object.fromEntries(STAT_ORDER.map((k) => [k, STAT_LABELS[k]])), ...BONUS_EXTRA };
                    const field = "rounded-md border border-line bg-paper px-2.5 py-1.5 text-[12px] text-ink placeholder:text-ink-soft/65 focus:border-jade focus:outline-none";
                    return (
                      <div className="mt-4">
                        <p className="mb-1 text-[10.5px] font-bold tracking-[0.16em] text-ink-soft">地点商店</p>
                        {shop.length === 0 && <p className="mb-2 text-[11.5px] text-ink-soft">还没有商品。添加后，玩家来到这里就能购买（不耗行动点，按售价扣钱并结算效果）。</p>}
                        <div className="space-y-2">
                          {shop.map((it, i) => (
                            <div key={it.id} className="rounded-xl border border-coral/30 bg-coral/[0.03] p-2.5">
                              <div className="mb-1.5 flex items-center gap-2">
                                <input value={it.name} onChange={(ev) => put(i, { name: ev.target.value })} placeholder="商品名（如：蛋白粉 / 香水 / 演技教材）"
                                  className={`min-w-0 flex-1 font-semibold ${field}`} />
                                <label className="flex shrink-0 items-center gap-1 text-[11px] text-ink-soft">¥
                                  <input type="number" min={0} value={it.price} onChange={(ev) => put(i, { price: Math.max(0, Math.round(Number(ev.target.value) || 0)) })}
                                    className="w-20 rounded-md border border-line bg-paper px-1.5 py-1 text-right text-[12px] tabular-nums text-ink focus:border-jade focus:outline-none" />
                                </label>
                                <button onClick={async () => { if (!it.name.trim() || (await confirm(`删除商品「${it.name}」？`))) setShop(shop.filter((x) => x.id !== it.id)); }}
                                  className="shrink-0 rounded-md border border-line px-2 py-1 text-[11.5px] text-ink-soft transition hover:border-danger/60 hover:text-danger">删除</button>
                              </div>
                              <input value={it.desc ?? ""} onChange={(ev) => put(i, { desc: ev.target.value })} placeholder="商品说明（可选）" className={`mb-1.5 w-full ${field}`} />
                              <textarea value={it.replyPrompt ?? ""} onChange={(ev) => put(i, { replyPrompt: ev.target.value })} rows={2}
                                placeholder="AI 购买回复设定（可选：店员怎么接待、商品的细节、买下后可能发生什么）……"
                                className={`mb-1.5 w-full resize-y leading-relaxed ${field}`} />
                              <label className="mb-1.5 flex items-center gap-1.5 text-[11.5px] text-ink">
                                <input type="checkbox" checked={!!it.toBag} onChange={(ev) => put(i, { toBag: ev.target.checked || undefined })} className="accent-[var(--jade)]" />
                                买下后放进行囊（可查看、赠送给角色；已有时不能重复购买）
                              </label>
                              <div className="text-[11px] text-ink-soft">
                                <span className="mb-1 block">购买效果</span>
                                <BonusRow value={it.effects} keys={keys} onChange={(v) => put(i, { effects: v })} />
                              </div>
                              <div className="mt-1.5 text-[11px] text-ink-soft">
                                <span className="mb-1 block">购买门槛</span>
                                <BonusRow value={it.require} keys={{ ...keys, fame: "名气" }} onChange={(v) => put(i, { require: v })} />
                              </div>
                              <label className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-soft">每周限购
                                <input type="number" min={0} max={99} value={it.perWeek ?? 0} onChange={(ev) => put(i, { perWeek: Math.max(0, Math.round(Number(ev.target.value) || 0)) || undefined })}
                                  className="w-12 rounded-md border border-line bg-paper px-1.5 py-0.5 text-center text-[12px] tabular-nums text-ink focus:border-jade focus:outline-none" />
                                件（0 = 不限）
                              </label>
                            </div>
                          ))}
                        </div>
                        <button onClick={() => setShop([...shop, { id: `good_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, name: "", price: 100 }])}
                          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-coral/50 py-2 text-[12px] font-semibold text-coral transition hover:bg-coral/[0.05]">
                          <span className="text-[15px] leading-none">＋</span>添加商品
                        </button>
                      </div>
                    );
                  })()}
                  </>)}

                  {spotTab === "story" && (<>
                  {/* 剧情事件：为此点位写下「可做什么 / 会发生什么」，进入该地时可点击触发，交 AI 演绎 */}
                  <div>
                    <label className="mb-1.5 block text-[10.5px] font-bold tracking-[0.16em] text-ink-soft">剧情事件（进入此地即可触发）</label>
                    {events.length === 0 && <p className="text-[11.5px] text-ink-soft">暂无剧情事件。至少填写事件名与剧情种子才会出现。</p>}
                    <div className="space-y-2">
                      {events.map((ev, i) => (
                        <div key={ev.id} className="rounded-xl border border-coral/40 bg-coral/[0.04] p-2.5">
                          <div className="mb-1.5 flex items-center gap-2">
                            <span className="text-[14px] leading-none text-coral"></span>
                            <input
                              value={ev.title}
                              onChange={(evn) => setEvents(loc.id, events.map((x, j) => (j === i ? { ...x, title: evn.target.value } : x)))}
                              placeholder="事件名（如：雨夜的偶遇）"
                              className="min-w-0 flex-1 rounded-md border border-line bg-paper px-2.5 py-1.5 text-[13px] font-semibold text-ink placeholder:font-normal placeholder:text-ink-soft/70 focus:border-coral focus:outline-none"
                            />
                            <button
                              onClick={async () => { if (!ev.title.trim() || (await confirm(`删除事件「${ev.title}」？`))) setEvents(loc.id, events.filter((x) => x.id !== ev.id)); }}
                              aria-label="删除该事件"
                              className="shrink-0 rounded-md border border-line px-2 py-1 text-[11.5px] text-ink-soft transition hover:border-danger/60 hover:text-danger"
                            >
                              删除
                            </button>
                          </div>
                          <input
                            value={ev.annotation ?? ""}
                            onChange={(evn) => setEvents(loc.id, events.map((x, j) => (j === i ? { ...x, annotation: evn.target.value } : x)))}
                            placeholder="地图批注：这里能做什么 / 会发生什么"
                            className="mb-1.5 w-full rounded-md border border-line bg-paper px-2.5 py-1.5 text-[12.5px] text-ink placeholder:text-ink-soft/70 focus:border-coral focus:outline-none"
                          />
                          <textarea
                            value={ev.seed}
                            onChange={(evn) => setEvents(loc.id, events.map((x, j) => (j === i ? { ...x, seed: evn.target.value } : x)))}
                            placeholder="剧情种子：交给 AI 演绎的场景与走向……"
                            rows={2}
                            className="w-full resize-y rounded-md border border-line bg-paper px-2.5 py-1.5 text-[12.5px] leading-relaxed text-ink placeholder:text-ink-soft/70 focus:border-coral focus:outline-none"
                          />
                          <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 text-[11.5px] text-ink-soft">
                            <input
                              type="checkbox"
                              checked={!!ev.once}
                              onChange={(evn) => setEvents(loc.id, events.map((x, j) => (j === i ? { ...x, once: evn.target.checked } : x)))}
                              className="accent-coral"
                            />
                            一次性事件（触发后不再出现）
                          </label>
                          <label className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-ink-soft">
                            进入支线扣行程点
                            <input
                              type="number"
                              min={0}
                              max={5}
                              value={ev.energy ?? 1}
                              onChange={(evn) => setEvents(loc.id, events.map((x, j) => (j === i ? { ...x, energy: Math.max(0, Math.min(5, Math.round(Number(evn.target.value) || 0))) } : x)))}
                              className="w-14 rounded-md border border-line bg-paper px-1.5 py-0.5 text-[12px] text-ink focus:border-coral focus:outline-none"
                            />
                            <span className="text-ink-soft/70">支线内行动不再扣</span>
                          </label>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setEvents(loc.id, [...events, newEvent()])}
                      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-coral/50 bg-coral/5 py-2 text-[12.5px] font-bold text-coral transition hover:bg-coral/10"
                    >
                      <span className="text-[15px] leading-none">＋</span>添加剧情事件
                    </button>
                  </div>
                  </>)}

                  {edited && !e.custom && (
                    <button
                      onClick={() => resetSpot(loc.id)}
                      className="text-[11.5px] text-ink-soft underline-offset-2 transition hover:text-danger hover:underline"
                    >
                      清除此点位的全部自定义，恢复默认
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* 折叠分组：次要配置默认收起，避免一屏铺满 */
function Fold({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl bg-paper-2/60 ring-1 ring-line/60 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5">
        <span className="text-[13px] font-bold text-ink">{title}</span>
        {note && <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-soft">{note}</span>}
        <span className="ml-auto text-ink-soft transition group-open:rotate-90">›</span>
      </summary>
      <div className="space-y-3 px-3.5 pb-3.5">{children}</div>
    </details>
  );
}
