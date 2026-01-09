import { InteractionType, InteractionMode, PlaybackMode, type InteractionConfig } from '../types/interactionTypes';

/**
 * 构建交互配置
 */
export const buildInteractionConfig = (
  pendingAction: { nodeId: string; actionId: string } | null | undefined,
  skipAutoInit: boolean,
  currentSubsceneId: string | null | undefined,
  isTextMode: boolean,
  isAutoPlay: boolean
): InteractionConfig => {
  const type = pendingAction ? InteractionType.ABILITY_NODE : InteractionType.NPC_DIALOGUE;
  const mode = isTextMode ? InteractionMode.TEXT : InteractionMode.NORMAL;
  const playback = isAutoPlay ? PlaybackMode.AUTO : PlaybackMode.MANUAL;

  return {
    type,
    mode,
    playback,
    skipAutoInit,
    currentSubsceneId: currentSubsceneId || undefined,
    pendingAction: pendingAction || undefined,
  };
};

