import { create } from 'zustand';

interface GameState {
  pdfFileId: string | null;
  setPdfFileId: (id: string | null) => void;
}

export const useGameStore = create<GameState>((set) => ({
  pdfFileId: null,
  setPdfFileId: (id) => set({ pdfFileId: id }),
}));
