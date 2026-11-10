/**
 * 功能注释：世界题材编辑区（C0.2 / P4.1）——创作者在「基本信息」里写 themeLabel / themeCode / commsSkin / 平台题材。
 * 题材驱动：安装玩法 / 应用的适用题材提示，以及局内通讯换皮（绿信 / 传讯）。
 * 只做受控输入：值来自 Mod 清单，变更经 onPatch 回到 ModEditorPanel 的 setM（patchWorldTheme 统一清洗）。
 */
import { COMMS_SKIN_OPTIONS, type WorldThemeFieldsPatch, type WorldThemeHint } from "../lib/worldTheme";
import type { PlatformThemeTag } from "../lib/platformThemeTags";

const inp = "w-full min-w-0 rounded-lg border border-line bg-paper-2 px-2.5 py-1.5 text-[12.5px] text-ink placeholder:text-ink-soft/70 focus:border-jade focus:outline-none";
const lbl = "mb-0.5 block text-[10.5px] font-bold tracking-[0.12em] text-ink-soft";

export default function WorldThemeFields({
  value,
  tags,
  onPatch,
}: {
  value: WorldThemeHint;
  /** 平台公共题材；为空（未加载 / 失败）时题材 id 退化成数字输入 */
  tags: PlatformThemeTag[];
  onPatch: (patch: Partial<WorldThemeFieldsPatch>) => void;
}) {
  const current = tags.find((t) => t.id === value.themeTagId);
  return (
    <div data-world-theme-fields className="mt-2 space-y-2 rounded-xl border border-line/70 bg-paper-2/40 p-2.5">
      <p className="text-[12px] font-bold text-ink">世界题材</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label>
          <span className={lbl}>题材名</span>
          <input
            data-world-theme-label
            className={inp}
            value={value.themeLabel}
            placeholder="如：现代都市 / 古代仙侠"
            onChange={(e) => onPatch({ themeLabel: e.target.value })}
          />
        </label>
        <label>
          <span className={lbl}>题材 code（可选）</span>
          <input
            data-world-theme-code
            className={`${inp} font-mono`}
            value={value.themeCode}
            placeholder="如：modern / ancient"
            onChange={(e) => onPatch({ themeCode: e.target.value })}
          />
        </label>
        <label>
          <span className={lbl}>平台题材</span>
          {tags.length ? (
            <select
              data-world-theme-tag
              className={inp}
              value={value.themeTagId ?? ""}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null;
                const tag = tags.find((t) => t.id === id);
                // 功能注释：选了平台题材顺手补空的题材名 / code，已手填的不覆盖
                onPatch({
                  themeTagId: id,
                  ...(tag && !value.themeLabel ? { themeLabel: tag.name } : {}),
                  ...(tag && !value.themeCode && tag.code ? { themeCode: tag.code } : {}),
                });
              }}
            >
              <option value="">未选择</option>
              {value.themeTagId != null && !current && <option value={value.themeTagId}>题材 #{value.themeTagId}</option>}
              {tags.map((t) => <option key={t.id} value={t.id}>{t.name || `#${t.id}`}</option>)}
            </select>
          ) : (
            <input
              data-world-theme-tag-id
              type="number"
              min={1}
              className={inp}
              value={value.themeTagId ?? ""}
              placeholder="平台题材 id（可空）"
              onChange={(e) => onPatch({ themeTagId: e.target.value ? Number(e.target.value) : null })}
            />
          )}
        </label>
        <label>
          <span className={lbl}>通讯 App 皮肤</span>
          <select
            data-world-theme-comms-skin
            className={inp}
            value={value.commsSkin === "modern" || value.commsSkin === "letter" ? value.commsSkin : ""}
            onChange={(e) => onPatch({ commsSkin: e.target.value })}
          >
            {COMMS_SKIN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>
      <p className="text-[11px] leading-relaxed text-ink-soft">题材决定安装玩法时的适用提示；通讯皮肤选「自动」时按题材判断（古代 / 仙侠用「传讯」，其余用「绿信」）。</p>
    </div>
  );
}
