import type { ReactNode } from "react";
import { useGame } from "../store/gameCtx";
import { GLYPHS } from "../lib/iconGlyphs";

/* 可 DIY 的图标位：玩家换了图片 → 显示图片；换了内置图标 → 显示该图标；否则显示原图标（children）。
 * 颜色 / 线宽 / 大小由根节点上的 CSS 变量统一控制（见 index.css「图标 DIY」）。 */
export default function DiyIcon({ slot, size = 18, children }: { slot: string; size?: number; children: ReactNode }) {
  const { look } = useGame();
  const d = look.icons;
  const img = d?.imgs?.[slot];
  const g = d?.glyphs?.[slot] ? GLYPHS[d.glyphs[slot]] : undefined;
  return (
    <span className="diy-ico" aria-hidden>
      {img ? <img src={img} alt="" style={{ width: size * 1.2, height: size * 1.2 }} className="object-contain" />
        : g ? <g.C width={size} height={size} />
        : children}
    </span>
  );
}
