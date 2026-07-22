export type InteractiveVideoPlaybackMode = 'fresh' | 'replay';

export const PLAYBACK_RATE_OPTIONS = [1, 1.25, 1.5, 2] as const;

export type InteractiveVideoPlaybackRate = typeof PLAYBACK_RATE_OPTIONS[number];

export function normalizePlaybackRate(value: number): InteractiveVideoPlaybackRate {
  return PLAYBACK_RATE_OPTIONS.includes(value as InteractiveVideoPlaybackRate)
    ? value as InteractiveVideoPlaybackRate
    : 1;
}

export function getNextPlaybackRate(currentRate: number): InteractiveVideoPlaybackRate {
  const normalized = normalizePlaybackRate(currentRate);
  const currentIndex = PLAYBACK_RATE_OPTIONS.indexOf(normalized);
  return PLAYBACK_RATE_OPTIONS[(currentIndex + 1) % PLAYBACK_RATE_OPTIONS.length];
}

export function canShowSkipControl(playbackMode: InteractiveVideoPlaybackMode): boolean {
  return playbackMode === 'replay';
}
