import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { externalSdkApi, type ExternalRechargeSession } from '../../api/externalSdkApi';
import diamondSpritesUrl from '../../assets/external-recharge/funloom-diamond-package-sprites.png';
import { getApiErrorMessage } from '../../utils/error';
import {
  buildExternalReturnUrl,
  getRechargeDisplayState,
  getRechargePlanOptions,
  parseExternalRechargeParams,
  type ExternalRechargeDisplayState,
  type ExternalRechargePlanLike,
} from '../../utils/externalSdkPages';
import styles from './ExternalSdkPage.module.css';

const POLL_INTERVAL_MS = 3000;
const AUTO_RETURN_SECONDS = 3;
const PACKAGE_BADGES = ['入门', '热选', '畅玩', '高能', '豪华', '推荐'];
const PACKAGE_NAMES = ['星钻补给', '闪耀礼包', '进阶礼盒', '高能宝库', '臻享钱袋', '尊享宝箱'];

function formatPlanPrice(plan: ExternalRechargePlanLike | null | undefined): string {
  if (!plan) return '--';
  return `${!plan.currency || plan.currency === 'CNY' ? '¥' : plan.currency} ${plan.price.toFixed(2)}`;
}

function formatDiamondCount(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--';
  return new Intl.NumberFormat('zh-CN').format(value);
}

function getStatusCopy(state: ExternalRechargeDisplayState): { title: string; body: string } {
  if (state === 'paid') {
    return { title: '支付成功', body: '充值已完成，钻石会同步回外部游戏。' };
  }
  if (state === 'expired') {
    return { title: '充值链接已过期', body: '请回到外部游戏重新发起充值。' };
  }
  if (state === 'failed') {
    return { title: '支付未完成', body: '可以重新选择礼包并生成新的支付二维码。' };
  }
  if (state === 'paying') {
    return { title: '等待支付确认', body: '请使用微信扫码支付，页面会自动刷新支付结果。' };
  }
  if (state === 'missing') {
    return { title: '缺少充值会话', body: '请回到外部游戏重新打开充值链接。' };
  }
  return { title: '选择充值礼包', body: '点击任一礼包后，会打开微信支付二维码。' };
}

function getPackageSpriteStyle(index: number): CSSProperties {
  const normalizedIndex = index % 6;
  const column = normalizedIndex % 3;
  const row = Math.floor(normalizedIndex / 3);
  return {
    backgroundImage: `url(${diamondSpritesUrl})`,
    backgroundPosition: `${column * 50}% ${row * 100}%`,
  };
}

function getPackageBadge(index: number, total: number): string {
  if (total > 1 && index === total - 1) return '推荐';
  return PACKAGE_BADGES[index % PACKAGE_BADGES.length];
}

function getPackageName(index: number): string {
  return PACKAGE_NAMES[index % PACKAGE_NAMES.length];
}

