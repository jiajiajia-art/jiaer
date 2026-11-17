import { artStyleSampleUrl, type ArtStylePreset } from "../lib/editorImagePrompts";
import { useArtStylePresets } from "../lib/platformArtStyles";
import { useState } from "react";

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
 * 功能注释：画风选择——三列芯片（小缩略图 + 名称）；点芯片填入画风。
 * 不做放大镜预览弹层，避免干扰点选。画风正向词由运营后台配置，创作者端不展示、不手改。
 * onChange 第二参供外层并入该画风负面词。
 */
export default function ArtStylePicker({ value, onChange, disabled }: {
  value: string;
  onChange: (style: string, preset?: ArtStylePreset) => void;
  disabled?: boolean;
}) {
  const cur = value.trim();
  const presets = useArtStylePresets();
  return (
    <div className="grid grid-cols-2 gap-1 sm:grid-cols-3" role="group" aria-label="选择画风">
      {presets.map((p) => {
        const on = cur === p.prompt;
        return (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            title={p.label}
            onClick={() => onChange(on ? "" : p.prompt, on ? undefined : p)}
            className={`flex min-w-0 items-center gap-1 rounded-full border py-0.5 pl-0.5 pr-1.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
              on
                ? "border-[color:var(--jade)] bg-[color:var(--jade)]/10 ring-1 ring-[color:var(--jade)]/35"
                : "border-line bg-white hover:border-[color:var(--jade)]/45"
            }`}
          >
            <Sample p={p} className="h-6 w-6 shrink-0 rounded-full" />
            <span className={`min-w-0 truncate text-[10.5px] font-semibold leading-none ${on ? "text-[color:var(--jade)]" : "text-ink"}`}>
              {p.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
