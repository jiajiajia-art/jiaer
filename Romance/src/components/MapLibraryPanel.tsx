import { IconStar } from "../lib/icons";
import { useRef, useState } from "react";
import type { MapEdits } from "../lib/types";
import { getWorld } from "../mods/registry";
import { PUBLIC_MAPS, addSpots } from "../game/publicMaps";
import { readLibrary, writeLibrary, type MapPreset } from "../game/mapStart";

/* 地图编辑器 · 地图库：把当前地图存进个人库 / 套用 / 设为开局地图 / 导出分享文件给其他创作者 */
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";

export default function MapLibraryPanel({ edits, apply, confirm }: {
  edits: MapEdits;
  apply: (e: MapEdits) => void;
  confirm: (msg: string, o?: { ok?: string }) => Promise<boolean>;
}) {
  const world = getWorld().worldId;
  const [list, setList] = useState<MapPreset[]>(readLibrary);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const commit = (next: MapPreset[], ok: string) => {
    if (writeLibrary(next)) { setList(next); setMsg(ok); }
    else setMsg("保存失败：本地存储已满。底图请尽量用图片直链，少用上传。");
  };
  const empty = !Object.keys(edits).some((k) => k !== "_config") && !edits._config?.bgUrl && !edits._config?.sheets?.length;
  const save = () => {
    const p: MapPreset = { id: `map_${Date.now().toString(36)}`, name: name.trim() || `我的地图预设 ${list.length + 1}`, world, edits: JSON.parse(JSON.stringify(edits)), at: Date.now() };
    commit([p, ...list], `已保存「${p.name}」`);
    setName("");
  };
  const download = (p: MapPreset) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ kind: "star-map", ...p, useOnStart: undefined }, null, 2)], { type: "application/json" }));
    Object.assign(document.createElement("a"), { href: url, download: `${p.name}.map.json` }).click();
    URL.revokeObjectURL(url);
  };
  const importFile = async (f?: File) => {
    if (!f) return;
    try {
      const raw = JSON.parse(await f.text());
      if (!raw?.edits || typeof raw.edits !== "object") throw new Error("不是地图分享文件");
      commit([{ id: `map_${Date.now().toString(36)}`, name: String(raw.name ?? f.name), world: String(raw.world ?? world), edits: raw.edits, at: Date.now() }, ...list], `已导入「${raw.name ?? f.name}」`);
    } catch (e) { setMsg(`导入失败：${(e as Error).message}`); }
  };
  const mine = [...list].sort((a, b) => Number(b.world === world) - Number(a.world === world));

  return (
    <div className="space-y-2.5 rounded-2xl border border-line bg-paper/40 p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-[0.16em] text-ink-soft">地图库 · {list.length}</span>
        <button type="button" className={btn} onClick={() => file.current?.click()}>导入分享文件</button>
        <input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      <p className="text-[11px] leading-relaxed text-ink-soft">把当前地图存进个人库，随时套用；标「开局使用」的那份会在新开局时自动铺好（含开局起点）。想分享给其他创作者，导出文件发给对方导入即可。</p>
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="预设名称，如：修仙大陆" className="min-w-0 flex-1 rounded-lg border border-line bg-paper-2 px-2.5 py-1.5 text-[12.5px] text-ink focus:border-jade focus:outline-none" />
        <button type="button" disabled={empty} onClick={save} className="shrink-0 rounded-lg border border-jade/50 bg-jade/10 px-3 text-[12px] font-bold text-jade-deep hover:bg-jade/20 disabled:opacity-40">保存到我的库</button>
      </div>
      <button type="button" disabled={empty} onClick={() => {
        download({ id: "share", name: name.trim() || "我的地图", world, edits, at: Date.now() });
        setMsg("已导出分享文件。暂无在线公共库，请把文件发给其他创作者，对方用「导入分享文件」即可使用。");
      }} className="w-full rounded-lg border border-dashed border-line py-1.5 text-[12px] font-semibold text-ink-soft hover:border-jade hover:text-jade disabled:opacity-40">申请公开分享（导出分享文件）</button>

      <p className="pt-1 text-[10.5px] font-bold tracking-[0.16em] text-ink-soft">公共地图</p>
      <div className="grid grid-cols-2 gap-1.5">
        {PUBLIC_MAPS.map((m) => (
          <button key={m.id} type="button"
            onClick={async () => {
              if (!(await confirm(`套用「${m.name}」？将新增一张底图「${m.name}」和 ${m.spots.length} 个地点（依次相连，首个连到开局地点），不影响现有地点。`, { ok: "套用" }))) return;
              apply(addSpots(edits, m.spots, { sheetName: m.name }));
              setMsg(`已套用「${m.name}」，可在下方「地图底图」切到它上传底图`);
            }}
            className="rounded-xl border border-line bg-paper/60 px-2.5 py-2 text-left transition hover:border-jade">
            <span className="block truncate text-[12.5px] font-bold text-ink">{m.name}</span>
            <span className="block truncate text-[10.5px] text-ink-soft">{m.tag} · {m.spots.length} 处</span>
          </button>
        ))}
      </div>
      <p className="pt-1 text-[10.5px] font-bold tracking-[0.16em] text-ink-soft">我的地图</p>
      {msg && <p className="text-[11px] text-jade-deep">{msg}</p>}
      {!list.length && <p className="rounded-lg border border-dashed border-line py-3 text-center text-[11.5px] text-ink-soft">库里还没有地图</p>}
      <ul className="space-y-1.5">
        {mine.map((p) => {
          const other = p.world !== world;
          const n = Object.keys(p.edits).filter((k) => k !== "_config").length;
          const bg = p.edits._config?.bgUrl ?? p.edits._config?.sheets?.find((x) => x.bgUrl)?.bgUrl;
          return (
            <li key={p.id} className={`flex items-center gap-2 rounded-xl border p-1.5 ${p.useOnStart && !other ? "border-coral/60 bg-coral/[0.05]" : "border-line bg-paper/60"} ${other ? "opacity-60" : ""}`}>
              <span className="h-9 w-12 shrink-0 overflow-hidden rounded-md border border-line bg-paper-2">{bg && <img src={(bg) || undefined} alt="" className="h-full w-full object-cover" />}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-bold text-ink">{p.useOnStart && !other ? <IconStar size={12} className="mr-0.5 inline" /> : null}{p.name}</span>
                <span className="block truncate text-[10.5px] text-ink-soft">{other ? `其他世界观 · ${p.world}` : `${n} 个地点 · ${(p.edits._config?.sheets?.length ?? 0) || 1} 张底图`}</span>
              </span>
              <span className="flex shrink-0 flex-wrap justify-end gap-1">
                <button type="button" className={btn} disabled={other} onClick={async () => { if (await confirm(`套用「${p.name}」？当前存档的地图设置会被替换。`, { ok: "套用" })) { apply(JSON.parse(JSON.stringify(p.edits))); setMsg(`已套用「${p.name}」`); } }}>套用</button>
                <button type="button" className={btn} disabled={other} onClick={() => commit(list.map((x) => (x.world === world ? { ...x, useOnStart: x.id === p.id ? !p.useOnStart : false } : x)), p.useOnStart ? "已取消开局使用" : `新开局将使用「${p.name}」`)}>{p.useOnStart ? "取消开局" : "开局使用"}</button>
                <button type="button" className={btn} onClick={() => download(p)}>导出</button>
                <button type="button" className={`${btn} hover:!text-danger`} onClick={async () => { if (await confirm(`删除「${p.name}」？`, { ok: "删除" })) commit(list.filter((x) => x.id !== p.id), "已删除"); }}>删除</button>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
