/**
 * 视觉小说「回放式」阅读：纯索引 / 场景 / 自动推进规则（无 React、无 DOM）。
 * 供 NovelReader NormalMode 与单测共用；与 useGalgameController 回放路径对齐。
 */

export type NovelPlaybackStepLike = {
  type?: string | null;
  sceneId?: string | null;
  sceneImage?: string | null;
  sceneName?: string | null;
  content?: string | null;
  text?: string | null;
  message?: string | null;
  [key: string]: unknown;
};

export type NovelPlaybackFrame = {
  index: number;
  currentStep: NovelPlaybackStepLike | null;
  showNextButton: boolean;
  isFinished: boolean;
};

export type SceneBackdropHint = {
  sceneId: string | null;
  sceneImage: string | null;
  sceneName: string | null;
};

/** scene_change 不停留在对话框，与回放控制器一致 */
export function shouldAutoSkipPlaybackStep(step: NovelPlaybackStepLike | null | undefined): boolean {
  return String(step?.type || '').trim() === 'scene_change';
}

export function clampPlaybackIndex(index: number, total: number): number {
  const n = Math.floor(Number(index));
  const t = Math.max(0, Math.floor(Number(total) || 0));
  if (!Number.isFinite(n) || t <= 0) return 0;
  if (n < 0) return 0;
  if (n >= t) return t - 1;
  return n;
}

/**
 * 从 requested 起跳过连续 scene_change，落到可展示 step。
 * 若全是 scene_change，返回最后一个下标（由 UI 再判结束）。
 */
export function resolveDisplayablePlaybackIndex(
  steps: NovelPlaybackStepLike[],
  requestedIndex: number,
): number {
  const total = Array.isArray(steps) ? steps.length : 0;
  if (total <= 0) return 0;
  let i = clampPlaybackIndex(requestedIndex, total);
  while (i < total - 1 && shouldAutoSkipPlaybackStep(steps[i])) {
    i += 1;
  }
  return i;
}

/** 目录跳转：先跳过章首 scene_change，再落到可展示帧（对齐 novelChapters.resolveReadableStepIndex） */
export function seekPlaybackIndex(steps: NovelPlaybackStepLike[], requestedIndex: number): number {
  const total = Array.isArray(steps) ? steps.length : 0;
  if (total <= 0) return 0;
  let index = clampPlaybackIndex(requestedIndex, total);
  while (index < total) {
    const type = String(steps[index]?.type || '').trim();
    if (type && type !== 'scene_change') break;
    index += 1;
  }
  if (index >= total) index = total - 1;
  return resolveDisplayablePlaybackIndex(steps, index);
}

/**
 * 推进到下一可展示 step；已无后续则返回 null。
 * 会跳过中间的 scene_change。
 */
export function advancePlaybackIndex(
  steps: NovelPlaybackStepLike[],
  currentIndex: number,
): number | null {
  const total = Array.isArray(steps) ? steps.length : 0;
  if (total <= 0) return null;
  let next = Math.floor(Number(currentIndex)) + 1;
  if (!Number.isFinite(next) || next < 0) next = 0;
  while (next < total && shouldAutoSkipPlaybackStep(steps[next])) {
    next += 1;
  }
  if (next >= total) return null;
  return next;
}

export function buildPlaybackFrame(
  steps: NovelPlaybackStepLike[],
  index: number,
): NovelPlaybackFrame {
  const total = Array.isArray(steps) ? steps.length : 0;
  if (total <= 0) {
    return { index: 0, currentStep: null, showNextButton: false, isFinished: true };
  }
  const safeIndex = resolveDisplayablePlaybackIndex(steps, index);
  const currentStep = steps[safeIndex] ?? null;
  const type = String(currentStep?.type || '');
  const showNextButton = Boolean(currentStep) && type !== 'choice';
  const hasMore = advancePlaybackIndex(steps, safeIndex) !== null;
  return {
    index: safeIndex,
    currentStep,
    showNextButton,
    isFinished: !currentStep || (!hasMore && type !== 'choice'),
  };
}

/** 从当前下标向前找最近一次 scene_change，取背景提示 */
export function findSceneBackdropAtIndex(
  steps: NovelPlaybackStepLike[],
  index: number,
): SceneBackdropHint | null {
  const total = Array.isArray(steps) ? steps.length : 0;
  if (total <= 0) return null;
  const start = clampPlaybackIndex(index, total);
  for (let i = start; i >= 0; i -= 1) {
    const step = steps[i];
    if (!shouldAutoSkipPlaybackStep(step)) continue;
    return {
      sceneId: step?.sceneId != null ? String(step.sceneId) : null,
      sceneImage: typeof step?.sceneImage === 'string' && step.sceneImage ? step.sceneImage : null,
      sceneName: typeof step?.sceneName === 'string' && step.sceneName ? step.sceneName : null,
    };
  }
  return null;
}

