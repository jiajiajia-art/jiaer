import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import styles from './CreateEmptyGameModal.module.css';

interface CreateEmptyGameModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (title: string) => Promise<void>;
}

const CreateEmptyGameModal: React.FC<CreateEmptyGameModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
}) => {
    const { t } = useTranslation();
    const [title, setTitle] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!title.trim()) {
            setError(t('validation.enterGameName'));
            return;
        }

        try {
            await onSubmit(title.trim());
            setTitle('');
            onClose();
        } catch (err: any) {
            setError(err?.message || t('createGame.createFailedRetry'));
        }
    };

    const handleClose = () => {
        setTitle('');
        setError('');
        onClose();
    };

    const modalContent = (
        <div className={styles.modalOverlay} onClick={handleClose}>
            <div className={styles.modalWrapper} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modal}>
                    <div className={styles.modalHeader}>
                        <h2 className={styles.title}>{t('createGame.createEmptyGame')}</h2>
                        <button 
                            className={styles.closeButton} 
                            onClick={handleClose}
                        >
                            ×
                        </button>
                    </div>
                    
                    <form className={styles.modalBody} onSubmit={handleSubmit}>
                        <div className={styles.formGroup}>
                            <label htmlFor="gameTitle" className={styles.label}>
                                {t('profile.gameName')}
                            </label>
                            <input
                                id="gameTitle"
                                type="text"
                                className={styles.input}
                                value={title}
                                onChange={(e) => {
                                    setTitle(e.target.value);
                                    setError('');
                                }}
                                placeholder={t('validation.enterGameName')}
                                autoFocus
                            />
                            {error && <p className={styles.errorText}>{error}</p>}
                        </div>
                        <div className={styles.buttonGroup}>
                            <button
                                type="button"
                                className={styles.cancelButton}
                                onClick={handleClose}
                            >
                                {t('createGame.cancel')}
                            </button>
                            <button
                                type="submit"
                                className={styles.submitButton}
                            >
                                {t('createGame.create')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') {
        return modalContent;
    }
    return createPortal(modalContent, document.body);
};

export default CreateEmptyGameModal;
