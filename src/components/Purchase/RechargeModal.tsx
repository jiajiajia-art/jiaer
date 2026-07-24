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

type RechargeTabType = 'diamonds' | 'membership';

interface MembershipPlan {
    planId: PlanId;
    name: string;
    shortName: string;
    price: number;
}

interface DiamondPlan {
    planId: DiamondsPlanId;
    amount: number;
    firstChargeDiamonds: number;
    noFirstChargeBonus?: boolean;
}

// 会员钻石充值折扣（日卡9折、月卡8折、季卡7折、年卡6折）
const MEMBER_DISCOUNTS: Record<string, number> = {
    creator_day: 0.9,
    creator_month: 0.8,
    creator_season: 0.7,
    creator_year: 0.6,
};

const FIRST_CHARGE_PLANS: DiamondPlan[] = [
    { planId: 'dr_1', amount: 1, firstChargeDiamonds: 19 },
    { planId: 'dr_6', amount: 6, firstChargeDiamonds: 60, noFirstChargeBonus: true },
    { planId: 'dr_24', amount: 24, firstChargeDiamonds: 240 },
    { planId: 'dr_45', amount: 45, firstChargeDiamonds: 450 },
    { planId: 'dr_95', amount: 95, firstChargeDiamonds: 950 },
    { planId: 'dr_198', amount: 198, firstChargeDiamonds: 1980 },
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
    isFirstChargePlans?: Record<string, boolean>;
    fixedTab?: RechargeTabType;
}

const POINTS_PER_YUAN = 10;
const MIN_AMOUNT = 0.1;
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 2 * 60 * 1000;
const COUNTDOWN_SECONDS = POLL_TIMEOUT_MS / 1000;

const isMiniProgramEnv = (): boolean => {
    const win = window as WindowWithWx;
    return String(win.__wxjs_environment || '').toLowerCase() === 'miniprogram';
};

