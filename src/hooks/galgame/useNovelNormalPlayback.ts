/**
 * 视觉小说回放式阅读驱动：索引推进、场景背景、打字机、自动播放。
 * 不接入 AI 流；选项点击仅本地推进。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { extractPlainText } from '../../utils/textUtils';
import { getImageUrl, getPlayerImageUrl } from '../../utils/constants';
import { withCacheBust } from '../../utils/imageCache';
import { useStoryTyping } from '../story/useStoryTyping';
import {
  advancePlaybackIndex,
  buildPlaybackFrame,
  canAutoAdvanceWithSteps,
  findSceneBackdropAtIndex,
  resolveBackdropImagePath,
  seekPlaybackIndex,
  type NovelPlaybackStepLike,
} from '../../lib/galgame/novelPlayback';
import {
  stepToDisplayMessage,
  type DisplayMessage,
  type StepToMessagePreset,
} from '../../lib/galgame/stepToDisplayMessage';

export type NovelPlaybackPreset = {
  world?: unknown;
  scenes?: { scenes?: Array<{ id?: string; name?: string; image?: string; images?: string }> } | null;
  npcs?: unknown;
};

type UseNovelNormalPlaybackArgs = {
  steps: NovelPlaybackStepLike[];
  preset: NovelPlaybackPreset | null;
  enabled: boolean;
  isWaitingForData?: boolean;
  coverFallbackUrl?: string | null;
  onNeedPrefetch?: (playbackIndex: number) => void;
};

function toDisplayUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('blob:') || path.startsWith('data:')) return path;
  const url = getImageUrl(path);
  return url ? withCacheBust(url) : undefined;
}

export function useNovelNormalPlayback({
  steps,
  preset,
  enabled,
  isWaitingForData = false,
  coverFallbackUrl = null,
  onNeedPrefetch,
}: UseNovelNormalPlaybackArgs) {
  const [index, setIndex] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [backgroundImage, setBackgroundImage] = useState('');
  const [sceneName, setSceneName] = useState('');

  const scenesById = useMemo(() => {
    const map = new Map<string, unknown>();
    (preset?.scenes?.scenes || []).forEach((scene) => {
      if (scene?.id) map.set(String(scene.id), scene);
    });
    return map;
  }, [preset?.scenes]);

  const messagePreset: StepToMessagePreset = useMemo(() => {
    const world = (preset?.world ?? null) as { player?: StepToMessagePreset['player'] } | null;
    const npcsBag = (preset?.npcs ?? null) as { npcs?: StepToMessagePreset['npcs'] } | null;
    return {
      player: world?.player ?? null,
      npcs: npcsBag?.npcs ?? null,
    };
  }, [preset?.npcs, preset?.world]);

  const playerImagePath = useMemo(() => {
    const world = (preset?.world ?? null) as { player?: unknown } | null;
    return getPlayerImageUrl(world?.player) || null;
  }, [preset?.world]);

  const syncBackdrop = useCallback(
    (stepList: NovelPlaybackStepLike[], at: number) => {
      const hint = findSceneBackdropAtIndex(stepList, at);
      const path = resolveBackdropImagePath(hint, scenesById);
      const url = toDisplayUrl(path) || toDisplayUrl(coverFallbackUrl) || '';
      if (url) setBackgroundImage(url);
      if (hint?.sceneName) {
        setSceneName(hint.sceneName);
      } else if (hint?.sceneId && scenesById.has(hint.sceneId)) {
        const scene = scenesById.get(hint.sceneId) as { name?: string };
        setSceneName(String(scene?.name || ''));
      }
    },
    [coverFallbackUrl, scenesById],
  );

  // 步骤列表变化时重置到首个可展示帧
  useEffect(() => {
    if (!enabled || steps.length === 0) {
      setIndex(0);
      return;
    }
    const frame = buildPlaybackFrame(steps, 0);
    setIndex(frame.index);
    syncBackdrop(steps, frame.index);
  }, [enabled, steps, syncBackdrop]);

  const frame = useMemo(() => buildPlaybackFrame(steps, index), [index, steps]);

  const currentMessage: DisplayMessage | null = useMemo(() => {
    if (!enabled || !frame.currentStep) return null;
    return stepToDisplayMessage(frame.currentStep, messagePreset, {
      messageId: frame.index + 1,
      resolveImageUrl: toDisplayUrl,
      playerImagePath,
    });
  }, [enabled, frame.currentStep, frame.index, messagePreset, playerImagePath]);

  const typingSource =
    currentMessage && currentMessage.type !== 'choice'
      ? extractPlainText(currentMessage.message)
      : '';
  const { displayedText, isTyping } = useStoryTyping({
    text: typingSource,
    enabled: enabled && Boolean(typingSource),
    speed: 30,
  });

  const finalIsTyping = Boolean(currentMessage && currentMessage.type !== 'choice' && isTyping);
  const finalDisplayText =
    currentMessage && currentMessage.type !== 'choice'
      ? (finalIsTyping ? displayedText : typingSource)
      : (currentMessage?.message || '');

  const goToIndex = useCallback(
    (nextIndex: number) => {
      if (!enabled || steps.length === 0) return;
      const clamped = seekPlaybackIndex(steps, nextIndex);
      setIndex(clamped);
      syncBackdrop(steps, clamped);
      onNeedPrefetch?.(clamped);
    },
    [enabled, onNeedPrefetch, steps, syncBackdrop],
  );

  const handleNext = useCallback(() => {
    if (!enabled) return;
    const next = advancePlaybackIndex(steps, frame.index);
    if (next == null) {
      setIsAutoPlay(false);
      return;
    }
    setIndex(next);
    syncBackdrop(steps, next);
    onNeedPrefetch?.(next);
  }, [enabled, frame.index, onNeedPrefetch, steps, syncBackdrop]);

  const handleChoiceClick = useCallback(() => {
    const next = advancePlaybackIndex(steps, frame.index);
    if (next == null) {
      setIsAutoPlay(false);
      return;
    }
    setIndex(next);
    syncBackdrop(steps, next);
    onNeedPrefetch?.(next);
  }, [frame.index, onNeedPrefetch, steps, syncBackdrop]);

  // 自动播放
  useEffect(() => {
    if (!enabled || !isAutoPlay) return undefined;
    if (
      !canAutoAdvanceWithSteps(steps, {
        isAutoPlay,
        isTyping: finalIsTyping,
        showNextButton: frame.showNextButton,
        stepType: frame.currentStep?.type,
        index: frame.index,
      })
    ) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      handleNext();
    }, 2000 / Math.max(0.5, playbackSpeed));
    return () => window.clearTimeout(timer);
  }, [
    enabled,
    finalIsTyping,
    frame.currentStep?.type,
    frame.index,
    frame.showNextButton,
    handleNext,
    isAutoPlay,
    playbackSpeed,
    steps,
  ]);

  // 当前帧若仍是 scene_change（极端全 scene 列表），自动跳过
  useEffect(() => {
    if (!enabled) return;
    if (String(frame.currentStep?.type || '') !== 'scene_change') return;
    const next = advancePlaybackIndex(steps, frame.index);
    if (next == null || next === frame.index) return;
    setIndex(next);
    syncBackdrop(steps, next);
  }, [enabled, frame.currentStep, frame.index, steps, syncBackdrop]);

  return {
    index: frame.index,
    currentStep: frame.currentStep,
    currentMessage,
    finalDisplayText,
    finalIsTyping,
    showNextButton: frame.showNextButton,
    isFinished: frame.isFinished,
    isAutoPlay,
    setIsAutoPlay,
    playbackSpeed,
    setPlaybackSpeed,
    playbackSpeedOptions: [0.5, 1, 1.5, 2] as const,
    stepsCount: steps.length,
    backgroundImage,
    sceneName,
    handleNext,
    handleChoiceClick,
    seekTo: goToIndex,
    stepHandlers: {
      isWaitingForData,
      currentStep: frame.currentStep,
      showNextButton: frame.showNextButton,
      selectedOptionIndex: null as number | null,
    },
  };
}
