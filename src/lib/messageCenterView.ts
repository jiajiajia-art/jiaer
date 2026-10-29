/**
 * 功能注释：消息中心列表展示（相对时间、分区、预览截断），对齐效果图会话列表样式。
 */

export type MessageListSectionKey = 'system' | 'activity' | 'interaction' | 'safety';

export type MessageFeedItemType =
  | 'announcement'
  | 'promotion'
  | 'promotion_submission_status'
  | 'favorite_game_updated'
  | 'game_moderation'
  | 'game_publish_appeal'
  | 'creator_earning_withdrawal'
  | 'report_received'
  | 'report_resolved'
  | 'moderation';

export type CreatorEarningWithdrawalMessageInput = {
  notificationType: 'approved' | 'paid' | 'rejected';
  grossCents: number;
  payoutCents: number;
  rejectionReason?: string | null;
};

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** 功能注释：列表右侧相对时间（上午10:42 / 昨天 / 周一 / 10月12日） */
export function formatMessageListTime(value?: string | null, now: Date = new Date()): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const dayDiff = Math.round((startOfLocalDay(now) - startOfLocalDay(date)) / 86_400_000);
  if (dayDiff === 0) {
    const hour = date.getHours();
    const minute = String(date.getMinutes()).padStart(2, '0');
    const period = hour < 12 ? '上午' : '下午';
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${period}${hour12}:${minute}`;
  }
  if (dayDiff === 1) return '昨天';
  if (dayDiff > 1 && dayDiff < 7) return WEEKDAY_LABELS[date.getDay()];
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 功能注释：安全通知卡片标题下日期 YYYY-MM-DD */
export function formatMessageDateYmd(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** 功能注释：安全通知卡片字段时间 YYYY-MM-DD HH:mm:ss */
export function formatMessageDateTime(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

/** 功能注释：预览一行截断，避免列表撑高 */
export function truncateMessagePreview(text: string, maxLen = 36): string {
  const cleaned = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen).trim()}…`;
}

/** 功能注释：消息类型归区；安全/违规为独立分区 */
export function resolveMessageListSection(itemType: MessageFeedItemType): MessageListSectionKey {
  if (
    itemType === 'announcement'
    || itemType === 'game_moderation'
    || itemType === 'game_publish_appeal'
    || itemType === 'creator_earning_withdrawal'
  ) return 'system';
  if (itemType === 'favorite_game_updated') return 'interaction';
  if (
    itemType === 'report_received'
    || itemType === 'report_resolved'
    || itemType === 'moderation'
  ) {
    return 'safety';
  }
  return 'activity';
}

function formatYuanFromCents(cents: number): string {
  const safeCents = Number.isFinite(cents) ? Math.max(0, Math.trunc(cents)) : 0;
  return `¥${(safeCents / 100).toFixed(2)}`;
}

export function buildCreatorEarningWithdrawalMessageView(
  notification: CreatorEarningWithdrawalMessageInput,
): { title: string; preview: string; detail: string } {
  const gross = formatYuanFromCents(notification.grossCents);
  if (notification.notificationType === 'approved') {
    return {
      title: '创作者收益提现审核通过',
      preview: `税前金额 ${gross}，等待打款`,
      detail: `本次提现申请税前金额 ${gross}，审核已通过，款项将在完成打款后到账。`,
    };
  }
  if (notification.notificationType === 'paid') {
    const payout = formatYuanFromCents(notification.payoutCents);
    return {
      title: '创作者收益已打款',
      preview: `税前金额 ${gross}，实际到账 ${payout}`,
      detail: `本次提现税前金额 ${gross}，扣除个人所得税后实际到账 ${payout}。`,
    };
  }

  const reason = String(notification.rejectionReason || '').trim() || '未填写驳回原因';
  return {
    title: '创作者收益提现已驳回',
    preview: `税前金额 ${gross}，原因：${reason}`,
    detail: `本次提现税前金额 ${gross}。驳回原因：${reason}`,
  };
}
