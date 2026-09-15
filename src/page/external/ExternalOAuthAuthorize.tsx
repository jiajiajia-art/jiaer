import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AuthModal from '../../components/AuthModal';
import { externalSdkApi } from '../../api/externalSdkApi';
import { useAuthStore } from '../../store/useAuthStore';
import { getApiErrorMessage } from '../../utils/error';
import { parseExternalAuthorizeParams } from '../../utils/externalSdkPages';
import styles from './ExternalSdkPage.module.css';

export default function ExternalOAuthAuthorize() {
  const [searchParams] = useSearchParams();
  const params = useMemo(() => parseExternalAuthorizeParams(searchParams), [searchParams]);
  const authUser = useAuthStore((state) => state.user?.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [authOpen, setAuthOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successText, setSuccessText] = useState('');

  const handleAuthorize = async () => {
    if (!params.valid || submitting) return;
    if (!isAuthenticated) {
      setAuthOpen(true);
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessText('');
    try {
      const response = await externalSdkApi.createAuthCode({
        appId: params.appId,
        redirectUri: params.redirectUri,
        externalUserId: params.externalUserId || undefined,
        state: params.state || undefined,
      });
      const redirectUrl = response.data.data?.redirectUrl;
      if (!redirectUrl) {
        throw new Error('授权结果缺少回跳地址');
      }
      setSuccessText('授权成功，正在返回外部游戏。');
      window.location.assign(redirectUrl);
    } catch (err) {
      setError(getApiErrorMessage(err, '授权失败，请检查外部应用配置后重试。'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeny = async () => {
    if (!params.valid || submitting) return;
    setSubmitting(true);
    setError('');
    setSuccessText('');
    try {
      const response = await externalSdkApi.denyAuth({
        appId: params.appId,
        redirectUri: params.redirectUri,
        state: params.state || undefined,
      });
      const target = response.data.data?.redirectUrl;
      if (!target) {
        throw new Error('拒绝授权结果缺少回跳地址');
      }
      window.location.assign(target);
    } catch (err) {
      setError(getApiErrorMessage(err, '拒绝授权失败，请回到外部游戏重试。'));
    } finally {
      setSubmitting(false);
    }
  };

  const currentName = authUser?.nickname || authUser?.phoneNumber || authUser?.userCode || '当前账号';

  return (
    <main className={styles.shell}>
      <section className={styles.panel} aria-labelledby="external-oauth-title">
        <div className={styles.brandRow}>
          <img src="/funloom/data/assets/funloom_icon.png" alt="Funloom" className={styles.logo} />
          <span className={styles.brandName}>Funloom</span>
        </div>

        <div className={styles.heroBlock}>
          <p className={styles.eyebrow}>External Game Authorization</p>
          <h1 id="external-oauth-title">授权外部游戏连接 Funloom</h1>
          <p className={styles.lead}>
            外部游戏将通过一次性授权码完成账号绑定。授权码会在短时间内失效，不会向外部页面暴露你的登录密码。
          </p>
        </div>

        {!params.valid ? (
          <div className={styles.noticeError} role="alert">
            授权链接缺少必要参数，请回到外部游戏重新发起绑定。
          </div>
        ) : (
          <>
            <div className={styles.summary}>
              <div>
                <span>外部应用</span>
                <strong>{params.appId}</strong>
              </div>
              <div>
                <span>回跳地址</span>
                <strong>{params.redirectUri}</strong>
              </div>
              {params.externalUserId && (
                <div>
                  <span>外部用户</span>
                  <strong>{params.externalUserId}</strong>
                </div>
              )}
              <div>
                <span>Funloom 账号</span>
                <strong>{isAuthenticated ? currentName : '尚未登录'}</strong>
              </div>
            </div>

            {error && <div className={styles.noticeError} role="alert">{error}</div>}
            {successText && <div className={styles.noticeSuccess} role="status">{successText}</div>}

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleAuthorize}
                disabled={submitting}
              >
                {submitting ? '授权中...' : isAuthenticated ? '确认授权并返回' : '登录后授权'}
              </button>
              <button type="button" className={styles.secondaryButton} onClick={handleDeny} disabled={submitting}>
                拒绝并返回
              </button>
            </div>
          </>
        )}
      </section>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </main>
  );
}
