import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Layout/Navbar';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import AnnouncementModal from '../components/AnnouncementModal';
import messageApi from '../api/message/messageApi';
import type {
    MessageAnnouncement,
    MessageCenterData,
    MessagePromotion,
    MessagePromotionSubmissionNotification,
    MessageType,
} from '../api/message/message.type';
import type { PromotionReviewStatus } from '../api/promotion/promotion.type';
import { useMessageStore } from '../store/useMessageStore';
import { getImageUrl } from '../utils/constants';
import { toAnnouncementPlainText } from '../utils/announcementLinks';
import { openConfiguredLink, resolvePromotionAdLink } from '../utils/promotionNavigation';
import { useExternalLinkCopyModal } from '../hooks/useExternalLinkCopyModal';
import styles from './Messages.module.css';

type MessageFeedItem =
    | (MessageAnnouncement & { itemType: 'announcement'; sortTime: string | null })
    | (MessagePromotion & { itemType: 'promotion'; sortTime: string | null })
    | (MessagePromotionSubmissionNotification & { itemType: 'promotion_submission_status'; sortTime: string | null });

const formatTime = (value?: string | null, fallbackText?: string) => {
    if (!value) return fallbackText || '暂无时间';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
};

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error && typeof error === 'object' && 'response' in error) {
        const response = error as { response?: { data?: { message?: string; error?: string } } };
        return response.response?.data?.message || response.response?.data?.error || fallback;
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return fallback;
};

const getAnnouncementSortTime = (item: Pick<MessageAnnouncement, 'publishedAt' | 'updatedAt' | 'createdAt'>) =>
    item.publishedAt || item.updatedAt || item.createdAt || null;

const markCollectionAsRead = <T extends { isRead: boolean }>(items: T[]) =>
    items.map((item) => (item.isRead ? item : { ...item, isRead: true }));

const getSubmissionStatusLabel = (status: PromotionReviewStatus, t: (key: string, options?: Record<string, unknown>) => string) => {
    switch (status) {
        case 'approved':
            return t('messages.statusApproved');
        case 'rejected':
            return t('messages.statusRejected');
        case 'reward_pending':
            return t('messages.statusRewardPending');
        case 'reward_issued':
            return t('messages.statusRewardIssued');
        default:
            return t('messages.statusPending');
    }
};

const getSubmissionMessageTitle = (notification: MessagePromotionSubmissionNotification, t: (key: string, options?: Record<string, unknown>) => string) => {
    const activityName = notification.activityTitle?.trim() || `#${notification.activityId}`;
    return t('messages.activitySubmissionMessage', { activityName });
};

const getSubmissionMessageText = (notification: MessagePromotionSubmissionNotification, t: (key: string, options?: Record<string, unknown>) => string) => {
    switch (notification.reviewStatus) {
        case 'approved':
            return t('messages.submissionApproved');
        case 'rejected':
            return notification.reviewRemark
                ? t('messages.submissionRejectedWithRemark', { remark: notification.reviewRemark })
                : t('messages.submissionRejected');
        case 'reward_pending':
            return t('messages.submissionRewardPending');
        case 'reward_issued':
            return t('messages.submissionRewardIssued');
        default:
            return t('messages.submissionStatusUpdated');
    }
};

