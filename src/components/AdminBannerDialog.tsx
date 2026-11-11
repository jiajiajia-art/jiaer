import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './AdminBannerDialog.module.css';

interface AdminBannerDialogProps {
    isOpen: boolean;
    eyebrow: string;
    title: string;
    message: string;
    cancelButtonText?: string;
    confirmButtonText: string;
    onCancel: () => void;
    onConfirm: () => void;
}

const AdminBannerDialog: React.FC<AdminBannerDialogProps> = ({
    isOpen,
    eyebrow,
    title,
    message,
    cancelButtonText,
    confirmButtonText,
    onCancel,
    onConfirm,
}) => {
    const titleId = useId();
    const descriptionId = useId();
    const cancelButtonRef = useRef<HTMLButtonElement>(null);
    const confirmButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!isOpen) return undefined;

        const previouslyFocused = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const previousOverflow = document.body.style.overflow;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onCancel();
            }
        };

        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', onKeyDown);
        window.requestAnimationFrame(() => {
            (cancelButtonRef.current || confirmButtonRef.current)?.focus();
        });

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', onKeyDown);
            previouslyFocused?.focus();
        };
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    return createPortal(
        <div
            className={styles.overlay}
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onCancel();
            }}
        >
            <section
                className={styles.dialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
            >
                <div className={styles.accentLine} aria-hidden="true" />
                <header className={styles.header}>
                    <div>
                        <div className={styles.eyebrow}>{eyebrow}</div>
                        <h2 id={titleId} className={styles.title}>{title}</h2>
                    </div>
                    <button
                        type="button"
                        className={styles.closeButton}
                        onClick={onCancel}
                        aria-label="关闭弹窗"
                    >
                        <span className={styles.closeIcon} aria-hidden="true" />
                    </button>
                </header>

                <p id={descriptionId} className={styles.message}>{message}</p>

                <footer className={styles.actions}>
                    {cancelButtonText ? (
                        <button
                            ref={cancelButtonRef}
                            type="button"
                            className={`${styles.actionButton} ${styles.cancelButton}`}
                            onClick={onCancel}
                        >
                            {cancelButtonText}
                        </button>
                    ) : null}
                    <button
                        ref={confirmButtonRef}
                        type="button"
                        className={`${styles.actionButton} ${styles.confirmButton}`}
                        onClick={onConfirm}
                    >
                        {confirmButtonText}
                    </button>
                </footer>
            </section>
        </div>,
        document.body,
    );
};

export default AdminBannerDialog;
