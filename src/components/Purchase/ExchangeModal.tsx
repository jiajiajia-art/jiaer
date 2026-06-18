import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { auth } from '../../api/account/authApi';
import { useAuthStore } from '../../store/useAuthStore';
import styles from './ExchangeModal.module.css';

const POINTS_PER_DIAMOND = 10;

interface ExchangeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

const ExchangeModal: React.FC<ExchangeModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { t } = useTranslation();
    const { user, updateUser } = useAuthStore();
    const [diamondsInput, setDiamondsInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const currentDiamonds = user?.user?.diamonds ?? 0;
    const diamondsToExchange = parseInt(diamondsInput, 10) || 0;
    const pointsToReceive = diamondsToExchange * POINTS_PER_DIAMOND;

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value === '') {
            setDiamondsInput('');
            return;
        }
        if (/^\d+$/.test(value)) {
            const num = parseInt(value, 10);
            if (num >= 0) {
                setDiamondsInput(value);
            }
        }
    }, []);

    const handleClose = useCallback(() => {
        if (!isSubmitting) {
            setDiamondsInput('');
            onClose();
        }
    }, [isSubmitting, onClose]);

    const handleSubmit = async () => {
        if (diamondsToExchange <= 0) {
            toast.error(t('exchangeModal.enterValidAmount'));
            return;
        }
        if (diamondsToExchange > currentDiamonds) {
            toast.error(t('exchangeModal.insufficientDiamonds'));
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await auth.exchangeDiamonds({ diamonds: diamondsToExchange });
            if (response.data.success) {
                toast.success(
                    t('exchangeModal.exchangeSuccess', {
                        diamonds: diamondsToExchange,
                        points: pointsToReceive,
                    })
                );
                const userRes = await auth.getUserInfo();
                if (userRes.data.success && userRes.data.data) {
                    updateUser(userRes.data.data);
                }
                setDiamondsInput('');
                onSuccess?.();
                onClose();
            } else {
                toast.error(response.data.message || t('exchangeModal.exchangeFailed'));
            }
        } catch (error: unknown) {
            const message =
                error && typeof error === 'object' && 'response' in error
                    ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
                    : t('exchangeModal.exchangeFailed');
            toast.error(message || t('exchangeModal.exchangeFailed'));
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
                <div className={styles.header}>
                    <h2 className={styles.title}>{t('exchangeModal.title')}</h2>
                    <button
                        type="button"
                        className={styles.closeBtn}
                        onClick={handleClose}
                        disabled={isSubmitting}
                        aria-label="close"
                    >
                        ×
                    </button>
                </div>

                <div className={styles.rateHint}>
                    <span className={styles.rateValue}>
                        {t('exchangeModal.rate', { diamonds: 1, points: POINTS_PER_DIAMOND })}
                    </span>
                </div>

                <div className={styles.balanceRow}>
                    <span className={styles.balanceLabel}>{t('exchangeModal.currentBalance')}</span>
                    <span className={styles.balanceValue}>
                        <svg className={styles.balanceIconDiamond} viewBox="0 0 1024 1024" width="18" height="18" aria-hidden="true">
                            <path d="M296.42524445 392.80526222H50.38421333L216.76942222 148.46179555h246.03875556zM798.02823111 149.81233778H551.98833778l166.38520889 244.34232889h246.03989333zM403.65169778 392.80526222L511.19786667 226.41777778l106.40611555 166.38748444zM617.75075555 487.09859555L511.34350222 1000.40248889 407.21066667 487.09859555zM300.18901333 487.09859555l211.90883556 531.02364445-454.30670222-531.02364445zM719.77642667 487.09859555l-207.35658667 531.02364445 449.75559111-531.02364445z" fill="#FB4655"/>
                        </svg>
                        {currentDiamonds}
                    </span>
                </div>

                <div className={styles.formSection}>
                    <div className={styles.inputRow}>
                        <span className={styles.inputPrefix} aria-hidden="true">
                            <svg viewBox="0 0 1024 1024" width="18" height="18">
                                <path d="M296.42524445 392.80526222H50.38421333L216.76942222 148.46179555h246.03875556zM798.02823111 149.81233778H551.98833778l166.38520889 244.34232889h246.03989333zM403.65169778 392.80526222L511.19786667 226.41777778l106.40611555 166.38748444zM617.75075555 487.09859555L511.34350222 1000.40248889 407.21066667 487.09859555zM300.18901333 487.09859555l211.90883556 531.02364445-454.30670222-531.02364445zM719.77642667 487.09859555l-207.35658667 531.02364445 449.75559111-531.02364445z" fill="#FB4655"/>
                            </svg>
                        </span>
                        <input
                            type="text"
                            inputMode="numeric"
                            className={styles.input}
                            placeholder={t('exchangeModal.inputPlaceholder')}
                            value={diamondsInput}
                            onChange={handleInputChange}
                            maxLength={10}
                            disabled={isSubmitting}
                            aria-label={t('exchangeModal.exchangeAmount')}
                        />
                        <span className={styles.inputSuffix}>{t('exchangeModal.diamondUnit')}</span>
                    </div>
                </div>

                {diamondsToExchange > 0 && (
                    <div className={styles.previewCard}>
                        <span className={styles.previewLabel}>将获得</span>
                        <span className={styles.previewValue}>
                            <span className={styles.previewBadge}>
                                +{pointsToReceive} {t('exchangeModal.points')}
                            </span>
                        </span>
                    </div>
                )}

                {diamondsToExchange > currentDiamonds && diamondsToExchange > 0 && (
                    <div className={styles.errorHint} role="alert">
                        {t('exchangeModal.insufficientDiamonds')}
                    </div>
                )}

                <button
                    type="button"
                    className={styles.submitBtn}
                    onClick={handleSubmit}
                    disabled={
                        isSubmitting ||
                        diamondsToExchange <= 0 ||
                        diamondsToExchange > currentDiamonds
                    }
                >
                    {isSubmitting
                        ? t('exchangeModal.submitting')
                        : diamondsToExchange > 0
                            ? t('exchangeModal.confirmExchange', {
                                diamonds: diamondsToExchange,
                                points: pointsToReceive,
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
