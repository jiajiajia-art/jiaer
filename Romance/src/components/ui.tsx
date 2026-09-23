import { useRef, type ReactNode } from "react";
import { IconCamera, IconClose } from "../lib/icons";

/* —— 终端平铺分节标题：▌CODE 中文 ······ —— */
export function SectionHead({ code, cn, hint, right }: { code?: string; cn: string; hint?: string; right?: ReactNode }) {
  return (
    <h3 className="mb-2 mt-5 flex items-center gap-2">
      <span className="h-3.5 w-[3px] shrink-0 rounded-full bg-gradient-to-b from-[var(--jade)] to-[var(--coral)]" aria-hidden />
      {code && <span className="text-[11px] font-bold tracking-[0.25em] text-jade">{code}</span>}
      <span className={code ? "text-[12px] text-ink-soft" : "text-[13px] font-bold text-ink"}>{cn}</span>
      {hint && <span className="text-[11px] text-ink-soft">{hint}</span>}
      <span className="h-px flex-1 bg-gradient-to-r from-line to-transparent" />
      {right}
    </h3>
  );
}

/* —— 模态弹窗 —— */
export function Modal({ title, onClose, children, wide, heavyBackdrop }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; heavyBackdrop?: boolean }) {
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 ${heavyBackdrop ? "bg-black/75 backdrop-blur-md" : "bg-black/40 backdrop-blur-sm"}`} onClick={onClose}>
      <div
        className={`animate-pop max-h-[calc(100dvh-1rem)] w-full overflow-y-auto rounded-[20px] border border-line bg-paper-2 pb-2 shadow-2xl ring-1 ring-inset ring-white/40 ${wide ? "max-w-2xl" : "max-w-lg"}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="sticky top-0 z-10 border-b border-line bg-paper-2/95 backdrop-blur">
          <div className="flex items-center justify-between px-5 py-3">
            <h3 className="flex items-center gap-2 font-serif text-lg font-bold text-ink">
              <span className="h-4 w-[3px] rounded-full bg-gradient-to-b from-[var(--jade)] to-[var(--coral)]" aria-hidden />
              {title}
            </h3>
            <button onClick={onClose} aria-label="关闭" className="rounded-full p-1 text-ink-soft transition hover:bg-line/50 hover:text-ink">
              <IconClose />
            </button>
          </div>
          <span className="block h-px bg-gradient-to-r from-transparent via-[var(--coral)]/40 to-transparent" aria-hidden />
        </div>
        <div className="px-4 pb-5 pt-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}

/* —— 头像上传（点击即可上传） —— */
export function Avatar({ src, name, size = 48, onPick, editable = true, shape = "rounded" }: { src?: string; name: string; size?: number; onPick?: (dataUrl: string) => void; editable?: boolean; shape?: "circle" | "rounded" }) {
  const ref = useRef<HTMLInputElement>(null);
  const pick = (f?: File) => {
    if (!f || !onPick) return;
    const r = new FileReader();
    r.onload = () => onPick(String(r.result));
    r.readAsDataURL(f);
  };
  const initial = name?.trim()?.[0] ?? "★";
  const Tag = editable ? "button" : "span";
  return (
    <Tag
      {...(editable ? { type: "button" as const, onClick: () => ref.current?.click() } : {})}
      className={`group relative flex shrink-0 overflow-hidden ${shape === "rounded" ? "rounded-[8px]" : "rounded-full"} border border-line bg-gradient-to-br from-jade/25 to-coral/15 shadow-sm ring-1 ring-inset ring-white/40 ${editable ? "cursor-pointer" : "cursor-default"}`}
      style={{ width: size, height: size }}
      aria-label={editable ? `上传${name}头像` : name}
    >
      {src ? (
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-serif font-bold text-jade" style={{ fontSize: size * 0.42 }}>
          {initial}
        </span>
      )}
      {editable && (
        <span className="absolute inset-0 hidden items-center justify-center bg-black/45 text-paper-2 group-hover:flex">
          <IconCamera width={size * 0.4} height={size * 0.4} />
        </span>
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
    </Tag>
  );
}

/* —— SVG 进度条 —— */
export function Meter({ value, max, tone = "jade", height = 8 }: { value: number; max: number; tone?: string; height?: number }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  const color =
    tone === "coral" ? "var(--coral)" : tone === "gold" ? "var(--gold)" : tone === "danger" ? "var(--danger)" : "var(--jade)";
  const gid = `mg-${tone}`;
  return (
    <svg width="100%" height={height} className="overflow-visible" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100%" height={height} rx={height / 2} fill="color-mix(in srgb, var(--ink-soft) 18%, transparent)" />
      <rect x="0" y="0" width={`${pct}%`} height={height} rx={height / 2} fill={color} style={{ transition: "width 0.6s cubic-bezier(.2,.7,.2,1)" }} />
      <rect x="0" y="0" width={`${pct}%`} height={height} rx={height / 2} fill={`url(#${gid})`} style={{ transition: "width 0.6s cubic-bezier(.2,.7,.2,1)" }} />
    </svg>
  );
}

/* —— 纯文本方块条：标签 [▮▮▮▯] 数值（终端读出） —— */
const BAR_TONE: Record<string, string> = { jade: "text-jade", coral: "text-coral", gold: "text-gold", danger: "text-danger" };
export function BlockBar({ value, max, tone = "jade", cells = 12 }: { value: number; max: number; tone?: string; cells?: number }) {
  const filled = Math.max(0, Math.min(cells, Math.round((value / (max || 1)) * cells)));
  return (
    <span className="min-w-0 flex-1 truncate font-mono text-[12px] tracking-tight text-ink-soft">
      [<span className={BAR_TONE[tone] ?? "text-jade"}>{"▮".repeat(filled)}</span>
      <span className="text-line">{"▯".repeat(cells - filled)}</span>]
    </span>
  );
}

/* —— 键 ······ 值：中间虚线延伸（终端读出行） —— */
export function LeaderRow({ k, v, tone = "text-ink" }: { k: string; v: ReactNode; tone?: string }) {
  return (
    <div className="flex items-baseline gap-2 text-[13px]">
      <span className="shrink-0 text-ink-soft">{k}</span>
      <span className="min-w-[1rem] flex-1 translate-y-[-0.28em] border-b border-dotted border-line" aria-hidden />
      <span className={`min-w-0 shrink truncate text-right ${tone}`}>{v}</span>
    </div>
  );
}

/* —— 好感度等级 —— */
export function affinityLevel(a: number, isFamily = false): { text: string; tone: string } {
  if (isFamily) {
    // 亲人只谈亲疏与好感，绝不带任何暧昧/心动色彩
    if (a >= 65) return { text: "至亲至爱", tone: "jade" };
    if (a >= 40) return { text: "血浓于水", tone: "jade" };
    if (a >= 20) return { text: "亲近和睦", tone: "jade" };
    if (a >= 1) return { text: "尚算融洽", tone: "gold" };
    if (a <= -40) return { text: "反目成仇", tone: "danger" };
    if (a <= -1) return { text: "心生嫌隙", tone: "danger" };
    return { text: "形同陌路", tone: "gold" };
  }
  if (a >= 65) return { text: "情愫暗生", tone: "coral" };
  if (a >= 40) return { text: "亲密无间", tone: "jade" };
  if (a >= 20) return { text: "渐生好感", tone: "jade" };
  if (a >= 1) return { text: "点头之交", tone: "gold" };
  if (a <= -40) return { text: "势同水火", tone: "danger" };
  if (a <= -1) return { text: "心存芥蒂", tone: "danger" };
  return { text: "萍水相逢", tone: "gold" };
}

export function Chip({ children, tone = "line" }: { children: ReactNode; tone?: string }) {
  const cls =
    tone === "jade" ? "border-jade/40 bg-jade/10 text-jade"
    : tone === "coral" ? "border-coral/40 bg-coral/10 text-coral"
    : tone === "gold" ? "border-gold/40 bg-gold/10 text-gold"
    : tone === "danger" ? "border-danger/40 bg-danger/10 text-danger"
    : "border-line bg-paper text-ink-soft";
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide shadow-[0_1px_2px_-1px_rgba(0,0,0,0.12)] ring-1 ring-inset ring-white/30 ${cls}`}>{children}</span>;
}
