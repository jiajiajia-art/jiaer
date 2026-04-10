import React from 'react';
import { createPortal } from 'react-dom';
import type { SubscriptionPlanId } from '../api/subscriptionKeys/subscriptionKeysApi.type';
import styles from './MembershipRedeemResultModal.module.css';

interface MembershipRedeemResultModalProps {
    isOpen: boolean;
    onClose: () => void;
    planId: SubscriptionPlanId;
}

const planLabelMap: Record<SubscriptionPlanId, string> = {
    month: '月卡',
    season: '季卡',
    year: '年卡',
};

const MembershipRedeemResultModal: React.FC<MembershipRedeemResultModalProps> = ({
    isOpen,
    onClose,
    planId,
}) => {
    if (!isOpen) return null;

    const handleConfirm = () => {
        onClose();
    };

    return createPortal(
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.content} onClick={(event) => event.stopPropagation()}>
                <button type="button" className={styles.closeButton} onClick={onClose}>
                    ×
                </button>

                <div className={styles.iconWrapper}>
                    <svg className={styles.checkIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                </div>

                <h3 className={styles.title}>
                    <span className={styles.planName}>{planLabelMap[planId]}</span>兑换成功
                </h3>
                <p className={styles.desc}>请尽情享受会员权益</p>

                <button
                    type="button"
                    className={styles.confirmButton}
                    onClick={handleConfirm}
                >
                    确定
                </button>
            </div>
        </div>,
        document.body,
    );
};

export default MembershipRedeemResultModal;
