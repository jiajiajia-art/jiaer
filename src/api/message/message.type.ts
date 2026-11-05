import type { AnnouncementRecord } from '../announcement/announcement.type';
import type { PromotionActivity, PromotionReviewStatus } from '../promotion/promotion.type';

export type MessageType =
    | 'announcement'
    | 'promotion'
    | 'promotion_submission_status'
    | 'favorite_game_updated'
    | 'report_received'
    | 'report_resolved'
    | 'moderation'
    | 'feedback_reply';

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

/** 举报人：已受理回执（无进度页） */
export interface MessageReportReceivedNotification {
    id: number;
    sourceId: number;
    messageType: 'report_received';
    title?: string;
    body: string;
    targetType?: string;
    targetId?: string;
    reasonTitle?: string;
    status?: string;
    createdAt: string | null;
    publishedAt?: string | null;
    isRead: boolean;
}

/** 举报人：审核成立/驳回后的处理结果（与受理分条） */
export interface MessageReportResolvedNotification {
    id: number;
    sourceId: number;
    messageType: 'report_resolved';
    title?: string;
    body: string;
    targetType?: string;
    targetId?: string;
    reasonTitle?: string;
    /** upheld | rejected */
    status?: string;
    createdAt: string | null;
    publishedAt?: string | null;
    reviewedAt?: string | null;
    isRead: boolean;
}

/** 意见反馈运营回复 */
export interface MessageFeedbackReplyNotification {
    id: number;
    sourceId: number;
    messageType: 'feedback_reply';
    feedbackId?: number;
    ticketNo?: string;
    title?: string;
    body: string;
    createdAt: string | null;
    publishedAt?: string | null;
    isRead: boolean;
}

/** 创作者：违规 / 处罚 / 申诉结果通知 */
export interface MessageModerationNotification {
    id: number;
    /** 功能注释：标已读用数字 sourceId；跳转违规详情请用 moderationId */
    sourceId: number;
    messageType: 'moderation';
    title: string;
    body: string;
    /** 功能注释：短违规原因（列表卡片用）；缺省时前端降级用 body */
    reason?: string | null;
    recordType?: string;
    /** 功能注释：如 game；发布审核透传，便于详情/跳转 */
    sourceType?: string | null;
    level?: number | null;
    status?: string;
    /** 功能注释：publish_review 恒为 false；处罚类按后端窗口计算 */
    canAppeal?: boolean;
    relatedGameId?: string | null;
    createdAt: string | null;
    publishedAt?: string | null;
    startsAt?: string | null;
    endsAt?: string | null;
    /** 功能注释：用户提交申诉的时间；缺省时前端暂用 createdAt */
    appealedAt?: string | null;
    /** 功能注释：16 位申诉 id；申诉结果跳转用，标已读仍用 sourceId */
    appealId?: string | null;
    /** 功能注释：16 位 moderation_id；违规详情 /moderation/:id 跳转用 */
    moderationId?: string | null;
    isRead: boolean;
}

export interface MessageCenterData {
    unreadCount: number;
    announcements: MessageAnnouncement[];
    promotions: MessagePromotion[];
    promotionSubmissionNotifications: MessagePromotionSubmissionNotification[];
    favoriteGameUpdateNotifications: MessageFavoriteGameUpdateNotification[];
    reportReceivedNotifications?: MessageReportReceivedNotification[];
    reportResolvedNotifications?: MessageReportResolvedNotification[];
    moderationNotifications?: MessageModerationNotification[];
    feedbackReplyNotifications?: MessageFeedbackReplyNotification[];
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
