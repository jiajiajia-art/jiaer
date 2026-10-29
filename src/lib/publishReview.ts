/** 功能注释：先审后发 — 公开成功进队（pending_review），非 403 主路径 */

export type PublishApiPayload = {
  success?: boolean;
  code?: string | null;
  message?: string | null;
  data?: {
    moderation_status?: string | null;
    moderationStatus?: string | null;
  } | null;
};

export function isPublishPendingReview(payload: PublishApiPayload | null | undefined): boolean {
  if (!payload) return false;
  if (payload.code === 'pending_review') return true;
  const status = payload.data?.moderationStatus || payload.data?.moderation_status;
  return status === 'pending_review';
}
