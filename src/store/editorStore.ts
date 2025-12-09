import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface EditorState {
    fileId: string | null;
    activePanel: string;
    isParsed: boolean;
    
    // Actions
    setFileId: (fileId: string | null) => void;
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

            setFileId: (fileId) => set({ fileId }),
            setActivePanel: (activePanel) => set({ activePanel }),
            setIsParsed: (isParsed) => set({ isParsed }),
            clearState: () => set({
                fileId: null,
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

