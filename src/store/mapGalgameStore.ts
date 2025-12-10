import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { EventData } from '../page/GalgameMap';

interface useMapGalgameState {
    eventData: EventData | null;
    setEventData: (eventData: EventData | null) => void;
    clearState: () => void;
}

export const useMapGalgameStore = create<useMapGalgameState>()(
    persist(
        (set) => ({
            eventData: null,

            setEventData: (eventData: EventData | null) => set({ eventData }),
            clearState: () => set({
                eventData: null,
            }),
        }),
        {
            name: 'map-galgame-storage',
            // 使用 sessionStorage，页面关闭后自动清除
            storage: createJSONStorage(() => sessionStorage),
        }
    )
);

