/**
 * 创作流程：统计缺立绘 / 缺场景背景 / 缺封面，供「素材待补齐」与发布前检查复用。
 * 张数必须来自编辑器真实角色/场景列表，禁止用弹窗预计默认值。
 */

export interface AssetCompletenessInput {
  /** world.player 整对象（兼容 image / images / imagePath） */
  player?: unknown;
  /** world.player.images 或等价结构（旧调用方仍可只传此字段） */
  playerImages?: unknown;
  /** npc 列表（含 images） */
  npcs?: Array<{ images?: unknown; image?: unknown; imagePath?: unknown } | null | undefined> | null;
  /** 场景列表（含 image / images） */
  scenes?: Array<{ image?: unknown; images?: unknown } | null | undefined> | null;
  /** 游戏封面 URL */
  coverUrl?: string | null;
  /** 竖版 3:4 封面 */
  portraitCoverUrl?: string | null;
}

export interface AssetCompletenessResult {
  missingPortraits: number;
  missingScenes: number;
  missingCover: boolean;
  /** 应有立绘总数（主角 + NPC） */
  portraitsTotal: number;
  /** 应有场景背景总数 */
  scenesTotal: number;
  totalMissing: number;
  hasGaps: boolean;
}

/** 功能注释：编辑器内真实已有图 / 应有图，供进度条与侧栏对齐。 */
export interface EditorAssetImageCounts {
  portraitsPresent: number;
  portraitsTotal: number;
  scenesPresent: number;
  scenesTotal: number;
  coverPresent: boolean;
}

const PLACEHOLDER_IMAGE_RE = /defaultNpc\.png|default.?npc|placeholder|创作界面切图/i;

/**
 * 功能注释：字符串是否为可用图路径（排除默认占位图）。
 */
export function isUsableImagePath(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return false;
  if (PLACEHOLDER_IMAGE_RE.test(trimmed)) return false;
  return true;
}

/**
 * 功能注释：从 images 对象 / 单字段 / {url} 中取可用图路径。
 */
export function resolveUsableImageRef(source: unknown): string | null {
  if (isUsableImagePath(source)) return String(source).trim();
  if (!source || typeof source !== 'object') return null;

  const record = source as Record<string, unknown>;
  const directKeys = ['base', 'Base', 'portrait', 'default', 'url', 'src', 'path', 'key', 'image', 'imagePath'];
  for (const key of directKeys) {
    if (isUsableImagePath(record[key])) return String(record[key]).trim();
  }

  for (const value of Object.values(record)) {
    if (isUsableImagePath(value)) return String(value).trim();
    if (value && typeof value === 'object') {
      const nested = resolveUsableImageRef(value);
      if (nested) return nested;
    }
  }
  return null;
}

/**
 * 功能注释：判断 images.base（或常见别名）是否为可用立绘路径。
 */
export function hasUsableBaseImage(images: unknown): boolean {
  return resolveUsableImageRef(images) != null;
}

/**
 * 功能注释：角色（主角或 NPC）是否已有可用立绘。
 */
export function hasUsableCharacterPortrait(entity: unknown): boolean {
  if (!entity || typeof entity !== 'object') {
    return hasUsableBaseImage(entity);
  }
  const record = entity as Record<string, unknown>;
  if (hasUsableBaseImage(record.images)) return true;
  if (isUsableImagePath(record.image)) return true;
  if (isUsableImagePath(record.imagePath)) return true;
  if (isUsableImagePath(record.portrait)) return true;
  return false;
}

/**
 * 功能注释：判断场景是否已有背景图（image 字符串或 images 结构）。
 */
export function hasUsableSceneImage(scene: { image?: unknown; images?: unknown } | null | undefined): boolean {
  if (!scene) return false;
  if (isUsableImagePath(scene.image)) return true;
  if (hasUsableBaseImage(scene.images)) return true;
  if (resolveUsableImageRef(scene.image)) return true;
  return false;
}

/**
 * 功能注释：汇总发布/提醒所需的素材缺口数量（按编辑器真实列表）。
 */
export function summarizeAssetCompleteness(input: AssetCompletenessInput): AssetCompletenessResult {
  const npcList = Array.isArray(input.npcs) ? input.npcs : [];
  const sceneList = Array.isArray(input.scenes) ? input.scenes : [];

  let missingPortraits = 0;
  const playerEntity = input.player
    ?? (input.playerImages != null ? { images: input.playerImages } : null);
  if (!hasUsableCharacterPortrait(playerEntity)) {
    missingPortraits += 1;
  }
  for (const npc of npcList) {
    if (!hasUsableCharacterPortrait(npc)) {
      missingPortraits += 1;
    }
  }

  let missingScenes = 0;
  for (const scene of sceneList) {
    if (!hasUsableSceneImage(scene)) {
      missingScenes += 1;
    }
  }

  const cover = typeof input.coverUrl === 'string' ? input.coverUrl.trim() : '';
  const portrait = typeof input.portraitCoverUrl === 'string' ? input.portraitCoverUrl.trim() : '';
  const missingCover = cover.length === 0 || portrait.length === 0;
  const portraitsTotal = 1 + npcList.length;
  const scenesTotal = sceneList.length;

  const totalMissing = missingPortraits + missingScenes + (missingCover ? 1 : 0);
  return {
    missingPortraits,
    missingScenes,
    missingCover,
    portraitsTotal,
    scenesTotal,
    totalMissing,
    hasGaps: totalMissing > 0,
  };
}

