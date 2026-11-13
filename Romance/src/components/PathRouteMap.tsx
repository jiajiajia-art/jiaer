import type { RouteNode } from "../lib/pathRoute";

/* 人物线路路线图：节点按顺序串成一条线。横向（默认，可横滑）/ 竖向两种排布；可选节点用虚线圈表示 */
export default function PathRouteMap({ nodes, vertical = false, active = false }: { nodes: RouteNode[]; vertical?: boolean; active?: boolean }) {
  if (!nodes.length) return null;
  const tone = active ? "border-jade bg-jade text-paper" : "border-jade/60 bg-paper text-jade";
  const dot = (n: RouteNode, i: number) => (
    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] font-bold tabular-nums transition ${n.optional ? "border-dashed border-ink-soft/60 bg-paper text-ink-soft" : tone}`}>{i + 1}</span>
  );

  if (vertical) {
    return (
      <ol className="relative space-y-2" aria-label="线路路线">
        {nodes.map((n, i) => (
          <li key={n.id + i} className="relative flex items-start gap-2.5">
            {i < nodes.length - 1 && <span className="absolute left-[9.5px] top-5 h-[calc(100%+0.5rem-1.25rem)] w-px bg-jade/30" aria-hidden />}
            {dot(n, i)}
            <span className={`pt-0.5 text-[12px] leading-snug ${n.optional ? "text-ink-soft" : "text-ink"}`}>{n.name}{n.optional && <span className="ml-1 text-[10px] text-ink-soft">可选</span>}</span>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
      <ol className="flex min-w-max items-start" aria-label="线路路线">
        {nodes.map((n, i) => (
          <li key={n.id + i} className="relative flex w-[76px] shrink-0 flex-col items-center text-center">
            {i > 0 && <span className="absolute right-1/2 top-2.5 mr-3 h-px w-[calc(100%-1.5rem)] bg-jade/30" aria-hidden />}
            {dot(n, i)}
            <span className={`mt-1 line-clamp-2 px-0.5 text-[10.5px] leading-tight ${n.optional ? "text-ink-soft" : "text-ink/85"}`} title={n.name}>{n.name}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
