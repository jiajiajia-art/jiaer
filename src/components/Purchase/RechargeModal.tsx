import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './RechargeModal.module.css';
import payApi from '../../api/pay/payApi';
import toast from 'react-hot-toast';

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
    onRecharge: (amount: number) => Promise<{ qrDataUrl: string; outTradeNo: string } | null>;
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

// type MiniPayParams = {
//     timeStamp: string;
//     nonceStr: string;
//     package: string;
//     signType: string;
//     paySign: string;
// };

// const invokeWeixinPay = (payParams: MiniPayParams): Promise<'ok' | 'cancel' | 'fail'> => {
//     const win = window as any;

//     const doInvoke = () =>
//         new Promise<'ok' | 'cancel' | 'fail'>((resolve) => {
//             const bridge = win.WeixinJSBridge;
//             if (!bridge?.invoke) {
//                 resolve('fail');
//                 return;
//             }

//             bridge.invoke('getBrandWCPayRequest', payParams, (res: any) => {
//                 const msg = String(res?.err_msg || '');
//                 if (msg.includes(':ok')) resolve('ok');
//                 else if (msg.includes(':cancel')) resolve('cancel');
//                 else resolve('fail');
//             });
//         });

//     if (win.WeixinJSBridge?.invoke) {
//         return doInvoke();
//     }

//     return new Promise<'ok' | 'cancel' | 'fail'>((resolve) => {
//         const onReady = async () => {
//             document.removeEventListener('WeixinJSBridgeReady', onReady);
//             resolve(await doInvoke());
//         };
//         document.addEventListener('WeixinJSBridgeReady', onReady, false);

//         // 兜底：如果一直等不到 Ready，就认为失败，避免“没反应”
//         window.setTimeout(() => {
//             document.removeEventListener('WeixinJSBridgeReady', onReady);
//             resolve('fail');
//         }, 3000);
//     });
// };

const RechargeModal: React.FC<RechargeModalProps> = ({ isOpen, onClose, onRecharge }) => {
    const closeAndReload = useCallback(() => {
        onClose();
        window.location.reload();
    }, [onClose]);

    // 用 ref 做“同步锁”和“实时输入值”，避免 React state 异步批处理导致的偶发旧值提交
    const inFlightRef = useRef(false);
    const isComposingRef = useRef(false);
    const amountInputRef = useRef<HTMLInputElement | null>(null);

    const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
    const [customAmount, setCustomAmount] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [inputError, setInputError] = useState<string>('');
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [orderId, setOrderId] = useState<string | null>(null);
    const [paymentStatus, setPaymentStatus] = useState<'idle' | 'polling' | 'success' | 'failed'>('idle');
    const [pollingError, setPollingError] = useState<string>('');
    const [timeLeft, setTimeLeft] = useState(COUNTDOWN_SECONDS);

    useEffect(() => {
        if (!isOpen) {
            setSelectedAmount(null);
            setCustomAmount('');
            setIsLoading(false);
            setInputError('');
            setQrCodeUrl(null);
            setOrderId(null);
            setPaymentStatus('idle');
            setPollingError('');
            setTimeLeft(COUNTDOWN_SECONDS);
        }
    }, [isOpen]);

    const handleFixedAmountClick = (amount: number) => {
        setSelectedAmount(amount);
        setCustomAmount('');
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

        setCustomAmount(value);
        setSelectedAmount(null);
    };

    const getCurrentAmount = (): number | null => {
        if (selectedAmount !== null) {
            return selectedAmount;
        }
        if (customAmount) {
            const amount = parseFloat(customAmount);
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

        if (isComposingRef.current) {
            toast.error('请输入完成后再提交');
            return;
        }

        let amount: number | null = null;
        if (selectedAmount !== null) {
            amount = selectedAmount;
        } else {
            const raw = (amountInputRef.current?.value ?? customAmount ?? '').trim();
            const parsed = parseFloat(raw || '0');
            amount = !isNaN(parsed) ? parsed : null;
        }

        if (!amount) {
            if (customAmount) {
                setInputError(`充值金额不能低于 ${MIN_AMOUNT} 元`);
            }
            return;
        }

        if (amount < MIN_AMOUNT) {
            setInputError(`充值金额不能低于 ${MIN_AMOUNT} 元`);
            return;
        }

        inFlightRef.current = true;
        setIsLoading(true);
        try {
            if (isMiniProgramEnv()) {
                setPaymentStatus('polling');
                setPollingError('');
                const response = await payApi.createMiniOrder({ amount });
                const data = response.data;
                if (data.code === 200 && data.data) {
                    const { outTradeNo, payParams } = data.data;
                    setOrderId(outTradeNo);
                    // 只负责发消息，不拉起支付
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
                const result = await onRecharge(amount);
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

    const formContent = (
        <div className={styles.modalOverlay} onClick={closeAndReload}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <button type="button" className={styles.closeBtn} onClick={closeAndReload}>
                    ×
                </button>

                <h2 className={styles.title}>账户充值</h2>

                <form className={styles.form} onSubmit={handleSubmit}>
                    <div className={styles.fixedAmounts}>
                        <div className={styles.amountsLabel}>选择充值金额</div>
                        <div className={styles.amountsGrid}>
                            {FIXED_AMOUNTS.map((amount) => (
                                <button
                                    key={amount}
                                    type="button"
                                    className={`${styles.amountBtn} ${selectedAmount === amount ? styles.amountBtnActive : ''}`}
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
                                value={customAmount}
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

                    <button
                        type="submit"
                        className={styles.submitBtn}
                        disabled={!currentAmount || currentAmount < MIN_AMOUNT || isLoading}
                    >
                        {isLoading ? '处理中...' : `确认充值 ￥${currentAmount ? currentAmount.toFixed(2) : '0.00'}`}
                    </button>
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