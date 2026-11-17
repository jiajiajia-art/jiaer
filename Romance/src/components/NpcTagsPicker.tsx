/**
 * 人物标签：卡片上只显示入口行；点开后弹窗勾选平台标签 + 自定义。
 */
import { useState } from "react";
import { PLATFORM_NPC_TAGS, isPlatformNpcTag, normalizeNpcTags, toggleNpcTag, voiceDrivingTag } from "../lib/npcTags";
import { Modal } from "./ui";

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
  const [open, setOpen] = useState(false);

  const addCustom = () => {
    const t = draft.trim();
    if (!t) return;
    onChange(toggleNpcTag(selected, t, true));
    setDraft("");
  };

  const voiceHint = (() => {
    const d = voiceDrivingTag(selected);
    if (!selected.length) return "未勾标签时嗓音按年龄";
    return d ? `嗓音由「${d.tag}」决定` : "已勾标签不影响嗓音";
  })();

  return (
    <>
      {/* 功能注释：入口放在人物卡上，完整勾选进弹窗，避免长标签墙占屏 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full min-w-0 items-start gap-2 rounded-lg border border-line bg-paper-2 px-2.5 py-2 text-left transition hover:border-jade/50"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-semibold text-ink">
            人物标签
            {selected.length > 0 ? <span className="ml-1 font-bold text-jade">{selected.length}</span> : null}
          </span>
          <span className="mt-0.5 block text-[10.5px] leading-snug text-ink-soft">
            影响私聊口吻 · {voiceHint}
          </span>
          {selected.length > 0 && (
            <span className="mt-1.5 flex flex-wrap gap-1">
              {selected.slice(0, 6).map((t) => (
                <span key={t} className={chip(true)}>{t}</span>
              ))}
              {selected.length > 6 && (
                <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-soft">+{selected.length - 6}</span>
              )}
            </span>
          )}
        </span>
        <span aria-hidden className="mt-0.5 shrink-0 text-[13px] text-ink-soft">›</span>
      </button>

      {open && (
        <Modal title="人物标签" onClose={() => setOpen(false)}>
          <div className="space-y-2.5">
            <p className="text-[11.5px] leading-snug text-ink-soft">
              影响私聊口吻 · {voiceHint}
            </p>
            <div className="flex max-h-[min(50vh,22rem)] flex-wrap gap-1.5 overflow-y-auto" role="group" aria-label="平台人物标签">
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
                className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-jade"
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
                className="shrink-0 rounded-full border border-line bg-paper px-3 py-1.5 text-[12px] font-semibold text-ink hover:border-jade hover:text-jade"
                onClick={addCustom}
              >
                添加
              </button>
            </div>
            <button
              type="button"
              className="w-full rounded-xl bg-jade py-2.5 text-[13px] font-bold text-white"
              onClick={() => setOpen(false)}
            >
              完成
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
