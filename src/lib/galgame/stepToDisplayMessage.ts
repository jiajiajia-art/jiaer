/**
 * step → NormalMode 对话框 Message（纯函数，与 useGalgameMessage.convertStepToMessage 对齐）。
 * 图片 URL 解析通过可选 resolveImageUrl 注入，便于 Node 单测不依赖 Vite env。
 */

import { sanitizeVisualStepText } from '../../utils/textUtils.ts';
import { ensureMinPlayChoiceOptions } from './playChoiceOptions.ts';

export type DisplayMessage = {
  id: number;
  type: 'dialogue' | 'narration' | 'choice' | 'scene_change' | 'transition';
  message: string;
  characterName?: string;
  characterImage?: string;
  characterPosition?: 'left' | 'right';
  portraitScale?: number;
  portraitOffsetX?: number;
  portraitOffsetY?: number;
  options?: Array<{ id: number; text: string; isMain?: boolean }>;
};

export type StepToMessagePreset = {
  player?: {
    name?: string;
    /** 玩家立绘路径；由调用方用 getPlayerImageUrl 解析后也可直接塞 images */
    image?: string;
    images?: Record<string, string>;
    portraitScale?: number;
    portraitOffsetX?: number;
    portraitOffsetY?: number;
    [key: string]: unknown;
  } | null;
  npcs?: Array<{
    id?: string;
    images?: Record<string, string>;
    portraitScale?: number;
    portraitOffsetX?: number;
    portraitOffsetY?: number;
    [key: string]: unknown;
  }> | null;
};

export type ResolveDisplayImageUrl = (imagePath?: string | null) => string | undefined;

export type StepToMessageOptions = {
  messageId?: number;
  /** 默认原样返回路径；线上传入 getImageUrl+withCacheBust */
  resolveImageUrl?: ResolveDisplayImageUrl;
  /** 玩家立绘路径（与 getPlayerImageUrl 结果一致） */
  playerImagePath?: string | null;
  /** 不足 2 选项时用于语境补全 */
  npcNames?: string[] | null;
  /** 主角名：补选项时用「角色+动宾」 */
  playerName?: string | null;
};

function resolveNpcImagePath(
  step: Record<string, unknown>,
  npcsById: Map<string, NonNullable<StepToMessagePreset['npcs']>[number]>,
): string | undefined {
  const npcId = step.speakerId || step.npcId;
  const latestNpc = npcId ? npcsById.get(String(npcId)) : null;
  const latestImages = latestNpc?.images;

  if (latestImages && typeof latestImages === 'object') {
    const active = step.activeImage;
    if (typeof active === 'string' && latestImages[active]) {
      return latestImages[active];
    }
    if (latestImages.base) return latestImages.base;
    const first = Object.values(latestImages).find(
      (value): value is string => typeof value === 'string' && value.trim() !== '',
    );
    return first;
  }

  return typeof step.activeImage === 'string' ? step.activeImage : undefined;
}

function defaultResolveImageUrl(imagePath?: string | null): string | undefined {
  if (!imagePath) return undefined;
  const path = String(imagePath).trim();
  return path || undefined;
}

/**
 * 将回放/小说 step 转为对话框消息；scene_change 返回 null（应由播放层跳过）。
 */
