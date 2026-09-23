/* 线性风格 SVG 图标集（统一 stroke，随字色 currentColor） */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (props: P) => ({
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

export const IconBook = (p: P) => (
  <svg {...base(p)}><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5z" /><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H12v16h6.5A1.5 1.5 0 0 0 20 18.5z" /></svg>
);
export const IconUser = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
);
export const IconUsers = (p: P) => (
  <svg {...base(p)}><circle cx="9" cy="8" r="3" /><path d="M3 19a6 6 0 0 1 12 0" /><path d="M16 5.5a3 3 0 0 1 0 5.8M21 19a6 6 0 0 0-4-5.6" /></svg>
);
export const IconSpark = (p: P) => (
  <svg {...base(p)}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></svg>
);
export const IconClock = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 1.5" /></svg>
);
export const IconPin = (p: P) => (
  <svg {...base(p)}><path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z" /><circle cx="12" cy="11" r="2.2" /></svg>
);
export const IconHeart = (p: P) => (
  <svg {...base(p)}><path d="M12 20s-7-4.5-9-9.2C1.6 7 3.6 4 6.8 4 9 4 12 6 12 6s3-2 5.2-2C20.4 4 22.4 7 21 10.8 19 15.5 12 20 12 20z" /></svg>
);
export const IconBackpack = (p: P) => (
  <svg {...base(p)}><path d="M6 10a6 6 0 0 1 12 0v9a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z" /><path d="M9 10V7a3 3 0 0 1 6 0v3" /><path d="M9 14h6a2 2 0 0 1 2 2v4H7v-4a2 2 0 0 1 2-2z" /><path d="M10.5 14v-1.5h3V14" /></svg>
);
export const IconWallet = (p: P) => (
  <svg {...base(p)}><path d="M4 7a2 2 0 0 1 2-2h11a1 1 0 0 1 1 1v2" /><path d="M4 7v10a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-3M4 7v0" /><path d="M20 10h-4a2 2 0 0 0 0 4h4a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1z" /><circle cx="16.5" cy="12" r=".6" fill="currentColor" stroke="none" /></svg>
);
export const IconSettings = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" /></svg>
);
export const IconSave = (p: P) => (
  <svg {...base(p)}><path d="M5 4h11l3 3v13H5z" /><path d="M8 4v5h7V4M8 20v-6h8v6" /></svg>
);
export const IconMoon = (p: P) => (
  <svg {...base(p)}><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /></svg>
);
export const IconSun = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9 6.3 6.3M17.7 17.7 19.1 19.1M19.1 4.9 17.7 6.3M6.3 17.7 4.9 19.1" /></svg>
);
export const IconSend = (p: P) => (
  <svg {...base(p)}><path d="M4 12l16-8-5 16-4-6-7-2z" /></svg>
);
export const IconSparkle = (p: P) => (
  <svg {...base(p)}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /></svg>
);
export const IconFlask = (p: P) => (
  <svg {...base(p)}><path d="M9 3h6M10 3v6l-5 8.5A2 2 0 0 0 6.8 21h10.4a2 2 0 0 0 1.8-3.5L14 9V3" /><path d="M7.5 15h9" /></svg>
);
export const IconScroll = (p: P) => (
  <svg {...base(p)}><path d="M6 4h11a2 2 0 0 1 2 2v11a3 3 0 0 1-3 3H7" /><path d="M6 4a2 2 0 0 0-2 2v1h4M8 20a3 3 0 0 1-3-3v-1" /><path d="M10 9h6M10 13h6" /></svg>
);
export const IconClose = (p: P) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconCamera = (p: P) => (
  <svg {...base(p)}><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.2" /></svg>
);
export const IconDice = (p: P) => (
  <svg {...base(p)}><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="9" cy="9" r="1" fill="currentColor" /><circle cx="15" cy="9" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="9" cy="15" r="1" fill="currentColor" /><circle cx="15" cy="15" r="1" fill="currentColor" /></svg>
);
export const IconFlag = (p: P) => (
  <svg {...base(p)}><path d="M6 21V4M6 4h11l-2 3.5L17 11H6" /></svg>
);
export const IconPlay = (p: P) => (
  <svg {...base(p)}><path d="M7 5l12 7-12 7z" /></svg>
);
export const IconRefresh = (p: P) => (
  <svg {...base(p)}><path d="M4 12a8 8 0 0 1 13.7-5.6L20 8M20 4v4h-4M20 12a8 8 0 0 1-13.7 5.6L4 16M4 20v-4h4" /></svg>
);
