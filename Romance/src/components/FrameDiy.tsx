/* 画面边框 DIY：封面与游玩界面共用。纯装饰层（pointer-events: none），不影响点击与布局。
 * 提供精致的 SVG 艺术角花、欧式卷草、中式回纹花窗、星盘塔罗、蕾丝珍珠、取景框与自定义边框图。 */
import type { CSSProperties, ReactNode } from "react";
import ImagePicker from "./ImagePicker";
import { IconCamera, IconClose, IconSpark, IconStar } from "../lib/icons";

export type FrameStyleId =
  | "none"
  | "line"
  | "double"
  | "corner"
  | "filigree"
  | "window"
  | "tarot"
  | "lace"
  | "cinema"
  | "inset"
  | "dashed"
  | "image";

export type FrameDiy = {
  style?: FrameStyleId;
  color?: string; // 缺省跟随精致香槟金 / 主题色
  width?: number; // 线宽 1~6 px
  radius?: number; // 圆角 0~36 px
  gap?: number; // 距画面边缘 4~36 px
  opacity?: number; // 0.2~1
  cornerSize?: number; // 角花尺寸 24~72 px
  glow?: boolean; // 柔和辉光
  image?: string; // 自定义边框图（PNG 透明底）
};

/* —— 精致 SVG 角花组件 —— */
function CornerSvg({ kind, size, strokeWidth }: { kind: "filigree" | "window" | "tarot" | "lace" | "double"; size: number; strokeWidth: number }) {
  const sw = Math.max(1, Math.min(2.5, strokeWidth * 0.85));
  if (kind === "filigree") {
    // 欧式古典卷草角花 + 菱形星芒
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 52 V14 C4 8.5 8.5 4 14 4 H52" />
        <path d="M10 44 V16 C10 12.7 12.7 10 16 10 H44" opacity="0.65" />
        <path d="M14 4 C14 16 24 22 32 14 C24 22 16 30 4 14" opacity="0.85" />
        <path d="M22 10 C28 10 32 15 29 20 C26 24 20 22 20 17" opacity="0.8" />
        <path d="M10 22 C10 28 15 32 20 29 C24 26 22 20 17 20" opacity="0.8" />
        <path d="M16 16 L20 18 L18 20 L16 16 Z" fill="currentColor" />
        <circle cx="38" cy="10" r="1.6" fill="currentColor" opacity="0.75" />
        <circle cx="10" cy="38" r="1.6" fill="currentColor" opacity="0.75" />
      </svg>
    );
  }
  if (kind === "window") {
    // 中式雅致回纹花窗角花
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="square">
        <path d="M4 56 V4 H56" />
        <path d="M10 46 V10 H46" opacity="0.75" />
        <path d="M4 22 H22 V4" />
        <path d="M10 16 H16 V10" />
        <path d="M22 14 H32 V22 H14 V32 H22" opacity="0.85" />
        <rect x="25" y="25" width="5" height="5" transform="rotate(45 27.5 27.5)" fill="currentColor" opacity="0.55" />
      </svg>
    );
  }
  if (kind === "tarot") {
    // 星盘塔罗：新月 + 四芒星 + 几何弧线
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 54 V4 H54" />
        <path d="M11 46 V11 H46" opacity="0.6" />
        <path d="M4 28 A24 24 0 0 0 28 4" opacity="0.8" />
        <path d="M11 34 A23 23 0 0 0 34 11" strokeDasharray="2 3" opacity="0.65" />
        <path d="M18 12 L20 16.5 L24.5 18 L20 19.5 L18 24 L16 19.5 L11.5 18 L16 16.5 Z" fill="currentColor" opacity="0.9" />
        <circle cx="34" cy="11" r="1.5" fill="currentColor" />
        <circle cx="11" cy="34" r="1.5" fill="currentColor" />
      </svg>
    );
  }
  if (kind === "lace") {
    // 千金蕾丝珍珠：扇形花边 + 蝴蝶结珍珠点缀
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 52 V14 C6 9.5 9.5 6 14 6 H52" />
        <path d="M12 48 Q18 42 12 36 Q18 30 12 24 Q18 18 12 12 Q18 18 24 12 Q30 18 36 12 Q42 18 48 12" opacity="0.75" />
        <circle cx="14" cy="14" r="3" fill="currentColor" opacity="0.85" />
        <circle cx="24" cy="9" r="1.5" fill="currentColor" opacity="0.7" />
        <circle cx="36" cy="9" r="1.5" fill="currentColor" opacity="0.7" />
        <circle cx="9" cy="24" r="1.5" fill="currentColor" opacity="0.7" />
        <circle cx="9" cy="36" r="1.5" fill="currentColor" opacity="0.7" />
        <path d="M14 14 C20 10 24 14 19 18 C14 21 10 18 14 14 Z" opacity="0.75" />
      </svg>
    );
  }
  // double: 精致双线内凹角
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={sw}>
      <path d="M2 40 V10 H10 V2 H40" />
      <path d="M8 36 V14 H14 V8 H36" opacity="0.65" />
      <rect x="11" y="11" width="4" height="4" transform="rotate(45 13 13)" fill="currentColor" opacity="0.8" />
    </svg>
  );
}

