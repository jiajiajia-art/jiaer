import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Layout/Navbar';
import AnnouncementModal from '../components/AnnouncementModal';
import FavoriteGameUpdateModal from '../components/FavoriteGameUpdateModal';
import messageApi from '../api/message/messageApi';
import { getApiErrorMessage } from '../utils/error';
import type {
    MessageAnnouncement,
    MessageCenterData,
    MessageFavoriteGameUpdateNotification,
    MessageModerationNotification,
    MessagePromotion,
    MessagePromotionSubmissionNotification,
    MessageReportReceivedNotification,
    MessageType,
} from '../api/message/message.type';
import type { PromotionReviewStatus } from '../api/promotion/promotion.type';
import { useMessageStore } from '../store/useMessageStore';
import { toAnnouncementPlainText } from '../utils/announcementLinks';
import { openConfiguredLink, resolvePromotionAdLink } from '../utils/promotionNavigation';
import { useExternalLinkCopyModal } from '../hooks/useExternalLinkCopyModal';
import { GAME_CARD_DEFAULT_AVATAR_PATH } from '../lib/gameCardAuthor';
import {
    formatMessageDateTime,
    formatMessageDateYmd,
    formatMessageListTime,
    resolveMessageListSection,
    truncateMessagePreview,
    type MessageListSectionKey,
} from '../lib/messageCenterView';
import ConfirmModal from '../components/CommonModal/ConfirmModal';
import styles from './Messages.module.css';

/** 功能注释：消息页「全部已读」图标对齐效果图 */
const ICON_MARK_ALL_READ = `${import.meta.env.BASE_URL}data/assetsv2/home/icon_mark_all_read.webp`;
const MESSAGE_AVATAR = `${import.meta.env.BASE_URL}${GAME_CARD_DEFAULT_AVATAR_PATH}`;

type MessageFeedItem =
    | (MessageAnnouncement & { itemType: 'announcement'; sortTime: string | null })
    | (MessagePromotion & { itemType: 'promotion'; sortTime: string | null })
    | (MessagePromotionSubmissionNotification & { itemType: 'promotion_submission_status'; sortTime: string | null })
    | (MessageFavoriteGameUpdateNotification & { itemType: 'favorite_game_updated'; sortTime: string | null })
    | (MessageReportReceivedNotification & { itemType: 'report_received'; sortTime: string | null })
    | (MessageModerationNotification & { itemType: 'moderation'; sortTime: string | null });

