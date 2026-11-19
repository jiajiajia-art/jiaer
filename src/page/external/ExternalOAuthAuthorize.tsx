import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AuthModal from '../../components/AuthModal';
import { externalSdkApi } from '../../api/externalSdkApi';
import { useAuthStore } from '../../store/useAuthStore';
import { getApiErrorMessage } from '../../utils/error';
import { parseExternalAuthorizeParams } from '../../utils/externalSdkPages';
import styles from './ExternalSdkPage.module.css';

export default function ExternalOAuthAuthorize() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const params = useMemo(() => parseExternalAuthorizeParams(searchParams), [searchParams]);
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
      const response = await externalSdkApi.createAuthCode({
        appId: params.appId,
        redirectUri: params.redirectUri,
        externalUserId: params.externalUserId || undefined,
        state: params.state || undefined,
      });
      const redirectUrl = response.data.data?.redirectUrl;
      if (!redirectUrl) {
        throw new Error(t('pagesExternal.oauth.missingRedirect'));
      }
      setSuccessText(t('pagesExternal.oauth.successRedirect'));
      window.location.assign(redirectUrl);
    } catch (err) {
      setError(getApiErrorMessage(err, t('pagesExternal.oauth.authorizeFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitchAccount = () => {
    if (submitting) return;
    logout();
    setError('');
    setSuccessText(t('pagesExternal.oauth.switchedAccount'));
    setAuthOpen(true);
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
        throw new Error(t('pagesExternal.oauth.denyMissingRedirect'));
      }
      window.location.assign(target);
    } catch (err) {
      setError(getApiErrorMessage(err, t('pagesExternal.oauth.denyFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  const currentName = authUser?.nickname || authUser?.phoneNumber || authUser?.userCode || t('pagesExternal.oauth.currentAccount');

  return (
    <main className={styles.shell}>
      <section className={styles.panel} aria-labelledby="external-oauth-title">
        <div className={styles.brandRow}>
          <img src="/funloom/data/assets/funloom_icon.png" alt="Funloom" className={styles.logo} />
          <span className={styles.brandName}>Funloom</span>
        </div>

        <div className={styles.heroBlock}>
          <p className={styles.eyebrow}>External Game Authorization</p>
          <h1 id="external-oauth-title">{t('pagesExternal.oauth.title')}</h1>
          <p className={styles.lead}>
            {t('pagesExternal.oauth.lead')}
          </p>
        </div>

        {!params.valid ? (
          <div className={styles.noticeError} role="alert">
            {t('pagesExternal.oauth.invalidParams')}
          </div>
        ) : (
          <>
            <div className={styles.summary}>
              <div>
                <span>{t('pagesExternal.oauth.externalApp')}</span>
                <strong>{params.appId}</strong>
              </div>
              <div>
                <span>{t('pagesExternal.oauth.redirectUri')}</span>
                <strong>{params.redirectUri}</strong>
              </div>
              {params.externalUserId && (
                <div>
                  <span>{t('pagesExternal.oauth.externalUser')}</span>
                  <strong>{params.externalUserId}</strong>
                </div>
              )}
              <div>
                <span>{t('pagesExternal.oauth.funloomAccount')}</span>
                <strong>{isAuthenticated ? currentName : t('pagesExternal.oauth.notLoggedIn')}</strong>
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
                {submitting ? t('pagesExternal.oauth.authorizing') : isAuthenticated ? t('pagesExternal.oauth.confirmAndReturn') : t('pagesExternal.oauth.loginThenAuthorize')}
              </button>
              <button type="button" className={styles.secondaryButton} onClick={handleDeny} disabled={submitting}>
                {t('pagesExternal.oauth.denyAndReturn')}
              </button>
              {isAuthenticated && (
                <button type="button" className={styles.ghostButton} onClick={handleSwitchAccount} disabled={submitting}>
                  {t('pagesExternal.oauth.switchAccount')}
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
