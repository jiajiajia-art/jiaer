import { useState } from "react";
import { useGame } from "../store/gameCtx";
import type { CustomSpotItem, MapEdits, MapSpotEdit, SpotEvent } from "../lib/types";
import { LOCATIONS } from "../game/data";
import { DEFAULT_PLAYER_ATTRIBUTES } from "../lib/playerAttributes";

/* 地图编辑器：玩家为地图上的每个点位覆写「名称 / 场景描述 / 背景图」，
 * 并新增可在场景里拾取、收进行囊的「点位物件」。所有覆写以点位 id 存入 GameState.mapEdits，
 * 留空即回落到世界内容池的默认值——与题材解耦，任何世界都通用。 */
const newItem = (): CustomSpotItem => ({
  id: `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  name: "",
  desc: "",
  icon: "◇",
});

const newEvent = (): SpotEvent => ({
  id: `evt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  title: "",
  annotation: "",
  seed: "",
  once: false,
  autoTrigger: true,
  probability: 30,
  requiredStat: "",
  requiredMin: 0,
});

const hasEdit = (e?: MapSpotEdit) =>
  !!e && (
    !!e.name?.trim() || !!e.desc?.trim() || !!e.background?.trim()
    || (e.items ?? []).some((it) => it.name.trim())
    || (e.events ?? []).some((ev) => ev.title.trim() || ev.seed.trim())
  );

