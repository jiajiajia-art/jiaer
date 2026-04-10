import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './RechargeModal.module.css';
import payApi from '../../api/pay/payApi';
import toast from 'react-hot-toast';
import type { PayOrderRequest, PlanId } from '../../api/pay/pay.type';

type RechargeTabType = 'points' | 'membership';

interface MembershipPlan {
    planId: PlanId;
    name: string;
    price: number;
}

const MEMBERSHIP_PLANS: MembershipPlan[] = [
    {
        planId: 'month',
        name: '月卡',
        price: 28,
    },
    {
        planId: 'season',
        name: '季卡',
        price: 78,
    },
    {
        planId: 'year',
        name: '年卡',
        price: 248,
    },
];

interface WechatMiniProgram {
    postMessage: (data: Record<string, unknown>) => void;
    navigateTo: (options: { url: string }) => void;
}

interface WindowWithWx extends Window {
    wx?: {
        miniProgram?: WechatMiniProgram;
    };
    __wxjs_environment?: string;
}

interface RechargeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRecharge: (order: PayOrderRequest) => Promise<{ qrDataUrl: string; outTradeNo: string } | null>;
}

const FIXED_AMOUNTS = [5, 10, 15];
const POINTS_PER_YUAN = 10;
const MIN_AMOUNT = 0.1;
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 2 * 60 * 1000;
const COUNTDOWN_SECONDS = POLL_TIMEOUT_MS / 1000;

const isMiniProgramEnv = (): boolean => {
    const win = window as WindowWithWx;
    return String(win.__wxjs_environment || '').toLowerCase() === 'miniprogram';
};

