import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './AnnouncementModal.module.css';
import type { AnnouncementRecord } from '../api/announcement/announcement.type';
import { parseAnnouncementBody } from '../utils/announcementLinks';

interface AnnouncementModalProps {
    announcement: AnnouncementRecord | null;
    isOpen: boolean;
    onClose: () => void;
    badgeText?: string;
    onNavigateLink?: (path: string) => void;
}

const formatAnnouncementDate = (announcement: AnnouncementRecord): string | null => {
    const dateSource = announcement.publishedAt || announcement.updatedAt || announcement.createdAt;

    if (!dateSource) {
        return null;
    }

    const parsedDate = new Date(dateSource);

    if (Number.isNaN(parsedDate.getTime())) {
        return null;
    }

    return new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(parsedDate);
};

const AnnouncementModal: React.FC<AnnouncementModalProps> = ({
    announcement,
    isOpen,
    onClose,
    badgeText,
    onNavigateLink,
}) => {
    const { t } = useTranslation();
    const displayBadgeText = badgeText || t('common.announcement.defaultBadge');

    if (!isOpen || !announcement) {
        return null;
    }

    const displayDate = formatAnnouncementDate(announcement);
    const titleId = `announcement-modal-title-${announcement.id}`;

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
                aria-labelledby={titleId}
            >
                <button
                    type="button"
                    className={styles.closeButton}
                    onClick={onClose}
                    aria-label={t('common.announcement.close')}
                >
                    <span aria-hidden="true">×</span>
                </button>

                <div className={styles.header}>
                    <div className={styles.headerMeta}>
                        <div className={styles.badge}>{displayBadgeText}</div>
                        {displayDate ? <div className={styles.date}>{displayDate}</div> : null}
                    </div>
                    <h2 id={titleId} className={styles.title}>{announcement.title}</h2>
                </div>

                <div className={styles.content}>
                    {announcement.sections.map((section, index) => (
                        <section key={`${section.subtitle}-${index}`} className={styles.section}>
                            {section.subtitle ? (
                                <h3 className={styles.subtitle}>{section.subtitle}</h3>
                            ) : null}
                            <p className={styles.body}>
                                {parseAnnouncementBody(section.body).map((part, partIndex) => {
                                    if (part.type === 'text') {
                                        return <React.Fragment key={`${index}-text-${partIndex}`}>{part.text}</React.Fragment>;
                                    }

                                    return (
                                        <button
                                            key={`${index}-link-${partIndex}-${part.path}`}
                                            type="button"
                                            className={styles.bodyLink}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onNavigateLink?.(part.path);
                                            }}
                                        >
                                            {part.text}
                                        </button>
                                    );
                                })}
                            </p>
                        </section>
                    ))}
                </div>

                <div className={styles.footer}>
                    <button
                        type="button"
                        className={styles.confirmButton}
                        onClick={onClose}
                    >
                        {t('common.announcement.acknowledged')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AnnouncementModal;
