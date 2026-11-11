import type { ReactNode } from "react";

type IndustryPageHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle: string;
  icon?: ReactNode;
  action?: ReactNode;
};

/** 页面刊头：贴边全宽 + 顶缘主色发丝线 + 左侧主色竖条 + 标题首字水印；全部由主题变量驱动，随皮肤换色 */
export default function IndustryPageHeader({ eyebrow, title, subtitle, icon, action }: IndustryPageHeaderProps) {
  return (
    <header className="relative w-full select-none">
      <div
        className="relative overflow-hidden px-5 pb-4 pt-[max(16px,calc(env(safe-area-inset-top)+10px))]"
        style={{
          background:
            "linear-gradient(118deg, color-mix(in srgb, var(--coral) 11%, var(--paper-2)) 0%, var(--paper-2) 48%, color-mix(in srgb, var(--jade) 9%, var(--paper-2)) 100%)",
        }}
      >
        {/* 顶缘发丝高光 */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[var(--coral)] via-[var(--jade)] to-transparent opacity-70" />
        {/* 标题首字水印 */}
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-6 right-20 font-serif text-[88px] font-black leading-none text-jade opacity-[0.07]"
        >
          {title.slice(0, 1)}
        </span>
        {/* 细点阵纹理 */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-[0.35]"
          style={{
            backgroundImage: "radial-gradient(color-mix(in srgb, var(--jade) 22%, transparent) 0.8px, transparent 0.8px)",
            backgroundSize: "9px 9px",
            maskImage: "linear-gradient(90deg, transparent, #000 70%)",
            WebkitMaskImage: "linear-gradient(90deg, transparent, #000 70%)",
          }}
        />

        <div className="relative flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span aria-hidden className="h-10 w-[3px] shrink-0 rounded-[2px] bg-gradient-to-b from-[var(--jade)] to-[var(--coral)]" />
            <div className="min-w-0">
              <p className="whitespace-nowrap text-[10.5px] font-bold tracking-[0.32em] text-ink-soft">{subtitle}</p>
              <h1 className="mt-1 truncate font-serif text-[24px] font-black leading-[1.1] tracking-[0.1em] text-ink">{title}</h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {action}
            {eyebrow && (
              <span className="rounded-[6px] border border-line bg-paper/80 px-2.5 py-1.5 text-[12px] font-bold leading-none tracking-[0.1em] text-jade-deep">{eyebrow}</span>
            )}
            {icon && <span className="grid h-8 w-8 place-items-center rounded-[8px] border border-line bg-paper/80 text-gold">{icon}</span>}
          </div>
        </div>
        {/* 底缘渐变分隔线 */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-[var(--coral)]/50 via-[var(--line)] to-[var(--jade)]/40" />
      </div>
    </header>
  );
}