const Messages: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { requestCopy, modal: externalLinkCopyModal } = useExternalLinkCopyModal();
    const { setUnreadCount } = useMessageStore();
    const [messageCenter, setMessageCenter] = useState<MessageCenterData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
    const [selectedAnnouncement, setSelectedAnnouncement] = useState<MessageAnnouncement | null>(null);

    const loadMessages = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await messageApi.list();
            const nextData = response.data.data;

            setMessageCenter(nextData);
            setUnreadCount(nextData?.unreadCount || 0);
        } catch (error) {
            toast.error(getErrorMessage(error, t('messages.loadFailed')));
        } finally {
            setIsLoading(false);
        }
    }, [setUnreadCount, t]);

    useEffect(() => {
        void loadMessages();
    }, [loadMessages]);

    const unreadCount = messageCenter?.unreadCount || 0;

    const messageFeed = useMemo<MessageFeedItem[]>(() => {
        const announcements = (messageCenter?.announcements || []).map((item) => ({
            ...item,
            itemType: 'announcement' as const,
            sortTime: getAnnouncementSortTime(item),
        }));

        const promotions = (messageCenter?.promotions || []).map((item) => {
            const hasDetailLink = Boolean(item.detailLinkUrl?.trim());

            return {
                ...item,
                summary: item.summary || (hasDetailLink ? '' : 'Activity details are not available yet.'),
                itemType: 'promotion' as const,
                sortTime: item.publishedAt || item.updatedAt || item.createdAt || null,
            };
        });

        const promotionSubmissionNotifications = (messageCenter?.promotionSubmissionNotifications || []).map((item) => ({
            ...item,
            itemType: 'promotion_submission_status' as const,
            sortTime: item.createdAt || null,
        }));

        return [...announcements, ...promotions, ...promotionSubmissionNotifications].sort((left, right) => {
            const leftTime = new Date(left.sortTime || 0).getTime();
            const rightTime = new Date(right.sortTime || 0).getTime();
            return rightTime - leftTime;
        });
    }, [messageCenter]);

    const applyReadState = useCallback((messageType: MessageType, sourceId: number, nextUnreadCount: number) => {
        setMessageCenter((prev) => {
            if (!prev) return prev;

            const announcements = prev.announcements.map((item) => (
                messageType === 'announcement' && item.sourceId === sourceId
                    ? { ...item, isRead: true }
                    : item
            ));

            const promotions = prev.promotions.map((item) => (
                messageType === 'promotion' && item.sourceId === sourceId
                    ? { ...item, isRead: true }
                    : item
            ));

            const promotionSubmissionNotifications = prev.promotionSubmissionNotifications.map((item) => (
                messageType === 'promotion_submission_status' && item.sourceId === sourceId
                    ? { ...item, isRead: true }
                    : item
            ));

            return {
                ...prev,
                unreadCount: nextUnreadCount,
                announcements,
                promotions,
                promotionSubmissionNotifications,
            };
        });
    }, []);

    const applyAllReadState = useCallback((nextUnreadCount: number) => {
        setMessageCenter((prev) => {
            if (!prev) return prev;

            return {
                ...prev,
                unreadCount: nextUnreadCount,
                announcements: markCollectionAsRead(prev.announcements),
                promotions: markCollectionAsRead(prev.promotions),
                promotionSubmissionNotifications: markCollectionAsRead(prev.promotionSubmissionNotifications),
            };
        });
    }, []);

    const markMessageAsRead = useCallback(async (messageType: MessageType, sourceId: number, isRead: boolean) => {
        if (isRead) {
            return;
        }

        try {
            const response = await messageApi.markRead({ messageType, sourceId });
            const nextUnreadCount = response.data.data?.unreadCount ?? Math.max(0, unreadCount - 1);
            applyReadState(messageType, sourceId, nextUnreadCount);
            setUnreadCount(nextUnreadCount);
        } catch (error) {
            toast.error(getErrorMessage(error, t('messages.readStatusFailed')));
        }
    }, [applyReadState, setUnreadCount, unreadCount, t]);

    const handleMarkAllRead = useCallback(async () => {
        if (isMarkingAllRead || unreadCount <= 0) {
            return;
        }

        try {
            setIsMarkingAllRead(true);
            const response = await messageApi.markAllRead();
            const nextUnreadCount = response.data.data?.unreadCount ?? 0;
            applyAllReadState(nextUnreadCount);
            setUnreadCount(nextUnreadCount);
        } catch (error) {
            toast.error(getErrorMessage(error, t('messages.batchReadFailed')));
        } finally {
            setIsMarkingAllRead(false);
        }
    }, [applyAllReadState, isMarkingAllRead, setUnreadCount, unreadCount, t]);

    const handleOpenAnnouncement = useCallback(async (announcement: MessageAnnouncement) => {
        await markMessageAsRead('announcement', announcement.sourceId, announcement.isRead);
        setSelectedAnnouncement({ ...announcement, isRead: true });
    }, [markMessageAsRead]);

    const handleAnnouncementLinkNavigate = useCallback((path: string) => {
        setSelectedAnnouncement(null);
        navigate(path);
    }, [navigate]);

    const handleOpenPromotion = useCallback(async (promotion: MessagePromotion) => {
        await markMessageAsRead('promotion', promotion.sourceId, promotion.isRead);

        const targetLink = resolvePromotionAdLink(promotion);
        if (!targetLink) {
            navigate('/promotions');
            return;
        }

        openConfiguredLink(targetLink, {
            navigate,
            onExternalLinkCopy: requestCopy,
        });
    }, [markMessageAsRead, navigate, requestCopy]);

    const handleOpenPromotionSubmissionNotification = useCallback(async (notification: MessagePromotionSubmissionNotification) => {
        await markMessageAsRead('promotion_submission_status', notification.sourceId, notification.isRead);
        navigate(`/promotions?tab=submissions&submissionId=${notification.submissionId}`);
    }, [markMessageAsRead, navigate]);

    return (
        <div className={styles.pageRoot}>
            <Navbar />

            <div className={styles.pageBody}>
                <section className={styles.hero}>
                    <div className={styles.heroContent}>
                        <div className={styles.badge}>{t('messages.pageTitle')}</div>
                        <h1 className={styles.title}>{t('messages.viewNotifications')}</h1>
                    </div>

                    <div className={styles.heroActions}>
                        <div className={styles.actionRow}>
                            <button
                                type="button"
                                className={`${styles.actionButton} ${styles.refreshButton}`}
                                onClick={() => void loadMessages()}
                                disabled={isLoading}
                            >
                                {isLoading ? t('messages.refreshing') : t('messages.refreshList')}
                            </button>
                            {unreadCount > 0 ? (
                                <button
                                    type="button"
                                    className={`${styles.actionButton} ${styles.markAllButton}`}
                                    onClick={() => void handleMarkAllRead()}
                                    disabled={isMarkingAllRead}
                                >
                                    {isMarkingAllRead ? t('messages.processing') : t('messages.markAllRead')}
                                </button>
                            ) : null}
                        </div>
                    </div>
                </section>

                <section className={styles.feedCard}>
                    <div className={styles.list}>
                        {isLoading ? <div className={styles.emptyState}>{t('messages.loadingMessages')}</div> : null}
                        {!isLoading && messageFeed.length === 0 ? (
                            <div className={styles.emptyState}>{t('messages.noMessages')}</div>
                        ) : null}

                        {!isLoading && messageFeed.map((item) => {
                            const isRead = item.isRead;
                            const cardClassName = [
                                styles.messageCard,
                                isRead ? styles.messageCardRead : styles.messageCardUnread,
                            ].join(' ');
                            const stateClassName = `${styles.stateTag} ${isRead ? styles.stateTagRead : styles.stateTagUnread}`;

                            if (item.itemType === 'announcement') {
                                return (
                                    <article
                                        key={`announcement-${item.sourceId}`}
                                        className={cardClassName}
                                        onClick={() => void handleOpenAnnouncement(item)}
                                    >
                                        <div className={styles.messageHeader}>
                                            <div className={styles.titleBlock}>
                                                <span className={`${styles.typeTag} ${styles.typeTagAnnouncement}`}>{t('messages.announcement')}</span>
                                                <div className={styles.messageTitle}>{item.title}</div>
                                            </div>
                                            <span className={stateClassName}>{isRead ? t('messages.read') : t('messages.unread')}</span>
                                        </div>

                                        <div className={styles.messageText}>
                                            {toAnnouncementPlainText(item.sections[0]?.body || '') || t('messages.clickToViewAnnouncement')}
                                        </div>

                                        <div className={styles.messageMeta}>
                                            <span className={styles.metaItem}>{t('messages.publishedAt')}{formatTime(item.sortTime, t('messages.noTime'))}</span>
                                        </div>
                                    </article>
                                );
                            }

                            if (item.itemType === 'promotion') {
                                return (
                                    <article
                                        key={`promotion-${item.sourceId}`}
                                        className={cardClassName}
                                        onClick={() => void handleOpenPromotion(item)}
                                    >
                                        <div className={styles.messageLayout}>
                                            <div className={styles.promotionCoverWrap}>
                                                <img
                                                    className={styles.promotionCover}
                                                    src={getImageUrl(item.coverImageUrl)}
                                                    alt={item.title}
                                                />
                                            </div>
                                            <div className={styles.messageMain}>
                                                <div className={styles.messageHeader}>
                                                    <div className={styles.titleBlock}>
                                                        <span className={`${styles.typeTag} ${styles.typeTagPromotion}`}>{t('messages.activity')}</span>
                                                        <div className={styles.messageTitle}>{item.title}</div>
                                                    </div>
                                                    <span className={stateClassName}>{isRead ? t('messages.read') : t('messages.unread')}</span>
                                                </div>

                                                <div className={styles.messageText}>{item.summary || t('messages.clickToViewActivity')}</div>

                                                <div className={styles.messageMeta}>
                                                    <span className={styles.metaItem}>{t('messages.publishedAt')}{formatTime(item.sortTime, t('messages.noTime'))}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </article>
                                );
                            }

                            const coverImageUrl = item.activityCoverImageUrl ? getImageUrl(item.activityCoverImageUrl) : '';

                            return (
                                <article
                                    key={`promotion-submission-${item.sourceId}`}
                                    className={cardClassName}
                                    onClick={() => void handleOpenPromotionSubmissionNotification(item)}
                                >
                                    <div className={styles.messageLayout}>
                                        {coverImageUrl ? (
                                            <div className={styles.promotionCoverWrap}>
                                            <img
                                                className={styles.promotionCover}
                                                src={coverImageUrl}
                                                alt={item.activityTitle || t('messages.submissionStatusUpdate')}
                                            />
                                            </div>
                                        ) : (
                                            <div className={styles.promotionCoverPlaceholder}>{t('messages.submission')}</div>
                                        )}
                                        <div className={styles.messageMain}>
                                            <div className={styles.messageHeader}>
                                                <div className={styles.titleBlock}>
                                                    <span className={`${styles.typeTag} ${styles.typeTagSubmission}`}>{t('messages.submission')}</span>
                                                    <div className={styles.messageTitle}>{getSubmissionMessageTitle(item, t)}</div>
                                                </div>
                                                <span className={stateClassName}>{isRead ? t('messages.read') : t('messages.unread')}</span>
                                            </div>

                                            <div className={styles.messageText}>{getSubmissionMessageText(item, t)}</div>
                                            {item.reviewRemark ? (
                                                <div className={styles.submissionRemark}>{t('messages.reviewRemark')}{item.reviewRemark}</div>
                                            ) : null}

                                            <div className={styles.messageMeta}>
                                                <span className={styles.metaItem}>{t('messages.status')}{getSubmissionStatusLabel(item.reviewStatus, t)}</span>
                                                <span className={styles.metaItem}>{t('messages.updatedAt')}{formatTime(item.sortTime, t('messages.noTime'))}</span>
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>
            </div>

            <AnnouncementModal
                announcement={selectedAnnouncement}
                isOpen={Boolean(selectedAnnouncement)}
                onClose={() => setSelectedAnnouncement(null)}
                onNavigateLink={handleAnnouncementLinkNavigate}
                badgeText={t('messages.announcement')}
            />
            <MobileBottomNav />
            {externalLinkCopyModal}
        </div>
    );
};

export default Messages;
