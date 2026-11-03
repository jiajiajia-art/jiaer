import type { ModTheme } from "../mods/types";
import { ACCENTS, FONTS, MODES, SKINS } from "../lib/skins";
import { SkinIcon } from "../lib/icons";

/* 模组编辑器 · 界面风格：进入本世界时自动套用；每项可留「不指定」沿用玩家设置。
 * 功能注释：不再提供本页即时预览条；面板级皮肤 DIY 入口已从美化页移除。 */
const chip = (on: boolean) =>
  `rounded-xl border p-2 text-left transition ${on ? "border-jade bg-jade/15 ring-2 ring-jade/30" : "border-line bg-paper hover:border-jade/60"}`;

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10.5px] font-bold tracking-[0.16em] text-ink-soft">{title}</p>
      {children}
    </div>
  );
}

export default function ModThemeEditor({ value, onChange }: { value?: ModTheme; onChange: (v?: ModTheme) => void }) {
  const v = value ?? {};
  const set = <K extends keyof ModTheme>(k: K, x: ModTheme[K]) => {
    const next = { ...v, [k]: v[k] === x ? undefined : x }; // 再点一次 = 取消指定
    const clean = Object.fromEntries(Object.entries(next).filter(([, y]) => y !== undefined)) as ModTheme;
    onChange(Object.keys(clean).length ? clean : undefined);
  };
  const Off = ({ k }: { k: keyof ModTheme }) => (
    <button type="button" onClick={() => v[k] && set(k, v[k] as never)} className={`${chip(!v[k])} text-[11.5px] text-ink-soft`}>不指定</button>
  );

  return (
    <div className="space-y-3.5">
      <p className="text-[11px] leading-relaxed text-ink-soft">玩家第一次进入本世界时套用这套外观；之后以玩家在设置里的选择为准。不指定则不改玩家外观。</p>

      <Row title="皮肤">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          <Off k="skin" />
          {SKINS.map((s) => (
            <button key={s.id} type="button" onClick={() => set("skin", s.id)} className={`${chip(v.skin === s.id)} flex items-center gap-2`}>
              <SkinIcon id={s.icon} size={18} />
              <span className="min-w-0">
                <span className="block text-[12px] font-bold text-ink">{s.label}</span>
                <span className="block truncate text-[10px] text-ink-soft">{s.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </Row>

      <details className="rounded-xl border border-line bg-paper/40">
        <summary className="cursor-pointer px-3 py-2 text-[12px] font-bold text-ink">自定义</summary>
        <div className="space-y-3.5 border-t border-line/70 p-3">
          <Row title="主题色">
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
              <Off k="accent" />
              {ACCENTS.map((a) => (
                <button key={a.id} type="button" onClick={() => set("accent", a.id)} className={`${chip(v.accent === a.id)} flex items-center gap-1.5 text-[11.5px] text-ink`}>
                  <span className={`h-3.5 w-3.5 shrink-0 rounded-full ${a.bg}`} />{a.label}
                </button>
              ))}
            </div>
          </Row>

          <Row title="字体">
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
              <Off k="font" />
              {FONTS.map((f) => (
                <button key={f.id} type="button" onClick={() => set("font", f.id)} className={`${chip(v.font === f.id)} flex items-center gap-1.5 text-[11.5px] text-ink`}>
                  <span className="text-[17px] leading-none" style={{ fontFamily: f.family }}>星</span>{f.label}
                </button>
              ))}
            </div>
          </Row>

          <Row title="深浅色">
            <div className="grid grid-cols-4 gap-1.5">
              <Off k="mode" />
              {MODES.map((m) => (
                <button key={m.id} type="button" onClick={() => set("mode", m.id)} className={`${chip(v.mode === m.id)} text-center text-[11.5px] text-ink`}>{m.label}</button>
              ))}
            </div>
          </Row>
        </div>
      </details>
    </div>
  );
}
