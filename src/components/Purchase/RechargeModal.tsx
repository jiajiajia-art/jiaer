import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FaAlipay, FaWeixin } from 'react-icons/fa6';
import { Globe2 } from 'lucide-react';
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
import { useAlipayCheckout } from '../../hooks/useAlipayCheckout';
import AlipayCheckoutPanel from './AlipayCheckoutPanel';
import RechargeSuccessReceipt from './RechargeSuccessReceipt';
import { createDiamondReceipt, createMembershipReceipt, saveRechargeReceiptToStorage } from '../../lib/rechargeReceipt';
import type { RechargeReceipt } from '../../lib/rechargeReceipt';
import {
    calcDiamondsForPayMethod,
    formatPayAmount,
    normalizeOverseasRate,
    toOverseasPrice,
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
    overseasMultiplier?: number;
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
            overseasMultiplier: plan.overseasMultiplier,
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
    const [activeReceipt, setActiveReceipt] = useState<RechargeReceipt | null>(null);

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
    const isOverseas = selectedPayMethod === 'overseas';
    const overseasRate = normalizeOverseasRate(memberProfile?.overseasPricing?.rate);
    /** 功能注释：人民币标价 → 当前支付方式的实付价（海外按后台倍率换算） */
    const toPayPrice = (cny: number, multiplier?: number) =>
        isOverseas ? toOverseasPrice(cny, multiplier && multiplier > 0 ? multiplier : overseasRate) : cny;
    const fmt = (amount: number) => `${currencySymbol}${formatPayAmount(amount, selectedPayMethod)}`;

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

    const alipay = useAlipayCheckout(isOpen && !isMiniProgramEnv(), authUser?.user.userId, refreshUserInfo);

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
            setActiveReceipt(null);
            return;
        }

        if (openedRef.current) return;
        openedRef.current = true;
        payMethodTouchedRef.current = false;
        setSelectedPayMethod('wechat');
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
    }, [isOpen, fixedTab, rechargePlans]);

    useEffect(() => {
        if (isOpen && regionLoaded && !payMethodTouchedRef.current) setSelectedPayMethod('wechat');
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
        setActiveReceipt(null);
        setActiveReceipt(null);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (inFlightRef.current || alipay.creating) {
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
            const payMethod = isMiniProgramEnv() ? 'wechat' : selectedPayMethod;

            setPendingPayment({
                orderData,
                payMethod,
                kind: 'membership',
                amount: payMethod === 'overseas' ? toOverseasPrice(selectedPlan.price, overseasRate) : selectedPlan.price,
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
            : calcDiamondsForPayMethod(amount, selectedPayMethod, false, overseasRate);
        setPendingPayment({
            orderData,
            payMethod: isMiniProgramEnv() ? 'wechat' : selectedPayMethod,
            kind: 'diamonds',
            // 固定档位按 planId 下单，展示金额按支付方式换算；自定义金额本身即实付币种
            amount: diamondPlan ? toPayPrice(diamondPlan.amount, diamondPlan.overseasMultiplier) : amount,
            diamondPlan,
            estimatedDiamonds,
        });
    };

    /** 功能注释：KK币和会员共用既有微信 Native / 小程序支付链路。 */
    const startWechatPay = async (orderData: PayOrderRequest, receipt: RechargeReceipt) => {
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
                    setActiveReceipt(receipt);
                    setPaymentStatus('polling');
                    if (authUser?.user.userId) {
                        saveRechargeReceiptToStorage(sessionStorage, authUser.user.userId, outTradeNo, receipt);
                    }
                    const mp = (window as WindowWithWx).wx?.miniProgram;
                    if (mp && typeof mp.postMessage === 'function') {
                        const payParamsStr = encodeURIComponent(JSON.stringify(payParams));
                        mp.navigateTo({
                            url: `/pages/pay/pay?outTradeNo=${outTradeNo}&payParams=${payParamsStr}`,
                        });
                        toast.success(t('rechargeModal.redirectingToPayment'));
                    } else {
                        toast.error(t('rechargeModal.miniProgramNotSupported'));
                        setPaymentStatus('failed');
                        setPollingError(t('rechargeModal.miniProgramNotSupported'));
                    }
                } else {
                    throw new Error(data.message || t('rechargeModal.paymentRequestFailed'));
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
                    setActiveReceipt(receipt);
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
    const startOverseasPay = async (orderData: PayOrderRequest, receipt: RechargeReceipt) => {
        inFlightRef.current = true;
        setIsLoading(true);
        try {
            toast.success(t('rechargeModal.redirectingOverseas'));
            const response = await payApi.createOverseasOrder(orderData);
            const data = response.data;
            if (data.code === 200 && data.data?.payUrl) {
                if (authUser?.user.userId) {
                    saveRechargeReceiptToStorage(sessionStorage, authUser.user.userId, data.data.outTradeNo, receipt);
                }
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

    const startAlipayPay = async (orderData: PayOrderRequest, receipt: RechargeReceipt) => {
        inFlightRef.current = true;
        setIsLoading(true);
        try {
            await alipay.start(orderData, receipt);
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
        if (!pendingPayment || inFlightRef.current || alipay.creating) return;
        const confirmed = pendingPayment;
        const receipt = confirmed.kind === 'diamonds'
            ? createDiamondReceipt(confirmed.amount, confirmed.estimatedDiamonds || 0)
            : createMembershipReceipt(confirmed.membershipPlan!.planId, confirmed.amount);
        setActiveReceipt(receipt);
        setPendingPayment(null);
        if (confirmed.payMethod === 'overseas') {
            await startOverseasPay(confirmed.orderData, receipt);
            return;
        }
        if (confirmed.payMethod === 'alipay') {
            await startAlipayPay(confirmed.orderData, receipt);
            return;
        }
        await startWechatPay(confirmed.orderData, receipt);
    };

    const returnToRechargePlans = useCallback(async () => {
        await refreshUserInfo();
        setQrCodeUrl(null);
        setOrderId(null);
        setPaymentStatus('idle');
        setPollingError('');
        setTimeLeft(COUNTDOWN_SECONDS);
        setActiveReceipt(null);
        alipay.returnToPlans();
    }, [alipay.returnToPlans, refreshUserInfo]);

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
        if (!orderId || qrCodeUrl || !isMiniProgramEnv() || !isOpen || paymentStatus !== 'polling') return;
        let timeoutId: number | null = null;
        let stopped = false;
        const startedAt = Date.now();
        const pollStatus = async () => {
            if (stopped) return;
            try {
                const response = await payApi.checkPayStatus(orderId);
                const status = response.data?.data;
                if (status === 'paid') {
                    setPaymentStatus('success');
                    setPollingError('');
                    await refreshUserInfo();
                    return;
                }
                if (['failed', 'closed', 'cancelled', 'canceled', 'expired'].includes(String(status))) {
                    setPaymentStatus('failed');
                    setPollingError(t('rechargeModal.paymentFailed'));
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
        void pollStatus();
        return () => {
            stopped = true;
            if (timeoutId) window.clearTimeout(timeoutId);
        };
    }, [orderId, qrCodeUrl, isOpen, paymentStatus, refreshUserInfo, t]);

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
                    void returnToRechargePlans();
                    return;
                }
                handleClose();
            }
        };

        document.addEventListener('keydown', handleEscKey);
        return () => {
            document.removeEventListener('keydown', handleEscKey);
        };
    }, [isOpen, paymentStatus, pendingPayment, handleClose, returnToRechargePlans]);

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
            : calcDiamondsForPayMethod(currentAmount, selectedPayMethod, false, overseasRate);
    const payAmount = currentAmount == null
        ? 0
        : selectedDiamondPlan ? toPayPrice(selectedDiamondPlan.amount, selectedDiamondPlan.overseasMultiplier) : currentAmount;
    const membershipPayAmount = selectedMembershipPlan ? toPayPrice(selectedMembershipPlan.price) : 0;
    const canSubmit = rechargeTab === 'membership'
        ? Boolean(selectedMembershipPlan)
        : isAmountReadyToPay(currentAmount, selectedPayMethod);

    const diamondsTabContent = (
        <>
            <div className={styles.fixedAmounts}>
                {isOverseas && (
                    <div className={styles.sectionHeadRow}>
                        <span className={styles.currencyBadge}>USD 美元结算</span>
                    </div>
                )}
                <div className={styles.amountsGrid}>
                    {rechargePlans.map((plan) => {
                        const planDiamonds = plan.firstChargeEligible ? plan.firstTotalDiamonds : plan.baseDiamonds;
                        const isFirst = plan.firstChargeEligible;
                        const isActive = selectedFirstChargePlanId === plan.planId;
                        return (
                            <button
                                key={plan.planId}
                                type="button"
                                aria-pressed={isActive}
                                className={`${styles.amountBtn} ${styles.tile} ${isFirst ? styles.tileFirst : ''} ${isActive ? `${styles.amountBtnActive} ${styles.tileActive}` : ''}`}
                                onClick={() => handleFixedAmountClick(plan)}
                            >
                                {isFirst && <span className={styles.tileRibbon}>首充</span>}
                                <span className={styles.tileCoins}>
                                    <b>{plan.baseDiamonds} KK币</b>
                                </span>
                                {/* 首充 / 非首充共用同一标签位，卡片高度一致 */}
                                <span className={`${styles.tileBonus} ${isFirst ? styles.tileBonusFirst : ''}`}>
                                    {isFirst
                                        ? <>首充得 <strong>{planDiamonds}</strong></>
                                        : <>本次获得 <strong>{plan.baseDiamonds}</strong></>}
                                </span>
                                <span className={styles.tilePrice}>
                                    {fmt(toPayPrice(plan.amount, plan.overseasMultiplier))}
                                    {isOverseas && <small>≈¥{plan.amount}</small>}
                                </span>
                            </button>
                        );
                    })}
                    <div className={`${styles.customAmount} ${styles.customAmountTile} ${styles.tileCustom} ${amountError ? styles.inputError : ''}`}>
                        <div className={styles.customLabel}>自定义</div>
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
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.customAmount}>
                {amountError && (
                    <div className={styles.amountHint}>
                        <span className={styles.errorText}>{amountError}</span>
                    </div>
                )}
                <p className={styles.customAmountNotice}>
                    {isOverseas
                        ? `自定义按 ×${overseasRate} 换算，不参与首充加赠`
                        : '1 元 = 10 KK币 · 自定义不参与首充加赠'}
                </p>
            </div>
        </>
    );

    const membershipTabContent = (
        <div className={styles.membershipStack}>
            <div className={styles.membershipBlock}>
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
                                    {fmt(toPayPrice(plan.price))}
                                </span>
                            </span>
                            <span className={styles.planRewardSummary}>
                                {plan.durationLabel} · {plan.totalReward.toLocaleString()} KK币
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            <div className={styles.membershipPerkStrip} aria-label="会员权益">
                <span>
                    {selectedMembershipPlan
                        ? `每日 ${selectedMembershipPlan.dailyReward} 币`
                        : '每日领币'}
                </span>
                <span>AI 文游 85 折</span>
                <span>同档顺延</span>
            </div>
            <p className={styles.membershipFootNote}>
                需每日签到领取；周卡/月卡可同时持有，未签到可补签后领取。
            </p>
        </div>
    );

    const formContent = (
        <>
            <div className={styles.modalOverlay} onClick={handleClose}>
                <div
                    className={`${styles.modalContent} ${styles.modalContentWide} ${styles.rechargeCenter}${constrainToGameViewport ? ` ${styles.modalContentGameViewport}` : ''}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button type="button" className={styles.dismissBtn} onClick={handleClose} aria-label={t('common.close')}>
                        <span className={styles.dismissIcon} aria-hidden="true" />
                    </button>

                    <header className={styles.rechargeHeader}>
                        <h2 className={styles.title}>充值中心</h2>
                        <p className={styles.regionMeta}>
                            {currentPaymentRegion}
                            <span aria-hidden="true">·</span>
                            虚拟商品不支持退款
                        </p>
                    </header>

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
                            <span>KK币</span>
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
                            <span>会员卡</span>
                        </button>
                    </div>

                    <form className={styles.form} onSubmit={handleSubmit}>
                        {rechargeTab === 'diamonds' ? diamondsTabContent : membershipTabContent}

                        <section className={styles.paymentSection} aria-label={t('rechargeModal.choosePayMethod')}>
                            <div className={styles.payMethodToggle} role="group" aria-label={t('rechargeModal.choosePayMethod')}
                                style={isMiniProgramEnv() ? { gridTemplateColumns: '1fr' } : undefined}>
                                {((isMiniProgramEnv() ? ['wechat'] : ['wechat', 'alipay', 'overseas']) as DefaultPayMethod[]).map((method) => (
                                    <button
                                        key={method}
                                        type="button"
                                        aria-pressed={selectedPayMethod === method}
                                        className={`${styles.payMethodToggleBtn} ${selectedPayMethod === method ? styles.payMethodToggleBtnActive : ''}`}
                                        onClick={() => {
                                            payMethodTouchedRef.current = true;
                                            setSelectedPayMethod(method);
                                            setAmountError('');
                                            setInputShake(false);
                                        }}
                                    >
                                        {method === 'wechat' ? (
                                            <FaWeixin className={`${styles.payMethodIcon} ${styles.payMethodIconWechat}`} aria-hidden="true" />
                                        ) : method === 'alipay' ? (
                                            <FaAlipay className={`${styles.payMethodIcon} ${styles.payMethodIconAlipay}`} aria-hidden="true" />
                                        ) : (
                                            <Globe2 className={`${styles.payMethodIcon} ${styles.payMethodIconOverseas}`} aria-hidden="true" />
                                        )}
                                        <span className={styles.payMethodLabel}>
                                            {t(method === 'wechat' ? 'rechargeModal.payWechat' : method === 'alipay' ? 'rechargeModal.payAlipay' : 'rechargeModal.payOverseas')}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* 功能注释：订单摘要便于用户核对金额/到账；与支付按钮文案互补 */}
                        <section className={styles.orderSummary} aria-label="订单摘要">
                            {rechargeTab === 'membership' ? (
                                <>
                                    <div><span>选择商品</span><strong>{selectedMembershipPlan?.name ?? '未选择'}</strong></div>
                                    <div><span>支付金额</span><strong>{fmt(membershipPayAmount)}</strong></div>
                                </>
                            ) : (
                                <>
                                    <div><span>支付金额</span><strong>{fmt(payAmount)}</strong></div>
                                    <div><span>本次获得</span><strong>{estimatedDiamonds} KK币</strong></div>
                                </>
                            )}
                        </section>

                        <button
                            type="submit"
                            className={`${styles.submitBtn} ${rechargeTab === 'membership' ? styles.membershipSubmitBtn : ''}`}
                            disabled={!canSubmit || isLoading || alipay.creating || alipay.requiresResolution}
                        >
                            {isLoading || alipay.creating
                                ? t('rechargeModal.processing')
                                : rechargeTab === 'membership'
                                    ? `支付 ${fmt(membershipPayAmount)} · 开通${selectedMembershipPlan?.name ?? '会员卡'}`
                                    : `支付 ${fmt(payAmount)} · 获得 ${estimatedDiamonds} KK币`}
                        </button>

                        {alipay.error && alipay.error !== 'cancelPending' && <p role="alert" className={styles.errorText}>
                            {t(`rechargeModal.alipayCheckoutErrors.${alipay.error}`)}
                        </p>}

                        {alipay.requiresResolution && <div role="alert" className={styles.errorText}>
                            <p>{t('rechargeModal.alipayCheckoutErrors.cancelPending')}</p>
                            <button type="button" className={styles.qrActionBtn} onClick={() => void alipay.dismiss()}>
                                {t('rechargeModal.alipayCancelRetry')}
                            </button>
                        </div>}
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
                        {pendingPayment.kind === 'diamonds' ? (() => {
                            const plan = pendingPayment.diamondPlan;
                            const isFirstCharge = Boolean(plan?.firstChargeEligible);
                            // 首充 / 非首充 / 自定义金额共用同一结构，只切换标签内容，弹窗高度保持一致
                            const chipText = isFirstCharge
                                ? <>含首充赠送 <strong>+{plan!.firstBonusDiamonds}</strong> KK币</>
                                : plan ? '首充赠送已领取，本档按原价到账' : '自定义金额不参与首充赠送';
                            return (
                                <div className={`${styles.confirmHero} ${isFirstCharge ? styles.confirmHeroFirst : ''}`}>
                                    <span className={styles.confirmHeroLabel}>本次获得</span>
                                    <span className={styles.confirmHeroValue}>
                                        {pendingPayment.estimatedDiamonds ?? 0}<small>KK币</small>
                                    </span>
                                    <span className={`${styles.confirmHeroChip} ${isFirstCharge ? styles.confirmHeroChipFirst : ''}`}>
                                        {chipText}
                                    </span>
                                </div>
                            );
                        })() : null}
                        <div className={styles.confirmationRows}>
                            <div>
                                <span>支付方式</span>
                                <strong>{t(pendingPayment.payMethod === 'wechat' ? 'rechargeModal.payWechat' : pendingPayment.payMethod === 'alipay' ? 'rechargeModal.payAlipay' : 'rechargeModal.payOverseas')}</strong>
                            </div>
                            <div>
                                <span>支付金额</span>
                                <strong>
                                    {getPayMethodCurrencySymbol(pendingPayment.payMethod)}
                                    {formatPayAmount(pendingPayment.amount, pendingPayment.payMethod)}
                                </strong>
                            </div>
                            {pendingPayment.kind === 'membership' ? (
                                <>
                                    <div><span>会员卡</span><strong>{pendingPayment.membershipPlan?.name} · {pendingPayment.membershipPlan?.durationLabel}</strong></div>
                                    <div><span>领取方式</span><strong>每日登录签到领取</strong></div>
                                </>
                            ) : (
                                <div>
                                    <span>基础到账</span>
                                    <strong>{pendingPayment.diamondPlan?.baseDiamonds ?? pendingPayment.estimatedDiamonds ?? 0} KK币</strong>
                                </div>
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

    const qrContent = paymentStatus === 'success' && activeReceipt ? (
        <RechargeSuccessReceipt receipt={activeReceipt} onReturn={() => void returnToRechargePlans()} />
    ) : (
        <div
            className={styles.modalOverlay}
            onClick={handleClose}
        >
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    className={styles.closeBtn}
                    onClick={handleClose}
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
                    {paymentStatus === 'failed' && (
                        <div className={styles.errorText}>
                            {pollingError || t('rechargeModal.paymentPending')}
                        </div>
                    )}
                    <div className={styles.qrActions}>
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

    const miniProgramPaymentContent = (
        <div className={styles.modalOverlay} onClick={handleClose}>
            <section className={styles.modalContent} role="dialog" aria-modal="true"
                aria-label={t('rechargeModal.payWechat')} onClick={(event) => event.stopPropagation()}>
                <button type="button" className={styles.closeBtn} onClick={handleClose} aria-label={t('common.close')}>
                    <span className={styles.closeIcon} aria-hidden="true" />
                </button>
                <div className={styles.qrSection}>
                    <h2 className={styles.qrTitle}>{t('rechargeModal.payWechat')}</h2>
                    {paymentStatus === 'failed' ? (
                        <>
                            <p role="alert" className={styles.errorText}>{pollingError || t('rechargeModal.paymentFailed')}</p>
                            <button type="button" className={styles.qrActionBtn} onClick={handleRestart}>
                                {t('rechargeModal.restartRecharge')}
                            </button>
                        </>
                    ) : (
                        <p role="status" aria-live="polite" className={styles.qrHint}>
                            {t('rechargeModal.miniProgramPaymentWaiting')}
                        </p>
                    )}
                </div>
            </section>
        </div>
    );

    return createPortal(
        alipay.order && alipay.showCheckout && !isMiniProgramEnv()
            ? <AlipayCheckoutPanel checkout={alipay}
                onClose={alipay.status === 'paid' ? returnToRechargePlans : alipay.dismiss}
                onReturnToPlans={() => void returnToRechargePlans()} />
            : paymentStatus === 'success' && activeReceipt
                ? <RechargeSuccessReceipt receipt={activeReceipt} onReturn={() => void returnToRechargePlans()} />
                : isMiniProgramEnv() && orderId
                    ? miniProgramPaymentContent
                    : qrCodeUrl ? qrContent : formContent,
        document.body,
    );
};

export default RechargeModal;