const RechargeModal: React.FC<RechargeModalProps> = ({ isOpen, onClose, onRecharge }) => {
    const closeAndReload = useCallback(() => {
        onClose();
        window.location.reload();
    }, [onClose]);

    const inFlightRef = useRef(false);
    const isComposingRef = useRef(false);
    const amountInputRef = useRef<HTMLInputElement | null>(null);

    const [amountText, setAmountText] = useState<string>('');
    const [, setIsLoading] = useState(false);
    const [inputError, setInputError] = useState<string>('');
    const [qrCodeUrl,  setQrCodeUrl] = useState<string | null>(null);
    const [orderId, setOrderId] = useState<string | null>(null);
    const [paymentStatus, setPaymentStatus] = useState<'idle' | 'polling' | 'success' | 'failed'>('idle');
    const [pollingError, setPollingError] = useState<string>('');
    const [timeLeft, setTimeLeft] = useState(COUNTDOWN_SECONDS);

    const [rechargeTab, setRechargeTab] = useState<RechargeTabType>('points');
    const [selectedPlanIndex, setSelectedPlanIndex] = useState<number>(-1);

    useEffect(() => {
        if (!isOpen) {
            setAmountText('');
            setIsLoading(false);
            setInputError('');
            setQrCodeUrl(null);
            setOrderId(null);
            setPaymentStatus('idle');
            setPollingError('');
            setTimeLeft(COUNTDOWN_SECONDS);
            setRechargeTab('points');
            setSelectedPlanIndex(-1);
        }
    }, [isOpen]);

    const handleFixedAmountClick = (amount: number) => {
        setAmountText(String(amount));
        setInputError('');
    };

    const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value;
        value = value.replace(/[^\d.]/g, '');

        const parts = value.split('.');
        if (parts.length > 2) {
            return;
        }

        if (parts.length === 2) {
            if (parts[1].length > 1) {
                return;
            }
            if (parts[0] === '0' && parts[1] === '1') {
                value = '0.1';
            }
        }

        const numericValue = parseFloat(value || '0');
        if (!isNaN(numericValue)) {
            if (numericValue > 0 && numericValue < MIN_AMOUNT) {
                setInputError(`充值金额不能低于 ${MIN_AMOUNT} 元`);
            } else {
                setInputError('');
            }
        }

        setAmountText(value);
    };

    const getCurrentAmount = (): number | null => {
        if (amountText) {
            const amount = parseFloat(amountText);
            return !isNaN(amount) && amount >= MIN_AMOUNT ? amount : null;
        }
        return null;
    };

    const calculatePoints = (amount: number): number => {
        return Math.floor(amount * POINTS_PER_YUAN);
    };

    const normalizeQrCodeUrl = (raw: string | null): string | null => {
        if (!raw) return null;
        const cleaned = raw.trim().replace(/\s+/g, '');
        if (!cleaned) return null;
        if (cleaned.startsWith('data:image')) {
            return cleaned;
        }
        const isBase64Only = /^[A-Za-z0-9+/=]+$/.test(cleaned);
        if (isBase64Only) {
            return `data:image/png;base64,${cleaned}`;
        }
        return cleaned;
    };

    const handleRestart = useCallback(() => {
        setQrCodeUrl(null);
        setOrderId(null);
        setPaymentStatus('idle');
        setPollingError('');
        setTimeLeft(COUNTDOWN_SECONDS);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (inFlightRef.current) {
            toast.error('请求处理中，请勿重复点击');
            return;
        }

        // 会员卡充值分支
        if (rechargeTab === 'membership') {
            if (selectedPlanIndex < 0 || selectedPlanIndex >= MEMBERSHIP_PLANS.length) {
                toast.error('请选择要购买的会员卡套餐');
                return;
            }
            const selectedPlan = MEMBERSHIP_PLANS[selectedPlanIndex];
            const orderData: PayOrderRequest = {
                orderType: 'subscription',
                planId: selectedPlan.planId,
            };

            inFlightRef.current = true;
            setIsLoading(true);
            try {
                if (isMiniProgramEnv()) {
                    setPaymentStatus('polling');
                    setPollingError('');
                    const response = await payApi.createMiniOrder(orderData);
                    const data = response.data;
                    if (data.code === 200 && data.data) {
                        const { outTradeNo, payParams } = data.data;
                        setOrderId(outTradeNo);
                        const mp = (window as WindowWithWx).wx?.miniProgram;
                        if (mp && typeof mp.postMessage === 'function') {
                            const payParamsStr = encodeURIComponent(JSON.stringify(payParams));
                            mp.navigateTo({
                                url: `/pages/pay/pay?outTradeNo=${outTradeNo}&payParams=${payParamsStr}`
                            });
                            toast.success('正在跳转支付页面...');
                        } else {
                            toast.error('当前小程序环境不支持支付，请稍后重试');
                        }
                        setPaymentStatus('failed');
                        setPollingError(data.message || '发起微信支付失败，请重试。');
                    }
                    setIsLoading(false);
                    return;
                } else if (onRecharge) {
                    const result = await onRecharge(orderData);
                    const qrDataUrl = normalizeQrCodeUrl(result?.qrDataUrl ?? null);
                    if (result && qrDataUrl) {
                        setQrCodeUrl(qrDataUrl);
                        setOrderId(result.outTradeNo);
                        setPaymentStatus('polling');
                        setPollingError('');
                        setTimeLeft(COUNTDOWN_SECONDS);
                    }
                }
            } catch (error) {
                console.error('充值失败:', error);
                setPaymentStatus('failed');
                setPollingError('发起支付请求失败，请稍后重试。');
            } finally {
                setIsLoading(false);
                inFlightRef.current = false;
            }
            return;
        }

        // 积分充值分支
        if (isComposingRef.current) {
            toast.error('请输入完成后再提交');
            return;
        }

        const raw = (amountInputRef.current?.value ?? amountText ?? '').trim();
        const parsed = parseFloat(raw || '0');
        const amount: number | null = !isNaN(parsed) ? parsed : null;

        if (!amount) {
            if (amountText) {
                setInputError(`充值金额不能低于 ${MIN_AMOUNT} 元`);
            }
            return;
        }

        if (amount < MIN_AMOUNT) {
            setInputError(`充值金额不能低于 ${MIN_AMOUNT} 元`);
            return;
        }

        const orderData: PayOrderRequest = {
            orderType: 'points',
            amount,
            description: `积分充值 ${amount} 元`,
        };

        inFlightRef.current = true;
        setIsLoading(true);
        try {
            if (isMiniProgramEnv()) {
                setPaymentStatus('polling');
                setPollingError('');
                const response = await payApi.createMiniOrder(orderData);
                const data = response.data;
                if (data.code === 200 && data.data) {
                    const { outTradeNo, payParams } = data.data;
                    setOrderId(outTradeNo);
                    const mp = (window as WindowWithWx).wx?.miniProgram;
                    if (mp && typeof mp.postMessage === 'function') {
                        const payParamsStr = encodeURIComponent(JSON.stringify(payParams));
                        mp.navigateTo({
                            url: `/pages/pay/pay?outTradeNo=${outTradeNo}&payParams=${payParamsStr}`
                        });
                        toast.success('正在跳转支付页面...');
                    } else {
                        toast.error('当前小程序环境不支持支付，请稍后重试');
                    }
                    setPaymentStatus('failed');
                    setPollingError(data.message || '发起微信支付失败，请重试。');
                }
                setIsLoading(false);
                return;
            } else if (onRecharge) {
                const result = await onRecharge(orderData);
                const qrDataUrl = normalizeQrCodeUrl(result?.qrDataUrl ?? null);
                if (result && qrDataUrl) {
                    setQrCodeUrl(qrDataUrl);
                    setOrderId(result.outTradeNo);
                    setPaymentStatus('polling');
                    setPollingError('');
                    setTimeLeft(COUNTDOWN_SECONDS);
                }
            }
        } catch (error) {
            console.error('充值失败:', error);
            setPaymentStatus('failed');
            setPollingError('发起支付请求失败，请稍后重试。');
        } finally {
            setIsLoading(false);
            inFlightRef.current = false;
        }
    };

    useEffect(() => {
        if (!orderId || !qrCodeUrl || !isOpen) {
            return;
        }

        let timeoutId: number | null = null;
        let stopped = false;
        const startedAt = Date.now();

        const pollStatus = async () => {
            if (stopped || !orderId) return;
            try {
                const response = await payApi.checkPayStatus(orderId);
                const tradeStatePayload = response.data?.data;
                if (tradeStatePayload && tradeStatePayload === 'paid') {
                    setPaymentStatus('success');
                    setPollingError('');
                    return;
                }
            } catch {
                setPollingError('查询支付状态失败，稍后自动重试...');
            }

            if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
                setPaymentStatus('failed');
                setPollingError('暂未确认到支付结果，请稍后刷新账户或重新充值。');
                return;
            }

            timeoutId = window.setTimeout(pollStatus, POLL_INTERVAL_MS);
        };

        pollStatus();

        return () => {
            stopped = true;
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [orderId, qrCodeUrl, isOpen]);

    useEffect(() => {
        if (!qrCodeUrl || !isOpen || paymentStatus !== 'polling') {
            return;
        }

        setTimeLeft(COUNTDOWN_SECONDS);
        const intervalId = window.setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    window.clearInterval(intervalId);
                    setTimeLeft(0);
                    setPaymentStatus('failed');
                    setPollingError('二维码已超时，请重新发起充值。');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [qrCodeUrl, isOpen, paymentStatus]);

    useEffect(() => {
        const handleEscKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                closeAndReload();
            }
        };

        document.addEventListener('keydown', handleEscKey);
        return () => {
            document.removeEventListener('keydown', handleEscKey);
        };
    }, [isOpen, closeAndReload]);

    if (!isOpen) return null;

    const currentAmount = getCurrentAmount();
    const currentPoints = currentAmount ? calculatePoints(currentAmount) : 0;
    const selectedPresetAmount = FIXED_AMOUNTS.includes(currentAmount || NaN) ? currentAmount : null;
    const selectedPlan = selectedPlanIndex >= 0 ? MEMBERSHIP_PLANS[selectedPlanIndex] : null;

    const pointsTabContent = (
        <>
            <div className={styles.fixedAmounts}>
                <div className={styles.amountsLabel}>选择充值金额</div>
                <div className={styles.amountsGrid}>
                    {FIXED_AMOUNTS.map((amount) => (
                        <button
                            key={amount}
                            type="button"
                            className={`${styles.amountBtn} ${selectedPresetAmount === amount ? styles.amountBtnActive : ''}`}
                            onClick={() => handleFixedAmountClick(amount)}
                        >
                            <div className={styles.amountValue}>￥{amount}</div>
                            <div className={styles.amountPoints}>{calculatePoints(amount)}积分</div>
                        </button>
                    ))}
                </div>
            </div>

            <div className={styles.customAmount}>
                <div className={styles.customLabel}>或输入自定义金额</div>
                <div className={styles.customInputWrapper}>
                    <span className={styles.currencySymbol}>￥</span>
                    <input
                        type="text"
                        className={`${styles.customInput} ${inputError ? styles.inputError : ''}`}
                        placeholder="请输入金额"
                        value={amountText}
                        onChange={handleCustomAmountChange}
                        onCompositionStart={() => {
                            isComposingRef.current = true;
                        }}
                        onCompositionEnd={() => {
                            isComposingRef.current = false;
                        }}
                        maxLength={10}
                        ref={amountInputRef}
                    />
                </div>
                {inputError && (
                    <div className={styles.amountHint}>
                        <span className={styles.errorText}>{inputError}</span>
                    </div>
                )}
            </div>

            {currentAmount && currentAmount >= MIN_AMOUNT && (
                <div className={styles.rechargeSummary}>
                    <div className={styles.summaryRow}>
                        <span className={styles.summaryLabel}>充值金额：</span>
                        <span className={styles.summaryValue}>￥{currentAmount.toFixed(2)}</span>
                    </div>
                    <div className={styles.summaryRow}>
                        <span className={styles.summaryLabel}>获得积分：</span>
                        <span className={styles.summaryValue}>{currentPoints}</span>
                    </div>
                </div>
            )}

            {/* <button
                type="submit"
                className={styles.submitBtn}
                disabled={!currentAmount || currentAmount < MIN_AMOUNT || isLoading}
            >
                {isLoading ? '处理中...' : `确认充值 ￥${currentAmount ? currentAmount.toFixed(2) : '0.00'}`}
            </button> */}
            <button type="button" className={styles.submitBtn} disabled>
                请进入推广分享页面进入活动进行充值
            </button>
        </>
    );

    const membershipTabContent = (
        <>
            <div className={styles.plansList}>
                {MEMBERSHIP_PLANS.map((plan, index) => (
                    <button
                        key={plan.planId}
                        type="button"
                        className={`${styles.planItem} ${selectedPlanIndex === index ? styles.planItemActive : ''}`}
                        onClick={() => setSelectedPlanIndex(index)}
                    >
                        <span className={styles.planItemName}>{plan.name}</span>
                        <span className={styles.planItemPrice}>￥{plan.price}</span>
                    </button>
                ))}
            </div>

            {selectedPlan && (
                <div className={styles.rechargeSummary}>
                    <div className={styles.summaryRow}>
                        <span className={styles.summaryLabel}>套餐名称：</span>
                        <span className={styles.summaryValue}>{selectedPlan.name}</span>
                    </div>
                    <div className={styles.summaryRow}>
                        <span className={styles.summaryLabel}>充值金额：</span>
                        <span className={styles.summaryValue}>￥{selectedPlan.price.toFixed(2)}</span>
                    </div>
                    <div className={styles.benefitSection}>
                        <div className={styles.benefitTitle}>会员权益</div>
                        <div className={styles.benefitItem}>
                            <span className={styles.benefitIcon}>✓</span>
                            <span>每个游戏前100回合免积分</span>
                        </div>
                        {selectedPlanIndex > 0 && (
                            <div className={styles.benefitItem}>
                                <span className={styles.benefitIcon}>★</span>
                                <span>
                                    {selectedPlanIndex === 1 && '每日签到：18 / 18 / 58 / 18 / 38 / 58 / 78 积分（7天循环）'}
                                    {selectedPlanIndex === 2 && '每日签到：28 / 28 / 68 / 28 / 48 / 68 / 88 积分（7天循环）'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* <button
                type="submit"
                className={styles.submitBtn}
                disabled={selectedPlanIndex < 0 || isLoading}
            >
                {isLoading ? '处理中...' : selectedPlan ? `确认购买 ${selectedPlan.name}` : '请选择套餐'}
            </button> */}
            <button type="button" className={styles.submitBtn} disabled>
                请进入推广分享页面进入活动进行充值
            </button>
        </>
    );

    const formContent = (
        <div className={styles.modalOverlay} onClick={closeAndReload}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <button type="button" className={styles.closeBtn} onClick={closeAndReload}>
                    ×
                </button>

                <h2 className={styles.title}>账户充值</h2>

                <div className={styles.tabBar}>
                    <button
                        type="button"
                        className={`${styles.tabBtn} ${rechargeTab === 'points' ? styles.tabBtnActive : ''}`}
                        onClick={() => setRechargeTab('points')}
                    >
                        积分充值
                    </button>
                    <button
                        type="button"
                        className={`${styles.tabBtn} ${rechargeTab === 'membership' ? styles.tabBtnActive : ''}`}
                        onClick={() => setRechargeTab('membership')}
                    >
                        会员卡充值
                    </button>
                </div>

                <form className={styles.form} onSubmit={handleSubmit}>
                    {rechargeTab === 'points' ? pointsTabContent : membershipTabContent}
                </form>
            </div>
        </div>
    );

    const qrContent = (
        <div className={styles.modalOverlay} onClick={closeAndReload}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <button type="button" className={styles.closeBtn} onClick={closeAndReload}>
                    ×
                </button>
                <div className={styles.qrSection}>
                    <div className={styles.qrTitle}>微信扫码支付</div>
                    <img src={qrCodeUrl || ''} alt="支付二维码" className={styles.qrImage} />
                    <div className={styles.qrHint}>请使用手机扫码完成支付</div>
                    {paymentStatus === 'polling' && (
                        <div className={styles.countdownText}>
                            剩余 {timeLeft}s 自动失效
                        </div>
                    )}
                    {paymentStatus === 'success' && <div className={styles.successText}>支付成功，可关闭弹窗。</div>}
                    {paymentStatus === 'failed' && (
                        <div className={styles.errorText}>
                            {pollingError || '暂未确认到支付结果，请稍后刷新账户或重新充值。'}
                        </div>
                    )}
                    <div className={styles.qrActions}>
                        {paymentStatus === 'success' && (
                            <button type="button" className={styles.qrActionBtn} onClick={closeAndReload}>
                                完成
                            </button>
                        )}
                        {paymentStatus === 'failed' && (
                            <button type="button" className={styles.qrActionBtn} onClick={handleRestart}>
                                重新发起充值
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(qrCodeUrl ? qrContent : formContent, document.body);
};

export default RechargeModal;
