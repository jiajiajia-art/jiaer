/**
 * 人物标签选择：平台内置 50 个勾选 + 自定义追加；禁止只留一个纯输入框。
 */
import { useState } from "react";
import { PLATFORM_NPC_TAGS, isPlatformNpcTag, normalizeNpcTags, toggleNpcTag, voiceDrivingTag } from "../lib/npcTags";

const chip = (on: boolean) =>
  `rounded-full border px-2 py-0.5 text-[11px] font-semibold transition ${
    on ? "border-jade/50 bg-jade/15 text-jade" : "border-line bg-paper text-ink-soft hover:border-jade/40 hover:text-ink"
  }`;

export default function NpcTagsPicker({
  value,
  onChange,
}: {
  value?: string[];
  onChange: (tags: string[] | undefined) => void;
}) {
  const selected = normalizeNpcTags(value);
  const custom = selected.filter((t) => !isPlatformNpcTag(t));
  const [draft, setDraft] = useState("");

  const addCustom = () => {
    const t = draft.trim();
    if (!t) return;
    onChange(toggleNpcTag(selected, t, true));
    setDraft("");
  };

  return (
    <div className="space-y-1.5 rounded-lg border border-line bg-paper-2/50 p-2">
      <p className="text-[11px] text-ink-soft">
        <b className="font-semibold text-ink">人物标签</b> · 勾选平台常用标签，也可自定义
      </p>
      {/* 功能注释：如实告诉作者标签在哪些地方参与演绎；改动接入范围时同步改这行 */}
      <ul className="space-y-0.5 text-[10.5px] leading-relaxed text-ink-soft">
        <li><b className="font-semibold text-ink">私聊 / 当面说话</b>：全部已勾标签写进对话提示词，口吻、态度随之变化。</li>
        <li><b className="font-semibold text-ink">语音嗓音</b>：{(() => {
          const d = voiceDrivingTag(selected);
          if (!selected.length) return "未勾标签，按年龄决定。";
          return d ? `由「${d.tag}」决定（${d.effect}）；其余标签只影响说话内容，不改嗓音。` : "已勾标签都不影响嗓音，按年龄决定；说话内容仍按标签。";
        })()}</li>
        <li><b className="font-semibold text-ink">人物资料</b>：不直接显示标签，只在玩家点「生成近况」时用于撰写近况。</li>
      </ul>
      <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto" role="group" aria-label="平台人物标签">
        {PLATFORM_NPC_TAGS.map((t) => {
          const on = selected.includes(t);
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on}
              className={chip(on)}
              onClick={() => onChange(toggleNpcTag(selected, t, !on))}
            >
              {t}
            </button>
          );
        })}
      </div>
      {custom.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {custom.map((t) => (
            <button
              key={t}
              type="button"
              className={`${chip(true)} inline-flex items-center gap-1`}
              onClick={() => onChange(toggleNpcTag(selected, t, false))}
              aria-label={`移除自定义标签 ${t}`}
            >
              {t} ×
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <input
          className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-2 py-1 text-[12px] text-ink outline-none focus:border-jade"
          value={draft}
          maxLength={12}
          placeholder="自定义标签，回车或点添加"
          aria-label="自定义人物标签"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
        />
        <button
          type="button"
          className="shrink-0 rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink hover:border-jade hover:text-jade"
          onClick={addCustom}
        >
          添加
        </button>
      </div>
    </div>
  );
}
