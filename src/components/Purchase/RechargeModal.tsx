import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import styles from './RechargeModal.module.css';
import payApi from '../../api/pay/payApi';
import toast from 'react-hot-toast';
import { auth } from '../../api/account/authApi';
import type { PayOrderRequest, PlanId, DiamondsPlanId } from '../../api/pay/pay.type';
import { getApiErrorMessage } from '../../utils/error';
import { useAuthStore } from '../../store/useAuthStore';
import type { DefaultPayMethod } from '../../lib/geoRegion';
import {
    getPayMethodCurrencySymbol,
    getPayMethodMinAmount,
    isAmountReadyToPay,
    sanitizeAmountInput,
    validateRechargeAmount,
} from '../../lib/rechargeAmountRules';
import CurrencyIcon from '../CurrencyIcon';

const MEMBER_ICON = `${import.meta.env.BASE_URL}data/assetsv2/personal/member.png`;
const ENJOY_ICON = `${import.meta.env.BASE_URL}data/assetsv2/personal/enjoy.png`;

const formatMemberEndDate = (raw?: string | null): string | undefined => {
    if (!raw) return undefined;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return undefined;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

type RechargeTabType = 'diamonds' | 'membership';

interface MembershipPlan {
    planId: PlanId;
    name: string;
    shortName: string;
    price: number;
    dailyReward: number;
    finalDayReward: number;
    durationLabel: string;
}

interface DiamondPlan {
    planId: DiamondsPlanId;
    amount: number;
    baseDiamonds: number;
    firstBonusDiamonds: number;
    firstTotalDiamonds: number;
    firstChargeEligible: boolean;
}

const DEFAULT_KK_RECHARGE_PLANS: DiamondPlan[] = [
    { planId: 'dr_6_v2', amount: 6, baseDiamonds: 60, firstBonusDiamonds: 6, firstTotalDiamonds: 66, firstChargeEligible: true },
    { planId: 'dr_30_v2', amount: 30, baseDiamonds: 300, firstBonusDiamonds: 30, firstTotalDiamonds: 330, firstChargeEligible: true },
    { planId: 'dr_68_v2', amount: 68, baseDiamonds: 680, firstBonusDiamonds: 68, firstTotalDiamonds: 748, firstChargeEligible: true },
    { planId: 'dr_128_v2', amount: 128, baseDiamonds: 1280, firstBonusDiamonds: 192, firstTotalDiamonds: 1472, firstChargeEligible: true },
    { planId: 'dr_328_v2', amount: 328, baseDiamonds: 3280, firstBonusDiamonds: 1312, firstTotalDiamonds: 4592, firstChargeEligible: true },
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
    fixedTab?: RechargeTabType;
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 2 * 60 * 1000;
const COUNTDOWN_SECONDS = POLL_TIMEOUT_MS / 1000;

const isMiniProgramEnv = (): boolean => {
    const win = window as WindowWithWx;
    return String(win.__wxjs_environment || '').toLowerCase() === 'miniprogram';
};

const RechargeModal: React.FC<RechargeModalProps> = ({ isOpen, onClose, onRecharge, fixedTab }) => {
    const { t } = useTranslation();
    const { updateUser, user: authUser } = useAuthStore();
    const memberProfile = authUser?.user;
    const weekEndDate = formatMemberEndDate(memberProfile?.membership?.week?.endAt);
    const monthEndDate = formatMemberEndDate(memberProfile?.membership?.month?.endAt);
    const rechargePlans = useMemo<DiamondPlan[]>(() => {
        const plans = memberProfile?.kkRechargePlans;
        if (!plans?.length) return DEFAULT_KK_RECHARGE_PLANS;
        return plans.map((plan) => ({
            planId: plan.id as DiamondsPlanId,
            amount: plan.price,
            baseDiamonds: plan.baseDiamonds,
            firstBonusDiamonds: plan.firstBonusDiamonds,
            firstTotalDiamonds: plan.firstTotalDiamonds,
            firstChargeEligible: plan.firstChargeEligible,
        }));
    }, [memberProfile?.kkRechargePlans]);
    const [isLoading, setIsLoading] = useState(false);
    const [amountError, setAmountError] = useState('');
    const [inputShake, setInputShake] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [orderId, setOrderId] = useState<string | null>(null);
    const [paymentStatus, setPaymentStatus] = useState<'idle' | 'polling' | 'success' | 'failed'>('idle');
    const [pollingError, setPollingError] = useState<string>('');
    const [timeLeft, setTimeLeft] = useState(COUNTDOWN_SECONDS);

    const [rechargeTab, setRechargeTab] = useState<RechargeTabType>(fixedTab ?? 'diamonds');
    const [selectedPlanIndex, setSelectedPlanIndex] = useState<number>(-1);
    const [selectedFirstChargePlanId, setSelectedFirstChargePlanId] = useState<DiamondsPlanId | null>(null);
    // 选中的固定档位的原始金额（用于下单），不受会员折扣影响
    const [selectedFixedPlanAmount, setSelectedFixedPlanAmount] = useState<number | null>(null);
    // 自定义充值的原始金额（用于下单），不受会员折扣影响
    const [customOriginalAmount, setCustomOriginalAmount] = useState<number | null>(null);
    // 用户实际看到的（可能是折扣后的）金额文本
    const [amountText, setAmountText] = useState<string>('');
    /** 功能注释：钻石充值顶部互切支付方式；点立即支付直接走当前选中方式，不再二次弹窗 */
    const [selectedPayMethod, setSelectedPayMethod] = useState<DefaultPayMethod>('wechat');
    const payMinAmount = getPayMethodMinAmount(selectedPayMethod);
    const currencySymbol = getPayMethodCurrencySymbol(selectedPayMethod);

    const inFlightRef = useRef(false);
    const isComposingRef = useRef(false);
    const amountInputRef = useRef<HTMLInputElement | null>(null);

    const handleClose = useCallback(() => {
        onClose();
    }, [onClose]);

    const refreshUserInfo = useCallback(async () => {
        try {
            const userRes = await auth.getUserInfo();
            if (userRes.data.success && userRes.data.data) {
                updateUser(userRes.data.data);
            }
        } catch (error) {
            console.error('刷新用户信息失败:', error);
        }
    }, [updateUser]);

    const handleCloseWithRefresh = useCallback(async () => {
        await refreshUserInfo();
        onClose();
    }, [onClose, refreshUserInfo]);

    const MEMBERSHIP_PLANS = useMemo<MembershipPlan[]>(() => [
        {
            planId: 'week',
            name: '周卡',
            shortName: '周卡',
            price: 45,
            dailyReward: 77,
            finalDayReward: 78,
            durationLabel: '7 天',
        },
        {
            planId: 'month_v2',
            name: '月卡',
            shortName: '月卡',
            price: 148,
            dailyReward: 66,
            finalDayReward: 86,
            durationLabel: '30 天',
        },
    ], []);

    useEffect(() => {
        if (!isOpen) {
            setAmountText('');
            setIsLoading(false);
            setQrCodeUrl(null);
            setOrderId(null);
            setPaymentStatus('idle');
            setPollingError('');
            setTimeLeft(COUNTDOWN_SECONDS);
            setRechargeTab(fixedTab ?? 'diamonds');
            setSelectedPlanIndex(-1);
            setSelectedFirstChargePlanId(null);
            setSelectedFixedPlanAmount(null);
            setCustomOriginalAmount(null);
            setAmountError('');
            setInputShake(false);
            return;
        }

        // 功能注释：每次打开默认微信支付（首位）；用户仍可切到海外支付
        setSelectedPayMethod('wechat');
        setRechargeTab(fixedTab ?? 'diamonds');
        if ((fixedTab ?? 'diamonds') === 'diamonds') {
            const defaultPlan = rechargePlans[0];
            setAmountText(String(defaultPlan.amount));
            setSelectedFirstChargePlanId(defaultPlan.planId);
            setSelectedFixedPlanAmount(defaultPlan.amount);
            setCustomOriginalAmount(null);
            setAmountError('');
            setInputShake(false);
            setSelectedPlanIndex(-1);
        } else {
            setSelectedPlanIndex(0);
            setSelectedFirstChargePlanId(null);
            setSelectedFixedPlanAmount(null);
            setCustomOriginalAmount(null);
            setAmountText('');
            setAmountError('');
            setInputShake(false);
        }
    }, [isOpen, fixedTab, rechargePlans]);

    useEffect(() => {
        if (isOpen && fixedTab && rechargeTab !== fixedTab) {
            setRechargeTab(fixedTab);
        }
    }, [isOpen, fixedTab, rechargeTab]);

    const handleFixedAmountClick = (plan: DiamondPlan) => {
        setAmountText(String(plan.amount));
        setSelectedFirstChargePlanId(plan.planId);
        setSelectedFixedPlanAmount(plan.amount);
        setCustomOriginalAmount(null);
        setAmountError('');
        setInputShake(false);
    };

    const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const sanitized = sanitizeAmountInput(e.target.value, selectedPayMethod);
        if (sanitized === null) {
            return;
        }
        const value = sanitized;

        const numericValue = Number.parseFloat(value || '0');
        if (Number.isFinite(numericValue) && value !== '' && value !== '.') {
            const validation = validateRechargeAmount(numericValue, selectedPayMethod);
            if (!validation.ok) {
                if (validation.reason === 'tooLow') {
                    setAmountError(t('rechargeModal.amountTooLow', { amount: payMinAmount, symbol: currencySymbol }));
                } else if (validation.reason === 'notInteger') {
                    setAmountError(t('rechargeModal.amountMustBeInteger'));
                } else {
                    setAmountError(t('rechargeModal.amountMaxTwoDecimals'));
                }
                setInputShake(validation.reason !== 'tooLow');
                if (validation.reason !== 'tooLow') {
                    window.setTimeout(() => setInputShake(false), 500);
                }
            } else {
                setAmountError('');
                setInputShake(false);
            }
            const matchedPlan = rechargePlans.find((plan) => plan.amount === numericValue);
            setSelectedFirstChargePlanId(matchedPlan?.planId ?? null);
            setCustomOriginalAmount(validation.ok ? numericValue : null);
        } else {
            setSelectedFirstChargePlanId(null);
            setCustomOriginalAmount(null);
            setAmountError('');
            setInputShake(false);
        }

        setSelectedFixedPlanAmount(null);
        setAmountText(value);
    };

    const getCurrentAmount = (): number | null => {
        if (selectedFixedPlanAmount !== null) {
            return selectedFixedPlanAmount;
        }
        if (customOriginalAmount !== null) {
            return customOriginalAmount;
        }
        if (amountText) {
            const amount = parseFloat(amountText);
            return !isNaN(amount) && amount >= payMinAmount ? amount : null;
        }
        return null;
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
            toast.error(t('rechargeModal.doNotRepeatClick'));
            return;
        }

        // 会员卡充值分支
        if (rechargeTab === 'membership') {
            if (selectedPlanIndex < 0 || selectedPlanIndex >= MEMBERSHIP_PLANS.length) {
                toast.error(t('rechargeModal.selectMembershipPlan'));
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
                            toast.success(t('rechargeModal.redirectingToPayment'));
                        } else {
                            toast.error(t('rechargeModal.miniProgramNotSupported'));
                        }
                        setPaymentStatus('failed');
                        setPollingError(data.message || t('rechargeModal.paymentRequestFailed'));
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
                const errorMessage = getApiErrorMessage(error, t('rechargeModal.paymentRequestFailed'));
                setPaymentStatus('failed');
                setPollingError(errorMessage);
                toast.error(errorMessage);
            } finally {
                setIsLoading(false);
                inFlightRef.current = false;
            }
            return;
        }

        // 钻石充值分支
        if (isComposingRef.current) {
            toast.error(t('rechargeModal.pleaseInputComplete'));
            return;
        }

        // 使用原始金额下单（不受会员折扣影响）
        const amount: number | null = getCurrentAmount();

        if (!amount) {
            if (amountText) {
                setAmountError(t('rechargeModal.amountTooLow', { amount: payMinAmount, symbol: currencySymbol }));
            }
            return;
        }

        const amountValidation = validateRechargeAmount(amount, selectedPayMethod);
        if (!amountValidation.ok) {
            if (amountValidation.reason === 'tooLow') {
                setAmountError(t('rechargeModal.amountTooLow', { amount: payMinAmount, symbol: currencySymbol }));
            } else if (amountValidation.reason === 'notInteger') {
                setAmountError(t('rechargeModal.amountMustBeInteger'));
            } else {
                setAmountError(t('rechargeModal.amountMaxTwoDecimals'));
            }
            setInputShake(true);
            window.setTimeout(() => setInputShake(false), 500);
            return;
        }

        // 根据是否选择了固定档位来决定传参方式
        // 固定档位：只传 orderType 和 planId，后端自动读取价格
        // 自定义金额：只传 orderType 和 amount
        const isFixedPlan = selectedFirstChargePlanId !== null;
        let orderData: PayOrderRequest;

        if (isFixedPlan) {
            orderData = {
                orderType: 'diamonds',
                planId: selectedFirstChargePlanId,
            };
        } else {
            orderData = {
                orderType: 'diamonds',
                amount,
                description: `KK币充值 ${amount} 元`,
            };
        }

        // 小程序仅走微信；H5/Web 直接按顶部已选支付方式下单，不再二次确认弹窗
        if (isMiniProgramEnv() || selectedPayMethod === 'wechat') {
            await startWechatDiamondPay(orderData);
            return;
        }
        await startOverseasDiamondPay(orderData);
    };

    /** 功能注释：既有微信 Native / 小程序支付链路 */
    const startWechatDiamondPay = async (orderData: PayOrderRequest) => {
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
                            url: `/pages/pay/pay?outTradeNo=${outTradeNo}&payParams=${payParamsStr}`,
                        });
                        toast.success(t('rechargeModal.redirectingToPayment'));
                    } else {
                        toast.error(t('rechargeModal.miniProgramNotSupported'));
                    }
                    setPaymentStatus('failed');
                    setPollingError(data.message || t('rechargeModal.paymentRequestFailed'));
                }
                setIsLoading(false);
                return;
            }
            if (onRecharge) {
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
            const errorMessage = getApiErrorMessage(error, t('rechargeModal.paymentRequestFailed'));
            setPaymentStatus('failed');
            setPollingError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
            inFlightRef.current = false;
        }
    };

    /** 功能注释：海外支付 → EnjoyPayment 收银台；金额/IP/用户ID 由后端组单 */
    const startOverseasDiamondPay = async (orderData: PayOrderRequest) => {
        inFlightRef.current = true;
        setIsLoading(true);
        try {
            toast.success(t('rechargeModal.redirectingOverseas'));
            const response = await payApi.createOverseasOrder(orderData);
            const data = response.data;
            if (data.code === 200 && data.data?.payUrl) {
                // 功能注释：有收银台链接即跳转；returnWebBase 缺失时后端可用 PUBLIC_WEB_BASE_URL 兜底回跳
                if (!data.data.returnWebBase) {
                    console.warn('[overseas-pay] returnWebBase missing from create response; still redirect', data.data.returnUrl);
                }
                setOrderId(data.data.outTradeNo);
                window.location.assign(data.data.payUrl);
                return;
            }
            throw new Error(data.message || t('rechargeModal.paymentRequestFailed'));
        } catch (error) {
            console.error('海外支付失败:', error);
            const errorMessage = getApiErrorMessage(error, t('rechargeModal.paymentRequestFailed'));
            setPaymentStatus('failed');
            setPollingError(errorMessage);
            toast.error(errorMessage);
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
                setPollingError(t('rechargeModal.queryPaymentStatusFailed'));
            }

            if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
                setPaymentStatus('failed');
                setPollingError(t('rechargeModal.paymentPending'));
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
                    setPollingError(t('rechargeModal.qrCodeExpired'));
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
                if (paymentStatus === 'success') {
                    void handleCloseWithRefresh();
                    return;
                }
                handleClose();
            }
        };

        document.addEventListener('keydown', handleEscKey);
        return () => {
            document.removeEventListener('keydown', handleEscKey);
        };
    }, [isOpen, paymentStatus, handleClose, handleCloseWithRefresh]);

    if (!isOpen) return null;

    const currentAmount = getCurrentAmount();

    const diamondsTabContent = (
        <>
            {/* 功能注释：微信支付固定首位并默认选中；切换后金额校验与货币符号跟着变 */}
            <div className={styles.payMethodToggle} role="group" aria-label={t('rechargeModal.choosePayMethod')}>
                {(['wechat', 'overseas'] as const).map((method) => (
                    <button
                        key={method}
                        type="button"
                        className={`${styles.payMethodToggleBtn} ${selectedPayMethod === method ? styles.payMethodToggleBtnActive : ''}`}
                        onClick={() => {
                            setSelectedPayMethod(method);
                            setAmountError('');
                            setInputShake(false);
                        }}
                    >
                        {method === 'wechat' ? t('rechargeModal.payWechat') : t('rechargeModal.payOverseas')}
                    </button>
                ))}
            </div>

            <div className={styles.fixedAmounts}>
                <div className={styles.amountsGrid}>
                    {rechargePlans.map((plan) => {
                        const planDiamonds = plan.firstChargeEligible ? plan.firstTotalDiamonds : plan.baseDiamonds;
                        const isActive = selectedFirstChargePlanId === plan.planId;
                        return (
                            <button
                                key={plan.planId}
                                type="button"
                                className={`${styles.amountBtn} ${isActive ? styles.amountBtnActive : ''}`}
                                onClick={() => handleFixedAmountClick(plan)}
                            >
                                <div className={styles.amountTopSection}>
                                    <div className={styles.amountMainPoints}>
                                        <CurrencyIcon currency="diamonds" className={styles.amountCoin} aria-hidden="true" />
                                        <span>{planDiamonds}</span>
                                    </div>
                                    <div className={styles.amountPriceMeta}>
                                        {t('rechargeModal.priceShort', { amount: plan.amount, symbol: currencySymbol })}
                                    </div>
                                    <div className={styles.firstChargeMeta}>
                                        {plan.firstChargeEligible
                                            ? `首充：基础 ${plan.baseDiamonds} + 加赠 ${plan.firstBonusDiamonds} = ${planDiamonds} 币`
                                            : `基础 ${plan.baseDiamonds} 币（首充加赠已领取）`}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className={styles.customAmount}>
                <div className={styles.customLabel}>{t('rechargeModal.customAmount')}</div>
                <div className={`${styles.customInputWrapper} ${amountError ? styles.inputError : ''}`}>
                    <span className={styles.currencySymbol}>{currencySymbol}</span>
                    <input
                        type="text"
                        className={`${styles.customInput} ${inputShake ? styles.shake : ''}`}
                        placeholder={t('rechargeModal.enterAmount')}
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
                {amountError && (
                    <div className={styles.amountHint}>
                        <span className={styles.errorText}>{amountError}</span>
                    </div>
                )}
            </div>

            <button
                type="submit"
                className={styles.submitBtn}
                disabled={!isAmountReadyToPay(currentAmount, selectedPayMethod) || isLoading}
            >
                {isLoading
                    ? t('rechargeModal.processing')
                    : t('rechargeModal.payNow', {
                        amount: currentAmount ?? 0,
                        symbol: currencySymbol,
                    })}
            </button>
        </>
    );

    const membershipTabContent = (
        <>
            <div className={styles.membershipStatusCard}>
                <div className={styles.membershipStatusMain}>
                    <div className={styles.membershipStatusInfo}>
                        <img src={ENJOY_ICON} alt="" className={styles.membershipStatusIcon} aria-hidden="true" />
                        <div className={styles.membershipStatusText}>
                            <span className={styles.membershipStatusTitle}>
                                {t('rechargeModal.enjoyMember')}
                            </span>
                            <div className={styles.membershipStatusExpire}>
                                <span className={styles.membershipStatusExpireLabel}>周卡有效期</span>
                                <span className={styles.membershipStatusExpireDate}>{weekEndDate ?? '未开通'}</span>
                            </div>
                            <div className={styles.membershipStatusExpire}>
                                <span className={styles.membershipStatusExpireLabel}>月卡有效期</span>
                                <span className={styles.membershipStatusExpireDate}>{monthEndDate ?? '未开通'}</span>
                            </div>
                        </div>
                    </div>
                    <div className={styles.membershipStatusBadge}>
                        <img src={MEMBER_ICON} alt="" className={styles.membershipStatusBadgeIcon} aria-hidden="true" />
                    </div>
                </div>
            </div>

            <div className={styles.plansList}>
                {MEMBERSHIP_PLANS.map((plan, index) => (
                    <button
                        key={plan.planId}
                        type="button"
                        className={`${styles.planItem} ${selectedPlanIndex === index ? styles.planItemActive : ''}`}
                        onClick={() => setSelectedPlanIndex(index)}
                    >
                        <span className={styles.planItemName}>{plan.name}</span>
                        <span className={styles.planRewardSummary}>
                            {plan.durationLabel} · 每日签到额外 {plan.dailyReward} 永久KK币 · 最后一天 {plan.finalDayReward} 币
                        </span>
                        <span className={styles.planItemPrice}>
                            {t('rechargeModal.currencySymbol')}{plan.price}
                        </span>
                    </button>
                ))}
            </div>

            <div className={styles.benefitsComparison}>
                <div className={styles.membershipRules}>
                    <strong>会员通用权益</strong>
                    <span>正式发布的 AI 文游游玩扣费享 85 折，创作者测试不参与折扣。</span>
                    <span>周卡与月卡有效期独立，可同时生效并分别领取每日永久KK币。</span>
                    <span>同档位再次购买会从当前有效期结束后顺延，未领取的每日奖励不补发。</span>
                </div>
            </div>

            <button
                type="submit"
                className={`${styles.submitBtn} ${styles.membershipSubmitBtn}`}
                disabled={selectedPlanIndex < 0 || isLoading}
            >
                {isLoading
                    ? t('rechargeModal.processing')
                    : t('rechargeModal.openNow', {
                        amount: MEMBERSHIP_PLANS[selectedPlanIndex]?.price ?? 0,
                    })}
            </button>
        </>
    );

    const formContent = (
        <div className={styles.modalOverlay} onClick={handleClose}>
            <div
                className={`${styles.modalContent} ${rechargeTab === 'membership' ? styles.modalContentWide : ''}`}
                onClick={(e) => e.stopPropagation()}
            >
                <button type="button" className={styles.closeBtn} onClick={handleClose} aria-label={t('common.close')}>
                    <span className={styles.closeIcon} aria-hidden="true" />
                </button>

                <h2 className={styles.title}>
                    {rechargeTab === 'membership'
                        ? t('rechargeModal.membershipCenter')
                        : t('rechargeModal.diamondsTab')}
                </h2>

                <form className={styles.form} onSubmit={handleSubmit}>
                    {rechargeTab === 'diamonds' ? diamondsTabContent : membershipTabContent}
                </form>
            </div>
        </div>
    );

    const qrContent = (
        <div
            className={styles.modalOverlay}
            onClick={paymentStatus === 'success' ? () => void handleCloseWithRefresh() : handleClose}
        >
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    className={styles.closeBtn}
                    onClick={paymentStatus === 'success' ? () => void handleCloseWithRefresh() : handleClose}
                    aria-label={t('common.close')}
                >
                    <span className={styles.closeIcon} aria-hidden="true" />
                </button>
                <div className={styles.qrSection}>
                    <div className={styles.qrTitle}>{t('rechargeModal.scanToPay')}</div>
                    <img src={qrCodeUrl || ''} alt="payment QR code" className={styles.qrImage} />
                    <div className={styles.qrHint}>{t('rechargeModal.scanQrCode')}</div>
                    {paymentStatus === 'polling' && (
                        <div className={styles.countdownText}>
                            {t('rechargeModal.qrCodeExpire', { seconds: timeLeft })}
                        </div>
                    )}
                    {paymentStatus === 'success' && <div className={styles.successText}>{t('rechargeModal.paymentSuccess')}</div>}
                    {paymentStatus === 'failed' && (
                        <div className={styles.errorText}>
                            {pollingError || t('rechargeModal.paymentPending')}
                        </div>
                    )}
                    <div className={styles.qrActions}>
                        {paymentStatus === 'success' && (
                            <button type="button" className={styles.qrActionBtn} onClick={() => void handleCloseWithRefresh()}>
                                {t('rechargeModal.done')}
                            </button>
                        )}
                        {paymentStatus === 'failed' && (
                            <button type="button" className={styles.qrActionBtn} onClick={handleRestart}>
                                {t('rechargeModal.restartRecharge')}
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