/* 顶部/底部居中徽章装饰 */
function CrestSvg({ kind, width }: { kind: "filigree" | "tarot" | "lace" | "window"; width: number }) {
  return (
    <svg width={width} height={Math.round(width * 0.28)} viewBox="0 0 120 32" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <line x1="4" y1="16" x2="42" y2="16" opacity="0.55" />
      <line x1="78" y1="16" x2="116" y2="16" opacity="0.55" />
      {kind === "tarot" ? (
        <>
          <path d="M60 5 L63 13 L71 16 L63 19 L60 27 L57 19 L49 16 L57 13 Z" fill="currentColor" opacity="0.85" />
          <circle cx="45" cy="16" r="2" fill="currentColor" opacity="0.7" />
          <circle cx="75" cy="16" r="2" fill="currentColor" opacity="0.7" />
        </>
      ) : kind === "lace" ? (
        <>
          <path d="M60 16 C52 8 46 12 50 18 C53 22 58 19 60 16 C62 19 67 22 70 18 C74 12 68 8 60 16 Z" fill="currentColor" opacity="0.4" />
          <circle cx="60" cy="16" r="2.5" fill="currentColor" />
        </>
      ) : kind === "window" ? (
        <>
          <rect x="53" y="9" width="14" height="14" transform="rotate(45 60 16)" />
          <rect x="56.5" y="12.5" width="7" height="7" transform="rotate(45 60 16)" fill="currentColor" opacity="0.6" />
        </>
      ) : (
        <>
          <path d="M46 16 C51 9 56 9 60 16 C64 9 69 9 74 16 C69 23 64 23 60 16 C56 23 51 23 46 16 Z" opacity="0.8" />
          <circle cx="60" cy="16" r="2.2" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

export function FrameOverlay({ f, fixed }: { f?: FrameDiy; fixed?: boolean }) {
  if (!f || !f.style || f.style === "none") return null;
  const w = Math.max(1, Math.min(6, f.width ?? 1.5));
  const g = Math.max(4, Math.min(40, f.gap ?? 14));
  const r = Math.max(0, Math.min(40, f.radius ?? 14));
  const c = f.color || "rgba(244, 224, 186, 0.88)";
  const cs = Math.max(28, Math.min(76, f.cornerSize ?? 48));
  const glowFilter = f.glow !== false ? `drop-shadow(0 0 8px color-mix(in srgb, ${c} 45%, transparent))` : undefined;

  const base: CSSProperties = {
    position: fixed ? "fixed" : "absolute",
    inset: g,
    borderRadius: r,
    pointerEvents: "none",
    zIndex: 30,
    opacity: f.opacity ?? 0.88,
    color: c,
    filter: glowFilter,
  };

  // 自定义图片边框
  if (f.style === "image" && f.image) {
    return (
      <div aria-hidden className="frame-diy" style={{ ...base, inset: Math.max(0, g - 6), filter: undefined }}>
        <img src={f.image} alt="" className="h-full w-full object-fill select-none" />
      </div>
    );
  }

  // 艺术角花系列：欧式卷草 / 中式花窗 / 星盘塔罗 / 千金蕾丝
  if (f.style === "filigree" || f.style === "window" || f.style === "tarot" || f.style === "lace") {
    const rot = ["rotate(0deg)", "scaleX(-1)", "scaleY(-1)", "scale(-1,-1)"] as const;
    const pos: CSSProperties[] = [
      { top: -2, left: -2 },
      { top: -2, right: -2 },
      { bottom: -2, left: -2 },
      { bottom: -2, right: -2 },
    ];
    return (
      <div aria-hidden className="frame-diy" style={base}>
        {/* 外层极细描边 + 内层呼吸衬线 */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: r,
            border: `${Math.max(1, w * 0.75)}px solid color-mix(in srgb, ${c} 55%, transparent)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 5,
            borderRadius: Math.max(0, r - 4),
            border: `1px ${f.style === "lace" ? "dashed" : "solid"} color-mix(in srgb, ${c} 32%, transparent)`,
          }}
        />
        {/* 四角精致雕花 */}
        {pos.map((p, i) => (
          <span key={i} style={{ position: "absolute", width: cs, height: cs, transform: rot[i], ...p }}>
            <CornerSvg kind={f.style as "filigree" | "window" | "tarot" | "lace"} size={cs} strokeWidth={w} />
          </span>
        ))}
        {/* 上下居中徽章 */}
        <span style={{ position: "absolute", top: -Math.round(cs * 0.14), left: "50%", transform: "translateX(-50%)" }}>
          <CrestSvg kind={f.style} width={Math.round(cs * 1.65)} />
        </span>
        <span style={{ position: "absolute", bottom: -Math.round(cs * 0.14), left: "50%", transform: "translateX(-50%) scaleY(-1)" }}>
          <CrestSvg kind={f.style} width={Math.round(cs * 1.65)} />
        </span>
      </div>
    );
  }

  // 电影取景框
  if (f.style === "cinema") {
    const L = Math.max(20, Math.round(cs * 0.6));
    const corners: CSSProperties[] = [
      { top: 0, left: 0, borderTop: `${w}px solid ${c}`, borderLeft: `${w}px solid ${c}` },
      { top: 0, right: 0, borderTop: `${w}px solid ${c}`, borderRight: `${w}px solid ${c}` },
      { bottom: 0, left: 0, borderBottom: `${w}px solid ${c}`, borderLeft: `${w}px solid ${c}` },
      { bottom: 0, right: 0, borderBottom: `${w}px solid ${c}`, borderRight: `${w}px solid ${c}` },
    ];
    return (
      <div aria-hidden className="frame-diy" style={{ ...base, borderRadius: 4 }}>
        <div style={{ position: "absolute", inset: 0, border: `1px solid color-mix(in srgb, ${c} 22%, transparent)` }} />
        {corners.map((p, i) => (
          <span key={i} style={{ position: "absolute", width: L, height: L, ...p }} />
        ))}
        {/* 中心十字准星微标 */}
        <span style={{ position: "absolute", top: 6, left: "50%", width: 12, height: 1, background: c, opacity: 0.55, transform: "translateX(-50%)" }} />
        <span style={{ position: "absolute", bottom: 6, left: "50%", width: 12, height: 1, background: c, opacity: 0.55, transform: "translateX(-50%)" }} />
        <span style={{ position: "absolute", left: 6, top: "50%", width: 1, height: 12, background: c, opacity: 0.55, transform: "translateY(-50%)" }} />
        <span style={{ position: "absolute", right: 6, top: "50%", width: 1, height: 12, background: c, opacity: 0.55, transform: "translateY(-50%)" }} />
      </div>
    );
  }

  // 四角折线（改良版：带内衬细线与角点星芒，不再单调生硬）
  if (f.style === "corner") {
    const L = Math.max(22, Math.round(cs * 0.65));
    const pos: CSSProperties[] = [
      { top: 0, left: 0, borderTop: `${w}px solid ${c}`, borderLeft: `${w}px solid ${c}`, borderTopLeftRadius: r },
      { top: 0, right: 0, borderTop: `${w}px solid ${c}`, borderRight: `${w}px solid ${c}`, borderTopRightRadius: r },
      { bottom: 0, left: 0, borderBottom: `${w}px solid ${c}`, borderLeft: `${w}px solid ${c}`, borderBottomLeftRadius: r },
      { bottom: 0, right: 0, borderBottom: `${w}px solid ${c}`, borderRight: `${w}px solid ${c}`, borderBottomRightRadius: r },
    ];
    return (
      <div aria-hidden className="frame-diy" style={base}>
        <div style={{ position: "absolute", inset: 3, borderRadius: Math.max(0, r - 2), border: `1px solid color-mix(in srgb, ${c} 25%, transparent)` }} />
        {pos.map((p, i) => (
          <span key={i} style={{ position: "absolute", width: L, height: L, ...p }} />
        ))}
      </div>
    );
  }

  // 柔光内景框（画廊式内发光 + 极细金线）
  if (f.style === "inset") {
    return (
      <div
        aria-hidden
        className="frame-diy"
        style={{
          ...base,
          boxShadow: `inset 0 0 0 ${Math.max(1, w * 0.65)}px color-mix(in srgb, ${c} 75%, transparent), inset 0 0 ${w * 14 + 12}px color-mix(in srgb, ${c} 28%, transparent)`,
        }}
      />
    );
  }

  // 双线画报框（改良版：外实内细 + 四角内凹花格，取代原先突兀的 outline）
  if (f.style === "double") {
    const rot = ["rotate(0deg)", "scaleX(-1)", "scaleY(-1)", "scale(-1,-1)"] as const;
    const pos: CSSProperties[] = [
      { top: -1, left: -1 },
      { top: -1, right: -1 },
      { bottom: -1, left: -1 },
      { bottom: -1, right: -1 },
    ];
    return (
      <div aria-hidden className="frame-diy" style={base}>
        <div style={{ position: "absolute", inset: 0, borderRadius: r, border: `${Math.max(1, w * 0.8)}px solid color-mix(in srgb, ${c} 70%, transparent)` }} />
        <div style={{ position: "absolute", inset: 5, borderRadius: Math.max(0, r - 4), border: `1px solid color-mix(in srgb, ${c} 42%, transparent)` }} />
        {r <= 8 &&
          pos.map((p, i) => (
            <span key={i} style={{ position: "absolute", width: 32, height: 32, transform: rot[i], ...p }}>
              <CornerSvg kind="double" size={32} strokeWidth={w} />
            </span>
          ))}
      </div>
    );
  }

  // 细线 / 虚线（带轻微高光层次）
  return (
    <div
      aria-hidden
      className="frame-diy"
      style={{
        ...base,
        border: `${Math.max(1, w * 0.85)}px ${f.style === "dashed" ? "dashed" : "solid"} color-mix(in srgb, ${c} 78%, transparent)`,
      }}
    />
  );
}

const chip = (on: boolean) =>
  `rounded-lg border px-2.5 py-1.5 text-[12px] transition ${
    on ? "border-jade bg-jade/12 font-bold text-jade shadow-sm" : "border-line bg-paper text-ink hover:border-jade/60"
  }`;

/** 功能注释：边框样式选项用线性 SVG，禁止装饰字符当图标 */
const STYLES: { id: FrameStyleId; label: string; desc: string; icon: ReactNode }[] = [
  { id: "none", label: "无边框", desc: "纯净全屏画布", icon: <IconClose size={14} className="opacity-60" /> },
  { id: "filigree", label: "欧式卷草", desc: "古典雕花角饰 + 双层细线", icon: <IconSpark size={14} /> },
  { id: "tarot", label: "星盘塔罗", desc: "星芒新月秘仪几何框", icon: <IconStar size={14} /> },
  { id: "window", label: "中式花窗", desc: "东方回纹轩窗格栅", icon: <IconSpark size={14} /> },
  { id: "lace", label: "千金蕾丝", desc: "浪漫扇边珍珠花框", icon: <IconSpark size={14} /> },
  { id: "double", label: "画报双线", desc: "杂志感内外双层衬线", icon: <IconStar size={14} /> },
  { id: "corner", label: "极简四角", desc: "轻盈折角 + 呼吸内线", icon: <IconStar size={14} /> },
  { id: "cinema", label: "电影取景", desc: "宽银幕准星取景线", icon: <IconCamera size={14} /> },
  { id: "inset", label: "柔光画廊", desc: "微光漫射内晕染框", icon: <IconSpark size={14} /> },
  { id: "line", label: "极细金线", desc: "克制干净的单层细框", icon: <IconStar size={14} /> },
  { id: "dashed", label: "信笺虚线", desc: "手账明信片缝线感", icon: <IconSpark size={14} /> },
  { id: "image", label: "自定图片", desc: "上传透明底 PNG 边框", icon: <IconCamera size={14} /> },
];

const COLOR_PRESETS: [string, string][] = [
  ["#f4e0ba", "香槟流金"],
  ["#ffffff", "纯白微光"],
  ["#f7c6db", "樱粉玫瑰"],
  ["#d4bfff", "星云淡紫"],
  ["#a8e6df", "青玉琉璃"],
  ["#1f1f24", "复古墨黑"],
];

export default function FrameEditor({ value, onChange }: { value?: FrameDiy; onChange: (v?: FrameDiy) => void }) {
  const f = value ?? {};
  const on = !!f.style && f.style !== "none";
  const set = (p: Partial<FrameDiy>) => {
    const n = { ...f, ...p };
    onChange(!n.style || n.style === "none" ? undefined : n);
  };
  const range = (label: string, k: "width" | "radius" | "gap" | "cornerSize", min: number, max: number, def: number) => (
    <label className="block">
      <span className="mb-1 mt-2.5 flex justify-between text-[11.5px] font-bold text-ink">
        {label}
        <span className="tabular-nums text-ink-soft">{f[k] ?? def}px</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={f[k] ?? def}
        onChange={(e) => set({ [k]: Number(e.target.value) })}
        className="w-full accent-[var(--jade)]"
      />
    </label>
  );
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-[12px] font-bold text-ink">选择边框款式</p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {STYLES.map((s) => {
            const cur = (f.style ?? "none") === s.id;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={cur}
                onClick={() => set({ style: s.id })}
                className={`flex items-center gap-2 rounded-xl border p-2 text-left transition ${
                  cur ? "border-jade bg-jade/10 ring-1 ring-jade/30" : "border-line bg-paper hover:border-jade/50"
                }`}
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${cur ? "border-jade/40 bg-jade/15 text-jade" : "border-line bg-paper-2 text-ink-soft"}`}>
                  {s.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[12px] font-bold ${cur ? "text-jade" : "text-ink"}`}>{s.label}</span>
                  <span className="block truncate text-[10px] text-ink-soft">{s.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {f.style === "image" && (
        <div className="rounded-xl border border-line bg-paper-2/50 p-2.5">
          <p className="mb-1.5 text-[11.5px] font-bold text-ink">上传自定义边框图（建议使用透明底 PNG）</p>
          <ImagePicker value={f.image} label="边框贴图" max={1920} onChange={(image) => set({ image })} />
        </div>
      )}

      {on && f.style !== "image" && (
        <div className="rounded-xl border border-line bg-paper-2/40 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-ink">边框色彩</span>
            <label className="flex items-center gap-1.5 text-[11.5px] text-ink-soft cursor-pointer">
              <input
                type="checkbox"
                className="accent-[var(--jade)]"
                checked={f.glow !== false}
                onChange={(e) => set({ glow: e.target.checked ? undefined : false })}
              />
              柔和微光
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {COLOR_PRESETS.map(([hex, name]) => {
              const active = (f.color ?? "#f4e0ba").toLowerCase() === hex;
              return (
                <button
                  key={hex}
                  type="button"
                  onClick={() => set({ color: hex === "#f4e0ba" ? undefined : hex })}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ${
                    active ? "border-jade bg-jade/10 font-bold text-jade" : "border-line bg-paper text-ink hover:border-jade/50"
                  }`}
                >
                  <span className="h-3 w-3 rounded-full border border-black/15" style={{ background: hex }} />
                  {name}
                </button>
              );
            })}
            <button type="button" onClick={() => set({ color: "var(--jade)" })} className={chip(f.color === "var(--jade)")}>
              跟随主题色
            </button>
            <input
              type="color"
              value={f.color?.startsWith("#") ? f.color : "#f4e0ba"}
              onChange={(e) => set({ color: e.target.value })}
              className="h-7 w-8 cursor-pointer rounded border border-line bg-transparent p-0"
              aria-label="自定义边框颜色"
            />
          </div>

          <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {range("线条粗细", "width", 1, 5, 2)}
            {range("距画面边距", "gap", 4, 36, 14)}
            {f.style !== "cinema" && range("圆角弧度", "radius", 0, 36, 14)}
            {(f.style === "filigree" || f.style === "window" || f.style === "tarot" || f.style === "lace" || f.style === "corner") &&
              range("角花大小", "cornerSize", 28, 72, 48)}
            <label className="block">
              <span className="mb-1 mt-2.5 flex justify-between text-[11.5px] font-bold text-ink">
                不透明度
                <span className="tabular-nums text-ink-soft">{Math.round((f.opacity ?? 0.88) * 100)}%</span>
              </span>
              <input
                type="range"
                min={20}
                max={100}
                value={Math.round((f.opacity ?? 0.88) * 100)}
                onChange={(e) => set({ opacity: Number(e.target.value) / 100 })}
                className="w-full accent-[var(--jade)]"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
