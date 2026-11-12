import { useState } from "react";
import { createPortal } from "react-dom";
import { artStyleSampleUrl, type ArtStylePreset } from "../lib/editorImagePrompts";
import { useArtStylePresets } from "../lib/platformArtStyles";

/** 功能注释：示例图——本机生成过的优先，其次 public 固定示例；都加载失败显示画风色块 */
function Sample({ p, className }: { p: ArtStylePreset; className?: string }) {
  const { local, bundled } = artStyleSampleUrl(p.id);
  // 功能注释：后台配置的示例图优先，其次本机生成过的，再次内置示例
  const srcs = [p.sampleUrl, local, bundled].filter(Boolean) as string[];
  const [idx, setIdx] = useState(0);
  const src = srcs[idx];
  return (
    <span className={`relative block overflow-hidden ${className ?? ""}`} style={{ background: p.swatch }}>
      {src ? (
        <img src={src} alt={`${p.label}示例`} loading="lazy" className="h-full w-full object-cover" onError={() => setIdx((i) => i + 1)} />
      ) : (
        <span className="absolute inset-0 grid place-items-center text-[9px] font-semibold text-white/80 drop-shadow">暂无</span>
      )}
    </span>
  );
}

/**
 * 功能注释：画风选择——三列芯片（小缩略图 + 名称）；点芯片填入画风，点放大镜看示例大图。
 * 画风正向词由运营后台配置，创作者端不展示、不手改。onChange 第二参供外层并入该画风负面词。
 */
export default function ArtStylePicker({ value, onChange, disabled }: {
  value: string;
  onChange: (style: string, preset?: ArtStylePreset) => void;
  disabled?: boolean;
}) {
  const cur = value.trim();
  const [preview, setPreview] = useState<ArtStylePreset | null>(null);
  const presets = useArtStylePresets();
  return (
    <>
      <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="选择画风">
        {presets.map((p) => {
          const on = cur === p.prompt;
          return (
            <div key={p.id} className="relative min-w-0">
              <button
                type="button"
                disabled={disabled}
                aria-pressed={on}
                title={p.label}
                onClick={() => onChange(on ? "" : p.prompt, on ? undefined : p)}
                className={`flex w-full items-center gap-1.5 rounded-full border py-1 pl-1 pr-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  on ? "border-coral bg-coral/12 ring-2 ring-coral/35" : "border-line bg-paper hover:border-coral/50"
                }`}
              >
                <Sample p={p} className="h-8 w-8 shrink-0 rounded-full" />
                <span className={`min-w-0 truncate text-[11px] font-semibold leading-none ${on ? "text-coral" : "text-ink"}`}>
                  {p.label}
                </span>
              </button>
              <button
                type="button"
                aria-label={`查看「${p.label}」示例大图`}
                onClick={() => setPreview(p)}
                className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70"
              >
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
              </button>
            </div>
          );
        })}
      </div>
      {preview && createPortal(
        <div className="fixed inset-0 z-[4000] grid place-items-center bg-black/70 p-5 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setPreview(null); }}>
          <div className="w-[min(340px,100%)] overflow-hidden rounded-2xl border border-line bg-paper shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <Sample p={preview} className="aspect-[3/4] w-full" />
            <div className="space-y-2 p-3">
              <p className="text-[14px] font-bold text-ink">{preview.label}</p>
              <div className="flex gap-2">
                <button type="button" className="flex-1 rounded-full border border-line py-1.5 text-[12px] text-ink" onClick={() => setPreview(null)}>关闭</button>
                <button type="button" disabled={disabled} className="flex-1 rounded-full bg-coral py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                  onClick={() => { onChange(preview.prompt, preview); setPreview(null); }}>用这个画风</button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
