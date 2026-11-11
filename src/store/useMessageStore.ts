import { create } from 'zustand';
import messageApi from '../api/message/messageApi';

interface MessageState {
    unreadCount: number;
    setUnreadCount: (count: number) => void;
    refreshUnreadCount: () => Promise<void>;
    clearUnreadCount: () => void;
}

export const useMessageStore = create<MessageState>((set) => ({
    unreadCount: 0,

    setUnreadCount: (count) => set({ unreadCount: Math.max(0, Number(count) || 0) }),

    refreshUnreadCount: async () => {
        try {
            // 实现消息未读数刷新
            const response = await messageApi.getUnreadCount();
            set({ unreadCount: Math.max(0, response.data.data?.unreadCount || 0) });
        } catch {
            set({ unreadCount: 0 });
        }
    },

    clearUnreadCount: () => set({ unreadCount: 0 }),
}));
