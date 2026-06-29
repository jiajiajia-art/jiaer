import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './AnnouncementModal.module.css';
import type { MessageFavoriteGameUpdateNotification } from '../api/message/message.type';

interface FavoriteGameUpdateModalProps {
    notification: MessageFavoriteGameUpdateNotification | null;
    isOpen: boolean;
    onClose: () => void;
    badgeText?: string;
}

const formatNotificationDate = (value?: string | null): string | null => {
    if (!value) return null;

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) return null;

    return new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(parsedDate);
};

const FavoriteGameUpdateModal: React.FC<FavoriteGameUpdateModalProps> = ({
    notification,
    isOpen,
    onClose,
    badgeText,
}) => {
    const { t } = useTranslation();
    const displayBadgeText = badgeText || t('messages.favoriteGameUpdate');

    if (!isOpen || !notification) {
        return null;
    }

    const gameTitle = notification.gameTitle?.trim() || notification.fileId;
    const versionNotes = notification.versionNotes?.trim() || '';
    const displayDate = formatNotificationDate(notification.createdAt);
    const titleId = `favorite-game-update-modal-title-${notification.sourceId}`;

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
                    aria-label={t('common.close')}
                >
                    <span aria-hidden="true">×</span>
                </button>

                <div className={styles.header}>
                    <div className={styles.headerMeta}>
                        <div className={styles.badge}>{displayBadgeText}</div>
                        {displayDate ? <div className={styles.date}>{displayDate}</div> : null}
                    </div>
                    <h2 id={titleId} className={styles.title}>
                        {t('messages.favoriteGameUpdatedTitle', { gameTitle })}
                    </h2>
                </div>

                <div className={styles.content}>
                    <section className={styles.section}>
                        <p className={styles.body}>{gameTitle}</p>
                    </section>
                    {versionNotes ? (
                        <section className={styles.section}>
                            <h3 className={styles.subtitle}>{t('gameDetail.versionNotes')}</h3>
                            <p className={styles.body}>{versionNotes}</p>
                        </section>
                    ) : null}
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

export default FavoriteGameUpdateModal;
