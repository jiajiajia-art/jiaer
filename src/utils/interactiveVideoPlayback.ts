export type InteractiveVideoPlaybackVideo = {
  source?: string;
  mediaId?: string;
  id?: string;
  path?: string;
  name?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  duration?: number;
  aspect?: 'portrait' | 'landscape';
  url?: string;
};

export type InteractiveVideoPlaybackSequenceSegment = {
  segmentId?: string;
  index?: number;
  status?: string;
  video?: InteractiveVideoPlaybackVideo;
};

export type InteractiveVideoPlaybackSequence = {
  status?: string;
  segments?: InteractiveVideoPlaybackSequenceSegment[];
};

export type InteractiveVideoPlaybackTarget = {
  data?: {
    video?: InteractiveVideoPlaybackVideo;
    videoSequence?: InteractiveVideoPlaybackSequence;
  };
  video?: InteractiveVideoPlaybackVideo;
  videoSequence?: InteractiveVideoPlaybackSequence;
} | null | undefined;

export const getInteractiveVideoTargetVideo = (
  target: InteractiveVideoPlaybackTarget,
): InteractiveVideoPlaybackVideo | undefined => target?.data?.video || target?.video;

export const getInteractiveVideoTargetVideoSequence = (
  target: InteractiveVideoPlaybackTarget,
): InteractiveVideoPlaybackSequence | undefined => target?.data?.videoSequence || target?.videoSequence;

export const getInteractiveVideoTargetVideoRefs = (
  target: InteractiveVideoPlaybackTarget,
): InteractiveVideoPlaybackVideo[] => {
  const sequence = getInteractiveVideoTargetVideoSequence(target);
  const sequenceVideos = Array.isArray(sequence?.segments)
    ? sequence.segments
        .slice()
        .sort((left, right) => Number(left.index ?? 0) - Number(right.index ?? 0))
        .map((segment) => segment.video)
        .filter((video): video is InteractiveVideoPlaybackVideo => Boolean(video))
    : [];

  if (sequenceVideos.length > 0) return sequenceVideos;

  const singleVideo = getInteractiveVideoTargetVideo(target);
  return singleVideo ? [singleVideo] : [];
};
