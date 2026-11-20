import { useState } from "react";
import { Modal } from "./ui";
import type { RomancePublishInput } from "../lib/platformRomanceDraft";

/**
 * 功能注释：Romance 编辑器「提交发布审核」弹窗。
 * 简介已在作品信息填写，此处不再重复；首次上架也不要更新说明。
 * 只选面向人群，并勾选合并后的协议行后才可提交；默认不勾。
 */
const AUDIENCE: { k: RomancePublishInput["audienceType"]; label: string }[] = [
  { k: "all", label: "全部" },
  { k: "female", label: "女性向" },
  { k: "male", label: "男性向" },
];

export default function PublishReviewModal({
  workName,
  defaultDescription,
  busy,
  onCancel,
  onSubmit,
}: {
  workName: string;
  /** 功能注释：沿用作品信息里的简介，弹窗不再编辑 */
  defaultDescription: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: RomancePublishInput) => void;
}) {
  const [audienceType, setAudience] = useState<RomancePublishInput["audienceType"]>("all");
  const [agree, setAgree] = useState(false);

  const canSubmit = agree && !busy;

  return (
    <Modal
      title="提交发布审核"
      onClose={() => { if (!busy) onCancel(); }}
      heavyBackdrop
      locked={busy}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" disabled={busy} onClick={onCancel} className="rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-ink-soft transition hover:text-ink disabled:opacity-40">
            取消
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onSubmit({
              description: defaultDescription.trim(),
              audienceType,
              notifyFavoritedUsers: false,
            })}
            className="rounded-full bg-jade px-5 py-2 text-[13px] font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-40"
          >
            {busy ? "提交中…" : "同意并提交"}
          </button>
        </div>
      }
    >
      <div className="space-y-5 text-[13px]">
        <div className="rounded-2xl border border-jade/15 bg-gradient-to-br from-jade/[0.12] via-jade/[0.06] to-transparent px-4 py-3.5">
          <p className="mb-1 flex items-center gap-1.5 text-[12px] font-bold text-jade">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-jade/15">✓</span>
            提交前请确认
          </p>
          <p className="pl-6 text-[12px] leading-relaxed text-ink-soft">
            「<b className="text-ink">{workName || "未命名作品"}</b>」会先保存当前修改，再提交给平台审核。审核通过后才会公开上架，结果会发到你的消息中心。
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-end justify-between">
            <div>
              <span className="block text-[13px] font-bold text-ink">面向人群</span>
              <span className="mt-0.5 block text-[11px] text-ink-soft">帮助平台将作品推荐给感兴趣的用户</span>
            </div>
            <span className="rounded-full bg-paper-2 px-2 py-0.5 text-[10px] font-semibold text-ink-soft">可随时修改</span>
          </div>
          <div className="grid grid-cols-3 rounded-2xl border border-line bg-paper-2 p-1">
            {AUDIENCE.map((a) => (
              <button
                key={a.k}
                type="button"
                onClick={() => setAudience(a.k)}
                className={`rounded-xl px-3 py-2 text-[12px] font-semibold transition ${audienceType === a.k ? "bg-jade text-white shadow-[0_3px_10px_-4px_var(--jade)]" : "text-ink-soft hover:bg-paper hover:text-ink"}`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-paper-2/60 px-3.5 py-3">
          <label className="flex cursor-pointer items-start gap-2.5 text-[12.5px] leading-relaxed text-ink">
            <input type="checkbox" className="mt-0.5 h-[17px] w-[17px] shrink-0 accent-jade" checked={agree} disabled={busy} onChange={(e) => setAgree(e.target.checked)} />
            <span>
              我已阅读并同意{" "}
              <a href="/legal/creator-agreement" target="_blank" rel="noreferrer" className="font-semibold text-jade underline-offset-2 hover:underline">《创作者协议》</a>
              {" "}与{" "}
              <a href="/legal/work-review-standards" target="_blank" rel="noreferrer" className="font-semibold text-jade underline-offset-2 hover:underline">《作品审核标准》</a>
            </span>
          </label>
        </div>
      </div>
    </Modal>
  );
}
