import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from './RechargeModal.module.css';
import payApi from '../../api/pay/payApi';

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

const RechargeModal: React.FC<RechargeModalProps> = ({ isOpen, onClose, onRecharge }) => {
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

        const amount = getCurrentAmount();
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

        setIsLoading(true);
        try {
            if (onRecharge) {
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
        } finally {
            setIsLoading(false);
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

            } catch (error) {
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
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscKey);
        return () => {
            document.removeEventListener('keydown', handleEscKey);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const currentAmount = getCurrentAmount();
    const currentPoints = currentAmount ? calculatePoints(currentAmount) : 0;

    const formContent = (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <button type="button" className={styles.closeBtn} onClick={onClose}>
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
                                maxLength={4}
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
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <button type="button" className={styles.closeBtn} onClick={onClose}>
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
                            <button type="button" className={styles.qrActionBtn} onClick={onClose}>
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