export default function MapEditorPanel() {
  const { game, setMapEdits } = useGame();
  const [openId, setOpenId] = useState<string | null>(null);
  if (!game) return null;

  const edits: MapEdits = game.mapEdits ?? {};
  const editedCount = LOCATIONS.filter((l) => hasEdit(edits[l.id])).length;

  const patch = (roomId: string, part: Partial<MapSpotEdit>) => {
    const nextSpot: MapSpotEdit = { ...(edits[roomId] ?? {}), ...part };
    // 清掉全空的覆写，保持存档干净
    const clean = hasEdit(nextSpot) ? nextSpot : undefined;
    const next: MapEdits = { ...edits };
    if (clean) next[roomId] = clean;
    else delete next[roomId];
    setMapEdits(next);
  };
  const setItems = (roomId: string, items: CustomSpotItem[]) => patch(roomId, { items });
  const setEvents = (roomId: string, events: SpotEvent[]) => patch(roomId, { events });
  const resetSpot = (roomId: string) => {
    const next = { ...edits };
    delete next[roomId];
    setMapEdits(next);
  };
  const uploadBackground = (roomId: string, file?: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => patch(roomId, { background: String(reader.result ?? "") });
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-1.5">
      <p className="text-[12.5px] leading-relaxed text-ink-soft">
        为地图上的每个点位改名、重写场景描述、换背景、放置物件，或建立自己的概率事件库。
        事件会先由代码检查地点、属性门槛与概率，达标后才交给 AI 演绎。
      </p>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper/40 px-3 py-1.5">
        <span className="text-[11px] font-bold tracking-[0.22em] text-ink-soft">MAP EDITOR</span>
        <span className="h-3 w-px bg-line" />
        <span className="text-[12px] text-ink-soft">
          共 <span className="font-bold text-ink">{LOCATIONS.length}</span> 个点位 · 已自定义 <span className="font-bold text-jade-deep">{editedCount}</span> 个
        </span>
      </div>

      <div className="space-y-1.5">
        {LOCATIONS.map((loc) => {
          const e = edits[loc.id] ?? {};
          const items = e.items ?? [];
          const events = e.events ?? [];
          const open = openId === loc.id;
          const edited = hasEdit(e);
          const displayName = e.name?.trim() || loc.name;
          return (
            <div key={loc.id} className={`overflow-hidden rounded-2xl border transition ${edited ? "border-jade/50 bg-jade/[0.04]" : "border-line bg-paper/40"}`}>
              <button
                onClick={() => setOpenId(open ? null : loc.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left"
              >
                <span className="text-[15px] leading-none">{loc.icon || "◈"}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-bold text-ink">{displayName}</span>
                    {edited && <span className="shrink-0 rounded-full border border-jade/40 bg-jade/10 px-1.5 py-px text-[9.5px] font-bold text-jade-deep">已自定义</span>}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-ink-soft">
                    {loc.func}{items.length > 0 ? ` · ${items.length} 件物件` : ""}{events.length > 0 ? ` · ${events.length} 段剧情` : ""}
                  </span>
                </span>
                <span className={`shrink-0 text-[12px] text-ink-soft transition ${open ? "rotate-90" : ""}`}>›</span>
              </button>

              {open && (
                <div className="space-y-2 border-t border-line/60 px-3 py-2.5">
                  <div>
                    <label className="mb-1 block text-[10.5px] font-bold tracking-[0.16em] text-ink-soft">点位名称</label>
                    <input
                      value={e.name ?? ""}
                      onChange={(ev) => patch(loc.id, { name: ev.target.value })}
                      placeholder={loc.name}
                      className="w-full rounded-lg border border-line bg-paper-2 px-2.5 py-1.5 text-[13.5px] font-bold text-ink placeholder:font-normal placeholder:text-ink-soft/70 focus:border-jade focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10.5px] font-bold tracking-[0.16em] text-ink-soft">场景描述（进入此地时的旁白）</label>
                    <textarea
                      value={e.desc ?? ""}
                      onChange={(ev) => patch(loc.id, { desc: ev.target.value })}
                      placeholder="留空则沿用默认描述……"
                      rows={2}
                      className="w-full resize-y rounded-lg border border-line bg-paper-2 px-2.5 py-2 text-[13px] leading-relaxed text-ink placeholder:text-ink-soft/70 focus:border-jade focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10.5px] font-bold tracking-[0.16em] text-ink-soft">背景图 URL</label>
                    <div className="mb-1.5 flex items-center gap-2">
                      <label className="cursor-pointer rounded-lg border border-dashed border-jade/60 px-2.5 py-1.5 text-[11px] font-semibold text-jade transition hover:bg-jade/10">
                        上传本地图片
                        <input type="file" accept="image/*" className="sr-only" onChange={(ev) => { uploadBackground(loc.id, ev.target.files?.[0]); ev.currentTarget.value = ""; }} />
                      </label>
                      <span className="text-[10px] text-ink-soft">支持 JPG / PNG / WebP</span>
                    </div>
                    <input
                      value={e.background ?? ""}
                      onChange={(ev) => patch(loc.id, { background: ev.target.value })}
                      placeholder="https://…（贴一张图片直链，留空用默认实景）"
                      className="w-full rounded-lg border border-line bg-paper-2 px-2.5 py-1.5 font-mono text-[11.5px] text-ink placeholder:font-sans placeholder:text-ink-soft/70 focus:border-jade focus:outline-none"
                    />
                    {e.background?.trim() && (
                      <div className="mt-2 overflow-hidden rounded-lg border border-line bg-jade-deep/10">
                        <img src={e.background} alt="背景预览" className="h-24 w-full object-cover" loading="lazy" />
                      </div>
                    )}
                  </div>

                  {/* 点位物件：可在场景里拾取、收进行囊 */}
                  <div>
                    <label className="mb-1.5 block text-[10.5px] font-bold tracking-[0.16em] text-ink-soft">点位物件（可被拾取入行囊）</label>
                    <div className="space-y-2">
                      {items.map((it, i) => (
                        <div key={it.id} className="rounded-lg border border-line bg-paper-2 p-2">
                          <div className="mb-1.5 flex items-center gap-2">
                            <input
                              value={it.icon ?? ""}
                              onChange={(ev) => setItems(loc.id, items.map((x, j) => (j === i ? { ...x, icon: ev.target.value } : x)))}
                              placeholder="◇"
                              aria-label="物件图标"
                              className="h-8 w-9 shrink-0 rounded-md border border-line bg-paper text-center text-[15px] focus:border-jade focus:outline-none"
                            />
                            <input
                              value={it.name}
                              onChange={(ev) => setItems(loc.id, items.map((x, j) => (j === i ? { ...x, name: ev.target.value } : x)))}
                              placeholder="物件名（如：一封旧信）"
                              className="min-w-0 flex-1 rounded-md border border-line bg-paper px-2.5 py-1.5 text-[13px] font-semibold text-ink placeholder:font-normal placeholder:text-ink-soft/70 focus:border-jade focus:outline-none"
                            />
                            <button
                              onClick={() => setItems(loc.id, items.filter((_, j) => j !== i))}
                              aria-label="删除该物件"
                              className="shrink-0 rounded-md border border-line px-2 py-1 text-[11.5px] text-ink-soft transition hover:border-danger/60 hover:text-danger"
                            >
                              删除
                            </button>
                          </div>
                          <textarea
                            value={it.desc}
                            onChange={(ev) => setItems(loc.id, items.map((x, j) => (j === i ? { ...x, desc: ev.target.value } : x)))}
                            placeholder="物件描述……"
                            rows={2}
                            className="w-full resize-y rounded-md border border-line bg-paper px-2.5 py-1.5 text-[12.5px] leading-relaxed text-ink placeholder:text-ink-soft/70 focus:border-jade focus:outline-none"
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

                  {/* 剧情事件：为此点位写下「可做什么 / 会发生什么」，进入该地时可点击触发，交 AI 演绎 */}
                  <div>
                    <label className="mb-1.5 block text-[10.5px] font-bold tracking-[0.16em] text-ink-soft">剧情事件（进入此地即可触发）</label>
                    <div className="space-y-2">
                      {events.map((ev, i) => (
                        <div key={ev.id} className="rounded-lg border border-coral/40 bg-coral/[0.04] p-2">
                          <div className="mb-1.5 flex items-center gap-2">
                            <span className="text-[14px] leading-none text-coral">✦</span>
                            <input
                              value={ev.title}
                              onChange={(evn) => setEvents(loc.id, events.map((x, j) => (j === i ? { ...x, title: evn.target.value } : x)))}
                              placeholder="事件名（如：雨夜的偶遇）"
                              className="min-w-0 flex-1 rounded-md border border-line bg-paper px-2.5 py-1.5 text-[13px] font-semibold text-ink placeholder:font-normal placeholder:text-ink-soft/70 focus:border-coral focus:outline-none"
                            />
                            <button
                              onClick={() => setEvents(loc.id, events.filter((_, j) => j !== i))}
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
                          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                            <label className="text-[11px] text-ink-soft">触发概率（%）<input type="number" min={0} max={100} value={ev.probability ?? 100} onChange={(evn) => setEvents(loc.id, events.map((x, j) => j === i ? { ...x, probability: Math.max(0, Math.min(100, Number(evn.target.value) || 0)) } : x))} className="mt-1 w-full rounded-md border border-line bg-paper px-2 py-1.5" /></label>
                            <label className="text-[11px] text-ink-soft">达标属性<select value={ev.requiredStat ?? ""} onChange={(evn) => setEvents(loc.id, events.map((x, j) => j === i ? { ...x, requiredStat: evn.target.value } : x))} className="mt-1 w-full rounded-md border border-line bg-paper px-2 py-1.5"><option value="">无门槛</option>{(game.playerAttributeSchema ?? DEFAULT_PLAYER_ATTRIBUTES).map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}</select></label>
                            <label className="text-[11px] text-ink-soft">最低数值<input type="number" min={0} value={ev.requiredMin ?? 0} disabled={!ev.requiredStat} onChange={(evn) => setEvents(loc.id, events.map((x, j) => j === i ? { ...x, requiredMin: Math.max(0, Number(evn.target.value) || 0) } : x))} className="mt-1 w-full rounded-md border border-line bg-paper px-2 py-1.5 disabled:opacity-40" /></label>
                          </div>
                          <label className="mt-2 flex cursor-pointer items-center gap-1.5 text-[11.5px] text-ink-soft"><input type="checkbox" checked={ev.autoTrigger !== false} onChange={(evn) => setEvents(loc.id, events.map((x, j) => j === i ? { ...x, autoTrigger: evn.target.checked } : x))} className="accent-coral" />抵达此地点时自动判定</label>
                          <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 text-[11.5px] text-ink-soft">
                            <input
                              type="checkbox"
                              checked={!!ev.once}
                              onChange={(evn) => setEvents(loc.id, events.map((x, j) => (j === i ? { ...x, once: evn.target.checked } : x)))}
                              className="accent-coral"
                            />
                            一次性事件（触发后不再出现）
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

                  {edited && (
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
