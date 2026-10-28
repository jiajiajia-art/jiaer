/* 自定义属性数值：点按即可直接改数（状态栏 / 角色属性面板共用），回车或失焦保存，Esc 取消 */
import { useState } from "react";
import { useGame } from "../store/gameCtx";
import type { AttrDef } from "../lib/types";
import { attrCap, customAttrValue, setCustomAttr } from "../game/wallet";

export default function AttrValueEdit({ def, className = "", flash = false }: { def: AttrDef; className?: string; flash?: boolean }) {
  const { game, patchGame } = useGame();
  const [draft, setDraft] = useState<string | null>(null);
  if (!game) return null;
  const v = customAttrValue(game, def);
  const cap = attrCap(def.max);
  const save = () => {
    const n = Number(draft);
    if (draft !== null && draft.trim() !== "" && Number.isFinite(n) && n !== v) patchGame((g) => setCustomAttr(g, def, n));
    setDraft(null);
  };
  if (draft !== null) {
    return (
      <input
        autoFocus
        type="number"
        inputMode="numeric"
        value={draft}
        min={def.min ?? 0}
        max={Number.isFinite(cap) ? cap : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") save(); else if (e.key === "Escape") setDraft(null); }}
        onClick={(e) => e.stopPropagation()}
        aria-label={`修改${def.label}`}
        className="w-16 rounded-md border border-coral/50 bg-paper px-1 text-right text-[12px] font-semibold tabular-nums text-ink outline-none focus:ring-2 focus:ring-coral/30"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setDraft(String(v)); }}
      title={`点按修改${def.label}${Number.isFinite(cap) ? `（${def.min ?? 0}~${cap}）` : "（无上限）"}`}
      className={`rounded-md font-semibold tabular-nums text-ink underline decoration-dotted decoration-ink-soft/40 underline-offset-2 transition hover:bg-coral/10 ${flash ? "animate-flash inline-block" : ""} ${className}`}
    >
      {v.toLocaleString("zh-CN")}
    </button>
  );
}
