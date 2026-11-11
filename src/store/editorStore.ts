import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface EditorState {
    activePanel: string;
    isParsed: boolean;
    
    // Actions
    setActivePanel: (panel: string) => void;
    setIsParsed: (isParsed: boolean) => void;
    clearState: () => void;
}

export const useEditorStore = create<EditorState>()(
    persist(
        (set) => ({
            fileId: null,
            activePanel: 'documents',
            isParsed: false,

            setActivePanel: (activePanel) => set({ activePanel }),
            setIsParsed: (isParsed) => set({ isParsed }),
            clearState: () => set({
                activePanel: 'documents',
                isParsed: false,
            }),
        }),
        {
            name: 'editor-storage',
            // 使用 sessionStorage，页面关闭后自动清除
            storage: createJSONStorage(() => sessionStorage),
        }
    )
);

