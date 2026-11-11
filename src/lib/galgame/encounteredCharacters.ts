/**
 * 出场角色：从叙事 step / 场景 NPC 列表累计 id；再与 NPC 资料表拼详情字段。
 */

export interface NarrativeStepLike {
  type?: string;
  npcId?: string;
  speakerId?: string;
  speakerName?: string;
  isPlayer?: boolean;
  sceneId?: string;
  isNonPredefinedNPC?: boolean;
}

export interface SceneLike {
  id?: string;
  npcs?: string[];
}

export interface NpcProfileLike {
  id?: string;
  name?: string;
  gender?: string;
  job?: string;
  description?: string;
  background?: string;
  appearance?: string;
  personality?: string;
  tone?: string;
  relationship?: string;
  dialogue?: string[] | string;
  images?: { base?: string; [key: string]: string | undefined };
}

/** 功能注释：主角资料（世界 player），用于角色档案收录玩家本人。 */
export interface PlayerProfileLike {
  id?: string;
  name?: string;
  job?: string;
  description?: string;
  personality?: string;
  images?: NpcProfileLike['images'];
}

export interface CharacterPanelItem {
  id: string;
  name: string;
  identity: string;
  description: string;
  personality: string;
  memories: string[];
  avatarUrl: string;
}

export const PLAYER_ENCOUNTER_ID = 'player';
export const NAME_ENCOUNTER_PREFIX = 'name:';

function normalizePersonName(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

/** 功能注释：从对话 step 收集非玩家 NPC id（npcId 优先，否则 speakerId）。 */
export function collectNpcIdsFromSteps(steps: NarrativeStepLike[] | null | undefined): string[] {
  if (!Array.isArray(steps)) return [];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const step of steps) {
    if (!step || typeof step !== 'object') continue;
    if (step.isPlayer === true) continue;
    const type = String(step.type || 'dialogue');
    if (type !== 'dialogue') continue;
    const raw = String(step.npcId || step.speakerId || '').trim();
    if (!raw || raw === 'player' || raw === 'narrator') continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    ids.push(raw);
  }
  return ids;
}