export function stepToDisplayMessage(
  step: unknown,
  preset: StepToMessagePreset | null | undefined,
  options: StepToMessageOptions = {},
): DisplayMessage | null {
  if (!step || typeof step !== 'object') return null;
  let record = step as Record<string, unknown>;
  const type = String(record.type || '');
  if (type === 'scene_change') return null;

  const messageId = options.messageId ?? Date.now();
  const toDisplayImageUrl = options.resolveImageUrl ?? defaultResolveImageUrl;

  const stepText = sanitizeVisualStepText(
    String(record.content || record.text || record.message || ''),
  );
  if (typeof record.description === 'string') {
    record = { ...record, description: sanitizeVisualStepText(record.description) };
  }

  const player = preset?.player ?? null;
  const npcsById = new Map<string, NonNullable<StepToMessagePreset['npcs']>[number]>();
  (preset?.npcs || []).forEach((npc) => {
    if (npc?.id) npcsById.set(String(npc.id), npc);
  });

  if (type === 'narration') {
    return { id: messageId, type: 'narration', message: stepText };
  }

  if (type === 'transition') {
    return { id: messageId, type: 'transition', message: stepText };
  }

  if (type === 'dialogue') {
    const isPlayer = Boolean(record.isPlayer);
    const characterName = isPlayer
      ? String(record.speakerName || player?.name || '玩家').trim() || '玩家'
      : String(record.speakerName || record.npcId || '未知角色');
    let characterImage: string | undefined;
    let portraitScale: number | undefined;
    let portraitOffsetX: number | undefined;
    let portraitOffsetY: number | undefined;

    if (isPlayer) {
      const playerImagePath =
        options.playerImagePath
        || (typeof player?.image === 'string' ? player.image : undefined)
        || (typeof player?.images?.base === 'string' ? player.images.base : undefined);
      if (playerImagePath) characterImage = toDisplayImageUrl(playerImagePath);
      portraitScale = player?.portraitScale;
      portraitOffsetX = player?.portraitOffsetX;
      portraitOffsetY = player?.portraitOffsetY;
    } else {
      const npcImagePath = resolveNpcImagePath(record, npcsById);
      if (npcImagePath) characterImage = toDisplayImageUrl(npcImagePath);
      const npcId = record.speakerId || record.npcId;
      const npcData = npcId ? npcsById.get(String(npcId)) : null;
      portraitScale = npcData?.portraitScale;
      portraitOffsetX = npcData?.portraitOffsetX;
      portraitOffsetY = npcData?.portraitOffsetY;
    }

    if (!characterImage && typeof record.activeImage === 'string') {
      characterImage = toDisplayImageUrl(record.activeImage);
    }

    return {
      id: messageId,
      type: 'dialogue',
      message: stepText,
      characterName,
      characterImage,
      characterPosition: isPlayer ? 'right' : 'left',
      portraitScale,
      portraitOffsetX,
      portraitOffsetY,
    };
  }

  if (type === 'choice') {
    const rawMainOptions = Array.isArray(record.mainOptions)
      ? record.mainOptions
      : record.mainOption
        ? [record.mainOption]
        : [];
    const mainOptions = rawMainOptions.map((opt: unknown, index: number) => ({
      id: index + 1,
      text: sanitizeVisualStepText(
        String(typeof opt === 'string' ? opt : (opt as { text?: string })?.text || opt),
      ),
      isMain: true as const,
    }));
    const startId = mainOptions.length + 1;
    const rawOptions = Array.isArray(record.options) ? record.options : [];
    const normalOptions = rawOptions.map((opt: unknown, index: number) => ({
      id: startId + index,
      text: sanitizeVisualStepText(
        String(typeof opt === 'string' ? opt : (opt as { text?: string })?.text || opt),
      ),
      isMain: false as const,
    }));
    const optionsList = ensureMinPlayChoiceOptions([...mainOptions, ...normalOptions], {
      sceneName: typeof record.sceneName === 'string' ? record.sceneName : '',
      npcNames: Array.isArray(options.npcNames) ? options.npcNames : [],
      playerName: String(options.playerName || player?.name || '').trim() || '你',
    });
    const title = typeof record.title === 'string' ? record.title : '';
    const description = typeof record.description === 'string' ? record.description : '';
    const message = title
      ? description
        ? `${title}\n${description}`
        : title
      : description || '请选择你的行动';

    const playerImagePath =
      options.playerImagePath
      || (typeof player?.image === 'string' ? player.image : undefined)
      || (typeof player?.images?.base === 'string' ? player.images.base : undefined);

    return {
      id: messageId,
      type: 'choice',
      message,
      options: optionsList,
      characterImage: playerImagePath ? toDisplayImageUrl(playerImagePath) : undefined,
      characterPosition: 'right',
      portraitScale: player?.portraitScale,
      portraitOffsetX: player?.portraitOffsetX,
      portraitOffsetY: player?.portraitOffsetY,
    };
  }

  return null;
}
