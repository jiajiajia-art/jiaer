/**
 * 功能注释：本机草稿 vs 已保存版本——两张对照卡，时间一眼可见，点卡即选。
 * 冲突提示放顶部；卡片收紧，只留名称、时间、一句说明和操作。
 */
import { IconClock, IconSave } from "../lib/icons";

export default function DraftConflictChoice({
  draftAtLabel,
  savedAtLabel,
  stale,
  onPickDraft,
  onPickSaved,
}: {
  /** 已格式化的草稿时间，如「今天 19:11」 */
  draftAtLabel: string;
  /** 已格式化的保存时间；没有则传空串 */
  savedAtLabel?: string;
  stale?: boolean;
  onPickDraft: () => void;
  onPickSaved: () => void;
}) {
  const savedLabel = savedAtLabel?.trim() || "";

  return (
    <div className="space-y-2.5">
      {stale ? (
        <p className="rounded-xl border border-danger/35 bg-danger/10 px-3 py-2 text-[12px] leading-relaxed text-danger">
          草稿留下之后，已保存版本又改过。选「本机草稿」会盖住那些后来的修改。
        </p>
      ) : (
        <p className="text-[13px] leading-relaxed text-ink-soft">
          本机留了一份未保存的编辑，和已保存版本不一样。选一份继续。
        </p>
      )}
      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          autoFocus
          onClick={onPickDraft}
          className="group flex flex-col items-stretch rounded-xl border-2 border-jade/45 bg-gradient-to-b from-jade/12 to-paper px-3 py-2.5 text-left shadow-[0_8px_18px_-16px_color-mix(in_srgb,var(--jade)_55%,transparent)] transition hover:border-jade hover:from-jade/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade/40"
        >
          <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.06em] text-jade">
            <IconClock size={13} className="shrink-0" />
            本机草稿
            <span className="ml-auto text-[15px] font-bold tabular-nums leading-none text-ink">{draftAtLabel}</span>
          </span>
          <span className="mt-1 text-[11.5px] leading-snug text-ink-soft">写到一半时自动留下的</span>
          <span className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-jade px-3 py-1.5 text-[12px] font-bold text-white transition group-hover:brightness-105">
            用这份继续
          </span>
        </button>
        <button
          type="button"
          onClick={onPickSaved}
          className="group flex flex-col items-stretch rounded-xl border border-line bg-paper px-3 py-2.5 text-left transition hover:border-ink-soft/50 hover:bg-paper-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20"
        >
          <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.06em] text-ink-soft">
            <IconSave size={13} className="shrink-0" />
            已保存版本
            {savedLabel ? (
              <span className="ml-auto text-[15px] font-bold tabular-nums leading-none text-ink">{savedLabel}</span>
            ) : null}
          </span>
          <span className="mt-1 text-[11.5px] leading-snug text-ink-soft">上次点「保存」写入的那份</span>
          <span className="mt-2 inline-flex w-full items-center justify-center rounded-full border border-line bg-paper-2 px-3 py-1.5 text-[12px] font-bold text-ink transition group-hover:border-ink-soft/40">
            用这份开始
          </span>
        </button>
      </div>
    </div>
  );
}