/** 功能注释：场景切换时把场景配置的 npcs[] 并入出场集合。 */
export function collectNpcIdsFromSceneChange(
  steps: NarrativeStepLike[] | null | undefined,
  scenes: SceneLike[] | null | undefined
): string[] {
  if (!Array.isArray(steps) || !Array.isArray(scenes)) return [];
  const sceneById = new Map(
    scenes
      .filter((s) => s && s.id)
      .map((s) => [String(s.id), s] as const)
  );
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const step of steps) {
    if (!step || step.type !== 'scene_change') continue;
    const scene = sceneById.get(String(step.sceneId || ''));
    const list = Array.isArray(scene?.npcs) ? scene!.npcs! : [];
    for (const npcId of list) {
      const id = String(npcId || '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/** 功能注释：有序去重合并出场 id（保留先出现顺序）。 */
export function mergeEncounteredIds(...lists: Array<string[] | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      const id = String(raw || '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * 功能注释：按姓名匹配补齐出场。
 * - 无 id 的发言名 → 对齐世界 NPC
 * - id 不在 NPC 表时再用姓名回退（修 AI 写错 sceneId/npcId 的情况）
 * - 玩家台词若姓名能对齐 NPC，也收录（主角常在人物表）
 */
export function matchNpcIdsBySpeakerNames(
  steps: NarrativeStepLike[] | null | undefined,
  npcs: NpcProfileLike[] | null | undefined
): string[] {
  if (!Array.isArray(steps) || !Array.isArray(npcs)) return [];
  const byName = new Map<string, string>();
  const knownIds = new Set<string>();
  for (const npc of npcs) {
    const name = normalizePersonName(npc?.name);
    const id = String(npc?.id || '').trim();
    if (id) knownIds.add(id);
    if (name && id && !byName.has(name)) byName.set(name, id);
  }
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const step of steps) {
    if (!step || typeof step !== 'object') continue;
    const type = String(step.type || 'dialogue');
    if (type !== 'dialogue') continue;
    const rawId = String(step.npcId || step.speakerId || '').trim();
    // 已是合法 NPC id 则无需姓名回退
    if (rawId && rawId !== 'player' && rawId !== 'narrator' && knownIds.has(rawId)) continue;
    const name = normalizePersonName(step.speakerName || (!knownIds.has(rawId) ? rawId : ''));
    if (!name) continue;
    const id = byName.get(name);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

/**
 * 功能注释：对话里出现过、但世界表没有的角色，用 name:姓名 占位，保证档案可见。
 */
export function collectUnmatchedSpeakerNameIds(
  steps: NarrativeStepLike[] | null | undefined,
  npcs: NpcProfileLike[] | null | undefined
): string[] {
  if (!Array.isArray(steps)) return [];
  const knownIds = new Set(
    (Array.isArray(npcs) ? npcs : [])
      .map((n) => String(n?.id || '').trim())
      .filter(Boolean)
  );
  const knownNames = new Set(
    (Array.isArray(npcs) ? npcs : [])
      .map((n) => normalizePersonName(n?.name))
      .filter(Boolean)
  );
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const step of steps) {
    if (!step || typeof step !== 'object') continue;
    if (String(step.type || 'dialogue') !== 'dialogue') continue;
    if (step.isPlayer === true || step.speakerId === 'player') continue;
    const rawId = String(step.npcId || step.speakerId || '').trim();
    if (rawId && (rawId === 'narrator' || knownIds.has(rawId))) continue;
    // 功能注释：仅用可读 speakerName 做占位，避免把裸 id 再写成 name:xxx 重复。
    const displayName = String(step.speakerName || '').trim();
    const normalized = normalizePersonName(displayName);
    if (!normalized || knownNames.has(normalized)) continue;
    const stubId = `${NAME_ENCOUNTER_PREFIX}${displayName}`;
    if (seen.has(stubId)) continue;
    seen.add(stubId);
    ids.push(stubId);
  }
  return ids;
}

/**
 * 功能注释：主角开过口则收录进档案（优先人物表同名 NPC，否则用 player 占位）。
 */
export function collectProtagonistEncounterId(
  steps: NarrativeStepLike[] | null | undefined,
  npcs: NpcProfileLike[] | null | undefined,
  player?: PlayerProfileLike | null
): string[] {
  if (!Array.isArray(steps)) return [];
  const hasPlayerLine = steps.some(
    (step) =>
      step
      && String(step.type || '') === 'dialogue'
      && (step.isPlayer === true || String(step.speakerId || '') === 'player')
  );
  if (!hasPlayerLine) return [];

  const playerName =
    String(player?.name || '').trim()
    || String(
      steps.find(
        (s) => s && (s.isPlayer === true || s.speakerId === 'player') && s.speakerName
      )?.speakerName || ''
    ).trim();

  const normalized = normalizePersonName(playerName);
  if (normalized && Array.isArray(npcs)) {
    for (const npc of npcs) {
      if (normalizePersonName(npc?.name) === normalized && String(npc?.id || '').trim()) {
        return [String(npc.id).trim()];
      }
    }
  }
  return [PLAYER_ENCOUNTER_ID];
}

/**
 * 功能注释：一次解析出本局应展示的出场 id（对话 id + 场景 + 姓名回退 + 主角 + 无名氏占位）。
 */
export function resolveEncounteredCharacterIds(
  steps: NarrativeStepLike[] | null | undefined,
  scenes: SceneLike[] | null | undefined,
  npcs: NpcProfileLike[] | null | undefined,
  player?: PlayerProfileLike | null,
  previousIds?: string[] | null
): string[] {
  return mergeEncounteredIds(
    previousIds,
    collectNpcIdsFromSteps(steps),
    collectNpcIdsFromSceneChange(steps, scenes),
    matchNpcIdsBySpeakerNames(steps, npcs),
    collectProtagonistEncounterId(steps, npcs, player),
    collectUnmatchedSpeakerNameIds(steps, npcs)
  );
}

function asMemoryList(dialogue: NpcProfileLike['dialogue']): string[] {
  if (Array.isArray(dialogue)) {
    return dialogue.map((line) => String(line || '').trim()).filter(Boolean);
  }
  const text = String(dialogue || '').trim();
  return text ? [text] : [];
}

/**
 * 功能注释：优先肖像/表情键，再退回 base；供列表头像正方形顶对齐裁切。
 */
export function pickNpcAvatarPath(images: NpcProfileLike['images'] | null | undefined): string {
  if (!images || typeof images !== 'object') return '';
  const preferredKeys = ['portrait', 'face', 'bust', 'closeup', 'base', 'happy', 'serious', 'normal'];
  for (const key of preferredKeys) {
    const value = images[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  for (const value of Object.values(images)) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function resolveAvatarUrl(
  images: NpcProfileLike['images'] | null | undefined,
  resolveUrl?: (path: string) => string
): string {
  const avatarPath = pickNpcAvatarPath(images);
  if (!avatarPath) return '';
  return String(resolveUrl ? resolveUrl(avatarPath) : avatarPath).trim();
}

/** 功能注释：出场 id → 角色面板项（姓名/身份必填展示字段；性格/记忆可空）。 */
export function buildCharacterPanelItems(
  encounteredIds: string[] | null | undefined,
  npcs: NpcProfileLike[] | null | undefined,
  resolveUrl?: (path: string) => string,
  player?: PlayerProfileLike | null
): CharacterPanelItem[] {
  if (!Array.isArray(encounteredIds)) return [];
  const list = Array.isArray(npcs) ? npcs : [];
  const byId = new Map(
    list
      .filter((n) => n && String(n.id || '').trim())
      .map((n) => [String(n.id).trim(), n] as const)
  );
  const items: CharacterPanelItem[] = [];
  for (const rawId of encounteredIds) {
    const id = String(rawId || '').trim();
    if (!id) continue;

    if (id === PLAYER_ENCOUNTER_ID) {
      const name = String(player?.name || '').trim() || '主角';
      items.push({
        id,
        name,
        identity: String(player?.job || '').trim(),
        description: String(player?.description || '').trim(),
        personality: String(player?.personality || '').trim(),
        memories: [],
        avatarUrl: resolveAvatarUrl(player?.images, resolveUrl),
      });
      continue;
    }

    if (id.startsWith(NAME_ENCOUNTER_PREFIX)) {
      const name = id.slice(NAME_ENCOUNTER_PREFIX.length).trim();
      if (!name) continue;
      items.push({
        id,
        name,
        identity: '',
        description: '',
        personality: '',
        memories: [],
        avatarUrl: '',
      });
      continue;
    }

    const npc = byId.get(id);
    if (!npc) continue;
    items.push({
      id,
      name: String(npc.name || '').trim() || id,
      identity: String(npc.job || '').trim(),
      description: String(npc.description || '').trim(),
      personality: String(npc.personality || '').trim(),
      memories: asMemoryList(npc.dialogue),
      avatarUrl: resolveAvatarUrl(npc.images, resolveUrl),
    });
  }
  return items;
}
