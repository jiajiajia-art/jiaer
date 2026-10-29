/** 功能注释：读 /auth/user/info 的处罚短字段，判断禁发/隐藏/冻结/先审 */

export function isPublishBanned(publishBanUntil?: string | null): boolean {
  if (!publishBanUntil) return false;
  const until = Date.parse(publishBanUntil);
  return Number.isFinite(until) && until > Date.now();
}

export function isHomeHidden(homeHidden?: boolean | null): boolean {
  return homeHidden === true;
}

export function isCreatorFrozen(creatorFrozen?: boolean | null): boolean {
  return creatorFrozen === true;
}

export function isPublishNeedReview(publishNeedReview?: boolean | null): boolean {
  return publishNeedReview === true;
}
