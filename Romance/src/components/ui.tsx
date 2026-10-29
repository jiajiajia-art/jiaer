import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconCamera, IconClose, IconSpark } from "../lib/icons";
import { romancePortalRoot } from "../lib/romancePortalRoot";
import AvatarLibraryPicker from "./AvatarLibraryPicker";
import LocalAvatarCropFlow from "./LocalAvatarCropFlow";

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

/* —— 模态弹窗：遮罩 / 面板 / 标题栏 / 关闭钮全部取 index.css 的全局 ui-* 类（自绘弹窗也用同一套） —— */
const ModalDepth = createContext(0);

export function Modal({ title, onClose, children, wide, xl, heavyBackdrop, locked = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; /** 超宽面板：最小 / 最大 1200（模组编辑器） */ xl?: boolean; heavyBackdrop?: boolean; /** 必须点内容里的按钮才能离开：遮罩、Esc、关闭钮都不收起 */ locked?: boolean }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  // 嵌套弹窗：子弹窗先挂到 body（React 先提交子节点），按层级抬高 z-index 保证它在上层
  const depth = useContext(ModalDepth);
  // Esc 关闭最上层弹窗；打开期间锁住页面滚动（嵌套弹窗按计数恢复）。locked 时 Esc 只拦住，不调用 onClose。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const all = document.querySelectorAll(".modal-sheet");
      if (all[all.length - 1] !== sheetRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      if (lockedRef.current) return;
      // 游戏全屏中：Esc 先退出全屏；再按一次才关闭弹窗
      closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    const b = document.body;
    const n = Number(b.dataset.modals ?? 0) + 1;
    b.dataset.modals = String(n);
    if (n === 1) b.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      const m = Number(b.dataset.modals ?? 1) - 1;
      b.dataset.modals = String(m);
      if (m <= 0) b.style.overflow = "";
    };
  }, []);
  const sheetRef = useRef<HTMLDivElement>(null);
  // 功能注释：优先挂到平台暗红壳，再回退 romance-host / body，保证弹窗继承当前皮肤 token
  const portalRoot = romancePortalRoot();
  if (!portalRoot) return null;
  return createPortal(
    <ModalDepth.Provider value={depth + 1}>
    <div className={`ui-overlay ui-overlay-modal z-50 ${heavyBackdrop ? "ui-overlay-heavy" : ""}`} style={{ zIndex: 50 + depth * 10 }} onClick={locked ? undefined : onClose}>
      <div
        ref={sheetRef}
        className={`ui-sheet modal-sheet max-h-[92dvh] sm:max-h-[88dvh] overflow-x-auto overflow-y-auto overscroll-contain ${
          xl ? "w-[min(1200px,96vw)] min-w-[min(1200px,96vw)] max-w-[1200px]" : wide ? "max-w-2xl" : "max-w-lg"
        }`}
        onClick={(e) => e.stopPropagation()}
        role={locked ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-label={title}
      >
        <div className="ui-sheet-head-bar sticky top-0 z-10 rounded-t-[var(--radius-ui-lg)]">
          <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3.5 sm:px-5">
            <h3 className="ui-title flex min-w-0 items-center gap-2 truncate sm:text-[17px]">
              <IconSpark size="md" className="shrink-0 text-coral" />
              {title}
            </h3>
            {locked ? null : (
              <div className="flex shrink-0 items-center gap-1">
                <button onClick={onClose} aria-label="关闭" className="ui-icon-btn">
                  <IconClose />
                </button>
              </div>
            )}
          </div>
        </div>
        <div className={`px-4 pb-5 pt-1 sm:px-5`}>{children}</div>
      </div>
    </div>
    </ModalDepth.Provider>,
    portalRoot,
  );
}

