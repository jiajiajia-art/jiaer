import React from 'react';
import styles from './AnnouncementModal.module.css';
import type { AnnouncementRecord } from '../api/announcement/announcement.type';

interface AnnouncementModalProps {
    announcement: AnnouncementRecord | null;
    isOpen: boolean;
    onClose: () => void;
    badgeText?: string;
}

const AnnouncementModal: React.FC<AnnouncementModalProps> = ({
    announcement,
    isOpen,
    onClose,
    badgeText = '首页公告',
}) => {
    if (!isOpen || !announcement) {
        return null;
    }

    return (
        <div
            className={styles.overlay}
            onClick={onClose}
            role="presentation"
        >
            <div
                className={styles.modal}
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={badgeText}
            >
                <button
                    type="button"
                    className={styles.closeButton}
                    onClick={onClose}
                >
                    关闭
                </button>

                <div className={styles.header}>
                    <div className={styles.badge}>{badgeText}</div>
                    <h2 className={styles.title}>{announcement.title}</h2>
                </div>

                <div className={styles.content}>
                    {announcement.sections.map((section, index) => (
                        <section key={`${section.subtitle}-${index}`} className={styles.section}>
                            {section.subtitle ? (
                                <h3 className={styles.subtitle}>{section.subtitle}</h3>
                            ) : null}
                            <p className={styles.body}>{section.body}</p>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AnnouncementModal;
