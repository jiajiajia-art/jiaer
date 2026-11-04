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
import { useGeoRegionStore } from '../../store/useGeoRegionStore';
import type { DefaultPayMethod } from '../../lib/geoRegion';
import {
    calcDiamondsForPayMethod,
    getPayMethodCurrencySymbol,
    getPayMethodMinAmount,
    isAmountReadyToPay,
    sanitizeAmountInput,
    validateRechargeAmount,
} from '../../lib/rechargeAmountRules';

type RechargeTabType = 'diamonds' | 'membership';

interface MembershipPlan {
    planId: PlanId;
    name: string;
    shortName: string;
    price: number;
    dailyReward: number;
    finalDayReward: number;
    durationLabel: string;
    totalReward: number;
}

interface DiamondPlan {
    planId: DiamondsPlanId;
    amount: number;
    baseDiamonds: number;
    firstBonusDiamonds: number;
    firstTotalDiamonds: number;
    firstChargeEligible: boolean;
}

interface PendingPayment {
    orderData: PayOrderRequest;
    payMethod: DefaultPayMethod;
    kind: RechargeTabType;
    amount: number;
    diamondPlan?: DiamondPlan;
    estimatedDiamonds?: number;
    membershipPlan?: MembershipPlan;
}

const DEFAULT_KK_RECHARGE_PLANS: DiamondPlan[] = [
    { planId: 'dr_6_v2', amount: 6, baseDiamonds: 60, firstBonusDiamonds: 6, firstTotalDiamonds: 66, firstChargeEligible: true },
    { planId: 'dr_30_v2', amount: 30, baseDiamonds: 300, firstBonusDiamonds: 30, firstTotalDiamonds: 330, firstChargeEligible: true },
    { planId: 'dr_68_v2', amount: 68, baseDiamonds: 680, firstBonusDiamonds: 68, firstTotalDiamonds: 748, firstChargeEligible: true },
    { planId: 'dr_128_v2', amount: 128, baseDiamonds: 1280, firstBonusDiamonds: 128, firstTotalDiamonds: 1408, firstChargeEligible: true },
    { planId: 'dr_328_v2', amount: 328, baseDiamonds: 3280, firstBonusDiamonds: 328, firstTotalDiamonds: 3608, firstChargeEligible: true },
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
    constrainToGameViewport?: boolean;
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 2 * 60 * 1000;
const COUNTDOWN_SECONDS = POLL_TIMEOUT_MS / 1000;

const isMiniProgramEnv = (): boolean => {
    const win = window as WindowWithWx;
    return String(win.__wxjs_environment || '').toLowerCase() === 'miniprogram';
};

const RechargeModal: React.FC<RechargeModalProps> = ({
    isOpen,
    onClose,
    onRecharge,
    fixedTab,
    constrainToGameViewport = false,
}) => {
    const { t } = useTranslation();
    const { updateUser, user: authUser } = useAuthStore();
    const region = useGeoRegionStore((state) => state.region);
    const regionLoaded = useGeoRegionStore((state) => state.loaded);
    const memberProfile = authUser?.user;
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
    const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);

    const [rechargeTab, setRechargeTab] = useState<RechargeTabType>(fixedTab ?? 'diamonds');
    const [selectedPlanIndex, setSelectedPlanIndex] = useState<number>(-1);
    const [selectedFirstChargePlanId, setSelectedFirstChargePlanId] = useState<DiamondsPlanId | null>(null);
    // 选中的固定档位的原始金额（用于下单），不受会员折扣影响
    const [selectedFixedPlanAmount, setSelectedFixedPlanAmount] = useState<number | null>(null);
    // 自定义充值的原始金额（用于下单），不受会员折扣影响
    const [customOriginalAmount, setCustomOriginalAmount] = useState<number | null>(null);
    // 用户实际看到的（可能是折扣后的）金额文本
    const [amountText, setAmountText] = useState<string>('');
    /** 功能注释：地区决定首次默认值，用户仍可在本次打开期间手动切换。 */
    const [selectedPayMethod, setSelectedPayMethod] = useState<DefaultPayMethod>('wechat');
    const payMinAmount = getPayMethodMinAmount(selectedPayMethod);
    const currencySymbol = getPayMethodCurrencySymbol(selectedPayMethod);

    const inFlightRef = useRef(false);
    const isComposingRef = useRef(false);
    const amountInputRef = useRef<HTMLInputElement | null>(null);
    const openedRef = useRef(false);
    const payMethodTouchedRef = useRef(false);

    const currentPaymentRegion = useMemo(() => {
        const countrySuffix = region.country ? ` · ${region.country}` : '';
        return region.payRegion === 'greaterChina'
            ? `中国大陆及港澳台${countrySuffix}`
            : `海外地区${countrySuffix}`;
    }, [region.country, region.payRegion]);

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
            totalReward: 540,
        },
        {
            planId: 'month_v2',
            name: '月卡',
            shortName: '月卡',
            price: 148,
            dailyReward: 66,
            finalDayReward: 86,
            durationLabel: '30 天',
            totalReward: 2000,
        },
    ], []);

    useEffect(() => {
        if (!isOpen) {
            openedRef.current = false;
            payMethodTouchedRef.current = false;
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
            setPendingPayment(null);
            return;
        }

        if (openedRef.current) return;
        openedRef.current = true;
        payMethodTouchedRef.current = false;
        setSelectedPayMethod(isMiniProgramEnv() ? 'wechat' : region.defaultPayMethod);
        setRechargeTab(fixedTab ?? 'diamonds');
        if ((fixedTab ?? 'diamonds') === 'diamonds') {
            const defaultPlan = rechargePlans[0];
            setAmountText('');
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
    }, [isOpen, fixedTab, rechargePlans, region.defaultPayMethod]);

    useEffect(() => {
        if (isOpen && regionLoaded && !isMiniProgramEnv() && !payMethodTouchedRef.current) {
            setSelectedPayMethod(region.defaultPayMethod);
        }
    }, [isOpen, region.defaultPayMethod, regionLoaded]);

    const handleFixedAmountClick = (plan: DiamondPlan) => {
        setAmountText('');
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
            setSelectedFirstChargePlanId(null);
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

        // 会员卡先进入确认步骤，确认后再按当前支付方式下单。
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

            setPendingPayment({
                orderData,
                payMethod: isMiniProgramEnv() ? 'wechat' : selectedPayMethod,
                kind: 'membership',
                amount: selectedPlan.price,
                membershipPlan: selectedPlan,
            });
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

        const diamondPlan = selectedFirstChargePlanId
            ? rechargePlans.find((plan) => plan.planId === selectedFirstChargePlanId)
            : undefined;
        const estimatedDiamonds = diamondPlan
            ? (diamondPlan.firstChargeEligible ? diamondPlan.firstTotalDiamonds : diamondPlan.baseDiamonds)
            : calcDiamondsForPayMethod(amount, selectedPayMethod, false);
        setPendingPayment({
            orderData,
            payMethod: isMiniProgramEnv() ? 'wechat' : selectedPayMethod,
            kind: 'diamonds',
            amount,
            diamondPlan,
            estimatedDiamonds,
        });
    };

    /** 功能注释：KK币和会员共用既有微信 Native / 小程序支付链路。 */
    const startWechatPay = async (orderData: PayOrderRequest) => {
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
    const startOverseasPay = async (orderData: PayOrderRequest) => {
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

    const cancelPaymentConfirmation = () => {
        if (isLoading) return;
        setPendingPayment(null);
    };

    const confirmPayment = async () => {
        if (!pendingPayment || inFlightRef.current) return;
        const confirmed = pendingPayment;
        setPendingPayment(null);
        if (confirmed.payMethod === 'overseas') {
            await startOverseasPay(confirmed.orderData);
            return;
        }
        await startWechatPay(confirmed.orderData);
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
                if (pendingPayment) {
                    setPendingPayment(null);
                    return;
                }
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
    }, [isOpen, paymentStatus, pendingPayment, handleClose, handleCloseWithRefresh]);

    if (!isOpen) return null;

    const currentAmount = getCurrentAmount();
    const selectedMembershipPlan = selectedPlanIndex >= 0 ? MEMBERSHIP_PLANS[selectedPlanIndex] : undefined;
    const selectedDiamondPlan = selectedFirstChargePlanId
        ? rechargePlans.find((plan) => plan.planId === selectedFirstChargePlanId)
        : undefined;
    const estimatedDiamonds = currentAmount == null
        ? 0
        : selectedDiamondPlan
            ? (selectedDiamondPlan.firstChargeEligible
                ? selectedDiamondPlan.firstTotalDiamonds
                : selectedDiamondPlan.baseDiamonds)
            : calcDiamondsForPayMethod(currentAmount, selectedPayMethod, false);
    const canSubmit = rechargeTab === 'membership'
        ? Boolean(selectedMembershipPlan)
        : isAmountReadyToPay(currentAmount, selectedPayMethod);
    const currencyName = selectedPayMethod === 'wechat' ? '人民币' : '美元';

    const diamondsTabContent = (
        <>
            <div className={styles.fixedAmounts}>
                <h3 className={styles.sectionHeading}>选择充值档位</h3>
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
                                        <span>{plan.baseDiamonds} KK币</span>
                                    </div>
                                    <div className={styles.amountPriceMeta}>
                                        {t('rechargeModal.priceShort', { amount: plan.amount, symbol: currencySymbol })}
                                    </div>
                                    <div className={styles.firstChargeMeta}>
                                        {plan.firstChargeEligible
                                            ? <>首充得 <strong>{planDiamonds}</strong></>
                                            : <>本次获得 <strong>{plan.baseDiamonds}</strong></>}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                    <div className={`${styles.customAmount} ${styles.customAmountTile} ${amountError ? styles.inputError : ''}`}>
                        <div className={styles.customLabel}>{t('rechargeModal.customAmount')}</div>
                        <div className={styles.customInputWrapper}>
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
                            <span className={styles.currencyUnit}>{currencyName}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.customAmount}>
                <div className={styles.customAmountPanel}>
                    <div className={styles.customReceiveHint}>
                        <span>预计获得</span>
                        <strong>{currentAmount != null ? `${estimatedDiamonds} KK币` : '— KK币'}</strong>
                    </div>
                </div>
                {amountError && (
                    <div className={styles.amountHint}>
                        <span className={styles.errorText}>{amountError}</span>
                    </div>
                )}
                <p className={styles.customAmountNotice}>自定义金额按当前支付方式换算，不参与固定档位首充加赠。</p>
            </div>
        </>
    );

    const membershipTabContent = (
        <>
            <h3 className={styles.sectionHeading}>选择会员卡</h3>
            <div className={styles.plansList}>
                {MEMBERSHIP_PLANS.map((plan, index) => (
                    <button
                        key={plan.planId}
                        type="button"
                        className={`${styles.planItem} ${selectedPlanIndex === index ? styles.planItemActive : ''}`}
                        onClick={() => setSelectedPlanIndex(index)}
                    >
                        <span className={styles.planItemHeader}>
                            <span className={styles.planItemName}>{plan.name}</span>
                            <span className={styles.planItemPrice}>
                                {t('rechargeModal.currencySymbol')}{plan.price}
                            </span>
                        </span>
                        <span className={styles.planRewardSummary}>
                            {plan.durationLabel}累计 {plan.totalReward.toLocaleString()} 永久 KK币
                        </span>
                        <span className={styles.planDiscount}>游玩 AI 文游 85 折</span>
                    </button>
                ))}
            </div>

            <section className={styles.membershipBenefitsCard} aria-labelledby="membership-benefits-title">
                <header className={styles.membershipBenefitsHeader}>
                    <strong id="membership-benefits-title">会员权益</strong>
                    <span>有效期内生效</span>
                </header>
                <div className={styles.membershipBenefitRow}>
                    <span className={styles.membershipBenefitIcon} aria-hidden="true">币</span>
                    <span className={styles.membershipBenefitText}>
                        <strong>每日领币</strong>
                        <small>
                            {selectedMembershipPlan
                                ? `每日 ${selectedMembershipPlan.dailyReward} 永久KK币，最后一天 ${selectedMembershipPlan.finalDayReward} 币`
                                : '登录签到领取对应会员卡永久KK币'}
                        </small>
                    </span>
                    <span className={styles.membershipBenefitCheck} aria-hidden="true">✓</span>
                </div>
                <div className={styles.membershipBenefitRow}>
                    <span className={styles.membershipBenefitIcon} aria-hidden="true">85</span>
                    <span className={styles.membershipBenefitText}>
                        <strong>游玩 AI 85 折</strong>
                        <small>仅适用于正式发布的 AI 文游游玩扣费</small>
                    </span>
                    <span className={styles.membershipBenefitCheck} aria-hidden="true">✓</span>
                </div>
                <div className={styles.membershipBenefitRow}>
                    <span className={styles.membershipBenefitIcon} aria-hidden="true">双</span>
                    <span className={styles.membershipBenefitText}>
                        <strong>两档独立生效</strong>
                        <small>周卡、月卡可同时持有并分别领取奖励</small>
                    </span>
                    <span className={styles.membershipBenefitCheck} aria-hidden="true">✓</span>
                </div>
                <div className={styles.membershipBenefitRow}>
                    <span className={styles.membershipBenefitIcon} aria-hidden="true">续</span>
                    <span className={styles.membershipBenefitText}>
                        <strong>同档购买顺延</strong>
                        <small>重复购买同档会员卡会直接延长有效期</small>
                    </span>
                    <span className={styles.membershipBenefitCheck} aria-hidden="true">✓</span>
                </div>
            </section>
        </>
    );

    const formContent = (
        <>
            <div className={styles.modalOverlay} onClick={handleClose}>
                <div
                    className={`${styles.modalContent} ${styles.modalContentWide} ${styles.rechargeCenter}${constrainToGameViewport ? ` ${styles.modalContentGameViewport}` : ''}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button type="button" className={styles.closeBtn} onClick={handleClose} aria-label={t('common.close')}>
                        <span className={styles.closeIcon} aria-hidden="true" />
                    </button>
                    <button type="button" className={styles.dismissBtn} onClick={handleClose} aria-label={t('common.close')}>
                        <span className={styles.dismissIcon} aria-hidden="true" />
                    </button>

                    <h2 className={styles.title}>充值中心</h2>

                    <div className={styles.regionSummary}>
                        <span>当前支付地区</span>
                        <strong>{currentPaymentRegion}</strong>
                    </div>

                    <div className={styles.rechargeTabs} role="tablist" aria-label="充值类型">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={rechargeTab === 'diamonds'}
                            className={rechargeTab === 'diamonds' ? styles.rechargeTabActive : ''}
                            onClick={() => {
                                setRechargeTab('diamonds');
                                if (getCurrentAmount() == null) handleFixedAmountClick(rechargePlans[0]);
                            }}
                        >
                            KK币充值
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={rechargeTab === 'membership'}
                            className={rechargeTab === 'membership' ? styles.rechargeTabActive : ''}
                            onClick={() => {
                                setRechargeTab('membership');
                                if (selectedPlanIndex < 0) setSelectedPlanIndex(0);
                            }}
                        >
                            会员卡
                        </button>
                    </div>

                    <form className={styles.form} onSubmit={handleSubmit}>
                        {rechargeTab === 'diamonds' ? diamondsTabContent : membershipTabContent}

                        <section className={styles.paymentSection} aria-labelledby="payment-method-heading">
                            <h3 id="payment-method-heading" className={styles.sectionHeading}>支付方式</h3>
                            <div className={styles.payMethodToggle} role="group" aria-label={t('rechargeModal.choosePayMethod')}>
                                {(['wechat', 'overseas'] as const).map((method) => (
                                    <button
                                        key={method}
                                        type="button"
                                        disabled={isMiniProgramEnv() && method === 'overseas'}
                                        aria-pressed={selectedPayMethod === method}
                                        className={`${styles.payMethodToggleBtn} ${selectedPayMethod === method ? styles.payMethodToggleBtnActive : ''}`}
                                        onClick={() => {
                                            payMethodTouchedRef.current = true;
                                            setSelectedPayMethod(method);
                                            setAmountError('');
                                            setInputShake(false);
                                        }}
                                    >
                                        {method === 'wechat' ? t('rechargeModal.payWechat') : t('rechargeModal.payOverseas')}
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className={styles.orderSummary} aria-label="订单摘要">
                            {rechargeTab === 'membership' ? (
                                <>
                                    <div><span>选择商品</span><strong>{selectedMembershipPlan?.name ?? '未选择'}</strong></div>
                                    <div><span>支付金额</span><strong>¥{selectedMembershipPlan?.price ?? 0}</strong></div>
                                </>
                            ) : (
                                <>
                                    <div><span>支付金额</span><strong>{currencySymbol}{currentAmount ?? 0}</strong></div>
                                    <div><span>本次获得</span><strong>{estimatedDiamonds} KK币</strong></div>
                                </>
                            )}
                        </section>

                        <button
                            type="submit"
                            className={`${styles.submitBtn} ${rechargeTab === 'membership' ? styles.membershipSubmitBtn : ''}`}
                            disabled={!canSubmit || isLoading}
                        >
                            {isLoading
                                ? t('rechargeModal.processing')
                                : rechargeTab === 'membership'
                                    ? `支付 ¥${selectedMembershipPlan?.price ?? 0}，开通${selectedMembershipPlan?.name ?? '会员卡'}`
                                    : `支付 ${currencySymbol}${currentAmount ?? 0}，获得 ${estimatedDiamonds} KK币`}
                        </button>

                        {rechargeTab === 'membership' ? (
                            <section className={styles.membershipRulesCard} aria-labelledby="membership-rules-title">
                                <strong id="membership-rules-title">领取规则</strong>
                                <ul>
                                    <li>会员币需每日登录并完成签到后领取，到账后永久有效。</li>
                                    <li>周卡每日 77 币、最后一天 78 币，7 天累计 540 币。</li>
                                    <li>月卡每日 66 币、最后一天 86 币，30 天累计 2,000 币。</li>
                                    <li>周卡与月卡同时有效时分别领取；同档重复购买直接延长有效期。</li>
                                    <li>当日未签到不自动发放，可补签后领取对应日期奖励。</li>
                                </ul>
                            </section>
                        ) : (
                            <p className={styles.paymentNotice}>充值KK币永久有效，虚拟商品支付后不支持退款。</p>
                        )}
                    </form>
                </div>
            </div>

            {pendingPayment ? (
                <div className={styles.confirmationOverlay} onClick={cancelPaymentConfirmation}>
                    <section
                        className={styles.confirmationPanel}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="payment-confirmation-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <h2 id="payment-confirmation-title">
                            {pendingPayment.kind === 'membership' ? '确认开通会员卡' : '确认充值'}
                        </h2>
                        <div className={styles.confirmationRows}>
                            <div>
                                <span>支付方式</span>
                                <strong>{pendingPayment.payMethod === 'wechat' ? '微信支付' : '海外支付'}</strong>
                            </div>
                            <div>
                                <span>支付金额</span>
                                <strong>
                                    {pendingPayment.kind === 'membership' ? '¥' : getPayMethodCurrencySymbol(pendingPayment.payMethod)}
                                    {pendingPayment.amount}
                                </strong>
                            </div>
                            {pendingPayment.kind === 'membership' ? (
                                <>
                                    <div><span>会员卡</span><strong>{pendingPayment.membershipPlan?.name} · {pendingPayment.membershipPlan?.durationLabel}</strong></div>
                                    <div><span>领取方式</span><strong>每日登录签到领取</strong></div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <span>基础到账</span>
                                        <strong>{pendingPayment.diamondPlan?.baseDiamonds ?? pendingPayment.estimatedDiamonds ?? 0} KK币</strong>
                                    </div>
                                    {pendingPayment.diamondPlan?.firstChargeEligible ? (
                                        <div><span>首充赠送</span><strong>+{pendingPayment.diamondPlan.firstBonusDiamonds} KK币</strong></div>
                                    ) : null}
                                    <div><span>实际获得</span><strong>{pendingPayment.estimatedDiamonds ?? 0} KK币</strong></div>
                                </>
                            )}
                        </div>
                        <div className={styles.confirmationActions}>
                            <button type="button" onClick={cancelPaymentConfirmation} disabled={isLoading}>取消</button>
                            <button type="button" className={styles.confirmationPrimary} onClick={() => void confirmPayment()} disabled={isLoading}>
                                {isLoading ? t('rechargeModal.processing') : '确认支付'}
                            </button>
                        </div>
                    </section>
                </div>
            ) : null}
        </>
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
