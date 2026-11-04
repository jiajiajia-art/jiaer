import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { auth } from '../../api/account/authApi';
import { useAuthStore } from '../../store/useAuthStore';
import { getApiErrorMessage } from '../../utils/error';
import CurrencyIcon from '../CurrencyIcon';
import styles from './ExchangeModal.module.css';

const getExchangeValidationErrorKey = (
    points: number,
    diamondsCost: number,
    currentDiamonds: number
): string | null => {
    if (points <= 0) return null;
    if (points < 10) return 'exchangeModal.minAmount';
    if (points % 10 !== 0) return 'exchangeModal.multipleOfTen';
    if (diamondsCost > currentDiamonds) return 'exchangeModal.insufficientDiamonds';
    return null;
};

interface ExchangeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

const ExchangeModal: React.FC<ExchangeModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { t } = useTranslation();
    const { user, updateUser } = useAuthStore();
    const [pointsInput, setPointsInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const currentDiamonds = user?.user?.kkBalance?.permanent ?? user?.user?.diamonds ?? 0;
    const currentPoints = user?.user?.points ?? 0;
    const pointsToExchange = Number.parseInt(pointsInput, 10) || 0;
    const estimatedDiamondsCost = pointsToExchange;

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value === '') {
            setPointsInput('');
            return;
        }
        if (/^\d+$/.test(value)) {
            setPointsInput(value);
        }
    }, []);

    const handleBlur = useCallback(() => {
        const num = parseInt(pointsInput, 10);
        if (!Number.isFinite(num) || num <= 0) return;
        const rounded = Math.floor(num / 10) * 10;
        setPointsInput(rounded > 0 ? String(rounded) : '');
    }, [pointsInput]);

    const validationErrorKey = getExchangeValidationErrorKey(
        pointsToExchange,
        estimatedDiamondsCost,
        currentDiamonds
    );
    const validationError = validationErrorKey ? t(validationErrorKey) : null;

    const handleClose = useCallback(() => {
        if (!isSubmitting) {
            setPointsInput('');
            onClose();
        }
    }, [isSubmitting, onClose]);

    const handleSubmit = async () => {
        if (pointsToExchange <= 0) {
            toast.error(t('exchangeModal.enterValidAmount'));
            return;
        }
        if (validationErrorKey) {
            toast.error(t(validationErrorKey));
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await auth.exchangeDiamonds({ points: pointsToExchange });
            if (response.data.success && response.data.data) {
                const data = response.data.data;
                toast.success(
                    t('exchangeModal.exchangeSuccess', {
                        diamonds: data.diamondsSpent,
                        points: data.pointsEarned,
                    })
                );
                const userRes = await auth.getUserInfo();
                if (userRes.data.success && userRes.data.data) {
                    updateUser(userRes.data.data);
                }
                setPointsInput('');
                onSuccess?.();
                onClose();
            } else {
                toast.error(response.data.message || t('exchangeModal.exchangeFailed'));
            }
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, t('exchangeModal.exchangeFailed')));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            handleClose();
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className={styles.modalOverlay} onClick={handleOverlayClick}>
            <div className={styles.modalContent} role="dialog" aria-modal="true" aria-label={t('exchangeModal.title')}>
                <button
                    type="button"
                    className={styles.closeBtn}
                    onClick={handleClose}
                    disabled={isSubmitting}
                    aria-label={t('common.close')}
                >
                    <span className={styles.closeIcon} aria-hidden="true" />
                </button>

                <h2 className={styles.title}>{t('exchangeModal.title')}</h2>

                <div className={styles.balanceRow}>
                    <span className={styles.balanceLabel}>{t('exchangeModal.currentBalance')}</span>
                    <span className={styles.balanceValue}>
                        <CurrencyIcon currency="diamonds" className={styles.balanceIconDiamond} aria-hidden="true" />
                        {currentDiamonds}
                    </span>
                    <span className={styles.balanceDivider}>|</span>
                    <span className={styles.balanceValue}>
                        <CurrencyIcon currency="points" className={styles.balanceIconPoints} aria-hidden="true" />
                        {currentPoints}
                    </span>
                </div>

                <div className={styles.formSection}>
                    <div className={styles.inputRow}>
                        <span className={styles.inputPrefix} aria-hidden="true">
                            <CurrencyIcon currency="points" style={{ width: 18, height: 18 }} />
                        </span>
                        <input
                            type="text"
                            inputMode="numeric"
                            className={styles.input}
                            placeholder={t('exchangeModal.inputPlaceholder')}
                            value={pointsInput}
                            onChange={handleInputChange}
                            onBlur={handleBlur}
                            maxLength={10}
                            disabled={isSubmitting}
                            aria-label={t('exchangeModal.exchangeAmount')}
                        />
                        <span className={styles.inputSuffix}>{t('exchangeModal.pointsUnit')}</span>
                    </div>
                </div>

                {validationError && (
                    <p className={styles.errorHint}>{validationError}</p>
                )}

                {pointsToExchange > 0 && (
                    <div className={styles.previewCard}>
                        <div className={styles.previewRow}>
                            <span className={styles.previewLabel}>{t('exchangeModal.willSpend')}</span>
                            <span className={styles.previewValue}>
                                <span className={styles.previewDiamond}>
                                    -{estimatedDiamondsCost} {t('exchangeModal.diamonds')}
                                </span>
                            </span>
                        </div>
                        <div className={styles.previewRow}>
                            <span className={styles.previewLabel}>{t('exchangeModal.willGain')}</span>
                            <span className={styles.previewValue}>
                                <span className={styles.previewBadge}>
                                    +{pointsToExchange} {t('exchangeModal.points')}
                                </span>
                            </span>
                        </div>
                    </div>
                )}

                <button
                    type="button"
                    className={styles.submitBtn}
                    onClick={handleSubmit}
                    disabled={isSubmitting || pointsToExchange <= 0 || Boolean(validationError)}
                >
                    {isSubmitting
                        ? t('exchangeModal.submitting')
                        : pointsToExchange > 0
                            ? t('exchangeModal.confirmExchange', {
                                diamonds: estimatedDiamondsCost,
                                points: pointsToExchange,
                            })
                            : t('exchangeModal.selectAmount')}
                </button>

                <p className={styles.notice}>{t('exchangeModal.notice')}</p>
            </div>
        </div>,
        document.body
    );
};

export default ExchangeModal;
