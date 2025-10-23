import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GameState {
  pdfFileId: string | null;
  setPdfFileId: (id: string | null) => void;
  clearPdfFile(): void;
}

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      pdfFileId: null,
      setPdfFileId: (id) => set({ pdfFileId: id }),
      clearPdfFile: () => {
        set({ pdfFileId: null });
        localStorage.removeItem('game-storage');
      },
    }),
    { name: 'game-storage' }
  )
);

