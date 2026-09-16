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
import { resolveMemberDisplayEndAt } from '../../utils/planLabels';
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

const COIN_ICON = `${import.meta.env.BASE_URL}data/assetsv2/personal/payment/coin.png`;
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
}

interface DiamondPlan {
    planId: DiamondsPlanId;
    amount: number;
    firstChargeDiamonds: number;
    noFirstChargeBonus?: boolean;
}

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
    const memberEndDate = useMemo(
        () => formatMemberEndDate(
            resolveMemberDisplayEndAt(memberProfile?.stackedPlans, memberProfile?.memberEndAt),
        ),
        [memberProfile?.stackedPlans, memberProfile?.memberEndAt],
    );
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
    const defaultPayMethod = useGeoRegionStore((s) => s.region.defaultPayMethod);
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

        // 功能注释：每次打开按 IP 默认支付方式重置
        setSelectedPayMethod(defaultPayMethod);
        setRechargeTab(fixedTab ?? 'diamonds');
        if ((fixedTab ?? 'diamonds') === 'diamonds') {
            const defaultPlan = FIRST_CHARGE_PLANS[0];
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
    }, [isOpen, fixedTab, defaultPayMethod]);

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
            const matchedPlan = FIRST_CHARGE_PLANS.find((plan) => plan.amount === numericValue);
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

    const calculateDiamonds = (amount: number, isFixedPlan = true): number => {
        return calcDiamondsForPayMethod(amount, selectedPayMethod, isFixedPlan);
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
                description: `钻石充值 ${amount} 元`,
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
                // 功能注释：下单响应里应带回当前 Origin；缺失则回跳会落到线上兜底，本地需硬刷新前端
                if (!data.data.returnWebBase) {
                    console.warn('[overseas-pay] returnWebBase missing from create response', data.data.returnUrl);
                    toast.error(t('rechargeModal.paymentRequestFailed'));
                    return;
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

    // 会员特权项（所有套餐共用）
    const MEMBERSHIP_BENEFITS = [
        // { name: t('rechargeModal.noAdFreeRounds'), values: ['30', '100', '100', '100'] },
        // { name: t('rechargeModal.dailyCheckInBonus'), values: ['0%', '0%', '+100%', '+210%'] },
        //{ name: t('rechargeModal.creatorDiscount'), values: ['-', '50%', '50%', '50%'] },
        { name: "钻石兑换积分折扣", values: ['-', '9折', '8折', '7折', '6折'] },
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

    const currentAmount = getCurrentAmount();

    const diamondsTabContent = (
        <>
            {/* 功能注释：支付方式互切；IP 默认高亮，切换后金额校验与货币符号跟着变 */}
            <div className={styles.payMethodToggle} role="group" aria-label={t('rechargeModal.choosePayMethod')}>
                {(defaultPayMethod === 'overseas'
                    ? (['overseas', 'wechat'] as const)
                    : (['wechat', 'overseas'] as const)
                ).map((method) => (
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
                    {FIRST_CHARGE_PLANS.map((plan) => {
                        const planDiamonds = calculateDiamonds(plan.amount, true);
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
                                        <img src={COIN_ICON} alt="" className={styles.amountCoin} aria-hidden="true" />
                                        <span>{planDiamonds}</span>
                                    </div>
                                    <div className={styles.amountPriceMeta}>
                                        {t('rechargeModal.priceShort', { amount: plan.amount, symbol: currencySymbol })}
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
                            {memberEndDate ? (
                                <div className={styles.membershipStatusExpire}>
                                    <span className={styles.membershipStatusExpireLabel}>
                                        {t('rechargeModal.validUntil')}
                                    </span>
                                    <span className={styles.membershipStatusExpireDate}>{memberEndDate}</span>
                                </div>
                            ) : null}
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
                        <span className={styles.planItemPrice}>
                            {t('rechargeModal.currencySymbol')}{plan.price}
                        </span>
                    </button>
                ))}
            </div>

            <div className={styles.benefitsComparison}>
                <div className={styles.comparisonTable}>
                    <div className={styles.comparisonHeader}>
                        <span className={styles.comparisonLabel} aria-hidden="true" />
                        {allPlanBenefits.map((plan) => (
                            <span key={plan.planId} className={styles.comparisonHeaderCell}>
                                {plan.shortName.replace(/会员$/, '')}
                            </span>
                        ))}
                    </div>
                    {allPlanBenefits[0].perks.map((perk, perkIndex) => (
                        <div key={perkIndex} className={styles.comparisonRow}>
                            <span className={styles.comparisonLabel}>{perk.name}</span>
                            {perk.values.map((value, valIndex) => (
                                <span
                                    key={valIndex}
                                    className={`${styles.comparisonValue} ${valIndex >= 1 ? styles.highlight : ''}`}
                                >
                                    {value}
                                </span>
                            ))}
                        </div>
                    ))}
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
