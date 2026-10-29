import type { AnnouncementRecord } from '../announcement/announcement.type';
import type { PromotionActivity, PromotionReviewStatus } from '../promotion/promotion.type';

export type MessageType = 'announcement' | 'promotion' | 'promotion_submission_status' | 'favorite_game_updated' | 'game_moderation' | 'game_publish_appeal' | 'creator_earning_withdrawal';

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

export interface MessageGameModerationNotification {
    id: number;
    userId: string;
    fileId: string;
    gameTitle: string;
    action: 'takedown' | 'restore';
    reason: string;
    createdBy: string | null;
    createdAt: string | null;
    messageType: 'game_moderation';
    sourceId: number;
    isRead: boolean;
}

export interface MessageGamePublishAppeal {
    id: number;
    userId: string;
    fileId: string;
    gameTitle: string;
    gameEngine: string;
    takedownReason: string | null;
    takedownAt: string | null;
    gameUpdatedAt: string | null;
    appealReason: string;
    status: 'pending' | 'approved' | 'rejected';
    reviewRemark: string | null;
    reviewedBy: string | null;
    reviewedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    messageType: 'game_publish_appeal';
    sourceId: number;
    isRead: boolean;
}

export interface MessageCreatorEarningWithdrawalNotification {
    id: number;
    creatorUserId: string;
    withdrawRequestId: number;
    notificationType: 'approved' | 'paid' | 'rejected';
    grossCents: number;
    payoutCents: number;
    rejectionReason: string | null;
    createdAt: string | null;
    readAt: string | null;
    messageType: 'creator_earning_withdrawal';
    sourceId: number;
    isRead: boolean;
}

export interface MessageCenterData {
    unreadCount: number;
    announcements: MessageAnnouncement[];
    promotions: MessagePromotion[];
    promotionSubmissionNotifications: MessagePromotionSubmissionNotification[];
    favoriteGameUpdateNotifications: MessageFavoriteGameUpdateNotification[];
    gameModerationNotifications: MessageGameModerationNotification[];
    gamePublishAppeals: MessageGamePublishAppeal[];
    creatorEarningWithdrawalNotifications: MessageCreatorEarningWithdrawalNotification[];
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
