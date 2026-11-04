import { IconClose, IconStar, IconCheck, IconSpark } from "../lib/icons";
import { ICON_COLORS, SPOT_ICONS, spotIconUri } from "../game/spotIcons";
import { useRef, useState } from "react";
import type { FixedCond, MapArrival, MapSpotEdit } from "../lib/types";
import { getWorldSlot } from "../mods/registry";
import { STAT_LABELS, STAT_ORDER } from "../game/data";
import { FIXED_METRICS } from "../game/fixedEvents";
import { SCENE_PORTRAIT_HINT, fileToScenePortraitDataUrl } from "../lib/scenePortrait";
import { asModArray } from "../lib/asModArray";

/* 地图编辑器 · 地点详情扩展：开局起点 / 按身份开局 / 解锁条件 / 条件抵达 / 图标 / 乙游场景图 */
const lab = "mb-1 block text-[10.5px] font-bold tracking-[0.16em] text-ink-soft";
const inp = "min-w-0 rounded-lg border border-line bg-paper-2 px-2 py-1.5 text-[12.5px] text-ink focus:border-jade focus:outline-none";
const card = "rounded-xl border border-line/70 bg-paper-2/60 p-2.5";
type NumCond = Extract<FixedCond, { kind: "stat" | "metric" }>;
const targets = () => [
  ...FIXED_METRICS.map((m) => ({ v: `metric:${m.key}`, l: m.label })),
  ...STAT_ORDER.map((k) => ({ v: `stat:${k}`, l: STAT_LABELS[k] })),
];
const uid = () => `arr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function useUpload(onDone: (url: string) => void, opts?: { scenePortrait?: boolean; onError?: (msg: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const el = (
    <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => {
      const f = e.target.files?.[0]; e.target.value = "";
      if (!f) return;
      void (async () => {
        try {
          // 功能注释：乙游场景图自动裁成 1080×1920，避免尺寸不合规时点了没反应。
          if (opts?.scenePortrait) {
            onDone(await fileToScenePortraitDataUrl(f));
            return;
          }
          const r = new FileReader();
          r.onload = () => onDone(String(r.result));
          r.readAsDataURL(f);
        } catch (err) {
          opts?.onError?.((err as Error).message || SCENE_PORTRAIT_HINT);
        }
      })();
    }} />
  );
  return [() => ref.current?.click(), el] as const;
}

export default function MapSpotExtras({ e, name, isStart, patch, setStart }: {
  e: MapSpotEdit;
  name: string;
  isStart: boolean;
  patch: (p: Partial<MapSpotEdit>) => void;
  setStart: (on: boolean) => void;
}) {
  const [iconColor, setIconColor] = useState(ICON_COLORS[1]);
  const [bgErr, setBgErr] = useState("");
  const [pickIcon, iconEl] = useUpload((icon) => patch({ icon }));
  const [pickBg, bgEl] = useUpload((background) => { setBgErr(""); patch({ background }); }, { scenePortrait: true, onError: setBgErr });
  // 功能注释：身份/出身槽 AI 常写成单对象；asModArray 后再展开，禁止 ...(slot ?? []) → is not iterable
  const opts = [
    ...asModArray<{ id?: string; name?: string }>(getWorldSlot("identities"))
      .filter((o) => typeof o.name === "string" && o.name.trim())
      .map((o) => ({ id: o.id, name: o.name as string, group: "身份" })),
    ...asModArray<{ id?: string; name?: string }>(getWorldSlot("backgrounds"))
      .filter((o) => typeof o.name === "string" && o.name.trim())
      .map((o) => ({ id: o.id, name: o.name as string, group: "出身" })),
  ];
  const startFor = asModArray<string>(e.startFor).filter((k) => typeof k === "string" && k.length > 0);
  const conds = asModArray<FixedCond>(e.unlockConds).filter((c): c is NumCond => c.kind === "stat" || c.kind === "metric");
  const setCond = (i: number, p: Partial<NumCond>) => patch({ unlockConds: conds.map((c, j) => (j === i ? ({ ...c, ...p } as NumCond) : c)) });
  const arrivals = e.arrivals ?? [];
  const setArr = (id: string, p: Partial<MapArrival>) => patch({ arrivals: arrivals.map((a) => (a.id === id ? { ...a, ...p } : a)) });
  const n = (v: string) => (v === "" ? undefined : Number(v));
  const isImg = (v?: string) => !!v && /^(data:|https?:|\/)/.test(v);

  return (
    <div className="space-y-3">
      {iconEl}{bgEl}
      {/* 开局起点 */}
      <div className={`${card} ${isStart ? "border-coral/60 bg-coral/[0.05]" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12.5px] font-bold text-ink">{isStart ? <><IconStar size={12} className="inline" /> 默认开局起点</> : "默认开局起点"}</span>
          <button type="button" onClick={() => setStart(!isStart)}
            className={`rounded-full border px-3 py-1 text-[11.5px] font-bold transition ${isStart ? "border-line text-ink-soft hover:text-danger" : "border-coral/60 bg-coral/10 text-coral hover:bg-coral/20"}`}>
            {isStart ? "取消起点" : "设为默认开局起点"}
          </button>
        </div>
        <p className="mt-1 text-[10.5px] leading-relaxed text-ink-soft">起点不设解锁条件，始终显示。需把本地图存进「地图库」并标为「开局使用」，新开局才会从这里出发。</p>
      </div>

      {/* 图标 */}
      <div>
        <label className={lab}>图标</label>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-paper text-[17px]" style={{ background: iconColor === "#ffffff" ? "var(--color-ink, #2f2a26)" : undefined }}>
            {isImg(e.icon) ? <img src={(e.icon) || undefined} alt="" className="h-6 w-6 object-contain" /> : e.icon ? e.icon : <IconSpark size={16} />}
          </span>
          <input className={`${inp} w-16`} value={isImg(e.icon) ? "" : e.icon ?? ""} onChange={(x) => patch({ icon: x.target.value || undefined })} placeholder="emoji" maxLength={2} />
          <button type="button" onClick={pickIcon} className="rounded-lg border border-jade/50 bg-jade/10 px-2.5 py-1.5 text-[12px] font-bold text-jade-deep hover:bg-jade/20">上传图标 / SVG</button>
          {e.icon && <button type="button" onClick={() => patch({ icon: undefined })} className="text-[11.5px] text-ink-soft hover:text-danger">清除</button>}
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-[10.5px] text-ink-soft">线描颜色</span>
          {ICON_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setIconColor(c)} aria-label={`颜色 ${c}`}
              className={`h-5 w-5 rounded-full border ${iconColor === c ? "ring-2 ring-jade ring-offset-1" : "border-line"}`} style={{ background: c }} />
          ))}
        </div>
        <div className="mt-2 grid grid-cols-6 gap-1.5 sm:grid-cols-8">
          {SPOT_ICONS.map((ic) => {
            const uri = spotIconUri(ic.body, iconColor);
            const on = e.icon === uri;
            return (
              <button key={ic.id} type="button" onClick={() => patch({ icon: uri })} title={ic.label}
                className={`flex flex-col items-center gap-0.5 rounded-lg border py-1.5 transition ${on ? "border-jade bg-jade/10" : "border-line bg-paper hover:border-jade/60"}`}
                style={{ background: iconColor === "#ffffff" ? "var(--color-ink, #2f2a26)" : undefined }}>
                <img src={(uri) || undefined} alt="" className="h-5 w-5" />
                <span className={`text-[9.5px] ${iconColor === "#ffffff" ? "text-white/80" : "text-ink-soft"}`}>{ic.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 乙游场景图：仅 9:16 / 1080×1920 竖图 */}
      <div>
        <label className={lab}>乙游场景图</label>
        <p className="mb-1.5 text-[10.5px] leading-relaxed text-ink-soft">剧情写到「{name}」时铺这张图。{SCENE_PORTRAIT_HINT}。不设则用所在底图。</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => { setBgErr(""); pickBg(); }} className="flex-1 rounded-lg border border-jade/50 bg-jade/10 py-1.5 text-[12px] font-bold text-jade-deep hover:bg-jade/20">上传场景图</button>
          {e.background && <button type="button" onClick={() => { setBgErr(""); patch({ background: undefined }); }} className="rounded-lg border border-line px-3 text-[12px] text-ink-soft hover:text-danger">清除</button>}
        </div>
        {bgErr && <p className="mt-1 text-[11px] text-danger">{bgErr}</p>}
      </div>

      {/* 解锁条件 */}
      <div>
        <label className={lab}>解锁条件</label>
        <select className={`${inp} w-full`} disabled={isStart} value={isStart ? "open" : e.unlock ?? "open"}
          onChange={(x) => patch({ unlock: x.target.value === "open" ? undefined : (x.target.value as "story" | "cond") })}>
          <option value="open">开局即显示</option>
          <option value="story">叙事揭示（剧情带主角到过才显示）</option>
          <option value="cond">条件解锁（数值达标才显示）</option>
        </select>
        {!isStart && e.unlock === "cond" && (
          <div className="mt-1.5 space-y-1">
            {conds.map((c, i) => (
              <div key={i} className="flex items-center gap-1 text-[11.5px] text-ink-soft">
                <span className="shrink-0">{i ? "且" : "当"}</span>
                <select className={`${inp} flex-1`} value={`${c.kind}:${c.key}`} onChange={(x) => { const [kind, key] = x.target.value.split(":"); setCond(i, { kind: kind as "stat" | "metric", key }); }}>
                  {targets().map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
                <select className={`${inp} w-14`} value={c.op} onChange={(x) => setCond(i, { op: x.target.value as "gte" | "lte" })}><option value="gte">≥</option><option value="lte">≤</option></select>
                <input type="number" className={`${inp} w-16`} value={c.value} onChange={(x) => setCond(i, { value: Number(x.target.value) || 0 })} />
                <button type="button" className="hover:text-danger" onClick={() => patch({ unlockConds: conds.filter((_, j) => j !== i) })} aria-label="删除条件"><IconClose size={14} /></button>              </div>
            ))}
            <button type="button" className="text-[11.5px] font-bold text-jade" onClick={() => patch({ unlockConds: [...conds, { kind: "metric", key: "fame", op: "gte", value: 50 }] })}>＋ 添加条件</button>
          </div>
        )}
      </div>

      {/* 按建角选项开局 */}
      <div>
        <label className={lab}>按创建角色选项开局</label>
        <p className="mb-1.5 text-[10.5px] leading-relaxed text-ink-soft">勾选后，玩家选中该选项即从此地开局；未勾选的选项仍用默认开局起点。</p>
        {opts.length ? (
          <div className="flex flex-wrap gap-1.5">
            {opts.map((o) => {
              const on = startFor.includes(o.name);
              return (
                <button key={`${o.group}${o.id}`} type="button" onClick={() => patch({ startFor: on ? startFor.filter((k) => k !== o.name) : [...startFor, o.name] })}
                  className={`rounded-full border px-2.5 py-1 text-[11.5px] transition ${on ? "border-jade bg-jade/15 font-bold text-jade-deep" : "border-line text-ink-soft hover:border-jade/50"}`}>
                  {on ? "" : ""}<span className="opacity-60">{o.group}·</span>{o.name}
                </button>
              );
            })}
          </div>
        ) : <p className="text-[11px] text-ink-soft">当前世界观没有身份/出身选项。请先在「创意工坊」的创建角色里添加，再回这里勾选。</p>}
      </div>

      {/* 条件抵达 */}
      <div>
        <label className={lab}>条件抵达</label>
        <p className="mb-1.5 text-[10.5px] leading-relaxed text-ink-soft">到了指定年龄或周数，主角会自动来到此地展开剧情；每条只触发一次。同时满足多条时，只去地点列表里靠前的那一处。</p>
        <div className="space-y-1.5">
          {arrivals.map((a) => (
            <div key={a.id} className="space-y-1 rounded-lg border border-line bg-paper p-2 text-[11.5px] text-ink-soft">
              <div className="flex items-center gap-1.5">
                <span>年龄 ≥</span><input type="number" className={`${inp} w-14`} value={a.minAge ?? ""} onChange={(x) => setArr(a.id, { minAge: n(x.target.value) })} />
                <span>且 周数 ≥</span><input type="number" className={`${inp} w-14`} value={a.minWeek ?? ""} onChange={(x) => setArr(a.id, { minWeek: n(x.target.value) })} />
                <button type="button" className="ml-auto hover:text-danger" onClick={() => patch({ arrivals: arrivals.filter((x) => x.id !== a.id) })} aria-label="删除"><IconClose size={14} /></button>              </div>
              <input className={`${inp} w-full`} value={a.note ?? ""} onChange={(x) => setArr(a.id, { note: x.target.value || undefined })} placeholder="抵达后的剧情提示（交给 AI 演绎，可留空）" />
              {a.minAge == null && a.minWeek == null && <p className="text-[10.5px] text-danger">至少填一项，否则不会触发。两项都填则需同时满足。</p>}
            </div>
          ))}
          <button type="button" onClick={() => patch({ arrivals: [...arrivals, { id: uid(), minWeek: 10 }] })}
            className="w-full rounded-xl border border-dashed border-jade/50 bg-jade/5 py-1.5 text-[12px] font-bold text-jade-deep hover:bg-jade/10">＋ 添加抵达条件</button>
        </div>
      </div>
    </div>
  );
}
