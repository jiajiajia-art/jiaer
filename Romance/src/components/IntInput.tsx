import { useState } from "react";

const inp = "w-full min-w-0 rounded-full border border-line bg-paper-2 px-2.5 py-1 text-[12px] text-ink placeholder:text-ink-soft/70 focus:border-jade focus:outline-none";

/* 整数输入：只接受整数（可带负号），输入中途的「-」/ 空白先留着，失焦后回到最近一次合法值 */
export default function IntInput({ value, onChange, label, className = "" }: { value: number; onChange: (v: number) => void; label: string; className?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value);
  const bad = draft !== null && !/^-?\d+$/.test(draft);
  return (
    <input
      type="text" inputMode="numeric" aria-label={label} aria-invalid={bad || undefined}
      className={`${inp} !w-20 shrink-0 text-right tabular-nums ${bad ? "!border-danger" : ""} ${className}`}
      value={shown}
      onChange={(e) => {
        const t = e.target.value.replace(/\s/g, "");
        if (!/^-?\d{0,9}$/.test(t)) return; // 小数点、字母等直接拒收
        setDraft(t);
        if (/^-?\d+$/.test(t)) onChange(parseInt(t, 10));
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