/** 从 scene.image / scene.images 取可用路径（兼容 string 与 {base,active,...}） */
export function pickFirstImageUrl(value: unknown): string | null {
  if (typeof value === 'string') {
    const clean = value.trim();
    return clean || null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  for (const preferredKey of ['active', 'base', 'default', 'cover']) {
    const candidate = record[preferredKey];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  for (const candidate of Object.values(record)) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

/** preset scene → 图片路径（与回放 / 后端 resolveSceneImage 一致） */
export function resolveSceneImagePathFromPreset(scene: unknown): string | undefined {
  if (!scene || typeof scene !== 'object') return undefined;
  const record = scene as Record<string, unknown>;
  return pickFirstImageUrl(record.image) || pickFirstImageUrl(record.images) || undefined;
}

export function resolveBackdropImagePath(
  hint: SceneBackdropHint | null,
  scenesById: Map<string, unknown> | null | undefined,
): string | null {
  if (!hint) return null;
  if (hint.sceneId && scenesById?.has(hint.sceneId)) {
    const fromPreset = resolveSceneImagePathFromPreset(scenesById.get(hint.sceneId));
    if (fromPreset) return fromPreset;
  }
  return hint.sceneImage;
}

/**
 * 功能注释：无 scene_change 回溯时，用原作场景表兜底（与 AI 文游一致），禁止用宣传封面冒充场景底图。
 */
export function resolveFallbackSceneBackdrop(
  scenesList: Array<{ id?: string; name?: string; image?: unknown; images?: unknown }> | null | undefined,
): SceneBackdropHint | null {
  const list = Array.isArray(scenesList) ? scenesList : [];
  if (list.length === 0) return null;

  const withImage =
    list.find((scene) => Boolean(resolveSceneImagePathFromPreset(scene))) || list[0];
  if (!withImage) return null;

  return {
    sceneId: withImage.id != null ? String(withImage.id) : null,
    sceneImage: resolveSceneImagePathFromPreset(withImage) || null,
    sceneName: typeof withImage.name === 'string' && withImage.name ? withImage.name : null,
  };
}

export type AutoAdvanceGateInput = {
  isAutoPlay: boolean;
  isTyping: boolean;
  showNextButton: boolean;
  stepType?: string | null;
  index: number;
};

/** 回放自动播放门禁：非打字、可 next、非选项、且仍有下一可展示帧 */
export function canAutoAdvanceWithSteps(
  steps: NovelPlaybackStepLike[],
  input: AutoAdvanceGateInput,
): boolean {
  if (!input.isAutoPlay || input.isTyping || !input.showNextButton) return false;
  if (String(input.stepType || '') === 'choice') return false;
  return advancePlaybackIndex(steps, input.index) !== null;
}

/**
 * 窗口缓冲 → 从 0 起的连续已加载前缀（遇到空洞即停）。
 * 回放式阅读只推进已加载前缀，末尾触发上层预取。
 */
export function contiguousLoadedStepsFromBuffer(
  stepsByIndex: Map<number, unknown> | null | undefined,
  totalStepCount: number,
): NovelPlaybackStepLike[] {
  const total = Math.max(0, Math.floor(Number(totalStepCount) || 0));
  if (!stepsByIndex || total <= 0) return [];
  const out: NovelPlaybackStepLike[] = [];
  for (let i = 0; i < total; i += 1) {
    if (!stepsByIndex.has(i)) break;
    out.push(stepsByIndex.get(i) as NovelPlaybackStepLike);
  }
  return out;
}

/** 播放头接近已加载末尾时需要预取（剩余 ≤ threshold） */
export function shouldPrefetchPlaybackWindow(
  loadedCount: number,
  playbackIndex: number,
  totalStepCount: number,
  threshold = 20,
): boolean {
  const loaded = Math.max(0, Math.floor(Number(loadedCount) || 0));
  const index = Math.floor(Number(playbackIndex));
  const total = Math.max(0, Math.floor(Number(totalStepCount) || 0));
  if (loaded <= 0 || total <= 0) return false;
  if (loaded >= total) return false;
  if (!Number.isFinite(index) || index < 0) return false;
  return index >= loaded - Math.max(1, threshold);
}
