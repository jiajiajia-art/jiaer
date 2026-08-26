import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import styles from './CreateEmptyGameModal.module.css';
import { TXT_IDEA_GENERATE_COST, TXT_IDEA_TEXT_COST } from '../../../utils/constants';
import EditorApi from '../../../api/galgame/EditorData';
import { useAuthStore } from '../../../store/useAuthStore';
import { refreshAuthUserPoints } from '../../../lib/auth/refreshUserPoints';

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
    const updateUser = useAuthStore((s) => s.updateUser);
    const [idea, setIdea] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAiBusy, setIsAiBusy] = useState(false);

    if (!isOpen) return null;

    /**
     * 功能注释：标签旁 AI 生成创意描述；成功扣 1 积分并回填输入框。
     */
    const handleAiGenerateIdeaText = async () => {
        setError('');
        try {
            setIsAiBusy(true);
            const latestPoints = await refreshAuthUserPoints();
            const current = typeof latestPoints === 'number'
                ? latestPoints
                : (useAuthStore.getState().user?.user?.points ?? 0);
            if (current < TXT_IDEA_TEXT_COST) {
                toast.error(t('createGame.insufficientPointsForDoc', {
                    required: TXT_IDEA_TEXT_COST,
                    current,
                }));
                return;
            }

            const res = await EditorApi.generateIdeaText(idea.trim());
            const payload = res.data;
            if (!payload?.success || !payload.data?.text) {
                toast.error(payload?.message || payload?.error || t('createGame.generateFailedRetry'));
                return;
            }

            setIdea(payload.data.text);
            if (typeof payload.data.remainingPoints === 'number') {
                updateUser({ points: payload.data.remainingPoints });
            } else {
                await refreshAuthUserPoints();
            }
            toast.success(
                t('createGame.ideaTextSuccessDeducted', {
                    points: payload.data.pointsDeducted ?? TXT_IDEA_TEXT_COST,
                }),
            );
        } catch (err: unknown) {
            const anyErr = err as {
                response?: { data?: { message?: string; error?: string } };
                message?: string;
            };
            toast.error(
                anyErr?.response?.data?.message
                || anyErr?.response?.data?.error
                || anyErr?.message
                || t('createGame.generateFailedRetry'),
            );
        } finally {
            setIsAiBusy(false);
        }
    };

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

    const busy = isSubmitting || isAiBusy;

    const modalContent = (
        <div className={styles.modalOverlay} onClick={handleClose}>
            <div className={styles.modalWrapper} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modal}>
                    <div className={styles.modalHeader}>
                        <h2 className={styles.title}>{t('createGame.generateFromIdeaTitle')}</h2>
                        <button 
                            className={styles.closeButton} 
                            onClick={handleClose}
                            disabled={busy}
                        >
                            ×
                        </button>
                    </div>
                    
                    <form className={styles.modalBody} onSubmit={handleSubmit}>
                        <div className={styles.formGroup}>
                            <div className={styles.labelWithAi}>
                                <label htmlFor="gameIdea" className={styles.label}>
                                    {t('createGame.gameIdea')}
                                </label>
                                <button
                                    type="button"
                                    className={styles.fieldAiBtn}
                                    onClick={handleAiGenerateIdeaText}
                                    disabled={busy}
                                >
                                    {isAiBusy
                                        ? t('createGame.generating')
                                        : t('createGame.aiGenerateIdeaTextWithCost', {
                                            points: TXT_IDEA_TEXT_COST,
                                        })}
                                </button>
                            </div>
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
                                disabled={busy}
                            />
                            {error && <p className={styles.errorText}>{error}</p>}
                            <p className={styles.hintText}>
                                {t('createGame.gameIdeaHint')}
                            </p>
                            <p className={styles.hintText}>
                                {t('createGame.ideaGenerateCostHint', { points: TXT_IDEA_GENERATE_COST })}
                            </p>
                        </div>
                        
                        <div className={styles.buttonGroup}>
                            <button
                                type="button"
                                className={styles.cancelButton}
                                onClick={handleClose}
                                disabled={busy}
                            >
                                {t('createGame.cancel')}
                            </button>
                            <button
                                type="submit"
                                className={styles.submitButton}
                                disabled={busy || !idea.trim() || idea.trim().length < 10}
                            >
                                {isSubmitting
                                    ? t('createGame.generating')
                                    : t('createGame.startGenerateWithCost', { points: TXT_IDEA_GENERATE_COST })}
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
