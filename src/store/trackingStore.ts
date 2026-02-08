import { create } from "zustand";

interface TrackingState {
    started_at: string | null;
    hasReported: boolean; // 防止重复上报
    setStartedAt: (startedAt: string | null) => void;
    setHasReported: (hasReported: boolean) => void;
    clearTracking: () => void;
}

export const useTrackingStore = create<TrackingState>((set) => ({
    started_at: null,
    pausedDuration: 0,
    hasReported: false,
    setStartedAt: (startedAt: string | null) => set({ started_at: startedAt, hasReported: false }),
    setHasReported: (hasReported: boolean) => set({ hasReported }),
    clearTracking: () => set({ 
        started_at: null, 
        hasReported: false 
    }),
}));
