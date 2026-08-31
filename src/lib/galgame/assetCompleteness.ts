/**
 * 创作流程：统计缺立绘 / 缺场景背景 / 缺封面，供「素材待补齐」与发布前检查复用。
 */

export interface AssetCompletenessInput {
  /** world.player.images 或等价结构 */
  playerImages?: unknown;
  /** npc 列表（含 images） */
  npcs?: Array<{ images?: unknown } | null | undefined> | null;
  /** 场景列表（含 image / images） */
  scenes?: Array<{ image?: unknown; images?: unknown } | null | undefined> | null;
  /** 游戏封面 URL */
  coverUrl?: string | null;
}

export interface AssetCompletenessResult {
  missingPortraits: number;
  missingScenes: number;
  missingCover: boolean;
  totalMissing: number;
  hasGaps: boolean;
}

/**
 * 功能注释：判断 images.base（或常见别名）是否为可用立绘路径。
 */
export function hasUsableBaseImage(images: unknown): boolean {
  if (!images || typeof images !== 'object') return false;
  const record = images as Record<string, unknown>;
  const base = record.base ?? record.Base ?? record.portrait;
  if (typeof base === 'string') return base.trim().length > 0;
  if (base && typeof base === 'object') {
    const obj = base as Record<string, unknown>;
    const url = obj.url || obj.src || obj.path || obj.key;
    return typeof url === 'string' && url.trim().length > 0;
  }
  return false;
}

/**
 * 功能注释：判断场景是否已有背景图（image 字符串或 images 结构）。
 */
export function hasUsableSceneImage(scene: { image?: unknown; images?: unknown } | null | undefined): boolean {
  if (!scene) return false;
  if (typeof scene.image === 'string' && scene.image.trim().length > 0) return true;
  if (hasUsableBaseImage(scene.images)) return true;
  if (typeof scene.images === 'string' && scene.images.trim().length > 0) return true;
  return false;
}

/**
 * 功能注释：汇总发布/提醒所需的素材缺口数量。
 */
export function summarizeAssetCompleteness(input: AssetCompletenessInput): AssetCompletenessResult {
  let missingPortraits = 0;
  if (!hasUsableBaseImage(input.playerImages)) {
    missingPortraits += 1;
  }
  const npcList = Array.isArray(input.npcs) ? input.npcs : [];
  for (const npc of npcList) {
    if (!hasUsableBaseImage(npc?.images)) {
      missingPortraits += 1;
    }
  }

  let missingScenes = 0;
  const sceneList = Array.isArray(input.scenes) ? input.scenes : [];
  for (const scene of sceneList) {
    if (!hasUsableSceneImage(scene)) {
      missingScenes += 1;
    }
  }

  const cover = typeof input.coverUrl === 'string' ? input.coverUrl.trim() : '';
  const missingCover = cover.length === 0;

  const totalMissing = missingPortraits + missingScenes + (missingCover ? 1 : 0);
  return {
    missingPortraits,
    missingScenes,
    missingCover,
    totalMissing,
    hasGaps: totalMissing > 0,
  };
}

/**
 * 功能注释：从 editor complete 数据结构抽取缺口统计输入。
 */
export function assetCompletenessFromEditorData(gameData: {
  worldSetting?: { player?: { images?: unknown }; cover_url?: string; coverUrl?: string } | null;
  npcSetting?: { npcs?: Array<{ images?: unknown }> } | null;
  sceneSetting?: { scenes?: Array<{ image?: unknown; images?: unknown }> } | null;
  cover_url?: string | null;
  coverUrl?: string | null;
} | null | undefined): AssetCompletenessResult {
  if (!gameData) {
    return {
      missingPortraits: 0,
      missingScenes: 0,
      missingCover: true,
      totalMissing: 1,
      hasGaps: true,
    };
  }
  const world = gameData.worldSetting || {};
  const coverUrl =
    gameData.cover_url
    || gameData.coverUrl
    || (world as { cover_url?: string }).cover_url
    || (world as { coverUrl?: string }).coverUrl
    || null;

  return summarizeAssetCompleteness({
    playerImages: world.player?.images,
    npcs: gameData.npcSetting?.npcs || [],
    scenes: gameData.sceneSetting?.scenes || [],
    coverUrl,
  });
}
