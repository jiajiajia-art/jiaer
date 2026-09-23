/* 手机 App 统一 SVG 图标集（替代 emoji），全部 currentColor，随字号/传入 size 缩放。 */
import type { SVGProps } from "react";

type P = { size?: number } & SVGProps<SVGSVGElement>;
const base = (size: number, props: SVGProps<SVGSVGElement>) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  "aria-hidden": true as const,
  ...props,
});

export function IconSearch({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" />
    </svg>
  );
}
export function IconClose({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
export function IconPlus({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
export function IconArrowUp({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V6M6 12l6-6 6 6" />
    </svg>
  );
}
export function IconMic({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
      <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
export function IconSmiley({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" strokeLinecap="round" />
      <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
export function IconImage({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="8.5" cy="9" r="1.6" /><path d="m4 18 5-5 4 4 3-3 4 4" />
    </svg>
  );
}
export function IconHeart({ size = 20, filled, ...p }: P & { filled?: boolean }) {
  return (
    <svg {...base(size, p)} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
      <path d="M12 20s-7-4.4-7-9.5A4 4 0 0 1 12 7a4 4 0 0 1 7 3.5C19 15.6 12 20 12 20Z" />
    </svg>
  );
}
export function IconStar({ size = 20, filled, ...p }: P & { filled?: boolean }) {
  return (
    <svg {...base(size, p)} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round">
      <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" />
    </svg>
  );
}
export function IconComment({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
      <path d="M4 5h16v11H9l-4 3v-3H4z" />
    </svg>
  );
}
export function IconRepost({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9V7a2 2 0 0 1 2-2h11m0 0-3-3m3 3-3 3M20 15v2a2 2 0 0 1-2 2H7m0 0 3 3m-3-3 3-3" />
    </svg>
  );
}
export function IconShare({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6M12 3v13M8 7l4-4 4 4" />
    </svg>
  );
}
export function IconMusic({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V6l10-2v10" /><circle cx="6" cy="18" r="3" fill="currentColor" stroke="none" /><circle cx="16" cy="16" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}
export function IconGift({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round">
      <path d="M4 11h16v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" /><path d="M3 8h18v3H3zM12 8v12" />
      <path d="M12 8S10 3.5 7.8 5.2C6.3 6.4 8 8 12 8Zm0 0s2-4.5 4.2-2.8C17.7 6.4 16 8 12 8Z" />
    </svg>
  );
}
export function IconPhone({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="currentColor">
      <path d="M6.6 3.5c.5-.1 1 .2 1.2.7l1.2 3a1 1 0 0 1-.3 1.1L7.4 9.5a12 12 0 0 0 5.1 5.1l1.2-1.3a1 1 0 0 1 1.1-.3l3 1.2c.5.2.8.7.7 1.2l-.6 2.8a1.2 1.2 0 0 1-1.3.9C9.6 18.4 5.6 14.4 4 6.4a1.2 1.2 0 0 1 .9-1.3z" />
    </svg>
  );
}
export function IconBackspace({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9L2 12z" /><path d="M16 9l-5 6M11 9l5 6" />
    </svg>
  );
}
export function IconCallOut({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.6 4.5 8 8 6.4 9.6a12 12 0 0 0 5 5L13 13l3.5 1.4.6 3.2C10.6 18.4 5.6 13.4 5 6.5zM15 9l5-5m0 0h-4m4 0v4" />
    </svg>
  );
}
export function IconEdit({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h4L18.5 9.5a2 2 0 0 0-2.8-2.8L5 17zM14 7l3 3" />
    </svg>
  );
}
export function IconGear({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M4.2 7l2.6 1.5M17.2 15.5l2.6 1.5M4.2 17l2.6-1.5M17.2 8.5l2.6-1.5" strokeLinecap="round" />
    </svg>
  );
}
export function IconWallet({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18" /><circle cx="16.5" cy="14" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
export function IconFire({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="currentColor">
      <path d="M13 2s1.5 3-.5 5.5S9 11 9 13a3 3 0 0 0 6 0c0-.8-.3-1.6-.3-1.6s2.3 1.3 2.3 4.1a5 5 0 0 1-10 0c0-3.4 2.4-4.6 3.5-7C11.7 5.6 11 3.5 13 2Z" />
    </svg>
  );
}
export function IconVerified({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="currentColor">
      <path d="m12 2 2.2 1.6 2.7-.2 1 2.5 2.3 1.4-.6 2.7 1 2.5-2 1.9.2 2.7-2.6.8-1.4 2.3-2.7-.4L12 22l-2.1-1.4-2.7.4-1.4-2.3-2.6-.8.2-2.7-2-1.9 1-2.5-.6-2.7 2.3-1.4 1-2.5 2.7.2z" />
      <path d="m8.5 12 2.3 2.3L15.5 10" fill="none" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function IconTicket({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round">
      <path d="M4 7a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4z" /><path d="M14 6v12" strokeDasharray="2 2" />
    </svg>
  );
}
export function IconFolder({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round">
      <path d="M3 7a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}
export function IconParty({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21 8 8l8 8zM13 12l3-3M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM20 10l.7 1.3 1.3.7-1.3.7-.7 1.3-.7-1.3L18 12l1.3-.7z" />
    </svg>
  );
}
export function IconClock({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  );
}
export function IconPin({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round">
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" /><circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}
export function IconEnvelope({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" />
    </svg>
  );
}
export function IconBook({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round">
      <path d="M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3z" /><path d="M17 7h2v13" />
    </svg>
  );
}
export function IconSun({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18h18M6.5 18a5.5 5.5 0 0 1 11 0" /><path d="M12 5v2M5 8l1.4 1.4M19 8l-1.4 1.4M2.5 13H4M20 13h1.5" />
    </svg>
  );
}
export function IconScan({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><path d="M3.5 12h17" />
    </svg>
  );
}
export function IconCompass({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M15.5 8.5 11 11l-2.5 4.5L13 13l2.5-4.5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
export function IconGrid({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round">
      <rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}
export function IconShop({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round">
      <path d="M5 8h14l-1 11a1 1 0 0 1-1 .9H7a1 1 0 0 1-1-.9z" /><path d="M9 8a3 3 0 0 1 6 0" strokeLinecap="round" />
    </svg>
  );
}
export function IconChevron({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}
export function IconPlay({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="currentColor">
      <path d="M7 4.5v15l13-7.5z" />
    </svg>
  );
}
export function IconHome({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
      <path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />
    </svg>
  );
}
export function IconUser({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0 1 16 0" strokeLinecap="round" />
    </svg>
  );
}
export function IconVideo({ size = 20, ...p }: P) {
  return (
    <svg {...base(size, p)} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round">
      <rect x="3" y="6" width="12" height="12" rx="2.5" /><path d="m15 10 6-3v10l-6-3z" />
    </svg>
  );
}
