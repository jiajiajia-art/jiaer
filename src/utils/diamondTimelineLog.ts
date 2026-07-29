/**
 * 管理端钻石时间线：把 activity_type + description 译成运营可读文案
 */

export type DiamondTimelineLogInput = {
  activityType: string;
  diamonds: number;
  description?: string | null;
  businessId?: string | null;
};

function safeParseJson(raw: string | null | undefined): Record<string, unknown> | null {
  const text = String(raw || '').trim();
  if (!text || (text[0] !== '{' && text[0] !== '[')) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function asNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asString(value: unknown): string {
  return String(value ?? '').trim();
}

const TITLE_MAP: Record<string, string> = {
  diamonds_recharge: '钻石充值',
  diamonds_recharge_bonus: '充值赠送',
  game_purchase: '购买付费游戏',
  member_subscription: '会员订阅',
  revenue_share: '创作者收益分成',
  exchange_to_points: '兑换积分',
  custom_if_pay: '自定义应用消费',
  withdraw_apply: '提现申请扣减',
  withdraw_refund: '提现驳回退回',
};

/**
 * @returns 一行可读日志，例如「兑换积分（消耗 2 钻，获得 20 积分）」
 */
export function formatDiamondTimelineLog(item: DiamondTimelineLogInput): string {
  const type = String(item.activityType || '').trim();
  const absDiamonds = Math.abs(Number(item.diamonds) || 0);
  const meta = safeParseJson(item.description);
  const biz = asString(item.businessId);
  const title = TITLE_MAP[type] || (Number(item.diamonds) >= 0 ? '钻石收入' : '钻石支出');

  if (type === 'exchange_to_points') {
    const spent = asNumber(meta?.diamondsSpent) ?? absDiamonds;
    const earned = asNumber(meta?.pointsEarned);
    if (earned != null) {
      return `${title}（消耗 ${spent} 钻，获得 ${earned} 积分）`;
    }
    return `${title}（消耗 ${spent} 钻）`;
  }

  if (type === 'revenue_share') {
    const settleNo = biz || asString(meta?.settlementId) || asString(meta?.settleId);
    const fileCount = Array.isArray(meta?.fileIds) ? meta.fileIds.length : 0;
    const parts = [`获得 ${absDiamonds} 钻`];
    if (settleNo) parts.push(`结算单 ${settleNo}`);
    if (fileCount > 0) parts.push(`涉及 ${fileCount} 个作品`);
    return `${title}（${parts.join('，')}）`;
  }

  if (type === 'custom_if_pay') {
    const appName = asString(meta?.appName) || asString(meta?.reason);
    if (appName) return `${title}（${appName}，消耗 ${absDiamonds} 钻）`;
    if (biz) return `${title}（消耗 ${absDiamonds} 钻，单号 ${biz.slice(0, 12)}…）`;
    return `${title}（消耗 ${absDiamonds} 钻）`;
  }

  if (type === 'diamonds_recharge' || type === 'diamonds_recharge_bonus') {
    const orderNo = asString(meta?.orderNo) || biz;
    const planId = asString(meta?.planId);
    const parts = [`获得 ${absDiamonds} 钻`];
    if (planId) parts.push(`档位 ${planId}`);
    if (orderNo) parts.push(`订单 ${orderNo}`);
    return `${title}（${parts.join('，')}）`;
  }

  if (type === 'withdraw_apply') {
    return `${title}（冻结/扣减 ${absDiamonds} 钻${biz ? `，单号 ${biz}` : ''}）`;
  }

  if (type === 'withdraw_refund') {
    return `${title}（退回 ${absDiamonds} 钻${biz ? `，单号 ${biz}` : ''}）`;
  }

  if (type === 'game_purchase') {
    const gameTitle = asString(meta?.title) || asString(meta?.fileId);
    return gameTitle
      ? `${title}（${gameTitle}，消耗 ${absDiamonds} 钻）`
      : `${title}（消耗 ${absDiamonds} 钻）`;
  }

  // 非 JSON 的 description：若已是中文可读句则直接用
  const rawDesc = asString(item.description);
  if (rawDesc && !rawDesc.startsWith('{') && !/^[a-f0-9]{16,}$/i.test(rawDesc)) {
    return `${title}（${rawDesc}）`;
  }

  return absDiamonds > 0
    ? `${title}（${Number(item.diamonds) >= 0 ? '获得' : '消耗'} ${absDiamonds} 钻）`
    : title;
}

/** 展示用时间：去掉 T/Z，便于运营阅读 */
export function formatDiamondTimelineTime(raw: string | null | undefined): string {
  const text = String(raw || '').trim();
  if (!text) return '—';
  return text.replace('T', ' ').replace(/\.\d{3}Z?$/, '').replace(/Z$/, '');
}
