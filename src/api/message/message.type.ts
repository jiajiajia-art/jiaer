import type { AnnouncementRecord } from '../announcement/announcement.type';
import type { PromotionActivity, PromotionReviewStatus } from '../promotion/promotion.type';

export type MessageType = 'announcement' | 'promotion' | 'promotion_submission_status' | 'favorite_game_updated';

export interface MessageAnnouncement extends AnnouncementRecord {
    messageType: 'announcement';
    sourceId: number;
    isRead: boolean;
}

export interface MessagePromotion extends PromotionActivity {
    messageType: 'promotion';
    sourceId: number;
    isRead: boolean;
}

export interface MessagePromotionSubmissionNotification {
    id: number;
    userId: string;
    submissionId: number;
    activityId: number;
    activityTitle: string;
    activityCoverImageUrl: string;
    reviewStatus: PromotionReviewStatus;
    reviewRemark: string;
    createdAt: string | null;
    messageType: 'promotion_submission_status';
    sourceId: number;
    isRead: boolean;
}

export interface MessageFavoriteGameUpdateNotification {
    id: number;
    userId: string;
    fileId: string;
    gameTitle: string;
    versionNotes: string;
    createdAt: string | null;
    messageType: 'favorite_game_updated';
    sourceId: number;
    isRead: boolean;
}

export interface MessageCenterData {
    unreadCount: number;
    announcements: MessageAnnouncement[];
    promotions: MessagePromotion[];
    promotionSubmissionNotifications: MessagePromotionSubmissionNotification[];
    favoriteGameUpdateNotifications: MessageFavoriteGameUpdateNotification[];
}

export interface MessageUnreadCountData {
    unreadCount: number;
}

export interface MessageReadPayload {
    messageType: MessageType;
    sourceId: number;
}

export interface MessageReadResult extends MessageReadPayload {
    unreadCount: number;
}

export interface MessageReadAllResult {
    unreadCount: number;
    markedCount: number;
}
