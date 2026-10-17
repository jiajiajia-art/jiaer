/** 功能注释：读 /auth/user/info 的处罚短字段，判断禁发是否仍生效 */

export function isPublishBanned(publishBanUntil?: string | null): boolean {
  if (!publishBanUntil) return false;
  const until = Date.parse(publishBanUntil);
  return Number.isFinite(until) && until > Date.now();
}

export function isHomeHidden(homeHidden?: boolean | null): boolean {
  return homeHidden === true;
}
