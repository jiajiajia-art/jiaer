import React, { useState } from 'react';
import { createPortal } from 'react-dom';
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
    const [idea, setIdea] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!idea.trim()) {
            setError('请输入游戏创意描述');
            return;
        }

        if (idea.trim().length < 10) {
            setError('描述至少需要10个字符');
            return;
        }

        try {
            setIsSubmitting(true);
            const result = await onSubmit(idea.trim());
            if (result !== false) {
                setIdea('');
                onClose();
            }
        } catch (err: any) {
            setError(err?.message || '生成失败，请重试');
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
                        <h2 className={styles.title}>一句话生成游戏</h2>
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
                                游戏创意描述
                            </label>
                            <textarea
                                id="gameIdea"
                                className={styles.textarea}
                                value={idea}
                                onChange={(e) => {
                                    setIdea(e.target.value);
                                    setError('');
                                }}
                                placeholder="例如：一个关于魔法学院的冒险游戏，玩家扮演学生探索神秘的地下城..."
                                autoFocus
                                rows={6}
                                disabled={isSubmitting}
                            />
                            {error && <p className={styles.errorText}>{error}</p>}
                            <p className={styles.hintText}>
                                请详细描述你的游戏创意，包括世界观、角色、剧情等，至少10个字符
                            </p>
                        </div>
                        
                        <div className={styles.buttonGroup}>
                            <button
                                type="button"
                                className={styles.cancelButton}
                                onClick={handleClose}
                                disabled={isSubmitting}
                            >
                                取消
                            </button>
                            <button
                                type="submit"
                                className={styles.submitButton}
                                disabled={isSubmitting || !idea.trim() || idea.trim().length < 10}
                            >
                                {isSubmitting ? '生成中...' : '开始生成'}
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

