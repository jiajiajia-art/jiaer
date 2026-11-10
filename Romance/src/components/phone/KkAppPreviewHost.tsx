/**
 * 手机应用实时预览宿主（/romance/?kkappPreview=1）：
 * 平台创作页用 iframe 嵌入，postMessage 推送 {type:"kkapp-preview", spec, name}；
 * 用与游戏内完全相同的 KkAppView 渲染，数值走沙盒，不读写任何存档。
 */
import { useEffect, useMemo, useState } from "react";
import { KkAppView, type KkAppRuntime } from "./KkAppRenderer";
import { kkSandboxApply, kkSandboxCond, kkSandboxInit, kkSandboxRead, normalizeKkApp, type KkAppSpec, type KkSandbox } from "../../mods/kkmod/phoneApp";

export const KKAPP_PREVIEW_QUERY = "kkappPreview";
export const isKkAppPreviewRoute = () => {
  try { return new URLSearchParams(location.search).get(KKAPP_PREVIEW_QUERY) === "1"; } catch { return false; }
};

const METRIC_LABEL: Record<string, string> = { money: "金钱", stress: "压力", energy: "行动力", fame: "名气", reputation: "口碑", works: "作品" };
const labelOf = (m: string) => METRIC_LABEL[m] ?? (m.startsWith("c:") ? m.slice(2) : m);

export default function KkAppPreviewHost() {
  const [spec, setSpec] = useState<KkAppSpec | null>(null);
  const [name, setName] = useState("应用预览");
  const [box, setBox] = useState<KkSandbox>(() => kkSandboxInit(null));
  const [runs, setRuns] = useState<Record<string, number>>({});
  const [viewKey, setViewKey] = useState(0);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin) return;
      const d = e.data as { type?: string; spec?: unknown; name?: string } | null;
      if (!d || d.type !== "kkapp-preview") return;
      const next = normalizeKkApp(d.spec);
      setSpec(next);
      if (typeof d.name === "string" && d.name.trim()) setName(d.name.trim());
      // 功能注释：新出现的属性补进沙盒，已调过的数值保留
      setBox((b) => { const init = kkSandboxInit(next); return { ...b, metrics: { ...init.metrics, ...b.metrics } }; });
    };
    window.addEventListener("message", onMsg);
    window.parent?.postMessage({ type: "kkapp-preview-ready" }, location.origin);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const rt: KkAppRuntime = useMemo(() => ({
    ready: true,
    day: box.day,
    read: (m) => kkSandboxRead(box, m),
    condsOk: (conds) => !conds?.length || conds.every((c) => kkSandboxCond(c, box)),
    lastRun: (id) => runs[id] ?? 0,
    apply: (a, id) => {
      const { next, changes } = kkSandboxApply(a.effects ?? [], box, labelOf);
      setBox(next);
      if (a.once || a.cooldownDays) setRuns((r) => ({ ...r, [id]: box.day + 1 }));
      return changes;
    },
  }), [box, runs]);

  const reset = () => { setBox(kkSandboxInit(spec)); setRuns({}); setViewKey((k) => k + 1); };
  const metrics = Object.keys(box.metrics);

  return (
    <div className="flex min-h-screen flex-col items-center gap-3 bg-[#eef0f4] px-3 py-4 text-[#181818]">
      <div className="relative h-[640px] w-[320px] overflow-hidden rounded-[44px] border-[10px] border-[#111] bg-white shadow-[0_20px_50px_-20px_rgba(0,0,0,0.45)]">
        <div className="absolute left-1/2 top-2 z-10 h-[22px] w-[86px] -translate-x-1/2 rounded-full bg-[#111]" aria-hidden />
        <div className="h-full pt-8">
          {spec ? (
            <KkAppView key={viewKey} name={name} spec={spec} rt={rt} onBack={() => setViewKey((k) => k + 1)} />
          ) : (
            <p className="px-6 pt-24 text-center text-[13px] text-black/45">在左侧对话生成或填写应用配置后，这里实时显示效果</p>
          )}
        </div>
      </div>

      <section className="w-[320px] rounded-2xl bg-white px-3 py-2.5 shadow-sm" aria-label="沙盒数值">
        <div className="mb-1.5 flex items-center gap-2">
          <b className="text-[12.5px]">沙盒数值</b>
          <span className="text-[11px] text-black/45">第 {box.day} 天 · 不写存档</span>
          <button type="button" onClick={() => setBox({ ...box, day: box.day + 1 })} className="ml-auto rounded-full border border-black/10 px-2 py-0.5 text-[11px]">过一天</button>
          <button type="button" onClick={reset} className="rounded-full border border-black/10 px-2 py-0.5 text-[11px]">重置</button>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {metrics.map((m) => (
            <label key={m} className="flex items-center gap-1.5 rounded-lg bg-[#f2f2f7] px-2 py-1 text-[11.5px]">
              <span className="min-w-0 flex-1 truncate">{labelOf(m)}</span>
              <input type="number" value={box.metrics[m]} onChange={(e) => setBox({ ...box, metrics: { ...box.metrics, [m]: Number(e.target.value) || 0 } })}
                className="w-16 rounded bg-white px-1 py-0.5 text-right tabular-nums outline-none" aria-label={labelOf(m)} />
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}
