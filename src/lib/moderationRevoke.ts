/** 功能注释：运营「撤销」按钮显隐 — 对齐 POST .../moderation/:id/revoke 口径 */

export type RevokeRecordKind = 'warning' | 'penalty';

export function resolveRevokeRecordKind(input: {
  recordType?: string | null;
  level?: number | null;
}): RevokeRecordKind | null {
  const type = String(input.recordType || '').toLowerCase();
  if (type === 'warning') return 'warning';
  if (type === 'penalty') return 'penalty';
  if (type === 'publish_review' || type === 'appeal' || type === 'moderation_revoke') {
    return null;
  }
  // 功能注释：处罚列表可能缺 recordType；level≥1 按处罚，否则不给撤
  const level = Number(input.level);
  if (Number.isFinite(level) && level >= 1 && level <= 4) return 'penalty';
  return null;
}

function isConsumed(consumed?: number | boolean | null): boolean {
  return consumed === true || consumed === 1 || String(consumed) === '1';
}

/** 是否在运营端展示「撤销」 */
export function canShowModerationRevoke(input: {
  id?: string | null;
  recordType?: string | null;
  level?: number | null;
  status?: string | null;
  consumed?: number | boolean | null;
  /** 当前账号生效处罚档；处罚撤销需要 level 与之相等 */
  activePenaltyLevel?: number | null;
}): boolean {
  const id = String(input.id || '').trim();
  if (!/^\d{16}$/.test(id)) return false;

  const kind = resolveRevokeRecordKind(input);
  if (!kind) return false;

  const status = String(input.status || '').toLowerCase();
  if (status === 'revoked') return false;

  if (kind === 'warning') {
    if (isConsumed(input.consumed) || status === 'consumed') return false;
    return true;
  }

  // penalty：仅当前生效档；status 多为 active / finished
  if (status && status !== 'active' && status !== 'finished') return false;
  const level = Number(input.level);
  const active = Number(input.activePenaltyLevel);
  if (!Number.isFinite(level) || level < 1) return false;
  // 功能注释：列表无 activePenaltyLevel 时，仅对 active 档开放（finished 需在详情对照当前档）
  if (!Number.isFinite(active) || active <= 0) {
    return status === 'active';
  }
  return level === active;
}
