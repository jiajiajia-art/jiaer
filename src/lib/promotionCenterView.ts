/**
 * 功能注释：活动中心列表展示（结束时间角标、投稿形式文案），对齐效果图卡片样式。
 */

export type PromotionSubmissionAcceptFlags = {
  acceptTexts?: boolean;
  acceptLinks?: boolean;
  acceptImages?: boolean;
  acceptVideos?: boolean;
};

export type PromotionEndTimeSource = {
  endAt?: string | null;
  isLongTerm?: boolean;
};

/** 功能注释：封面右下角结束时间；长期活动回退为长期文案 */
export function formatPromotionEndTimeBadge(
  activity: PromotionEndTimeSource,
  labels: { longTerm: string; endTimePrefix: string },
): string {
  if (activity.isLongTerm || !activity.endAt) {
    return labels.longTerm;
  }

  const date = new Date(activity.endAt);
  if (Number.isNaN(date.getTime())) {
    return labels.longTerm;
  }

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${labels.endTimePrefix} ${month}月${day}日${hour}:${minute}`;
}

/** 功能注释：按活动投稿开关收集形式标签（文本/链接/图片/视频） */
export function collectAcceptedSubmissionLabels(
  config: PromotionSubmissionAcceptFlags | null | undefined,
  labels: { text: string; link: string; image: string; video: string },
): string[] {
  if (!config) return [];
  const parts: string[] = [];
  if (config.acceptTexts) parts.push(labels.text);
  if (config.acceptLinks) parts.push(labels.link);
  if (config.acceptImages) parts.push(labels.image);
  if (config.acceptVideos) parts.push(labels.video);
  return parts;
}

/** 功能注释：投稿形式一行展示，对齐效果图「文本投稿，图片投稿」 */
export function joinPromotionFormLabels(labels: string[], separator = '，'): string {
  return labels.filter((item) => Boolean(String(item || '').trim())).join(separator);
}

export type PromotionSubmissionReviewStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'reward_pending'
  | 'reward_issued';

export type PromotionSubmissionListBadgeTone = 'reviewing' | 'published' | 'returned';

/** 功能注释：列表角标三态对齐效果图（审核中 / 已发布 / 已退回） */
export function resolveSubmissionListBadgeTone(
  reviewStatus: PromotionSubmissionReviewStatus | string | null | undefined,
): PromotionSubmissionListBadgeTone {
  if (reviewStatus === 'pending_review') return 'reviewing';
  if (reviewStatus === 'rejected') return 'returned';
  return 'published';
}

export type PromotionSubmissionStats = {
  total: number;
  reviewing: number;
  published: number;
};

/** 功能注释：我的投稿顶栏统计（总投稿 / 审核中 / 已发布） */
export function buildPromotionSubmissionStats(
  submissions: Array<{ reviewStatus?: string | null }>,
): PromotionSubmissionStats {
  let reviewing = 0;
  let published = 0;
  for (const item of submissions) {
    const tone = resolveSubmissionListBadgeTone(item.reviewStatus);
    if (tone === 'reviewing') reviewing += 1;
    else if (tone === 'published') published += 1;
  }
  return {
    total: submissions.length,
    reviewing,
    published,
  };
}

/** 功能注释：列表提交时间短格式，对齐效果图「2026.3.3」 */
export function formatSubmissionListDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
}

/** 功能注释：投稿卡片封面优先活动封面，其次投稿首图 */
export function resolveSubmissionCoverUrl(input: {
  activityCoverImageUrl?: string | null;
  activityCoverFromList?: string | null;
  firstPayloadImage?: string | null;
}): string {
  return String(
    input.activityCoverImageUrl
      || input.activityCoverFromList
      || input.firstPayloadImage
      || '',
  ).trim();
}
