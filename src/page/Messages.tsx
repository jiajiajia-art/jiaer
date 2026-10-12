import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Layout/Navbar';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import AnnouncementModal from '../components/AnnouncementModal';
import FavoriteGameUpdateModal from '../components/FavoriteGameUpdateModal';
import messageApi from '../api/message/messageApi';
import { getApiErrorMessage } from '../utils/error';
import type {
    MessageAnnouncement,
    MessageCenterData,
    MessageFavoriteGameUpdateNotification,
    MessageGameModerationNotification,
    MessageGamePublishAppeal,
    MessagePromotion,
    MessagePromotionSubmissionNotification,
    MessageType,
} from '../api/message/message.type';
import type { PromotionReviewStatus } from '../api/promotion/promotion.type';
import { useMessageStore } from '../store/useMessageStore';
import { toAnnouncementPlainText } from '../utils/announcementLinks';
import { openConfiguredLink, resolvePromotionAdLink } from '../utils/promotionNavigation';
import { useExternalLinkCopyModal } from '../hooks/useExternalLinkCopyModal';
import { GAME_CARD_DEFAULT_AVATAR_PATH } from '../lib/gameCardAuthor';
import {
    formatMessageListTime,
    resolveMessageListSection,
    truncateMessagePreview,
    type MessageListSectionKey,
} from '../lib/messageCenterView';
import styles from './Messages.module.css';

/** 功能注释：消息页「全部已读」图标对齐效果图 */
const ICON_MARK_ALL_READ = `${import.meta.env.BASE_URL}data/assetsv2/home/icon_mark_all_read.webp`;
const MESSAGE_AVATAR = `${import.meta.env.BASE_URL}${GAME_CARD_DEFAULT_AVATAR_PATH}`;

type MessageFeedItem =
    | (MessageAnnouncement & { itemType: 'announcement'; sortTime: string | null })
    | (MessagePromotion & { itemType: 'promotion'; sortTime: string | null })
    | (MessagePromotionSubmissionNotification & { itemType: 'promotion_submission_status'; sortTime: string | null })
    | (MessageFavoriteGameUpdateNotification & { itemType: 'favorite_game_updated'; sortTime: string | null })
    | (MessageGameModerationNotification & { itemType: 'game_moderation'; sortTime: string | null })
    | (MessageGamePublishAppeal & { itemType: 'game_publish_appeal'; sortTime: string | null });

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

