import { cleanPerks } from "../game/routeFx";

/* 线路卡片的开局数值行：建角页、编辑器预览、线路管理面板共用，保证三处看到的完全一致。
 * 标题由作者自填（perksLabel），留空则只显示内容，不带任何固定前缀 */
export default function RoutePerks({ label, text, className = "" }: { label?: string; text?: string; className?: string }) {
  const t = cleanPerks(text);
  if (!t) return null;
  return (
    <p className={`rounded-lg bg-gold/5 px-2.5 py-1.5 text-[12px] leading-relaxed text-ink ${className}`}>
      {label?.trim() && <span className="font-semibold text-gold">{label.trim()}　</span>}{t}
    </p>
  );
}
