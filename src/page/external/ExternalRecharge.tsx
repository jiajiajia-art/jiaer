import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { externalSdkApi, type ExternalRechargeSession } from '../../api/externalSdkApi';
import { getApiErrorMessage } from '../../utils/error';
import {
  buildExternalReturnUrl,
  getRechargeDisplayState,
  parseExternalRechargeParams,
  type ExternalRechargeDisplayState,
} from '../../utils/externalSdkPages';
import styles from './ExternalSdkPage.module.css';

const POLL_INTERVAL_MS = 3000;
const AUTO_RETURN_SECONDS = 3;

function formatPrice(session: ExternalRechargeSession | null): string {
  const plan = session?.plan;
  if (!plan) return '--';
  return `${plan.currency === 'CNY' ? '¥' : plan.currency} ${plan.price.toFixed(2)}`;
}

function getStatusCopy(state: ExternalRechargeDisplayState): { title: string; body: string } {
  if (state === 'paid') {
    return { title: '支付成功', body: '充值已经完成，外部游戏可通过 webhook 或轮询恢复状态。' };
  }
  if (state === 'expired') {
    return { title: '充值链接已过期', body: '请回到外部游戏重新发起充值。' };
  }
  if (state === 'failed') {
    return { title: '支付未完成', body: '本次支付没有完成，可以重新发起支付。' };
  }
  if (state === 'paying') {
    return { title: '等待支付确认', body: '请使用微信扫码支付，页面会自动刷新支付结果。' };
  }
  if (state === 'missing') {
    return { title: '缺少充值会话', body: '请回到外部游戏重新打开充值链接。' };
  }
  return { title: '确认充值信息', body: '确认无误后生成支付二维码。' };
}