/* —— 头像（点击打开头像选择：本地上传 / 创作者头像库 / 系统头像库） —— */
export function Avatar({ src, name, size = 48, onPick, editable = true, square = true, avatarSlot }: { src?: string; name: string; size?: number; onPick?: (dataUrl: string) => void; editable?: boolean; square?: boolean; avatarSlot?: import("../lib/types").AvatarSlot | null }) {
  const ref = useRef<HTMLInputElement>(null);
  const [lib, setLib] = useState(false);
  /** 功能注释：本地上传先进裁切+预览，确认后再写入 onPick */
  const [localFile, setLocalFile] = useState<File | null>(null);
  const pick = (f?: File) => {
    if (!f || !onPick) return;
    setLocalFile(f);
  };
  // 功能注释：name 偶发非字符串（脏 NPC），禁止 name?.trim() 崩页
  const initial = String(name ?? "").trim()[0] || "?";
  const Tag = editable ? "button" : "span";
  return (
    <>
    <Tag
      {...(editable ? { type: "button" as const, onClick: () => (onPick ? setLib(true) : ref.current?.click()) } : {})}
      className={`group relative flex shrink-0 overflow-hidden ${square ? "" : "rounded-full"} border border-line bg-gradient-to-br from-jade/25 to-coral/15 ${editable ? "cursor-pointer" : "cursor-default"}`}
      style={{ width: size, height: size, ...(square ? { borderRadius: Math.max(6, Math.round(size * 0.18)) } : {}) }}
      aria-label={editable ? `更换${name}的头像` : name}
    >
      {src ? (
        <img src={(src) || undefined} alt={name} className={`h-full w-full object-cover ${square ? "object-center" : ""}`} />
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
    </Tag>
    {editable && (
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/*"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    )}
    {/* 弹窗经 portal 渲染，但 React 事件仍沿组件树冒泡：拦住，免得点遮罩又触发外层按钮 */}
    {lib && onPick && (
      <span className="contents" onClick={(e) => e.stopPropagation()}>
        <AvatarLibraryPicker name={name} current={src} slot={avatarSlot}
          onPick={(url) => { onPick(url); setLib(false); }}
          onUpload={() => { setLib(false); ref.current?.click(); }}
          onClose={() => setLib(false)} />
      </span>
    )}
    {localFile && onPick ? (
      <span className="contents" onClick={(e) => e.stopPropagation()}>
        <LocalAvatarCropFlow
          file={localFile}
          onDone={(dataUrl) => {
            onPick(dataUrl);
            setLocalFile(null);
          }}
          onCancel={() => setLocalFile(null)}
        />
      </span>
    ) : null}
    </>
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

/* —— 能力进度条：圆角轨道 + 主题色填充 + 顶部高光（替代旧的 [▮▮▯] 文本条） —— */
const BAR_FILL: Record<string, string> = {
  jade: "from-[var(--jade)] to-[var(--jade-deep)]",
  coral: "from-[var(--coral)] to-[var(--jade)]",
  gold: "from-[var(--gold)] to-[var(--coral)]",
  danger: "from-[var(--danger)] to-[var(--coral)]",
};
/** 属性色：主题色名（jade/coral/gold/danger）→ CSS 变量；#hex 为创作者自定义色 */
export const toneColor = (tone?: string) => (!tone ? "var(--jade)" : tone.startsWith("#") ? tone : `var(--${tone})`);
/** 档位徽章样式（随属性色） */
export const toneChip = (tone?: string) => { const c = toneColor(tone); return { color: c, borderColor: `color-mix(in srgb, ${c} 40%, transparent)`, background: `color-mix(in srgb, ${c} 10%, transparent)` }; };
export function BlockBar({ value, max, min = 0, tone = "jade" }: { value: number; max: number; min?: number; tone?: string; cells?: number }) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min || 1)) * 100));
  const custom = tone.startsWith("#");
  return (
    <span role="progressbar" aria-valuenow={value} aria-valuemax={max} className="relative block h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-ink-soft/15 ring-1 ring-inset ring-line/60">
      <span
        className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${custom ? "" : BAR_FILL[tone] ?? BAR_FILL.jade} transition-[width] duration-700 ease-out`}
        style={{ width: `${pct}%`, ...(custom ? { background: `linear-gradient(to right, ${tone}, color-mix(in srgb, ${tone} 70%, black))` } : {}) }}
      >
        <span aria-hidden className="absolute inset-x-0 top-0 h-1/2 rounded-full bg-white/35" />
      </span>
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
  const cls = ["jade", "coral", "gold", "danger"].includes(tone) ? `tone-${tone}` : "";
  return <span className={`ui-chip text-[11px] ${cls}`}>{children}</span>;
}

/** 心形计量：5 颗心按百分比填充（支持部分填充）。color 为填充色，track 为空心底色。 */
export function HeartMeter({ pct, color = "var(--coral)", track = "color-mix(in srgb, var(--ink-soft) 22%, transparent)", size = 14 }: { pct: number; color?: string; track?: string; size?: number }) {
  const p = Math.max(0, Math.min(100, pct));
  const d = "M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.3 2.6h2c.7-1.4 2.2-2.6 4.3-2.6 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z";
  return (
    <span role="meter" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100} className="inline-flex items-center gap-[3px]">
      {Array.from({ length: 5 }, (_, i) => {
        const f = Math.max(0, Math.min(1, p / 20 - i));
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
            <path d={d} fill={track} />
            <path d={d} fill={color} style={{ clipPath: `inset(0 ${(1 - f) * 100}% 0 0)` }} />
          </svg>
        );
      })}
    </span>
  );
}

/* 「本回合动向」：展示 AI 经 tabs 分发给该 Tab 的一句话摘要（只在当前回合显示，过期即隐藏） */
export function TabDigest({ digest, turn }: { digest?: { text: string; turn: number }; turn: number }) {
  if (!digest || digest.turn !== turn) return null;
  return (
    <p className="mb-3 flex items-start gap-2 rounded-xl border border-jade/25 bg-jade/[0.06] px-3 py-2 text-[12px] leading-relaxed text-ink">
      <span className="mt-[3px] shrink-0 rounded-[4px] bg-jade/15 px-1.5 text-[10px] font-bold leading-[16px] text-jade">本回合</span>
      <span className="min-w-0">{digest.text}</span>
    </p>
  );
}
