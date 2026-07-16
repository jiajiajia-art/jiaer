import type { CSSProperties } from 'react';
import type { GameTypeTone } from './gameTypeLabel';

type GameTypeTonePalette = {
  backgroundColor: string;
  borderColor: string;
};

/**
 * 玩法角标色板（内联 style 写入，避免跨 CSS Module 同优先级被基类 background 覆盖）
 */
export const GAME_TYPE_TONE_PALETTE: Record<GameTypeTone, GameTypeTonePalette> = {
  aiWenyou: {
    backgroundColor: '#e8455a',
    borderColor: 'rgba(255, 210, 216, 0.55)',
  },
  tavern: {
    backgroundColor: '#c9822a',
    borderColor: 'rgba(255, 228, 180, 0.5)',
  },
  custom: {
    backgroundColor: '#2c9b84',
    borderColor: 'rgba(190, 245, 230, 0.5)',
  },
  visualNovel: {
    backgroundColor: '#3f6ad8',
    borderColor: 'rgba(198, 214, 255, 0.5)',
  },
  ivg: {
    backgroundColor: '#9b4f8a',
    borderColor: 'rgba(240, 198, 228, 0.45)',
  },
  default: {
    backgroundColor: '#4a5564',
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
};

/** 解析玩法角标内联样式，保证色值优先级高于组件 CSS Module */
export const resolveGameTypeToneStyle = (tone: GameTypeTone): CSSProperties => {
  const palette = GAME_TYPE_TONE_PALETTE[tone] || GAME_TYPE_TONE_PALETTE.default;
  return {
    backgroundColor: palette.backgroundColor,
    borderColor: palette.borderColor,
    color: '#fff',
  };
};
