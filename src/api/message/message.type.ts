import type { AnnouncementRecord } from '../announcement/announcement.type';
import type { PromotionActivity } from '../promotion/promotion.type';

export type MessageType = 'announcement' | 'promotion';

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

export interface MessageCenterData {
    unreadCount: number;
    announcements: MessageAnnouncement[];
    promotions: MessagePromotion[];
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