export default function ExternalRecharge() {
  const [searchParams] = useSearchParams();
  const params = useMemo(() => parseExternalRechargeParams(searchParams), [searchParams]);
  const [session, setSession] = useState<ExternalRechargeSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [autoReturnLeft, setAutoReturnLeft] = useState<number | null>(null);
  const pollingRef = useRef<number | null>(null);

  const displayState = useMemo(() => getRechargeDisplayState(session), [session]);
  const statusCopy = getStatusCopy(params.valid ? displayState : 'missing');
  const returnUrl = useMemo(() => {
    if (!session) return '';
    return buildExternalReturnUrl(session.returnUrl, {
      sessionId: session.sessionId,
      status: session.status,
      outTradeNo: session.payment?.outTradeNo,
    });
  }, [session]);

  const clearPolling = useCallback(() => {
    if (pollingRef.current) {
      window.clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const loadSession = useCallback(async () => {
    if (!params.valid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await externalSdkApi.getRechargeSession(params.sessionId);
      let nextSession = response.data.data;
      if (nextSession?.payment && nextSession.status !== 'paid') {
        const statusResponse = await externalSdkApi.getRechargeStatus(params.sessionId);
        nextSession = statusResponse.data.data;
      }
      setSession(nextSession);
    } catch (err) {
      setError(getApiErrorMessage(err, '充值会话加载失败，请回到外部游戏重新发起充值。'));
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [params]);

  const pollStatus = useCallback(async () => {
    if (!params.valid) return;
    try {
      const response = await externalSdkApi.getRechargeStatus(params.sessionId);
      const nextSession = response.data.data;
      setSession(nextSession);
      const nextState = getRechargeDisplayState(nextSession);
      if (nextState === 'paying' || nextState === 'ready') {
        pollingRef.current = window.setTimeout(() => {
          void pollStatus();
        }, POLL_INTERVAL_MS);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, '支付状态查询失败，稍后会继续尝试。'));
      pollingRef.current = window.setTimeout(() => {
        void pollStatus();
      }, POLL_INTERVAL_MS);
    }
  }, [params]);

  useEffect(() => {
    void loadSession();
    return clearPolling;
  }, [clearPolling, loadSession]);

  useEffect(() => {
    clearPolling();
    if (displayState === 'paying') {
      pollingRef.current = window.setTimeout(() => {
        void pollStatus();
      }, POLL_INTERVAL_MS);
    }
    return clearPolling;
  }, [clearPolling, displayState, pollStatus]);

  useEffect(() => {
    if (displayState !== 'paid' || !returnUrl) {
      setAutoReturnLeft(null);
      return;
    }
    setAutoReturnLeft(AUTO_RETURN_SECONDS);
    const intervalId = window.setInterval(() => {
      setAutoReturnLeft((value) => {
        if (value === null) return value;
        if (value <= 1) {
          window.clearInterval(intervalId);
          window.location.assign(returnUrl);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [displayState, returnUrl]);

  const handleCreatePayment = async () => {
    if (!params.valid || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await externalSdkApi.createRechargePayment(params.sessionId);
      setSession(response.data.data);
    } catch (err) {
      setError(getApiErrorMessage(err, '支付二维码生成失败，请稍后重试。'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = () => {
    if (returnUrl) {
      window.location.assign(returnUrl);
    }
  };

  const qrDataUrl = session?.payment?.qrDataUrl || '';
  const canCreatePayment = params.valid && !loading && (displayState === 'ready' || displayState === 'failed');

  return (
    <main className={styles.shell}>
      <section className={`${styles.panel} ${styles.rechargePanel}`} aria-labelledby="external-recharge-title">
        <div className={styles.brandRow}>
          <img src="/funloom/data/assets/funloom_icon.png" alt="Funloom" className={styles.logo} />
          <span className={styles.brandName}>Funloom</span>
        </div>

        <div className={styles.heroBlock}>
          <p className={styles.eyebrow}>External Game Checkout</p>
          <h1 id="external-recharge-title">外部游戏充值</h1>
          <p className={styles.lead}>这是 Funloom 为外部游戏提供的统一充值页面，支付完成后会同步更新充值会话。</p>
        </div>

        {loading ? (
          <div className={styles.loadingBlock} role="status">正在加载充值会话...</div>
        ) : (
          <>
            <div className={styles.statusStrip} data-state={displayState}>
              <strong>{statusCopy.title}</strong>
              <span>{statusCopy.body}</span>
            </div>

            {error && <div className={styles.noticeError} role="alert">{error}</div>}

            {session && (
              <div className={styles.checkoutGrid}>
                <div className={styles.summary}>
                  <div>
                    <span>外部应用</span>
                    <strong>{session.appName}</strong>
                  </div>
                  <div>
                    <span>充值档位</span>
                    <strong>{session.plan ? `${session.plan.label} · ${session.plan.diamonds} 钻石` : '--'}</strong>
                  </div>
                  <div>
                    <span>支付金额</span>
                    <strong>{formatPrice(session)}</strong>
                  </div>
                  <div>
                    <span>会话状态</span>
                    <strong>{session.status}</strong>
                  </div>
                </div>

                <div className={styles.qrBox}>
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="微信支付二维码" className={styles.qrImage} />
                  ) : (
                    <div className={styles.qrPlaceholder}>等待生成二维码</div>
                  )}
                  <span>{displayState === 'paying' ? '微信扫码完成支付' : '二维码会在发起支付后显示'}</span>
                </div>
              </div>
            )}

            <div className={styles.actions}>
              {canCreatePayment && (
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={handleCreatePayment}
                  disabled={submitting}
                >
                  {submitting ? '生成中...' : '生成支付二维码'}
                </button>
              )}
              {displayState === 'paying' && (
                <button type="button" className={styles.secondaryButton} onClick={() => void pollStatus()}>
                  刷新支付状态
                </button>
              )}
              {displayState === 'paid' && returnUrl && (
                <button type="button" className={styles.primaryButton} onClick={handleReturn}>
                  {autoReturnLeft !== null && autoReturnLeft > 0 ? `${autoReturnLeft}s 后返回游戏` : '返回游戏'}
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
