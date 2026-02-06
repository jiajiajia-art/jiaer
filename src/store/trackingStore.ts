import { create } from "zustand";

interface TrackingState {
    started_at: string | null;
    pausedDuration: number; // 累计暂停的时长（毫秒），用于减去页面隐藏的时间
    hasReported: boolean; // 防止重复上报
    setStartedAt: (startedAt: string | null) => void;
    addPausedDuration: (duration: number) => void; // 累加暂停时长
    setHasReported: (hasReported: boolean) => void;
    clearTracking: () => void;
}

export const useTrackingStore = create<TrackingState>((set) => ({
    started_at: null,
    pausedDuration: 0,
    hasReported: false,
    setStartedAt: (startedAt: string | null) => set({ started_at: startedAt, pausedDuration: 0 }), // 重置时也重置暂停时长
    addPausedDuration: (duration: number) => set((state) => ({ pausedDuration: state.pausedDuration + duration })),
    setHasReported: (hasReported: boolean) => set({ hasReported }),
    clearTracking: () => set({ 
        started_at: null, 
        pausedDuration: 0,
        hasReported: false 
    }),
}));
