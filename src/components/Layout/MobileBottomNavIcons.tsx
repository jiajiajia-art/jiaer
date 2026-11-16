/**
 * 功能注释：底部导航图标统一 viewBox 0 0 24 24 + 同等描边，避免设计稿切片 viewBox 不一导致「有的特别大有的特别小」。
 * 创作中钮仍为红底白加号，尺寸由 CSS .createIcon 单独放大。
 */
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { active?: boolean };

const outlineBase: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24',
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
  'aria-hidden': true,
  focusable: 'false',
};

const stroke = {
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** 首页：房屋描边 */
export function BottomNavHomeIcon({ active: _active, ...props }: IconProps) {
  return (
    <svg {...outlineBase} {...props}>
      <path
        {...stroke}
        d="M3.5 10.2L12 3.5l8.5 6.7v10.1a1.2 1.2 0 01-1.2 1.2H14.5v-6.2h-5v6.2H4.7a1.2 1.2 0 01-1.2-1.2V10.2z"
      />
    </svg>
  );
}

/** 书架：书本描边 */
export function BottomNavBookshelfIcon({ active: _active, ...props }: IconProps) {
  return (
    <svg {...outlineBase} {...props}>
      <path {...stroke} d="M4 20.5h16" />
      <path {...stroke} d="M5 4.5h3.2v13.2H5V4.5z" />
      <path {...stroke} d="M10.2 6.2h3.2v11.5h-3.2V6.2z" />
      <path {...stroke} d="M15.2 5.4l3.5-.9 2.3 12.4-3.5.9-2.3-12.4z" />
    </svg>
  );
}

/** 创作：红底圆角钮 + 白加号（不受选中态染色） */
export function BottomNavCreateIcon({ active: _active, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 40 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden focusable="false" {...props}>
      <rect x="0" y="0" width="40" height="32" rx="11" fill="var(--color-primary)" />
      <path
        d="M12 16h8m0 0h8m-8 0V8m0 8v8"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 排行榜：领奖台三柱，和首页/书架同套描边 */
export function BottomNavRankingsIcon({ active: _active, ...props }: IconProps) {
  return (
    <svg {...outlineBase} {...props}>
      <path {...stroke} d="M4.5 19.5h15" />
      <path {...stroke} d="M6.2 19.5V12.2h3.6v7.3" />
      <path {...stroke} d="M10.2 19.5V7.2h3.6v12.3" />
      <path {...stroke} d="M14.2 19.5v-5.1h3.6v5.1" />
    </svg>
  );
}

/** 我的：人物描边 */
export function BottomNavProfileIcon({ active: _active, ...props }: IconProps) {
  return (
    <svg {...outlineBase} {...props}>
      <circle {...stroke} cx="12" cy="8" r="3.4" />
      <path {...stroke} d="M5.5 19.5c0-3.1 2.9-5.5 6.5-5.5s6.5 2.4 6.5 5.5" />
    </svg>
  );
}
