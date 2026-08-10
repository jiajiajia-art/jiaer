import { auth } from '../../api/account/authApi';
import { useAuthStore } from '../../store/useAuthStore';

/**
 * 从服务端拉最新用户信息（含积分）写回 auth store。
 * 后台改分后，本地登录缓存会过期，AI 扣费前应先刷新再本地预检。
 */
export async function refreshAuthUserPoints(): Promise<number | null> {
  try {
    const response = await auth.getUserInfo();
    const userInfo = response.data?.data;
    if (userInfo && typeof userInfo === 'object') {
      useAuthStore.getState().updateUser(userInfo);
      if (typeof userInfo.points === 'number') {
        return userInfo.points;
      }
    }
  } catch {
    /* 刷新失败时回退本地缓存 */
  }
  const cached = useAuthStore.getState().user?.user?.points;
  return typeof cached === 'number' ? cached : null;
}
