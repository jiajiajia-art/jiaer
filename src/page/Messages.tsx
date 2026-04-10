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
    MessageType,
} from '../api/message/message.type';
import { useMessageStore } from '../store/useMessageStore';
import { getImageUrl } from '../utils/constants';
import styles from './Messages.module.css';

type MessageFeedItem =
    | (MessageAnnouncement & { itemType: 'announcement'; sortTime: string | null })
    | (MessagePromotion & { itemType: 'promotion'; sortTime: string | null });

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

const normalizeInternalLink = (linkUrl: string) => {
    if (!linkUrl.trim()) {
        return '/promotions';
    }

    return linkUrl.startsWith('/') ? linkUrl : `/${linkUrl}`;
};

const getMessageSortTime = (item: Pick<MessageAnnouncement, 'publishedAt' | 'updatedAt' | 'createdAt'>) =>
    item.publishedAt || item.updatedAt || item.createdAt || null;

const Messages: React.FC = () => {
    const navigate = useNavigate();
    const { setUnreadCount } = useMessageStore();
    const [messageCenter, setMessageCenter] = useState<MessageCenterData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
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

    const unreadCount = useMemo(() => messageCenter?.unreadCount || 0, [messageCenter?.unreadCount]);

    const messageFeed = useMemo<MessageFeedItem[]>(() => {
        const announcements = (messageCenter?.announcements || []).map((item) => ({
            ...item,
            itemType: 'announcement' as const,
            sortTime: getMessageSortTime(item),
        }));

        const promotions = (messageCenter?.promotions || []).map((item) => ({
            ...item,
            itemType: 'promotion' as const,
            sortTime: getMessageSortTime(item),
        }));

        // 实现消息统一时间流排序
        return [...announcements, ...promotions].sort((left, right) => {
            const leftTime = new Date(left.sortTime || 0).getTime();
            const rightTime = new Date(right.sortTime || 0).getTime();
            return rightTime - leftTime;
        });
    }, [messageCenter?.announcements, messageCenter?.promotions]);

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

            return {
                ...prev,
                unreadCount: nextUnreadCount,
                announcements,
                promotions,
            };
        });
    }, []);

    const markMessageAsRead = useCallback(async (messageType: MessageType, sourceId: number, isRead: boolean) => {
        if (isRead) {
            return;
        }

        try {
            // 实现消息点击已读同步
            const response = await messageApi.markRead({ messageType, sourceId });
            const nextUnreadCount = response.data.data?.unreadCount ?? Math.max(0, unreadCount - 1);
            applyReadState(messageType, sourceId, nextUnreadCount);
            setUnreadCount(nextUnreadCount);
        } catch (error) {
            toast.error(getErrorMessage(error, '消息已读状态更新失败'));
        }
    }, [applyReadState, setUnreadCount, unreadCount]);

    const handleOpenAnnouncement = useCallback(async (announcement: MessageAnnouncement) => {
        await markMessageAsRead('announcement', announcement.sourceId, announcement.isRead);
        setSelectedAnnouncement({ ...announcement, isRead: true });
    }, [markMessageAsRead]);

    const handleOpenPromotion = useCallback(async (promotion: MessagePromotion) => {
        await markMessageAsRead('promotion', promotion.sourceId, promotion.isRead);

        // 实现活动消息跳转
        const targetLink = (promotion.detailLinkUrl || '').trim();
        if (targetLink.startsWith('http://') || targetLink.startsWith('https://')) {
            window.open(targetLink, '_blank', 'noopener,noreferrer');
            return;
        }

        navigate(normalizeInternalLink(targetLink));
    }, [markMessageAsRead, navigate]);

    return (
        <div className={styles.pageRoot}>
            <Navbar />

            <div className={styles.pageBody}>
                <section className={styles.hero}>
                    <div>
                        <div className={styles.badge}>消息中心</div>
                        <h1 className={styles.title}>查看公告通知与活动推送</h1>
                    </div>

                    <div className={styles.heroMeta}>
                        <span className={styles.heroChip}>未读消息 {unreadCount}</span>
                        <button type="button" className={styles.refreshButton} onClick={() => void loadMessages()}>
                            刷新列表
                        </button>
                    </div>
                </section>

                <section className={styles.feedCard}>
                    <div className={styles.list}>
                        {isLoading ? <div className={styles.emptyState}>正在加载消息列表...</div> : null}
                        {!isLoading && messageFeed.length === 0 ? (
                            <div className={styles.emptyState}>当前还没有可展示的公告或活动消息。</div>
                        ) : null}

                        {!isLoading && messageFeed.map((item) => (
                            item.itemType === 'announcement' ? (
                                <article
                                    key={`announcement-${item.sourceId}`}
                                    className={`${styles.messageCard} ${item.isRead ? styles.messageCardRead : ''}`}
                                    onClick={() => void handleOpenAnnouncement(item)}
                                >
                                    <div className={styles.messageHeader}>
                                        <div className={styles.titleBlock}>
                                            <span className={`${styles.typeTag} ${styles.typeTagAnnouncement}`}>公告</span>
                                            <div className={styles.messageTitle}>{item.title}</div>
                                        </div>
                                        <span className={`${styles.stateTag} ${item.isRead ? styles.stateTagRead : styles.stateTagUnread}`}>
                                            {item.isRead ? '已读' : '未读'}
                                        </span>
                                    </div>

                                    <div className={styles.messageText}>
                                        {item.sections[0]?.body || '点击查看公告详情'}
                                    </div>

                                    <div className={styles.messageFooter}>
                                        <span>发布时间：{formatTime(item.sortTime)}</span>
                                    </div>
                                </article>
                            ) : (
                                <article
                                    key={`promotion-${item.sourceId}`}
                                    className={`${styles.messageCard} ${item.isRead ? styles.messageCardRead : ''}`}
                                    onClick={() => void handleOpenPromotion(item)}
                                >
                                    <div className={styles.promotionCardTop}>
                                        <img
                                            className={styles.promotionCover}
                                            src={getImageUrl(item.coverImageUrl)}
                                            alt={item.title}
                                        />
                                        <div className={styles.promotionMain}>
                                            <div className={styles.messageHeader}>
                                                <div className={styles.titleBlock}>
                                                    <span className={`${styles.typeTag} ${styles.typeTagPromotion}`}>活动</span>
                                                    <div className={styles.messageTitle}>{item.title}</div>
                                                </div>
                                                <span className={`${styles.stateTag} ${item.isRead ? styles.stateTagRead : styles.stateTagUnread}`}>
                                                    {item.isRead ? '已读' : '未读'}
                                                </span>
                                            </div>

                                            <div className={styles.messageText}>{item.summary || '点击查看活动详情'}</div>
                                        </div>
                                    </div>

                                    <div className={styles.infoGrid}>
                                        <div className={styles.infoItem}>发布时间：{formatTime(item.sortTime)}</div>
                                    </div>
                                </article>
                            )
                        ))}
                    </div>
                </section>
            </div>

            <AnnouncementModal
                announcement={selectedAnnouncement}
                isOpen={Boolean(selectedAnnouncement)}
                onClose={() => setSelectedAnnouncement(null)}
                badgeText="消息公告"
            />
            <MobileBottomNav />
        </div>
    );
};

export default Messages;
