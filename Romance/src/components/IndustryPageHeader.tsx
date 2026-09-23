import type { ReactNode } from "react";

type IndustryPageHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  flush?: boolean;
};

/** 娱乐圈 / 人脉共用刊头：紧凑的艺人通告刊头，不挤占内容区域。 */
export default function IndustryPageHeader({ eyebrow, title, subtitle, icon, flush = true }: IndustryPageHeaderProps) {
  return (
    <header className={`relative w-full shrink-0 overflow-hidden border-line bg-paper-2 px-4 py-2.5 shadow-[0_12px_30px_-24px_rgba(52,44,40,0.72)] sm:px-5 ${flush ? "border-b" : "border"}`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(118deg,rgba(255,255,255,0.62),transparent_42%,rgba(185,138,70,0.10))]" aria-hidden />
      <div className="pointer-events-none absolute right-0 top-0 h-20 w-20 translate-x-6 -translate-y-6 rounded-full border border-gold/25" aria-hidden />
      <div className="pointer-events-none absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" aria-hidden />

      <div className="relative flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-3">
            <h1 className="font-serif text-[24px] font-black leading-[1.2] tracking-[0.06em] text-ink">{title}</h1>
            <p className="truncate text-[12px] font-semibold tracking-[0.18em] text-ink-soft">{subtitle}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="hidden text-right text-[12px] font-semibold tracking-[0.08em] text-gold sm:block">{eyebrow}</span>
          <span className="sm:hidden text-[12px] font-semibold text-gold">{eyebrow.replace("STAR CITY WEEKLY · ", "")}</span>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gold/45 bg-gold/10 text-gold shadow-[0_8px_18px_-12px_var(--gold)]">
            {icon}
          </span>
        </div>
      </div>
    </header>
  );
}
