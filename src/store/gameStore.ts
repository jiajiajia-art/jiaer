import { create } from 'zustand';

interface GameState {
  pdfFileId: string | null;
  setPdfFileId: (id: string | null) => void;
}

export const useGameStore = create<GameState>((set) => ({
  pdfFileId: '4982c1407932f432a9f760b70134a879',
  setPdfFileId: (id) => set({ pdfFileId: id }),
}));
