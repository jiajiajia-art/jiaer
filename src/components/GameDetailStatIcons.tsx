/**
 * 功能注释：作品详情统计条图标（内联 SVG），避免 public SVG 编码/加载失败导致裂图。
 */
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const baseProps: IconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
  'aria-hidden': true,
  focusable: 'false',
};

/** 效果图：圆角方框 + 右上箭头 */
export function DetailShareIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path
        d="M8.5 5.25H7.25A2.75 2.75 0 0 0 4.5 8v9.25A2.75 2.75 0 0 0 7.25 20h9.25A2.75 2.75 0 0 0 19.25 17.25V15.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.25 4.5H19.5V9.75"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.2 4.8 11.75 12.25"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 效果图：实心白心 */
export function DetailHeartIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path
        fill="currentColor"
        d="M12 20.4S4.8 15.55 4.8 10.2C4.8 7.35 7 5.2 9.8 5.2c1.55 0 2.95.72 3.4 1.85.45-1.13 1.85-1.85 3.4-1.85 2.8 0 5 2.15 5 5 0 5.35-7.2 10.2-7.2 10.2z"
      />
    </svg>
  );
}

/** 效果图：实心五角星 */
export function DetailStarIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path
        fill="currentColor"
        d="M12 2.8l2.55 5.35 5.9.66-4.4 4.05 1.22 5.8L12 15.9l-5.27 2.76 1.22-5.8-4.4-4.05 5.9-.66L12 2.8z"
      />
    </svg>
  );
}
