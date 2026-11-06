/**
 * 功能注释：平台本体入口门禁。玩家只看说明；作者 createWorld / 预览、后台 platformTest 或运营角色可进。
 */
export function shouldGateRomancePlatformShell(input: {
  search?: string;
  hasWorldGenSession?: boolean;
  isAuthorPreview?: boolean;
  isStaff?: boolean;
}): boolean {
  const raw = String(input.search || '');
  const q = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw);
  if (q.get('createWorld') === '1' || q.get('createWorld') === 'true') return false;
  if (q.get('createPlayMod') === '1' || q.get('createPlayMod') === 'true') return false;
  if (q.get('platformTest') === '1') return false;
  if (input.hasWorldGenSession) return false;
  if (input.isAuthorPreview) return false;
  if (input.isStaff) return false;
  return true;
}

/** 从 funloom 主站 auth 本地缓存读角色（Romance 子应用不直接依赖主站 store） */
export function readFunloomStaffFromStorage(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    const keys = ['auth-storage', 'funloom-auth', 'user-storage'];
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const role = String(
        parsed?.state?.user?.user?.role
        || parsed?.state?.user?.role
        || parsed?.user?.user?.role
        || parsed?.user?.role
        || '',
      ).toLowerCase();
      if (role === 'admin' || role === 'operator') return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