const getFavoriteGameUpdateListPreview = (notification: MessageFavoriteGameUpdateNotification, t: (key: string, options?: Record<string, unknown>) => string) => {
    const versionNotes = notification.versionNotes?.trim();
    if (versionNotes) {
        return versionNotes;
    }
    return t('messages.clickToViewFavoriteGameUpdate');
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

type RowView = {
    key: string;
    title: string;
    preview: string;
    time: string;
    isRead: boolean;
    onOpen: () => void;
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
    const [selectedFavoriteGameUpdate, setSelectedFavoriteGameUpdate] = useState<MessageFavoriteGameUpdateNotification | null>(null);

    const loadMessages = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await messageApi.list();
            const nextData = response.data.data;

            setMessageCenter(nextData);
            setUnreadCount(nextData?.unreadCount || 0);
        } catch (error) {
            toast.error(getApiErrorMessage(error, t('messages.loadFailed')));
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

        const favoriteGameUpdateNotifications = (messageCenter?.favoriteGameUpdateNotifications || []).map((item) => ({
            ...item,
            itemType: 'favorite_game_updated' as const,
            sortTime: item.createdAt || null,
        }));

        const gameModerationNotifications = (messageCenter?.gameModerationNotifications || []).map((item) => ({
            ...item,
            itemType: 'game_moderation' as const,
            sortTime: item.createdAt || null,
        }));

        const gamePublishAppeals = (messageCenter?.gamePublishAppeals || []).map((item) => ({
            ...item,
            itemType: 'game_publish_appeal' as const,
            sortTime: item.updatedAt || item.createdAt || null,
        }));

        return [...announcements, ...promotions, ...promotionSubmissionNotifications, ...favoriteGameUpdateNotifications, ...gameModerationNotifications, ...gamePublishAppeals].sort((left, right) => {
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

            const favoriteGameUpdateNotifications = (prev.favoriteGameUpdateNotifications || []).map((item) => (
                messageType === 'favorite_game_updated' && item.sourceId === sourceId
                    ? { ...item, isRead: true }
                    : item
            ));

            const gameModerationNotifications = (prev.gameModerationNotifications || []).map((item) => (
                messageType === 'game_moderation' && item.sourceId === sourceId
                    ? { ...item, isRead: true }
                    : item
            ));

            const gamePublishAppeals = (prev.gamePublishAppeals || []).map((item) => (
                messageType === 'game_publish_appeal' && item.sourceId === sourceId
                    ? { ...item, isRead: true }
                    : item
            ));

            return {
                ...prev,
                unreadCount: nextUnreadCount,
                announcements,
                promotions,
                promotionSubmissionNotifications,
                favoriteGameUpdateNotifications,
                gameModerationNotifications,
                gamePublishAppeals,
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
                favoriteGameUpdateNotifications: markCollectionAsRead(prev.favoriteGameUpdateNotifications || []),
                gameModerationNotifications: markCollectionAsRead(prev.gameModerationNotifications || []),
                gamePublishAppeals: markCollectionAsRead(prev.gamePublishAppeals || []),
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
            toast.error(getApiErrorMessage(error, t('messages.readStatusFailed')));
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
            toast.error(getApiErrorMessage(error, t('messages.batchReadFailed')));
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

    const handleOpenFavoriteGameUpdateNotification = useCallback(async (notification: MessageFavoriteGameUpdateNotification) => {
        await markMessageAsRead('favorite_game_updated', notification.sourceId, notification.isRead);
        setSelectedFavoriteGameUpdate({ ...notification, isRead: true });
    }, [markMessageAsRead]);

    const handleOpenGameModerationNotification = useCallback(async (notification: MessageGameModerationNotification) => {
        await markMessageAsRead('game_moderation', notification.sourceId, notification.isRead);
        navigate(notification.action === 'takedown' ? '/create/works?tab=drafts' : '/creator-benefits');
    }, [markMessageAsRead, navigate]);

    const handleOpenGamePublishAppeal = useCallback(async (appeal: MessageGamePublishAppeal) => {
        await markMessageAsRead('game_publish_appeal', appeal.sourceId, appeal.isRead);
        navigate(`/game-publish-appeals/${encodeURIComponent(appeal.fileId)}`);
    }, [markMessageAsRead, navigate]);

    const sectionRows = useMemo(() => {
        const buckets: Record<MessageListSectionKey, RowView[]> = {
            system: [],
            activity: [],
            interaction: [],
        };

        for (const item of messageFeed) {
            const section = resolveMessageListSection(item.itemType);
            const time = formatMessageListTime(item.sortTime);

            if (item.itemType === 'announcement') {
                buckets[section].push({
                    key: `announcement-${item.sourceId}`,
                    title: item.title || t('messages.announcement'),
                    preview: truncateMessagePreview(
                        toAnnouncementPlainText(item.sections[0]?.body || '') || t('messages.clickToViewAnnouncement'),
                    ),
                    time,
                    isRead: item.isRead,
                    onOpen: () => { void handleOpenAnnouncement(item); },
                });
                continue;
            }

            if (item.itemType === 'promotion') {
                buckets[section].push({
                    key: `promotion-${item.sourceId}`,
                    title: item.title || t('messages.activity'),
                    preview: truncateMessagePreview(item.summary || t('messages.clickToViewActivity')),
                    time,
                    isRead: item.isRead,
                    onOpen: () => { void handleOpenPromotion(item); },
                });
                continue;
            }

            if (item.itemType === 'favorite_game_updated') {
                buckets[section].push({
                    key: `favorite-game-updated-${item.sourceId}`,
                    title: t('messages.favoriteGameUpdatedTitle', {
                        gameTitle: item.gameTitle?.trim() || item.fileId,
                    }),
                    preview: truncateMessagePreview(getFavoriteGameUpdateListPreview(item, t)),
                    time,
                    isRead: item.isRead,
                    onOpen: () => { void handleOpenFavoriteGameUpdateNotification(item); },
                });
                continue;
            }

            if (item.itemType === 'game_moderation') {
                buckets[section].push({
                    key: `game-moderation-${item.sourceId}`,
                    title: item.action === 'restore'
                        ? t('messages.gameRestoredTitle', { gameTitle: item.gameTitle })
                        : t('messages.gameTakenDownTitle', { gameTitle: item.gameTitle }),
                    preview: truncateMessagePreview(item.reason || t('messages.gameModerationNoReason')),
                    time,
                    isRead: item.isRead,
                    onOpen: () => { void handleOpenGameModerationNotification(item); },
                });
                continue;
            }

            if (item.itemType === 'game_publish_appeal') {
                const titleKey = item.status === 'approved'
                    ? 'messages.gameAppealApprovedTitle'
                    : item.status === 'rejected'
                        ? 'messages.gameAppealRejectedTitle'
                        : 'messages.gameAppealPendingTitle';
                buckets[section].push({
                    key: `game-publish-appeal-${item.sourceId}`,
                    title: t(titleKey, { gameTitle: item.gameTitle || item.fileId }),
                    preview: truncateMessagePreview(
                        item.status === 'pending'
                            ? item.appealReason
                            : item.reviewRemark || t('messages.gameAppealViewDetails'),
                    ),
                    time,
                    isRead: item.isRead,
                    onOpen: () => { void handleOpenGamePublishAppeal(item); },
                });
                continue;
            }

            buckets[section].push({
                key: `promotion-submission-${item.sourceId}`,
                title: getSubmissionMessageTitle(item, t),
                preview: truncateMessagePreview(
                    item.reviewRemark
                        ? `${getSubmissionMessageText(item, t)} ${t('messages.reviewRemark')}${item.reviewRemark}`
                        : getSubmissionMessageText(item, t),
                ),
                time: time || getSubmissionStatusLabel(item.reviewStatus, t),
                isRead: item.isRead,
                onOpen: () => { void handleOpenPromotionSubmissionNotification(item); },
            });
        }

        return buckets;
    }, [
        handleOpenAnnouncement,
        handleOpenFavoriteGameUpdateNotification,
        handleOpenGameModerationNotification,
        handleOpenGamePublishAppeal,
        handleOpenPromotion,
        handleOpenPromotionSubmissionNotification,
        messageFeed,
        t,
    ]);

    const sections: Array<{ key: MessageListSectionKey; title: string; rows: RowView[] }> = [
        { key: 'system', title: t('messages.sectionSystem'), rows: sectionRows.system },
        { key: 'activity', title: t('messages.sectionActivity'), rows: sectionRows.activity },
        { key: 'interaction', title: t('messages.sectionInteraction'), rows: sectionRows.interaction },
    ];

    const hasAnyRow = sections.some((section) => section.rows.length > 0);

    const renderRow = (row: RowView) => (
        <button
            key={row.key}
            type="button"
            className={styles.messageRow}
            onClick={row.onOpen}
        >
            <div className={styles.avatarWrap}>
                <div className={styles.avatarFrame}>
                    <img className={styles.avatarImage} src={MESSAGE_AVATAR} alt="" />
                </div>
                {!row.isRead ? <span className={styles.unreadDot} aria-hidden="true" /> : null}
            </div>
            <div className={styles.rowBody}>
                <div className={styles.rowTop}>
                    <h3 className={styles.rowTitle}>{row.title}</h3>
                    {row.time ? <span className={styles.rowTime}>{row.time}</span> : null}
                </div>
                {row.preview ? <p className={styles.rowPreview}>{row.preview}</p> : null}
            </div>
        </button>
    );

    return (
        <div className={styles.pageRoot}>
            <Navbar />

            <div className={styles.pageBody}>
                <header className={styles.pageHeader}>
                    <button
                        type="button"
                        className={styles.backButton}
                        onClick={() => navigate('/home')}
                        aria-label={t('messages.backToHome')}
                        title={t('messages.backToHome')}
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M15 6L9 12L15 18" />
                        </svg>
                    </button>
                    <h1 className={styles.pageTitle}>{t('messages.listTitle')}</h1>
                    <button
                        type="button"
                        className={styles.markAllButton}
                        onClick={() => void handleMarkAllRead()}
                        disabled={isMarkingAllRead || unreadCount <= 0}
                        aria-label={t('messages.markAllRead')}
                    >
                        <img src={ICON_MARK_ALL_READ} alt="" className={styles.markAllIcon} />
                        {isMarkingAllRead ? t('messages.processing') : t('messages.markAllRead')}
                    </button>
                </header>

                {isLoading ? <div className={styles.emptyState}>{t('messages.loadingMessages')}</div> : null}
                {!isLoading && !hasAnyRow ? <div className={styles.emptyState}>{t('messages.noMessages')}</div> : null}

                {!isLoading && sections.map((section) => (
                    section.rows.length === 0 ? null : (
                        <section key={section.key} className={styles.sectionBlock}>
                            <h2 className={styles.sectionTitle}>{section.title}</h2>
                            <div className={styles.sectionCard}>
                                {section.rows.map(renderRow)}
                            </div>
                        </section>
                    )
                ))}
            </div>

            <AnnouncementModal
                announcement={selectedAnnouncement}
                isOpen={Boolean(selectedAnnouncement)}
                onClose={() => setSelectedAnnouncement(null)}
                onNavigateLink={handleAnnouncementLinkNavigate}
                badgeText={t('messages.announcement')}
            />
            <FavoriteGameUpdateModal
                notification={selectedFavoriteGameUpdate}
                isOpen={Boolean(selectedFavoriteGameUpdate)}
                onClose={() => setSelectedFavoriteGameUpdate(null)}
                badgeText={t('messages.favoriteGameUpdate')}
            />
            <MobileBottomNav />
            {externalLinkCopyModal}
        </div>
    );
};

export default Messages;
