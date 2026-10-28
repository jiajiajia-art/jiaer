import { useRef, useState } from "react";
import type { MapSheet } from "../lib/types";
import { MAIN_SHEET } from "../game/mapSheets";
import { IconChevronDown, IconChevronUp } from "../lib/icons";

/* 地图编辑器 · 地图底图：多张底图（添加 / 改名 / 上传 / 拖拽排序 / 删除），选中的底图即当前编辑底图 */
const inp = "w-full min-w-0 rounded-lg border border-line bg-paper-2 px-2.5 py-1.5 text-[12.5px] text-ink placeholder:text-ink-soft/70 focus:border-jade focus:outline-none";

export default function MapSheetsEditor({ sheets, cur, setCur, onChange, countOf, onRemove }: {
  sheets: MapSheet[];
  cur: string;
  setCur: (id: string) => void;
  onChange: (next: MapSheet[]) => void;
  countOf: (id: string) => number;
  onRemove: (id: string) => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const sheet = sheets.find((s) => s.id === cur) ?? sheets[0];
  const patch = (id: string, p: Partial<MapSheet>) => onChange(sheets.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= sheets.length || from === to) return;
    const next = [...sheets];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  };
  const add = () => {
    const id = `sheet_${Date.now().toString(36)}`;
    onChange([...sheets, { id, name: `底图 ${sheets.length + 1}` }]);
    setCur(id);
  };
  const upload = (f?: File) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => patch(sheet.id, { bgUrl: String(r.result) });
    r.readAsDataURL(f);
  };
  const bg = sheet.bgUrl ?? "";

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-bold tracking-[0.16em] text-ink-soft">地图底图 · {sheets.length} 张</span>
        <button type="button" onClick={add} className="rounded-full border border-jade/50 bg-jade/10 px-3 py-1 text-[11.5px] font-bold text-jade-deep hover:bg-jade/20">＋ 添加底图</button>
      </div>
      <p className="text-[11px] leading-relaxed text-ink-soft">地点标点保存到所属底图，游玩时用箭头切换。拖拽 ⠿ 调整切换顺序；选中哪张，下方「选择地点」就只显示哪张的地点。</p>

      <ol className="space-y-1.5">
        {sheets.map((s, i) => {
          const on = s.id === sheet.id;
          return (
            <li
              key={s.id}
              draggable
              onDragStart={() => setDrag(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (drag !== null) move(drag, i); setDrag(null); }}
              onDragEnd={() => setDrag(null)}
              className={`flex items-center gap-2 rounded-xl border p-1.5 transition ${on ? "border-jade bg-jade/10" : "border-line bg-paper/60"} ${drag === i ? "opacity-40" : ""}`}
            >
              <span className="cursor-grab select-none px-1 text-[15px] text-ink-soft" aria-hidden>⠿</span>
              <button type="button" onClick={() => setCur(s.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <span className="h-9 w-14 shrink-0 overflow-hidden rounded-md border border-line bg-paper-2">
                  {s.bgUrl ? <img src={(s.bgUrl) || undefined} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-[10px] text-ink-soft">无图</span>}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-bold text-ink">{i + 1}. {s.name || "未命名"}</span>
                  <span className="block text-[10.5px] text-ink-soft">{countOf(s.id)} 个地点{s.id === MAIN_SHEET ? " · 主地图" : ""}</span>
                </span>
              </button>
              <span className="flex shrink-0 flex-col">
                <button type="button" disabled={!i} onClick={() => move(i, i - 1)} className="px-1 text-[10px] leading-tight text-ink-soft disabled:opacity-25" aria-label="上移"><IconChevronUp size={12} /></button>
                <button type="button" disabled={i === sheets.length - 1} onClick={() => move(i, i + 1)} className="px-1 text-[10px] leading-tight text-ink-soft disabled:opacity-25" aria-label="下移"><IconChevronDown size={12} /></button>
              </span>
            </li>
          );
        })}
      </ol>

      {/* 当前底图详情 */}
      <div className="space-y-2 rounded-xl border border-line bg-paper/60 p-2.5">
        <div className="flex gap-2">
          <input className={inp} value={sheet.name} onChange={(e) => patch(sheet.id, { name: e.target.value })} placeholder="底图名称，如：城区全图 / 校园局部" />
          {sheet.id !== MAIN_SHEET && (
            <button type="button" onClick={() => onRemove(sheet.id)} className="shrink-0 rounded-lg border border-line px-2.5 text-[12px] text-ink-soft hover:border-danger/60 hover:text-danger">删除</button>
          )}
        </div>
        <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
        <div className="flex gap-2">
          <button type="button" onClick={() => file.current?.click()} className="flex-1 rounded-lg border border-jade/50 bg-jade/10 py-1.5 text-[12.5px] font-bold text-jade-deep hover:bg-jade/20">上传底图图片</button>
          {bg && <button type="button" onClick={() => patch(sheet.id, { bgUrl: undefined })} className="shrink-0 rounded-lg border border-line px-3 text-[12px] text-ink-soft hover:text-danger">清除</button>}
        </div>
        <input
          className={`${inp} font-mono text-[11.5px]`}
          value={bg.startsWith("data:") ? "" : bg}
          onChange={(e) => patch(sheet.id, { bgUrl: e.target.value || undefined })}
          placeholder={bg.startsWith("data:") ? "已上传本地图片（可改贴直链）" : sheet.id === MAIN_SHEET ? "或粘贴直链 https://…（留空用世界观默认底图）" : "或粘贴图片直链 https://…"}
        />
        {bg && <img src={(bg) || undefined} alt="底图预览" className="h-28 w-full rounded-lg border border-line object-cover" loading="lazy" />}
      </div>
    </div>
  );
}
