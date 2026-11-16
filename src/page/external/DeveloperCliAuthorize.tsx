import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
        throw new Error(t('pagesExternal.cli.missingRedirect'));
      }
      setSuccessText(t('pagesExternal.cli.successRedirect'));
      window.location.assign(redirectUrl);
    } catch (err) {
      setError(getApiErrorMessage(err, t('pagesExternal.cli.authorizeFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitchAccount = () => {
    if (submitting) return;
    logout();
    setError('');
    setSuccessText(t('pagesExternal.cli.switchedAccount'));
    setAuthOpen(true);
  };

  const handleDeny = () => {
    if (!params.valid || submitting) return;
    window.location.assign(appendCliResultUrl(params.redirectUri, {
      error: 'access_denied',
      state: params.state,
    }));
  };

  const currentName = authUser?.nickname || authUser?.phoneNumber || authUser?.userCode || t('pagesExternal.cli.currentAccount');

  return (
    <main className={styles.shell}>
      <section className={styles.panel} aria-labelledby="developer-cli-authorize-title">
        <div className={styles.brandRow}>
          <img src="/funloom/data/assets/funloom_icon.png" alt="Funloom" className={styles.logo} />
          <span className={styles.brandName}>Funloom</span>
        </div>

        <div className={styles.heroBlock}>
          <p className={styles.eyebrow}>Developer CLI Authorization</p>
          <h1 id="developer-cli-authorize-title">{t('pagesExternal.cli.title')}</h1>
          <p className={styles.lead}>
            {t('pagesExternal.cli.lead')}
          </p>
        </div>

        {!params.valid ? (
          <div className={styles.noticeError} role="alert">
            {t('pagesExternal.cli.invalidParams')}
          </div>
        ) : (
          <>
            <div className={styles.summary}>
              <div>
                <span>{t('pagesExternal.cli.callbackUri')}</span>
                <strong>{params.redirectUri}</strong>
              </div>
              <div>
                <span>{t('pagesExternal.cli.funloomAccount')}</span>
                <strong>{isAuthenticated ? currentName : t('pagesExternal.cli.notLoggedIn')}</strong>
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
                {submitting ? t('pagesExternal.cli.authorizing') : isAuthenticated ? t('pagesExternal.cli.confirmCli') : t('pagesExternal.cli.loginThenAuthorize')}
              </button>
              <button type="button" className={styles.secondaryButton} onClick={handleDeny} disabled={submitting}>
                {t('pagesExternal.cli.deny')}
              </button>
              {isAuthenticated && (
                <button type="button" className={styles.ghostButton} onClick={handleSwitchAccount} disabled={submitting}>
                  {t('pagesExternal.cli.switchAccount')}
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
