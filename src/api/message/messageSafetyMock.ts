import type {
  MessageModerationNotification,
  MessageReportReceivedNotification,
} from './message.type';

/** 功能注释：举报模块 mock 开启时，消息中心补安全分区假数据（含 recordType） */
export function buildMockSafetyMessages(): {
  reportReceivedNotifications: MessageReportReceivedNotification[];
  moderationNotifications: MessageModerationNotification[];
} {
  const now = new Date().toISOString();
  return {
    reportReceivedNotifications: [
      {
        id: 9001,
        body: '我们已收到你的举报，将尽快处理。',
        createdAt: now,
        messageType: 'report_received',
        sourceId: 9001,
        isRead: false,
      },
    ],
    moderationNotifications: [
      {
        id: 45,
        title: '违规处理通知',
        body: '你的作品因违反平台规范已被下架，并记为一次警告。请查看违规原因并避免再次违规。',
        recordType: 'warning',
        level: null,
        status: 'active',
        relatedGameId: 'mock_file_taken_down',
        createdAt: now,
        messageType: 'moderation',
        sourceId: 45,
        isRead: false,
      },
      {
        id: 1001,
        title: '申诉结果通知',
        body: '你的申诉已驳回。如有疑问请联系客服。',
        recordType: 'appeal',
        level: null,
        status: 'rejected',
        relatedGameId: 'mock_file_taken_down',
        createdAt: now,
        messageType: 'moderation',
        sourceId: 1001,
        isRead: false,
      },
    ],
  };
}