export default function ExternalRecharge() {
  const [searchParams] = useSearchParams();
  const params = useMemo(() => parseExternalRechargeParams(searchParams), [searchParams]);
  const [session, setSession] = useState<ExternalRechargeSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [autoReturnLeft, setAutoReturnLeft] = useState<number | null>(null);
  const pollingRef = useRef<number | null>(null);

  const displayState = useMemo(() => getRechargeDisplayState(session), [session]);
  const planOptions = useMemo(() => getRechargePlanOptions(session), [session]);
  const selectedPlan = useMemo(() => {
    if (session?.plan) return session.plan;
    return planOptions.find((plan) => plan.id === selectedPlanId) || planOptions[0] || null;
  }, [planOptions, selectedPlanId, session]);
  const statusCopy = getStatusCopy(params.valid ? displayState : 'missing');
  const balanceText = formatDiamondCount(session?.balance);
  const appDisplayName = session?.appName?.trim() || '当前游戏';
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
    if (session?.plan?.id) {
      setSelectedPlanId(session.plan.id);
      return;
    }
    setSelectedPlanId((current) => {
      if (current && planOptions.some((plan) => plan.id === current)) return current;
      return planOptions[0]?.id || '';
    });
  }, [planOptions, session]);

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
    if (displayState === 'paying' || displayState === 'paid') {
      setPaymentModalOpen(true);
    }
  }, [displayState]);

  useEffect(() => {
    if (!paymentModalOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) {
        setPaymentModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [paymentModalOpen, submitting]);

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

  const handleCreatePayment = useCallback(
    async (planOverride?: ExternalRechargePlanLike | null) => {
      if (!params.valid || submitting) return;
      const nextPlan = planOverride || selectedPlan;
      if (!nextPlan?.id) {
        setError('请选择一个充值礼包。');
        return;
      }

      setSelectedPlanId(nextPlan.id);
      setPaymentModalOpen(true);

      if (session?.payment && (displayState === 'paying' || displayState === 'paid')) {
        return;
      }

      setSubmitting(true);
      setError('');
      try {
        const response = await externalSdkApi.createRechargePayment(params.sessionId, { planId: nextPlan.id });
        setSession(response.data.data);
      } catch (err) {
        setError(getApiErrorMessage(err, '支付二维码生成失败，请稍后重试。'));
      } finally {
        setSubmitting(false);
      }
    },
    [displayState, params, selectedPlan, session?.payment, submitting],
  );

  const handleReturn = () => {
    if (returnUrl) {
      window.location.assign(returnUrl);
    }
  };

  const handleClosePaymentModal = () => {
    if (!submitting) {
      setPaymentModalOpen(false);
    }
  };

  const qrDataUrl = session?.payment?.qrDataUrl || '';
  const canCreatePayment =
    params.valid &&
    !loading &&
    Boolean(selectedPlan) &&
    !submitting &&
    (displayState === 'ready' || displayState === 'failed');
  const paymentLocked = Boolean(session?.payment && (displayState === 'paying' || displayState === 'paid'));

  return (
    <main className={styles.rechargeShell}>
      <div className={styles.rechargeBackdrop} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <section className={styles.rechargeStage} aria-labelledby="external-recharge-title">
        <header className={styles.rechargeTopbar}>
          <div className={styles.rechargeBrand}>
            <img src="/funloom/data/assets/funloom_icon.png" alt="Funloom" className={styles.rechargeLogo} />
            <span>Funloom</span>
          </div>
          <div className={styles.rechargePill}>安全充值</div>
        </header>

        <div className={styles.rechargeHero}>
          <div className={styles.rechargeHeroCopy}>
            <p className={styles.rechargeEyebrow}>External Game Checkout</p>
            <h1 id="external-recharge-title">钻石充值</h1>
            <p>为你当前进入的游戏补充 Funloom 钻石，支付完成后自动同步回游戏。</p>
          </div>

          <div className={styles.rechargeBalanceCard}>
            <div className={styles.balanceMedal} aria-hidden="true">
              <span />
            </div>
            <div>
              <span className={styles.balanceLabel}>当前钻石余额</span>
              <strong>{balanceText}</strong>
              <small>当前游戏：{appDisplayName}</small>
            </div>
          </div>
        </div>

        {loading ? (
          <div className={styles.rechargeLoading} role="status">
            <span />
            正在加载充值会话...
          </div>
        ) : (
          <>
            <div className={styles.rechargeStatusStrip} data-state={params.valid ? displayState : 'missing'}>
              <strong>{statusCopy.title}</strong>
              <span>{statusCopy.body}</span>
            </div>

            {error && <div className={styles.rechargeError} role="alert">{error}</div>}

            {session && planOptions.length > 0 && (
              <div className={styles.rechargePackages} aria-label="选择充值礼包">
                <div className={styles.packageHeader}>
                  <div>
                    <span>Recharge Packages</span>
                    <h2>选择适合你的钻石礼包</h2>
                  </div>
                  <small>Funloom 通用收银台</small>
                </div>

                <div className={styles.packageGrid}>
                  {planOptions.map((plan, index) => {
                    const isActive = selectedPlan?.id === plan.id;
                    const isDisabled =
                      submitting ||
                      displayState === 'expired' ||
                      displayState === 'paid' ||
                      (paymentLocked && !isActive);

                    return (
                      <button
                        key={plan.id}
                        type="button"
                        className={`${styles.packageCard} ${isActive ? styles.packageCardActive : ''}`}
                        aria-pressed={isActive}
                        disabled={isDisabled}
                        onClick={() => void handleCreatePayment(plan)}
                      >
                        <span className={styles.packageBadge}>{getPackageBadge(index, planOptions.length)}</span>
                        <span className={styles.packageArtwork} style={getPackageSpriteStyle(index)} aria-hidden="true" />
                        <span className={styles.packageName}>{getPackageName(index)}</span>
                        <strong>{formatDiamondCount(plan.diamonds)} 钻石</strong>
                        <span className={styles.packagePrice}>{formatPlanPrice(plan)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {session && (
              <div className={styles.rechargeFooterBar}>
                <span>安全支付</span>
                <span>即时到账</span>
                <span>支付成功后自动回跳</span>
              </div>
            )}

            <div className={styles.rechargeActions}>
              {displayState === 'paying' && (
                <>
                  <button type="button" className={styles.rechargePrimaryButton} onClick={() => setPaymentModalOpen(true)}>
                    查看支付二维码
                  </button>
                  <button type="button" className={styles.rechargeSecondaryButton} onClick={() => void pollStatus()}>
                    刷新支付状态
                  </button>
                </>
              )}
              {displayState === 'paid' && returnUrl && (
                <button type="button" className={styles.rechargePrimaryButton} onClick={handleReturn}>
                  {autoReturnLeft !== null && autoReturnLeft > 0 ? `${autoReturnLeft}s 后返回游戏` : '返回游戏'}
                </button>
              )}
            </div>
          </>
        )}
      </section>

      {paymentModalOpen && session && (
        <div
          className={styles.paymentOverlay}
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              handleClosePaymentModal();
            }
          }}
        >
          <section className={styles.paymentDialog} role="dialog" aria-modal="true" aria-labelledby="payment-dialog-title">
            <button type="button" className={styles.paymentCloseButton} onClick={handleClosePaymentModal} aria-label="关闭支付弹窗">
              ×
            </button>

            <div className={styles.paymentDialogHeader}>
              <span>微信支付</span>
              <h2 id="payment-dialog-title">{displayState === 'paid' ? '支付成功' : '扫码完成支付'}</h2>
              <p>{displayState === 'paid' ? '充值已完成，正在准备返回游戏。' : '请使用微信扫描二维码，完成后页面会自动更新。'}</p>
            </div>

            <div className={styles.paymentDialogBody}>
              <div className={styles.paymentPlanCard}>
                <span
                  className={styles.paymentPlanArt}
                  style={getPackageSpriteStyle(Math.max(0, planOptions.findIndex((plan) => plan.id === selectedPlan?.id)))}
                  aria-hidden="true"
                />
                <div>
                  <span>当前礼包</span>
                  <strong>{selectedPlan ? `${formatDiamondCount(selectedPlan.diamonds)} 钻石` : '--'}</strong>
                  <small>{formatPlanPrice(selectedPlan)}</small>
                </div>
              </div>

              <div className={styles.paymentQrFrame} data-state={displayState}>
                {displayState === 'paid' ? (
                  <div className={styles.paymentSuccessMark}>✓</div>
                ) : submitting ? (
                  <div className={styles.paymentQrPlaceholder}>
                    <span />
                    正在生成二维码...
                  </div>
                ) : qrDataUrl ? (
                  <img src={qrDataUrl} alt="微信支付二维码" className={styles.paymentQrImage} />
                ) : (
                  <div className={styles.paymentQrPlaceholder}>二维码暂未生成</div>
                )}
              </div>
            </div>

            {error && <p className={styles.paymentError} role="alert">{error}</p>}

            <div className={styles.paymentDialogActions}>
              {displayState === 'paid' && returnUrl && (
                <button type="button" className={styles.rechargePrimaryButton} onClick={handleReturn}>
                  {autoReturnLeft !== null && autoReturnLeft > 0 ? `${autoReturnLeft}s 后返回游戏` : '返回游戏'}
                </button>
              )}
              {displayState === 'paying' && (
                <button type="button" className={styles.rechargeSecondaryButton} onClick={() => void pollStatus()}>
                  刷新支付状态
                </button>
              )}
              {!qrDataUrl && canCreatePayment && (
                <button type="button" className={styles.rechargePrimaryButton} onClick={() => void handleCreatePayment()}>
                  重新生成二维码
                </button>
              )}
              {displayState !== 'paid' && (
                <button type="button" className={styles.rechargeGhostButton} onClick={handleClosePaymentModal} disabled={submitting}>
                  稍后支付
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
