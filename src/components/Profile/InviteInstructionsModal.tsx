import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { formatKk } from '../../utils/kkMoney';
import styles from './InviteInstructionsModal.module.css';

interface InviteInstructionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    inviteRewardKk: number;
}

const InviteInstructionsModal: React.FC<InviteInstructionsModalProps> = ({ isOpen, onClose, inviteRewardKk }) => {
    const { t } = useTranslation();

    useEffect(() => {
        if (!isOpen) return undefined;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const content = (
        <div className={styles.overlay} onClick={onClose}>
            <section
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="invite-instructions-title"
                onClick={(event) => event.stopPropagation()}
            >
                <h2 id="invite-instructions-title">{t('profile.inviteInstructionsTitle')}</h2>
                <p>{t('profile.inviteInstructionsBody')}</p>
                <strong>{t('profile.inviteInstructionsReward', { amount: formatKk(inviteRewardKk) })}</strong>
                <button type="button" onClick={onClose} autoFocus>
                    {t('profile.iKnow')}
                </button>
            </section>
        </div>
    );

    return typeof document === 'undefined' ? content : createPortal(content, document.body);
};

export default InviteInstructionsModal;
