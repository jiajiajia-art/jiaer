import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import styles from './CreateEmptyGameModal.module.css';

interface GenerateFromIdeaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (idea: string) => Promise<boolean | void>;
}

const GenerateFromIdeaModal: React.FC<GenerateFromIdeaModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
}) => {
    const { t } = useTranslation();
    const [idea, setIdea] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!idea.trim()) {
            setError(t('createGame.enterGameIdea'));
            return;
        }

        if (idea.trim().length < 10) {
            setError(t('createGame.ideaAtLeast10Chars'));
            return;
        }

        try {
            setIsSubmitting(true);
            const result = await onSubmit(idea.trim());
            if (result !== false) {
                setIdea('');
                onClose();
            }
        } catch (err: unknown) {
            setError((err as { message?: string })?.message || t('createGame.generateFailedRetry'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setIdea('');
        setError('');
        onClose();
    };

    const modalContent = (
        <div className={styles.modalOverlay} onClick={handleClose}>
            <div className={styles.modalWrapper} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modal}>
                    <div className={styles.modalHeader}>
                        <h2 className={styles.title}>{t('createGame.generateFromIdeaTitle')}</h2>
                        <button 
                            className={styles.closeButton} 
                            onClick={handleClose}
                            disabled={isSubmitting}
                        >
                            ×
                        </button>
                    </div>
                    
                    <form className={styles.modalBody} onSubmit={handleSubmit}>
                        <div className={styles.formGroup}>
                            <label htmlFor="gameIdea" className={styles.label}>
                                {t('createGame.gameIdea')}
                            </label>
                            <textarea
                                id="gameIdea"
                                className={styles.textarea}
                                value={idea}
                                onChange={(e) => {
                                    setIdea(e.target.value);
                                    setError('');
                                }}
                                placeholder={t('createGame.gameIdeaPlaceholder')}
                                autoFocus
                                rows={6}
                                disabled={isSubmitting}
                            />
                            {error && <p className={styles.errorText}>{error}</p>}
                            <p className={styles.hintText}>
                                {t('createGame.gameIdeaHint')}
                            </p>
                        </div>
                        
                        <div className={styles.buttonGroup}>
                            <button
                                type="button"
                                className={styles.cancelButton}
                                onClick={handleClose}
                                disabled={isSubmitting}
                            >
                                {t('createGame.cancel')}
                            </button>
                            <button
                                type="submit"
                                className={styles.submitButton}
                                disabled={isSubmitting || !idea.trim() || idea.trim().length < 10}
                            >
                                {isSubmitting ? t('createGame.generating') : t('createGame.startGenerate')}
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

export default GenerateFromIdeaModal;

