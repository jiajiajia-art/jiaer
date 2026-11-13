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
    backgroundColor: 'var(--color-primary)',
    borderColor: 'color-mix(in srgb, var(--color-primary-lighter) 55%, transparent)',
  },
  tavern: {
    backgroundColor: 'color-mix(in srgb, var(--color-highlight) 68%, var(--color-shadow))',
    borderColor: 'color-mix(in srgb, var(--color-highlight) 50%, transparent)',
  },
  custom: {
    backgroundColor: 'color-mix(in srgb, var(--color-success) 68%, var(--color-shadow))',
    borderColor: 'color-mix(in srgb, var(--color-success) 50%, transparent)',
  },
  visualNovel: {
    backgroundColor: 'color-mix(in srgb, var(--color-info) 68%, var(--color-shadow))',
    borderColor: 'color-mix(in srgb, var(--color-info) 50%, transparent)',
  },
  ivg: {
    backgroundColor: 'color-mix(in srgb, var(--color-accent) 68%, var(--color-shadow))',
    borderColor: 'color-mix(in srgb, var(--color-accent) 45%, transparent)',
  },
  default: {
    backgroundColor: 'color-mix(in srgb, var(--color-text-muted) 68%, var(--color-shadow))',
    borderColor: 'color-mix(in srgb, var(--color-text) 28%, transparent)',
  },
};

/** 解析玩法角标内联样式，保证色值优先级高于组件 CSS Module */
export const resolveGameTypeToneStyle = (tone: GameTypeTone): CSSProperties => {
  const palette = GAME_TYPE_TONE_PALETTE[tone] || GAME_TYPE_TONE_PALETTE.default;
  return {
    backgroundColor: palette.backgroundColor,
    borderColor: palette.borderColor,
    color: 'var(--color-on-primary)',
  };
};
