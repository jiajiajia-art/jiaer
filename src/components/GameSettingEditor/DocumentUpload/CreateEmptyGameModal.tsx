import React, { useState } from 'react';
import { createPortal } from 'react-dom';
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
    const [title, setTitle] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!title.trim()) {
            setError('请输入游戏名称');
            return;
        }

        try {
            await onSubmit(title.trim());
            setTitle('');
            onClose();
        } catch (err: any) {
            setError(err?.message || '创建失败，请重试');
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
                        <h2 className={styles.title}>创建空游戏</h2>
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
                                游戏名称
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
                                placeholder="请输入游戏名称"
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
                                取消
                            </button>
                            <button
                                type="submit"
                                className={styles.submitButton}
                            >
                                创建
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

