/** 功能注释：作品发布审核流水；契约为 record_type=publish_review（勿再靠中文正文推断） */

export function isPublishReviewModeration(input: {
  recordType?: string | null;
}): boolean {
  return String(input.recordType || '').toLowerCase() === 'publish_review';
}
