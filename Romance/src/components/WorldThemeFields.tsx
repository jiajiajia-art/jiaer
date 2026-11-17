/**
 * 功能注释：基本信息 · 世界题材——只能从平台题材列表勾选（单选），写入 themeTagId / themeLabel / themeCode。
 * 题材驱动玩法 / 应用的适用提示，以及通讯换皮（绿信 / 传讯）。变更经 onPatch → patchWorldTheme。
 */
import { COMMS_SKIN_OPTIONS, type WorldThemeFieldsPatch, type WorldThemeHint } from "../lib/worldTheme";
import type { PlatformThemeTag } from "../lib/platformThemeTags";

const inp = "w-full min-w-0 rounded-lg border border-line bg-paper-2 px-2.5 py-1.5 text-[12.5px] text-ink placeholder:text-ink-soft/70 focus:border-jade focus:outline-none";
const lbl = "mb-0.5 block text-[10.5px] font-bold tracking-[0.12em] text-ink-soft";
const chip = (on: boolean) =>
  `rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition ${
    on ? "border-jade/50 bg-jade/15 text-jade" : "border-line bg-paper text-ink-soft hover:border-jade/40 hover:text-ink"
  }`;

export default function WorldThemeFields({
  value,
  tags,
  onPatch,
  compact,
}: {
  value: WorldThemeHint;
  /** 平台公共题材；只能勾选这些，不可手填 */
  tags: PlatformThemeTag[];
  onPatch: (patch: Partial<WorldThemeFieldsPatch>) => void;
  /** 创作向导：只留题材；完整编辑器可再调通讯皮肤 */
  compact?: boolean;
}) {
  const pickTag = (tag: PlatformThemeTag | null) => {
    if (!tag) {
      onPatch({ themeTagId: null, themeLabel: "", themeCode: "" });
      return;
    }
    const same = value.themeTagId === tag.id;
    if (same) {
      onPatch({ themeTagId: null, themeLabel: "", themeCode: "" });
      return;
    }
    onPatch({
      themeTagId: tag.id,
      themeLabel: tag.name || "",
      themeCode: tag.code || "",
    });
  };

  const orphan =
    value.themeTagId != null && !tags.some((t) => t.id === value.themeTagId)
      ? { id: value.themeTagId, name: value.themeLabel || `题材 #${value.themeTagId}`, code: value.themeCode || "" }
      : null;

  return (
    <div
      data-world-theme-fields
      className={compact ? "space-y-1.5" : "mt-2 space-y-2 rounded-xl border border-line/70 bg-paper-2/40 p-2.5"}
    >
      {!compact ? <p className="text-[12px] font-bold text-ink">世界题材</p> : null}
      <div className={`grid grid-cols-1 gap-2 ${compact ? "" : "sm:grid-cols-2"}`}>
        <div className={compact ? undefined : "sm:col-span-2"} data-world-theme-tag>
          <span className={lbl}>题材 *</span>
          {tags.length ? (
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto" role="group" aria-label="平台题材">
              {orphan && (
                <button
                  type="button"
                  aria-pressed
                  className={chip(true)}
                  onClick={() => pickTag(null)}
                  title="已失效或不在当前平台列表，再点取消"
                >
                  {orphan.name} ×
                </button>
              )}
              {tags.map((t) => {
                const on = value.themeTagId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={on}
                    className={chip(on)}
                    onClick={() => pickTag(t)}
                  >
                    {t.name || `#${t.id}`}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-line bg-paper px-2.5 py-2 text-[12px] text-ink-soft">
              平台题材加载中或暂不可用，稍后再试。
            </p>
          )}
        </div>
        {!compact && (
          <label>
            <span className={lbl}>通讯 App 皮肤</span>
            <select
              data-world-theme-comms-skin
              className={inp}
              value={value.commsSkin === "modern" || value.commsSkin === "letter" ? value.commsSkin : ""}
              onChange={(e) => onPatch({ commsSkin: e.target.value })}
            >
              {COMMS_SKIN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}
