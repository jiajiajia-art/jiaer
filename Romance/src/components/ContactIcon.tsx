import type { ContactIcon as Kind } from "../game/contacts";

/* 人脉卡片数值图标：纯展示，图标与数值语义无绑定，由作者在人物上方的关系配置里自选 */
const PATHS: Record<Kind, { d: string; fill?: boolean }> = {
  dot: { d: "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z", fill: true },
  heart: { d: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z", fill: true },
  star: { d: "m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z", fill: true },
  gem: { d: "M6 3h12l3 6-9 12L3 9z M3 9h18 M12 21 8 9l4-6 4 6z" },
  book: { d: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z M4 21V5 M8 7h7" },
  sword: { d: "M14.5 3H21v6.5L10 20.5 3.5 14z M6 17l-3 3 M8 13l3 3" },
  coin: { d: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M9 9h6 M9 13h6 M12 9v8" },
  flame: { d: "M12 2c1 4 5 5.5 5 10.5a5 5 0 0 1-10 0C7 9 9 8 9 5c2 1 3 3 3 5 1-1 1-4 0-8z", fill: true },
  shield: { d: "M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z" },
  eye: { d: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" },
  leaf: { d: "M5 19C5 9 11 4 20 4c0 9-5 15-15 15z M5 19 13 11" },
  moon: { d: "M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z", fill: true },
};

export default function ContactIcon({ kind, size = 11 }: { kind: Kind; size?: number }) {
  const p = PATHS[kind] ?? PATHS.dot;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill={p.fill ? "currentColor" : "none"} stroke={p.fill ? "none" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={p.d} />
    </svg>
  );
}
