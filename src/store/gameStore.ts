import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GameState {
  pdfFileId: string | null;
  setPdfFileId: (id: string | null) => void;
  clearPdfFile: () => void;

  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  clearSessionId: () => void;

  clearAll: () => void; // ✅ 可选：清空整个 store
}

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      pdfFileId: '404ba83048e871ec162940513df8f30d',
      setPdfFileId: (id) => set({ pdfFileId: id }),
      clearPdfFile: () => set({ pdfFileId: null }),

      sessionId: '663377e201317245fecdc68cce128de2',
      setSessionId: (id) => set({ sessionId: id }),
      clearSessionId: () => set({ sessionId: null }),

      clearAll: () => set({ pdfFileId: null, sessionId: null }), // ✅
    }),
    { name: 'game-storage' }
  )
);