/**
 * 功能注释：统计编辑器里真实「已有图 / 应有图」，进度展示必须以此为准。
 */
export function countEditorAssetImages(input: AssetCompletenessInput): EditorAssetImageCounts {
  const summary = summarizeAssetCompleteness(input);
  return {
    portraitsPresent: Math.max(0, summary.portraitsTotal - summary.missingPortraits),
    portraitsTotal: summary.portraitsTotal,
    scenesPresent: Math.max(0, summary.scenesTotal - summary.missingScenes),
    scenesTotal: summary.scenesTotal,
    coverPresent: !summary.missingCover,
  };
}

type EditorCompleteLike = {
  worldSetting?: {
    player?: { images?: unknown; image?: unknown; imagePath?: unknown };
    cover_url?: string;
    coverUrl?: string;
  } | null;
  npcSetting?: { npcs?: Array<{ images?: unknown; image?: unknown; imagePath?: unknown }> } | null;
  sceneSetting?: { scenes?: Array<{ image?: unknown; images?: unknown }> } | null;
  cover_url?: string | null;
  coverUrl?: string | null;
  portrait_cover_url?: string | null;
  portraitCoverUrl?: string | null;
} | null | undefined;

function extractCompletenessInput(gameData: EditorCompleteLike): AssetCompletenessInput {
  if (!gameData) {
    return { player: null, playerImages: null, npcs: [], scenes: [], coverUrl: null, portraitCoverUrl: null };
  }
  const world = gameData.worldSetting || {};
  const coverUrl =
    gameData.cover_url
    || gameData.coverUrl
    || (world as { cover_url?: string }).cover_url
    || (world as { coverUrl?: string }).coverUrl
    || null;
  const portraitCoverUrl =
    gameData.portrait_cover_url
    || gameData.portraitCoverUrl
    || null;
  return {
    player: world.player || null,
    playerImages: world.player?.images,
    npcs: gameData.npcSetting?.npcs || [],
    scenes: gameData.sceneSetting?.scenes || [],
    coverUrl,
    portraitCoverUrl,
  };
}

/**
 * 功能注释：从 editor complete 数据结构抽取缺口统计。
 */
export function assetCompletenessFromEditorData(gameData: EditorCompleteLike): AssetCompletenessResult {
  if (!gameData) {
    return {
      missingPortraits: 0,
      missingScenes: 0,
      missingCover: true,
      portraitsTotal: 0,
      scenesTotal: 0,
      totalMissing: 1,
      hasGaps: true,
    };
  }
  return summarizeAssetCompleteness(extractCompletenessInput(gameData));
}

/** 功能注释：从 editor complete 统计真实场景/立绘张数。 */
export function editorAssetImageCountsFromEditorData(gameData: EditorCompleteLike): EditorAssetImageCounts {
  return countEditorAssetImages(extractCompletenessInput(gameData));
}

/**
 * 功能注释：job 进度与编辑器落盘张数对齐——completed 不得高于真实已有图。
 */
export function reconcileJobCountsWithEditorImages(input: {
  jobSuccess: number;
  jobFailed: number;
  jobTotal: number;
  editorPresent: number;
  editorTotal: number;
}): { completed: number; failed: number; total: number } {
  const editorTotal = Math.max(0, Number(input.editorTotal) || 0);
  const editorPresentRaw = Math.max(0, Number(input.editorPresent) || 0);
  const editorPresent = editorTotal > 0
    ? Math.min(editorPresentRaw, editorTotal)
    : editorPresentRaw;
  const jobTotal = Math.max(0, Number(input.jobTotal) || 0);
  const total = Math.max(editorTotal, jobTotal);
  // 真源：编辑器已有图；job 虚报成功时以编辑器为准
  const completed = editorTotal > 0
    ? editorPresent
    : Math.min(Math.max(0, Number(input.jobSuccess) || 0), total || Number(input.jobSuccess) || 0);
  const failed = Math.max(
    0,
    total > 0 ? total - completed : Math.max(0, Number(input.jobFailed) || 0),
  );
  return { completed, failed, total: total || completed + failed };
}
