import { useState } from "react";
import { Modal } from "./ui";
import type { RomancePublishInput } from "../lib/platformRomanceDraft";

/**
 * 功能注释：Romance 编辑器「提交发布审核」弹窗。
 * 填简介 / 受众 / 更新说明，并勾选《创作者协议》《作品审核标准》后才可提交；默认不勾。
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
  defaultDescription: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: RomancePublishInput) => void;
}) {
  const [description, setDescription] = useState(defaultDescription);
  const [versionNotes, setVersionNotes] = useState("");
  const [audienceType, setAudience] = useState<RomancePublishInput["audienceType"]>("all");
  const [notify, setNotify] = useState(true);
  const [agreeCreator, setAgreeCreator] = useState(false);
  const [agreeStandards, setAgreeStandards] = useState(false);

  const descOk = description.trim().length > 0;
  const canSubmit = descOk && agreeCreator && agreeStandards && !busy;
  const field = "w-full rounded-xl border border-line bg-paper-2 px-3 py-2 text-[13px] text-ink placeholder:text-ink-soft/60 focus:border-jade focus:outline-none";

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
            onClick={() => onSubmit({ description: description.trim(), versionNotes: versionNotes.trim() || undefined, audienceType, notifyFavoritedUsers: notify })}
            className="rounded-full bg-jade px-5 py-2 text-[13px] font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-40"
          >
            {busy ? "提交中…" : "同意并提交"}
          </button>
        </div>
      }
    >
      <div className="space-y-4 text-[13px]">
        <p className="rounded-xl bg-jade/10 px-3 py-2 text-[12px] leading-relaxed text-ink-soft">
          「<b className="text-ink">{workName || "未命名作品"}</b>」会先保存当前修改，再提交给平台审核。审核通过后才会公开上架，结果会发到你的消息中心。
        </p>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-bold text-ink">作品简介 <span className="text-danger">*</span></span>
          <textarea rows={4} className={field} value={description} maxLength={500} placeholder="玩家在详情页看到的介绍" onChange={(e) => setDescription(e.target.value)} />
          <span className="mt-1 block text-right text-[11px] text-ink-soft">{description.length}/500</span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[12px] font-bold text-ink">更新说明 <span className="font-normal text-ink-soft">（选填）</span></span>
          <input className={field} value={versionNotes} maxLength={200} placeholder="这一版改了什么" onChange={(e) => setVersionNotes(e.target.value)} />
        </label>

        <div>
          <span className="mb-1.5 block text-[12px] font-bold text-ink">面向人群</span>
          <div className="inline-flex rounded-full border border-line bg-paper-2 p-0.5">
            {AUDIENCE.map((a) => (
              <button
                key={a.k}
                type="button"
                onClick={() => setAudience(a.k)}
                className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${audienceType === a.k ? "bg-jade text-white shadow-sm" : "text-ink-soft hover:text-ink"}`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-ink">
          <input type="checkbox" className="h-4 w-4 accent-jade" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          通知收藏了这部作品的玩家
        </label>

        <div className="space-y-2 border-t border-line pt-3">
          <label className="flex cursor-pointer items-start gap-2 text-[12.5px] text-ink">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-jade" checked={agreeCreator} disabled={busy} onChange={(e) => setAgreeCreator(e.target.checked)} />
            <span>我已阅读并同意 <a href="/legal/creator-agreement" target="_blank" rel="noreferrer" className="font-semibold text-jade underline-offset-2 hover:underline">《创作者协议》</a></span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-[12.5px] text-ink">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-jade" checked={agreeStandards} disabled={busy} onChange={(e) => setAgreeStandards(e.target.checked)} />
            <span>我已阅读并同意 <a href="/legal/work-review-standards" target="_blank" rel="noreferrer" className="font-semibold text-jade underline-offset-2 hover:underline">《作品审核标准》</a></span>
          </label>
        </div>
      </div>
    </Modal>
  );
}
