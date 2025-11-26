import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './RechargeModal.module.css';

interface RechargeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRecharge?: (amount: number) => void;
}

const FIXED_AMOUNTS = [5, 10, 15];
const POINTS_PER_YUAN = 10;
const MIN_AMOUNT = 0.1;

const RechargeModal: React.FC<RechargeModalProps> = ({ isOpen, onClose, onRecharge }) => {
    const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
    const [customAmount, setCustomAmount] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [inputError, setInputError] = useState<string>('');

    useEffect(() => {
        if (!isOpen) {
            setSelectedAmount(null);
            setCustomAmount('');
            setIsLoading(false);
            setInputError('');
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
                await onRecharge(amount);
            }
            onClose();
        } catch (error) {
            console.error('充值失败:', error);
        } finally {
            setIsLoading(false);
        }
    };

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

    const modalContent = (
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
                                <span className={styles.summaryValue}>{currentPoints} 积分</span>
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

    return createPortal(modalContent, document.body);
};

export default RechargeModal;