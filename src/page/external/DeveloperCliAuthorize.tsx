import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AuthModal from '../../components/AuthModal';
import { externalSdkApi } from '../../api/externalSdkApi';
import { useAuthStore } from '../../store/useAuthStore';
import { getApiErrorMessage } from '../../utils/error';
import { parseDeveloperCliAuthorizeParams } from '../../utils/externalSdkPages';
import styles from './ExternalSdkPage.module.css';

function appendCliResultUrl(redirectUri: string, params: Record<string, string>): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

export default function DeveloperCliAuthorize() {
  const [searchParams] = useSearchParams();
  const params = useMemo(() => parseDeveloperCliAuthorizeParams(searchParams), [searchParams]);
  const authUser = useAuthStore((state) => state.user?.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);
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
      const response = await externalSdkApi.authorizeDeveloperCli({
        redirectUri: params.redirectUri,
        state: params.state,
        codeChallenge: params.codeChallenge,
      });
      const redirectUrl = response.data.data?.redirectUrl;
      if (!redirectUrl) {
        throw new Error('授权结果缺少回跳地址');
      }
      setSuccessText('授权成功，正在返回 Funloom CLI。');
      window.location.assign(redirectUrl);
    } catch (err) {
      setError(getApiErrorMessage(err, 'CLI 授权失败，请回到终端重新发起登录。'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitchAccount = () => {
    if (submitting) return;
    logout();
    setError('');
    setSuccessText('已退出当前 Funloom 账号，请登录你要授权的账号。');
    setAuthOpen(true);
  };

  const handleDeny = () => {
    if (!params.valid || submitting) return;
    window.location.assign(appendCliResultUrl(params.redirectUri, {
      error: 'access_denied',
      state: params.state,
    }));
  };

  const currentName = authUser?.nickname || authUser?.phoneNumber || authUser?.userCode || '当前账号';

  return (
    <main className={styles.shell}>
      <section className={styles.panel} aria-labelledby="developer-cli-authorize-title">
        <div className={styles.brandRow}>
          <img src="/funloom/data/assets/funloom_icon.png" alt="Funloom" className={styles.logo} />
          <span className={styles.brandName}>Funloom</span>
        </div>

        <div className={styles.heroBlock}>
          <p className={styles.eyebrow}>Developer CLI Authorization</p>
          <h1 id="developer-cli-authorize-title">授权 Funloom CLI</h1>
          <p className={styles.lead}>
            Funloom CLI 将获得开发者授权，用于创建和查看你的外部游戏应用。授权不会向命令行暴露你的登录密码。
          </p>
        </div>

        {!params.valid ? (
          <div className={styles.noticeError} role="alert">
            CLI 授权链接缺少必要参数，请回到终端重新执行登录命令。
          </div>
        ) : (
          <>
            <div className={styles.summary}>
              <div>
                <span>回调地址</span>
                <strong>{params.redirectUri}</strong>
              </div>
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
                {submitting ? '授权中...' : isAuthenticated ? '确认授权 CLI' : '登录后授权'}
              </button>
              <button type="button" className={styles.secondaryButton} onClick={handleDeny} disabled={submitting}>
                拒绝
              </button>
              {isAuthenticated && (
                <button type="button" className={styles.ghostButton} onClick={handleSwitchAccount} disabled={submitting}>
                  切换 Funloom 账号
                </button>
              )}
            </div>
          </>
        )}
      </section>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </main>
  );
}
