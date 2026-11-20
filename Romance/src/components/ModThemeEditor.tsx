import type { ModTheme } from "../mods/types";
import { SKINS } from "../lib/skins";
import { SkinIcon } from "../lib/icons";
const chip = (on: boolean) => `rounded-xl border p-2 text-left transition ${on ? "border-jade bg-jade/15 ring-2 ring-jade/30" : "border-line bg-paper hover:border-jade/60"}`;
export default function ModThemeEditor({ value, onChange }: { value?: ModTheme; onChange: (v?: ModTheme) => void }) {
  const v = value ?? {};
  const set = (skin: string) => onChange({ ...v, skin: v.skin === skin ? undefined : skin });
  return <div className="space-y-3.5"><p className="text-[11px] leading-relaxed text-ink-soft">玩家第一次进入本世界时套用这套外观；之后以玩家在设置里的选择为准。不指定则不改玩家外观。</p><div><p className="mb-1.5 text-[10.5px] font-bold tracking-[0.16em] text-ink-soft">皮肤</p><div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3"><button type="button" onClick={() => onChange(v.skin ? { ...v, skin: undefined } : undefined)} className={`${chip(!v.skin)} text-[11.5px] text-ink-soft`}>不指定</button>{SKINS.map((s) => <button key={s.id} type="button" onClick={() => set(s.id)} className={`${chip(v.skin === s.id)} flex items-center gap-2`}><SkinIcon id={s.icon} size={18} /><span><span className="block text-[12px] font-bold text-ink">{s.label}</span><span className="block truncate text-[10px] text-ink-soft">{s.desc}</span></span></button>)}</div></div></div>;
}
