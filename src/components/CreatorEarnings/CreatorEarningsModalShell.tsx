import React, { useEffect } from 'react';
import { IoClose } from 'react-icons/io5';
import styles from './CreatorEarnings.module.css';

interface Props {
    open: boolean;
    title: string;
    onClose: () => void;
    children: React.ReactNode;
    actions?: React.ReactNode;
    wide?: boolean;
    closeDisabled?: boolean;
}

const CreatorEarningsModalShell: React.FC<Props> = ({
    open, title, onClose, children, actions, wide, closeDisabled = false,
}) => {
    useEffect(() => {
        if (!open) return undefined;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !closeDisabled) onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [closeDisabled, onClose, open]);

    if (!open) return null;
    return (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={closeDisabled ? undefined : onClose}>
            <section
                className={`${styles.modalCard} ${wide ? styles.modalWide : ''}`}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header className={styles.modalHeader}>
                    <h2>{title}</h2>
                    <button type="button" onClick={onClose} aria-label="关闭" disabled={closeDisabled}>
                        <IoClose aria-hidden="true" />
                    </button>
                </header>
                <div className={styles.modalBody}>{children}</div>
                {actions && <footer className={styles.modalActions}>{actions}</footer>}
            </section>
        </div>
    );
};

export default CreatorEarningsModalShell;
