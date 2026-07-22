export type InteractiveVideoAspect = 'unknown' | 'portrait' | 'landscape';
export type InteractiveVideoViewportMode = 'desktop' | 'mobilePortrait' | 'mobileLandscape';
export type InteractiveVideoPlaybackOrientation = Exclude<InteractiveVideoAspect, 'unknown'>;

export function getVideoAspectFromDimensions(width: number, height: number): InteractiveVideoAspect {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 'unknown';
  return width > height ? 'landscape' : 'portrait';
}

export function normalizeVideoAspect(value: unknown): InteractiveVideoAspect {
  const aspect = String(value || '').trim().toLowerCase();
  return aspect === 'landscape' || aspect === 'portrait' ? aspect : 'unknown';
}

export function shouldRotateMobileLandscapeVideo({
  viewportMode,
  videoAspect,
  hasVideo,
}: {
  viewportMode: InteractiveVideoViewportMode;
  videoAspect: InteractiveVideoAspect;
  hasVideo: boolean;
}): boolean {
  return hasVideo && viewportMode === 'mobilePortrait' && videoAspect === 'landscape';
}

export function resolveInteractiveVideoImmersiveAspect({
  mediaAspect,
  playbackOrientation,
  hasImmersiveMedia,
}: {
  mediaAspect: InteractiveVideoAspect;
  playbackOrientation: InteractiveVideoPlaybackOrientation;
  hasImmersiveMedia: boolean;
}): InteractiveVideoAspect {
  if (!hasImmersiveMedia) return 'unknown';
  return mediaAspect === 'unknown' ? playbackOrientation : mediaAspect;
}
