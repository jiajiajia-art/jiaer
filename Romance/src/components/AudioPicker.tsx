/* 音频选择器：直接列出音频库全部音频（按分类分组）；来自未启用 MOD 的音频置灰、不可选 */
import type { AudioKind } from "../lib/types";
import { AUDIO_KIND_LABEL, audioLabel, audioOptions, useAudioLib } from "../game/audioLib";

const sel = "rounded-lg border border-line bg-paper-2 px-2 py-1 text-[12.5px] text-ink";
export default function AudioPicker({ value, onChange, kind, empty = "（请选择音频）", className = sel, label = "音频" }: { value?: string; onChange: (id: string | undefined) => void; kind?: AudioKind; empty?: string; className?: string; label?: string }) {
  useAudioLib();
  const all = audioOptions();
  // 功能注释：地点/事件的背景音乐下拉即使按分类筛选，平台曲也直接出现，不必先加进模组音乐列表
  const opts = kind ? all.filter((o) => o.a.kind === kind || o.a.id.startsWith("platform:")) : all;
  const known = opts.some((o) => o.a.id === value);
  const kinds: AudioKind[] = kind
    ? [kind, ...((["bgm", "amb", "sfx"] as AudioKind[]).filter((k) => k !== kind && opts.some((o) => o.a.kind === k && o.a.id.startsWith("platform:"))))]
    : ["bgm", "amb", "sfx"];
  const groups = kinds.map((k) => [k, opts.filter((o) => o.a.kind === k)] as const).filter(([, l]) => l.length);
  return (
    <select className={className} value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)} aria-label={label}>
      <option value="">{opts.length ? empty : "（音频库还是空的）"}</option>
      {value && !known && <option value={value}>{audioLabel(value)}</option>}
      {groups.map(([k, l]) => (
        <optgroup key={k} label={AUDIO_KIND_LABEL[k]}>
          {l.map((o) => <option key={o.a.id} value={o.a.id} disabled={!o.on}>{o.a.name}{o.a.id.startsWith("platform:") ? "（平台）" : ""}{o.modName ? ` · ${o.modName}` : ""}{o.on ? "" : "（MOD 未启用）"}</option>)}
        </optgroup>
      ))}
    </select>
  );
}
