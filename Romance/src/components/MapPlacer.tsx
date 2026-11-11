import { useEffect, useRef, useState } from "react";

/* 地图编辑器 · 直接在底图上标点：点图钉选中、拖动图钉移动、点空白处把选中的地点放过去。
 * 右上角或滚轮放大，放大后拖空白处平移。 */
export type PlacerDot = { id: string; x: number; y: number; label: string };

export default function MapPlacer({ bg, dots, activeId, onPick, onPlace }: {
  bg?: string;
  dots: PlacerDot[];
  activeId?: string | null;
  onPick: (id: string) => void;
  onPlace: (id: string, x: number, y: number) => void;
}) {
  const [z, setZ] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [temp, setTemp] = useState<{ id: string; x: number; y: number } | null>(null);
  const drag = useRef<{ sx: number; sy: number; px: number; py: number; moved: boolean; pin?: string } | null>(null);
  const inner = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const zoom = (nz: number) => {
    const c = Math.min(4, Math.max(1, Math.round(nz * 10) / 10));
    setZ(c);
    if (c === 1) setPan({ x: 0, y: 0 });
  };
  const zr = useRef(zoom); zr.current = zoom;
  const zv = useRef(z); zv.current = z;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const h = (e: WheelEvent) => { e.preventDefault(); zr.current(zv.current * (e.deltaY < 0 ? 1.2 : 1 / 1.2)); };
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, []);
  const pct = (cx: number, cy: number) => {
    const r = inner.current!.getBoundingClientRect(); // 已含缩放/平移
    return { x: Math.min(100, Math.max(0, Math.round(((cx - r.left) / r.width) * 1000) / 10)), y: Math.min(100, Math.max(0, Math.round(((cy - r.top) / r.height) * 1000) / 10)) };
  };
  const clamp = (v: number, size: number) => Math.min(0, Math.max(-(z - 1) * size, v));
  const shown = dots.map((d) => (temp?.id === d.id ? { ...d, x: temp.x, y: temp.y } : d));

  return (
    <div
      ref={box}
      className="relative aspect-[16/10] w-full touch-none select-none overflow-hidden rounded-xl border border-line bg-paper-2"
      onPointerDown={(e) => {
        const pin = (e.target as HTMLElement).closest("[data-pin]")?.getAttribute("data-pin") ?? undefined;
        if (pin) onPick(pin);
        drag.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y, moved: false, pin };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
        if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
        if (!d.moved) return;
        if (d.pin) setTemp({ id: d.pin, ...pct(e.clientX, e.clientY) });
        else if (z > 1) { const r = e.currentTarget.getBoundingClientRect(); setPan({ x: clamp(d.px + dx, r.width), y: clamp(d.py + dy, r.height) }); }
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        if (d.pin) { if (d.moved) { const p = pct(e.clientX, e.clientY); onPlace(d.pin, p.x, p.y); } setTemp(null); return; }
        if (!d.moved && activeId) { const p = pct(e.clientX, e.clientY); onPlace(activeId, p.x, p.y); }
      }}
    >
      <div
        ref={inner}
        className={`absolute inset-0 origin-top-left bg-cover bg-center ${activeId ? "cursor-crosshair" : z > 1 ? "cursor-grab" : ""}`}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${z})`,
          ...(bg ? { backgroundImage: `url(${bg})` } : { backgroundImage: "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)", backgroundSize: "10% 10%" }),
        }}
      >
        {shown.map((o) => {
          const on = o.id === activeId;
          return (
            <span key={o.id} data-pin={o.id} className={`absolute flex origin-bottom -translate-x-1/2 -translate-y-full cursor-grab flex-col items-center ${on ? "z-10" : ""}`} style={{ left: `${o.x}%`, top: `${o.y}%`, scale: `${1 / z}` }}>
              <span className={`whitespace-nowrap rounded-full border px-1.5 py-px text-[10px] font-bold shadow ${on ? "border-coral bg-coral text-white" : "border-line bg-paper/90 text-ink"}`}>{o.label}</span>
              <span className={`block h-2.5 w-2.5 rounded-full border-2 border-white shadow ${on ? "bg-coral" : "bg-jade"}`} />
            </span>
          );
        })}
      </div>
      <div className="absolute right-1.5 top-1.5 flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => zoom(z / 1.4)} disabled={z === 1} className="h-7 w-7 rounded-full border border-line bg-paper/90 text-[14px] font-bold text-ink shadow disabled:opacity-40" aria-label="缩小">−</button>
        <span className="rounded-full bg-paper/90 px-1.5 text-[10px] tabular-nums text-ink-soft">{Math.round(z * 100)}%</span>
        <button type="button" onClick={() => zoom(z * 1.4)} disabled={z === 4} className="h-7 w-7 rounded-full border border-line bg-paper/90 text-[14px] font-bold text-ink shadow disabled:opacity-40" aria-label="放大">＋</button>
      </div>
    </div>
  );
}