type SafetyDetail = {
    title: string;
    body: string;
    relatedGameId?: string | null;
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

type SafetyNoticeField = {
    label: string;
    value: string;
};

type RowView = {
    key: string;
    variant?: 'default' | 'safetyNotice';
    title: string;
    preview?: string;
    time?: string;
    dateLabel?: string;
    fields?: SafetyNoticeField[];
    actionLabel?: string;
    isRead: boolean;
    onOpen: () => void;
};

const isAppealResultNotification = (notification: MessageModerationNotification): boolean =>
    String(notification.recordType || '').toLowerCase() === 'appeal';

const getAppealResultLabel = (
    status: string | undefined,
    t: (key: string, options?: Record<string, unknown>) => string,
): string => {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'approved' || normalized === 'revoked') {
        return t('messages.appealResultApproved');
    }
    if (normalized === 'rejected') {
        return t('messages.appealResultRejected');
    }
    if (normalized === 'pending') {
        return t('messages.appealResultPending');
    }
    return status?.trim() || '—';
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
    const [safetyDetail, setSafetyDetail] = useState<SafetyDetail | null>(null);

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

        const reportReceivedNotifications = (messageCenter?.reportReceivedNotifications || []).map((item) => ({
            ...item,
            itemType: 'report_received' as const,
            sortTime: item.publishedAt || item.createdAt || null,
        }));

        const moderationNotifications = (messageCenter?.moderationNotifications || []).map((item) => ({
            ...item,
            itemType: 'moderation' as const,
            sortTime: item.publishedAt || item.createdAt || null,
        }));

        return [
            ...announcements,
            ...promotions,
            ...promotionSubmissionNotifications,
            ...favoriteGameUpdateNotifications,
            ...reportReceivedNotifications,
            ...moderationNotifications,
        ].sort((left, right) => {
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

            const reportReceivedNotifications = (prev.reportReceivedNotifications || []).map((item) => (
                messageType === 'report_received' && item.sourceId === sourceId
                    ? { ...item, isRead: true }
                    : item
            ));

            const moderationNotifications = (prev.moderationNotifications || []).map((item) => (
                messageType === 'moderation' && item.sourceId === sourceId
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
                reportReceivedNotifications,
                moderationNotifications,
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
                reportReceivedNotifications: markCollectionAsRead(prev.reportReceivedNotifications || []),
                moderationNotifications: markCollectionAsRead(prev.moderationNotifications || []),
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

    const handleOpenReportReceived = useCallback(async (notification: MessageReportReceivedNotification) => {
        await markMessageAsRead('report_received', notification.sourceId, notification.isRead);
        setSafetyDetail({
            title: notification.title?.trim() || t('messages.reportReceivedTitle'),
            body: notification.body || t('messages.reportReceivedBody'),
        });
    }, [markMessageAsRead, t]);

    const handleOpenModeration = useCallback(async (notification: MessageModerationNotification) => {
        await markMessageAsRead('moderation', notification.sourceId, notification.isRead);
        // 功能注释：申诉结果进结果页；违规通知进账号审核详情
        if (isAppealResultNotification(notification)) {
            const appealId = String(notification.appealId || '').trim();
            if (appealId) {
                navigate(`/appeals/${appealId}`);
            }
            return;
        }
        const moderationId = String(notification.moderationId || '').trim();
        if (moderationId) {
            navigate(`/moderation/${encodeURIComponent(moderationId)}`);
        }
    }, [markMessageAsRead, navigate]);

    const sectionRows = useMemo(() => {
        const buckets: Record<MessageListSectionKey, RowView[]> = {
            system: [],
            activity: [],
            interaction: [],
            safety: [],
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

            if (item.itemType === 'report_received') {
                buckets[section].push({
                    key: `report-received-${item.sourceId}`,
                    title: item.title?.trim() || t('messages.reportReceivedTitle'),
                    preview: truncateMessagePreview(item.body || t('messages.reportReceivedBody')),
                    time,
                    isRead: item.isRead,
                    onOpen: () => { void handleOpenReportReceived(item); },
                });
                continue;
            }

            if (item.itemType === 'moderation') {
                if (isAppealResultNotification(item)) {
                    const appealTime = formatMessageDateTime(item.appealedAt || item.createdAt);
                    buckets[section].push({
                        key: `moderation-${item.sourceId}`,
                        variant: 'safetyNotice',
                        title: t('messages.appealResultNoticeTitle'),
                        dateLabel: formatMessageDateYmd(item.createdAt || item.publishedAt),
                        fields: [
                            {
                                label: t('messages.appealTimeLabel'),
                                value: appealTime || '—',
                            },
                            {
                                label: t('messages.appealResultLabel'),
                                value: getAppealResultLabel(item.status, t),
                            },
                        ],
                        actionLabel: t('messages.viewDetails'),
                        isRead: item.isRead,
                        onOpen: () => { void handleOpenModeration(item); },
                    });
                } else {
                    const actionTime = formatMessageDateTime(item.startsAt || item.createdAt);
                    const endTime = formatMessageDateTime(item.endsAt);
                    const reasonText = (item.reason || '').trim() || '—';
                    const fields: SafetyNoticeField[] = [
                        {
                            label: t('messages.violationReasonLabel'),
                            value: reasonText,
                        },
                        {
                            label: t('messages.actionTimeLabel'),
                            value: actionTime || '—',
                        },
                    ];
                    if (endTime) {
                        fields.push({
                            label: t('messages.endTimeLabel'),
                            value: endTime,
                        });
                    }
                    buckets[section].push({
                        key: `moderation-${item.sourceId}`,
                        variant: 'safetyNotice',
                        title: t('messages.violationNoticeTitle'),
                        dateLabel: formatMessageDateYmd(item.createdAt || item.publishedAt || item.startsAt),
                        fields,
                        actionLabel: t('messages.viewDetails'),
                        isRead: item.isRead,
                        onOpen: () => { void handleOpenModeration(item); },
                    });
                }
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
        handleOpenModeration,
        handleOpenPromotion,
        handleOpenPromotionSubmissionNotification,
        handleOpenReportReceived,
        messageFeed,
        t,
    ]);

    const sections: Array<{ key: MessageListSectionKey; title: string; rows: RowView[] }> = [
        { key: 'system', title: t('messages.sectionSystem'), rows: sectionRows.system },
        { key: 'activity', title: t('messages.sectionActivity'), rows: sectionRows.activity },
        { key: 'interaction', title: t('messages.sectionInteraction'), rows: sectionRows.interaction },
        { key: 'safety', title: t('messages.sectionSafety'), rows: sectionRows.safety },
    ];

    const hasAnyRow = sections.some((section) => section.rows.length > 0);

    const renderDefaultRow = (row: RowView) => (
        <button
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

    const renderSafetyNotice = (row: RowView) => (
        <button
            key={row.key}
            type="button"
            className={styles.safetyNoticeCard}
            onClick={row.onOpen}
        >
            {!row.isRead ? <span className={styles.safetyUnreadDot} aria-hidden="true" /> : null}
            <div className={styles.safetyNoticeHead}>
                <h3 className={styles.safetyNoticeTitle}>{row.title}</h3>
                {row.dateLabel ? <p className={styles.safetyNoticeDate}>{row.dateLabel}</p> : null}
            </div>
            {row.fields?.length ? (
                <dl className={styles.safetyNoticeFields}>
                    {row.fields.map((field) => (
                        <div key={`${row.key}-${field.label}`} className={styles.safetyNoticeField}>
                            <dt className={styles.safetyNoticeLabel}>{field.label}</dt>
                            <dd className={styles.safetyNoticeValue}>{field.value}</dd>
                        </div>
                    ))}
                </dl>
            ) : null}
            <div className={styles.safetyNoticeFoot}>
                <span className={styles.safetyNoticeAction}>{row.actionLabel || t('messages.viewDetails')}</span>
                <span className={styles.safetyNoticeChevron} aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                        <path d="M9 6L15 12L9 18" />
                    </svg>
                </span>
            </div>
        </button>
    );

    const renderRow = (row: RowView) => (
        row.variant === 'safetyNotice'
            ? renderSafetyNotice(row)
            : (
                <React.Fragment key={row.key}>
                    {renderDefaultRow(row)}
                </React.Fragment>
            )
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
                            {section.key === 'safety' ? (
                                <div className={styles.sectionList}>
                                    {section.rows.map((row) => (
                                        row.variant === 'safetyNotice'
                                            ? renderSafetyNotice(row)
                                            : (
                                                <div key={row.key} className={styles.messageRowCard}>
                                                    {renderDefaultRow(row)}
                                                </div>
                                            )
                                    ))}
                                </div>
                            ) : (
                                <div className={styles.sectionCard}>
                                    {section.rows.map(renderRow)}
                                </div>
                            )}
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
            <ConfirmModal
                isOpen={Boolean(safetyDetail)}
                variant="alert"
                tone="glass"
                title={safetyDetail?.title || t('messages.sectionSafety')}
                message={(
                    <span>
                        {safetyDetail?.body}
                        {safetyDetail?.relatedGameId ? (
                            <>
                                <br />
                                <br />
                                <button
                                    type="button"
                                    className={styles.safetyAction}
                                    onClick={() => {
                                        const gameId = safetyDetail.relatedGameId;
                                        setSafetyDetail(null);
                                        // 功能注释：违规下架后公开详情不可开，创作者进作品数据页
                                        if (gameId) {
                                            navigate(`/createGame?mode=stats&gameId=${encodeURIComponent(gameId)}`);
                                        }
                                    }}
                                >
                                    {t('messages.viewReportedGame')}
                                </button>
                            </>
                        ) : null}
                    </span>
                )}
                confirmButtonText={t('common.confirm')}
                onConfirm={() => setSafetyDetail(null)}
                onCancel={() => setSafetyDetail(null)}
            />
            {externalLinkCopyModal}
        </div>
    );
};

export default Messages;