const RechargeModal: React.FC<RechargeModalProps> = ({ isOpen, onClose, onRecharge, isFirstChargePlans, fixedTab }) => {
    const { t } = useTranslation();
    const { user, updateUser } = useAuthStore();
    const [isLoading, setIsLoading] = useState(false);
    const [inputError, setInputError] = useState<string>('');
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
            planId: 'creator_day',
            name: t('profile.dailyMember'),
            shortName: t('profile.dailyMemberShort'),
            price: 1,
        },
        {
            planId: 'creator_month',
            name: t('profile.monthlyMember'),
            shortName: t('profile.monthlyMemberShort'),
            price: 30,
        },
        {
            planId: 'creator_season',
            name: t('profile.seasonalMember'),
            shortName: t('profile.seasonalMemberShort'),
            price: 90,
        },
        {
            planId: 'creator_year',
            name: t('profile.yearlyMember'),
            shortName: t('profile.yearlyMemberShort'),
            price: 365,
        },
    ], [t]);

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
            setRechargeTab(fixedTab ?? 'diamonds');
            setSelectedPlanIndex(-1);
            setSelectedFirstChargePlanId(null);
            setSelectedFixedPlanAmount(null);
            setCustomOriginalAmount(null);
        }
    }, [isOpen, fixedTab]);

    useEffect(() => {
        if (isOpen && fixedTab && rechargeTab !== fixedTab) {
            setRechargeTab(fixedTab);
        }
    }, [isOpen, fixedTab, rechargeTab]);

    const handleFixedAmountClick = (plan: DiamondPlan) => {
        const discount = getMemberDiscount();
        const displayAmount = discount < 1 ? (plan.amount * discount).toFixed(1) : String(plan.amount);
        setAmountText(displayAmount);
        setSelectedFirstChargePlanId(plan.planId);
        setSelectedFixedPlanAmount(plan.amount);
        setCustomOriginalAmount(null);
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
                    setInputError(t('rechargeModal.amountTooLow', { amount: MIN_AMOUNT }));
                } else {
                setInputError('');
            }
            const matchedPlan = FIRST_CHARGE_PLANS.find((plan) => plan.amount === numericValue);
            setSelectedFirstChargePlanId(matchedPlan?.planId ?? null);
            // 自定义金额也保存原始值
            setCustomOriginalAmount(numericValue >= MIN_AMOUNT ? numericValue : null);
        } else {
            setSelectedFirstChargePlanId(null);
            setCustomOriginalAmount(null);
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
            return !isNaN(amount) && amount >= MIN_AMOUNT ? amount : null;
        }
        return null;
    };

    const calculateDiamonds = (amount: number): number => {
        return Math.floor(amount * POINTS_PER_YUAN);
    };

    const getMemberDiscount = (): number => {
        const plan = user?.user?.memberPlan;
        return plan ? (MEMBER_DISCOUNTS[plan] ?? 1) : 1;
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
                setInputError(t('rechargeModal.amountTooLow', { amount: MIN_AMOUNT }));
            }
            return;
        }

        if (amount < MIN_AMOUNT) {
            setInputError(t('rechargeModal.amountTooLow', { amount: MIN_AMOUNT }));
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
                description: `钻石充值 ${amount} 元`,
            };
        }

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

    // 会员特权项（所有套餐共用）
    const MEMBERSHIP_BENEFITS = [
        // { name: t('rechargeModal.noAdFreeRounds'), values: ['30', '100', '100', '100'] },
        // { name: t('rechargeModal.dailyCheckInBonus'), values: ['0%', '0%', '+100%', '+210%'] },
        //{ name: t('rechargeModal.creatorDiscount'), values: ['-', '50%', '50%', '50%'] },
        { name: "钻石充值折扣", values: ['-', '9折', '8折', '7折', '6折'] },
    ];

    // 会员特权对比数据（普通用户 + 日卡 + 月卡 + 季卡 + 年卡）
    const allPlanBenefits = useMemo(() => [
        {
            planId: 'free',
            name: t('rechargeModal.free'),
            shortName: t('rechargeModal.free'),
            price: 0,
            color: '#999',
            tagBg: '#999',
        },
        {
            planId: 'creator_day',
            name: t('profile.dailyMember'),
            shortName: t('profile.dailyMemberShort'),
            price: 1,
            color: '#64b5f6',
            tagBg: '#64b5f6',
        },
        {
            planId: 'creator_month',
            name: t('profile.monthlyMember'),
            shortName: t('profile.monthlyMemberShort'),
            price: 30,
            color: '#228b22',
            tagBg: '#228b22',
        },
        {
            planId: 'creator_season',
            name: t('profile.seasonalMember'),
            shortName: t('profile.seasonalMemberShort'),
            price: 90,
            color: '#e57373',
            tagBg: '#e57373',
        },
        {
            planId: 'creator_year',
            name: t('profile.yearlyMember'),
            shortName: t('profile.yearlyMemberShort'),
            price: 365,
            color: '#d4a84b',
            tagBg: '#d4a84b',
        },
    ].map((plan) => ({ ...plan, perks: MEMBERSHIP_BENEFITS })), [t, MEMBERSHIP_BENEFITS]);

    if (!isOpen) return null;

    const hasFirstCharge = (planId: string) => isFirstChargePlans?.[planId] === true;
    const firstChargeAvailable = !hasFirstCharge(selectedFirstChargePlanId || '');
    const currentAmount = getCurrentAmount();
    const currentDiamonds = currentAmount ? calculateDiamonds(currentAmount) : 0;
    const selectedFirstChargePlan = FIRST_CHARGE_PLANS.find((plan) => plan.planId === selectedFirstChargePlanId) || null;
    const displayDiamonds = selectedFirstChargePlan?.noFirstChargeBonus
        ? currentDiamonds
        : (firstChargeAvailable ? (currentDiamonds + (selectedFirstChargePlan?.firstChargeDiamonds ?? 0)) : currentDiamonds);
    const summaryDisplayAmount = currentAmount ? currentAmount * getMemberDiscount() : 0;

    const diamondsTabContent = (
        <>
            <div className={styles.fixedAmounts}>
                <div className={styles.amountsLabel}>{t('rechargeModal.selectAmount')}</div>
                <div className={styles.amountsGrid}>
                    {FIRST_CHARGE_PLANS.map((plan) => {
                        const hasBonus = !plan.noFirstChargeBonus;
                        const isFirstYuan = plan.planId === 'dr_1';
                        const isSixYuan = plan.planId === 'dr_6';
                        const tagText = isFirstYuan ? t('rechargeModal.firstChargeBonus') : t('rechargeModal.firstChargeDouble');
                        const discount = getMemberDiscount();
                        const isDiscounted = discount < 1;
                        const displayAmount = isDiscounted ? plan.amount * discount : plan.amount;
                        const displayDiamonds = calculateDiamonds(plan.amount);
                        const planHasFirstCharged = hasFirstCharge(plan.planId);
                        return (
                            <button
                                key={plan.planId}
                                type="button"
                                className={`${styles.amountBtn} ${selectedFirstChargePlanId === plan.planId ? styles.amountBtnActive : ''}`}
                                onClick={() => handleFixedAmountClick(plan)}
                            >
                                {hasBonus ? (
                                    <div className={`${styles.firstChargeTag} ${planHasFirstCharged ? styles.firstChargeTagInactive : ''}`}>{tagText}</div>
                                ) : (
                                    isSixYuan && <div className={styles.noBonusTag}>{t('rechargeModal.noFirstChargeBonus')}</div>
                                )}
                                <div className={styles.amountTopSection}>
                                    <div className={styles.amountMainPoints}>{displayDiamonds}{t('rechargeModal.diamonds')}</div>
                                    <div className={styles.amountPriceMeta}>
                                        {isDiscounted ? (
                                            <>
                                                <span className={styles.amountPriceOriginal}>
                                                    {t('rechargeModal.currencySymbol')}{plan.amount.toFixed(1)}{t('rechargeModal.amountUnit')}
                                                </span>
                                                <span className={styles.amountPriceMetaDiscounted}>
                                                    {' '}{t('rechargeModal.currencySymbol')}{displayAmount.toFixed(1)}{t('rechargeModal.amountUnit')}
                                                </span>
                                            </>
                                        ) : (
                                            <>{t('rechargeModal.amountLabel')}{t('rechargeModal.currencySymbol')}{displayAmount.toFixed(1)}{t('rechargeModal.amountUnit')}</>
                                        )}
                                    </div>
                                </div>
                                {hasBonus ? (
                                    <div className={styles.amountFirstChargePoints}>{t('rechargeModal.firstChargeGive', { points: plan.firstChargeDiamonds })}</div>
                                ) : (
                                    isSixYuan && <div className={styles.amountNoBonus}>{t('rechargeModal.noBonus')}</div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className={styles.customAmount}>
                <div className={styles.customLabel}>{t('rechargeModal.customAmount')}</div>
                <div className={styles.customInputWrapper}>
                    <span className={styles.currencySymbol}>{t('rechargeModal.currencySymbol')}</span>
                    <input
                        type="text"
                        className={`${styles.customInput} ${inputError ? styles.inputError : ''}`}
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
                {inputError && (
                    <div className={styles.amountHint}>
                        <span className={styles.errorText}>{inputError}</span>
                    </div>
                )}
            </div>

            {currentAmount && currentAmount >= MIN_AMOUNT && (
                <div className={styles.rechargeSummary}>
                    <div className={styles.summaryRow}>
                        <span className={styles.summaryLabel}>{t('rechargeModal.rechargeAmount')}</span>
                        <span className={styles.summaryValue}>{t('rechargeModal.currencySymbol')}{summaryDisplayAmount.toFixed(2)}</span>
                    </div>
                    <div className={styles.summaryRow}>
                        <span className={styles.summaryLabel}>{t('rechargeModal.receiveDiamonds')}</span>
                        <span className={styles.summaryValue}>{displayDiamonds}</span>
                    </div>
                </div>
            )}

            {/* 确认充值按钮 */}
            <button
                type="submit"
                className={styles.submitBtn}
                disabled={!currentAmount || currentAmount < MIN_AMOUNT || isLoading}
            >
                {isLoading
                    ? t('rechargeModal.processing')
                    : `${t('rechargeModal.confirmRecharge')} ${t('rechargeModal.currencySymbol')}${summaryDisplayAmount.toFixed(2)}`}
            </button>
            {/* <button type="button" className={styles.submitBtn} disabled>
                临时维护
                请进交流群/活动页获取
             </button> */}
        </>
    );

    const membershipTabContent = (
        <>
            {/* 三列套餐卡片 - 保留不变 */}
            <div className={styles.plansList}>
                {MEMBERSHIP_PLANS.map((plan, index) => (
                    <button
                        key={plan.planId}
                        type="button"
                        className={`${styles.planItem} ${selectedPlanIndex === index ? styles.planItemActive : ''}`}
                        onClick={() => setSelectedPlanIndex(index)}
                    >
                        <span className={styles.planItemName}>{plan.name}</span>
                        <span className={styles.planItemPrice}>{t('rechargeModal.currencySymbol')}{plan.price}</span>
                    </button>
                ))}
            </div>

            {/* 会员权益对比表 - 百度网盘风格 */}
            <div className={styles.benefitsComparison}>
                <div className={styles.comparisonTitle}>{t('rechargeModal.membershipBenefits')}</div>
                <div className={styles.comparisonTable}>
                    <div className={styles.comparisonHeader}>
                        <span className={styles.comparisonLabel}>{t('rechargeModal.benefitName')}</span>
                        {allPlanBenefits.map((plan) => (
                            <span
                                key={plan.planId}
                                className={styles.comparisonHeaderCell}
                                style={{ color: plan.color }}
                            >
                                <span className={styles.planTag} style={{ background: plan.tagBg }}>
                                    {plan.shortName.replace(/会员$/, '')}
                                </span>
                                <span className={styles.planPriceSmall}>
                                    {plan.price > 0 ? `${t('rechargeModal.currencySymbol')}${plan.price}` : t('rechargeModal.free')}
                                </span>
                            </span>
                        ))}
                    </div>
                    {allPlanBenefits[0].perks.map((perk, perkIndex) => (
                        <div key={perkIndex} className={styles.comparisonRow}>
                            <span className={styles.comparisonLabel}>{perk.name}</span>
                            {perk.values.map((value, valIndex) => {
                                // 高亮：免积分回合数（月卡开始）和签到加成（月卡开始）
                                const isHighlight = valIndex >= 1;
                                const planColor = allPlanBenefits[valIndex].color;
                                return (
                                    <span
                                        key={valIndex}
                                        className={`${styles.comparisonValue} ${isHighlight ? styles.highlight : ''}`}
                                        style={isHighlight ? { color: planColor, fontWeight: 700 } : {}}
                                    >
                                        {value}
                                    </span>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* 确认购买按钮 */}
            <button
                type="submit"
                className={styles.submitBtn}
                disabled={selectedPlanIndex < 0 || isLoading}
            >
                {isLoading ? t('rechargeModal.processing') : `${t('rechargeModal.confirmPurchase')} ${MEMBERSHIP_PLANS[selectedPlanIndex]?.name || t('rechargeModal.membershipTab')}`}
            </button>
            {/* <button type="button" className={styles.submitBtn} disabled>
            临时维护
                请进交流群/活动页获取
            </button> */}
        </>
    );

    const formContent = (
        <div className={styles.modalOverlay} onClick={handleClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <button type="button" className={styles.closeBtn} onClick={handleClose}>
                    ×
                </button>

                <h2 className={styles.title}>{t('rechargeModal.title')}</h2>

                {!fixedTab && (
                    <div className={styles.tabBar}>
                        <button
                            type="button"
                            className={`${styles.tabBtn} ${rechargeTab === 'diamonds' ? styles.tabBtnActive : ''}`}
                            onClick={() => setRechargeTab('diamonds')}
                        >
                            {t('rechargeModal.diamondsTab')}
                        </button>
                        <button
                            type="button"
                            className={`${styles.tabBtn} ${rechargeTab === 'membership' ? styles.tabBtnActive : ''}`}
                            onClick={() => setRechargeTab('membership')}
                        >
                            {t('rechargeModal.membershipTab')}
                        </button>
                    </div>
                )}

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
                >
                    ×
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
