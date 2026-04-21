import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
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
import styles from './Messages.module.css';

type MessageFeedItem =
    | (MessageAnnouncement & { itemType: 'announcement'; sortTime: string | null })
    | (MessagePromotion & { itemType: 'promotion'; sortTime: string | null })
    | (MessagePromotionSubmissionNotification & { itemType: 'promotion_submission_status'; sortTime: string | null });

const formatTime = (value?: string | null) => {
    if (!value) return '暂无时间';
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

const normalizeInternalLink = (linkUrl: string) => (linkUrl.startsWith('/') ? linkUrl : `/${linkUrl}`);

const getAnnouncementSortTime = (item: Pick<MessageAnnouncement, 'publishedAt' | 'updatedAt' | 'createdAt'>) =>
    item.publishedAt || item.updatedAt || item.createdAt || null;

const markCollectionAsRead = <T extends { isRead: boolean }>(items: T[]) =>
    items.map((item) => (item.isRead ? item : { ...item, isRead: true }));

const getSubmissionStatusLabel = (status: PromotionReviewStatus) => {
    switch (status) {
        case 'approved':
            return '审核通过';
        case 'rejected':
            return '审核驳回';
        case 'reward_pending':
            return '奖励待下发';
        case 'reward_issued':
            return '奖励已发放';
        default:
            return '待审核';
    }
};

const getSubmissionMessageTitle = (notification: MessagePromotionSubmissionNotification) => {
    const activityName = notification.activityTitle?.trim() || `活动 #${notification.activityId}`;
    return `《${activityName}》投稿状态更新`;
};

const getSubmissionMessageText = (notification: MessagePromotionSubmissionNotification) => {
    switch (notification.reviewStatus) {
        case 'approved':
            return '官方小助手已将你的投稿审核为通过，你可以前往我的投稿查看详情。';
        case 'rejected':
            return notification.reviewRemark
                ? `官方小助手已驳回你的投稿，备注：${notification.reviewRemark}`
                : '官方小助手已驳回你的投稿，请前往我的投稿查看审核备注。';
        case 'reward_pending':
            return '你的投稿已进入奖励待下发队列，请前往我的投稿查看当前进度。';
        case 'reward_issued':
            return '你的投稿奖励已发放完成，请前往我的投稿确认奖励状态。';
        default:
            return '你的投稿状态有更新，请前往我的投稿查看详情。';
    }
};

const Messages: React.FC = () => {
    const navigate = useNavigate();
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
            toast.error(getErrorMessage(error, '消息中心加载失败'));
        } finally {
            setIsLoading(false);
        }
    }, [setUnreadCount]);

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
            toast.error(getErrorMessage(error, '消息已读状态更新失败'));
        }
    }, [applyReadState, setUnreadCount, unreadCount]);

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
            toast.error(getErrorMessage(error, '消息批量已读失败'));
        } finally {
            setIsMarkingAllRead(false);
        }
    }, [applyAllReadState, isMarkingAllRead, setUnreadCount, unreadCount]);

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

        const targetLink = (promotion.detailLinkUrl || '').trim();
        if (!targetLink) {
            navigate('/promotions');
            return;
        }

        if (targetLink.startsWith('http://') || targetLink.startsWith('https://')) {
            window.open(targetLink, '_blank', 'noopener,noreferrer');
            return;
        }

        navigate(normalizeInternalLink(targetLink));
    }, [markMessageAsRead, navigate]);

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
                        <div className={styles.badge}>消息中心</div>
                        <h1 className={styles.title}>查看通知</h1>
                    </div>

                    <div className={styles.heroActions}>
                        <div className={styles.actionRow}>
                            <button
                                type="button"
                                className={`${styles.actionButton} ${styles.refreshButton}`}
                                onClick={() => void loadMessages()}
                                disabled={isLoading}
                            >
                                {isLoading ? '刷新中...' : '刷新列表'}
                            </button>
                            {unreadCount > 0 ? (
                                <button
                                    type="button"
                                    className={`${styles.actionButton} ${styles.markAllButton}`}
                                    onClick={() => void handleMarkAllRead()}
                                    disabled={isMarkingAllRead}
                                >
                                    {isMarkingAllRead ? '处理中...' : '一键已读'}
                                </button>
                            ) : null}
                        </div>
                    </div>
                </section>

                <section className={styles.feedCard}>
                    <div className={styles.list}>
                        {isLoading ? <div className={styles.emptyState}>正在加载消息列表...</div> : null}
                        {!isLoading && messageFeed.length === 0 ? (
                            <div className={styles.emptyState}>当前还没有可展示的消息内容。</div>
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
                                                <span className={`${styles.typeTag} ${styles.typeTagAnnouncement}`}>公告</span>
                                                <div className={styles.messageTitle}>{item.title}</div>
                                            </div>
                                            <span className={stateClassName}>{isRead ? '已读' : '未读'}</span>
                                        </div>

                                        <div className={styles.messageText}>
                                            {toAnnouncementPlainText(item.sections[0]?.body || '') || '点击查看公告详情'}
                                        </div>

                                        <div className={styles.messageMeta}>
                                            <span className={styles.metaItem}>发布时间：{formatTime(item.sortTime)}</span>
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
                                                        <span className={`${styles.typeTag} ${styles.typeTagPromotion}`}>活动</span>
                                                        <div className={styles.messageTitle}>{item.title}</div>
                                                    </div>
                                                    <span className={stateClassName}>{isRead ? '已读' : '未读'}</span>
                                                </div>

                                                <div className={styles.messageText}>{item.summary || '点击查看活动详情'}</div>

                                                <div className={styles.messageMeta}>
                                                    <span className={styles.metaItem}>发布时间：{formatTime(item.sortTime)}</span>
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
                                                alt={item.activityTitle || '投稿状态消息'}
                                            />
                                            </div>
                                        ) : (
                                            <div className={styles.promotionCoverPlaceholder}>投稿</div>
                                        )}
                                        <div className={styles.messageMain}>
                                            <div className={styles.messageHeader}>
                                                <div className={styles.titleBlock}>
                                                    <span className={`${styles.typeTag} ${styles.typeTagSubmission}`}>投稿</span>
                                                    <div className={styles.messageTitle}>{getSubmissionMessageTitle(item)}</div>
                                                </div>
                                                <span className={stateClassName}>{isRead ? '已读' : '未读'}</span>
                                            </div>

                                            <div className={styles.messageText}>{getSubmissionMessageText(item)}</div>
                                            {item.reviewRemark ? (
                                                <div className={styles.submissionRemark}>审核备注：{item.reviewRemark}</div>
                                            ) : null}

                                            <div className={styles.messageMeta}>
                                                <span className={styles.metaItem}>状态：{getSubmissionStatusLabel(item.reviewStatus)}</span>
                                                <span className={styles.metaItem}>更新时间：{formatTime(item.sortTime)}</span>
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
                badgeText="消息公告"
            />
            <MobileBottomNav />
        </div>
    );
};

export default Messages;
