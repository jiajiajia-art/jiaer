/* 十二星座占星符号 —— 线性 SVG 字形，随字色 currentColor，替代 emoji 符号 */
import type { ReactNode, SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

/* 每个星座的路径（24×24 视图，stroke 描边） */
const GLYPHS: Record<string, ReactNode> = {
  // 白羊：中央下垂茎 + 两侧上卷羊角
  aries: <><path d="M12 21V10" /><path d="M12 10C12 5.5 9.5 4 7.2 5.4 5.4 6.5 5.4 8.8 6.6 9.6" /><path d="M12 10C12 5.5 14.5 4 16.8 5.4 18.6 6.5 18.6 8.8 17.4 9.6" /></>,
  // 金牛：圆脸 + 顶部弯角
  taurus: <><circle cx="12" cy="16" r="4.4" /><path d="M5.5 4.5C5.5 9.4 8.4 11.6 12 11.6S18.5 9.4 18.5 4.5" /></>,
  // 双子：两竖 + 上下弧
  gemini: <><path d="M8.5 6.5v11M15.5 6.5v11" /><path d="M6 6.2c3.5-2 8.5-2 12 0M6 17.8c3.5 2 8.5 2 12 0" /></>,
  // 巨蟹：上下双弧 + 两枚小圆（69 意象）
  cancer: <><path d="M4 9.5c5.5-3.5 10.5-3.5 16 0M20 14.5c-5.5 3.5-10.5 3.5-16 0" /><circle cx="6.5" cy="9.2" r="1.5" /><circle cx="17.5" cy="14.8" r="1.5" /></>,
  // 狮子：小环 + 上扬尾巴
  leo: <><circle cx="9.5" cy="15.5" r="2.8" /><path d="M12.2 14.6c-.8-3.6 1.2-6.8 4-5 2.2 1.4 1.7 4.4-.2 5.8-1.4 1-1.6 2.6-.6 4" /></>,
  // 处女：三竖含尾环（M 加内收）
  virgo: <><path d="M5.5 17V9c0-2 2.6-2 2.6 0v8M8.1 17V9c0-2 2.6-2 2.6 0v8M10.7 9c0-2 2.6-2 2.6 0v6c0 3.4 3.4 3 4.5.6M13.3 15c1.4 2.4 3.6 1.4 3.6-1.2" /></>,
  // 天秤：横线 + 上方带隆起的横杆
  libra: <><path d="M4 19h16" /><path d="M4 14.5h5.2c0-3.4 5.6-3.4 5.6 0H20" /></>,
  // 天蝎：三竖含尾环 + 箭头（M 加箭尾）
  scorpio: <><path d="M5 16V9c0-2 2.6-2 2.6 0v7M7.6 16V9c0-2 2.6-2 2.6 0v7M10.2 9c0-2 2.6-2 2.6 0v8" /><path d="M13 17l4 3M17 20v-3.6M17 20h-3.4" /></>,
  // 射手：斜箭 + 交叉横杆
  sagittarius: <><path d="M6 18L18 6M18 6h-5M18 6v5" /><path d="M9 11l4 4" /></>,
  // 摩羯：V 转圈尾（简化）
  capricorn: <><path d="M5 7c2-1 3 1 3 3v7M8 6c2-1 3 1 3 3v6" /><path d="M11 12c1-3 4-3 5-.5 1 2.4-.4 4.7-2.6 4.7-1.7 0-2.8-1.4-2.4-3.2" /></>,
  // 水瓶：两道水波纹
  aquarius: <><path d="M4 9l3-2 3 2 3-2 3 2 3-2M4 15l3-2 3 2 3-2 3 2 3-2" /></>,
  // 双鱼：两弧背向 + 中横连
  pisces: <><path d="M7 5c-3 2.8-3 11.4 0 14M17 5c3 2.8 3 11.4 0 14" /><path d="M5 12h14" /></>,
};

export function ZodiacSign({ id, ...props }: { id: string } & P) {
  const glyph = GLYPHS[id] ?? GLYPHS.aries;
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {glyph}
    </svg>
  );
}
