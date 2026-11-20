import type { AvatarSlot } from "../lib/types";
import { resolveAvatarMatchPrefs } from "../lib/types";
import { getWorldNpcs, getWorldSlot } from "../mods/registry";
import { loadGlobal, saveGlobal } from "../lib/saveScope";
import { filterPlatformAvatarItems, getCachedPlatformAvatarItems, groupPlatformAvatars, platformAvatarDisplayUrl } from "../lib/platformAvatarLibrary";

/* ═══ 头像池 ═══
 * 我的头像池：账号级（本机），跨剧本可见；每个剧本在自己的 avatars 槽里单独勾「玩家可选 / 随机池」，
 *   不会把别的剧本开过的池自动开放给本剧玩家。
 * 系统头像库：只对接平台 /api/avatar-library（公共+系统）；禁止 Unsplash 假数据。
 * 池名即 avatarVariant（须完全一致）：人物 / AI 新人物写了 avatarVariant 就从同名池里抽。 */
export type AvatarPool = { id: string; name: string; images: string[]; at: number };
export type AvatarSource = { name: string; images: string[]; source: "mine" | "public"; hint?: string };
export const AVATAR_POOLS_EVENT = "star:avatarPools";
const KEY = "star2005.avatarPools.v1";

export function readAvatarPools(): AvatarPool[] {
  const v = loadGlobal<unknown>(KEY, []);
  return Array.isArray(v)
    ? v.filter((p): p is AvatarPool => !!p && typeof p.name === "string" && Array.isArray(p.images)).map((p) => ({ ...p, images: p.images.filter((x) => typeof x === "string" && !!x) }))
    : [];
}
/** 写回账号头像池；本地存储满时返回 false */
export function writeAvatarPools(list: AvatarPool[]): boolean {
  const ok = saveGlobal(KEY, list);
  if (ok) window.dispatchEvent(new Event(AVATAR_POOLS_EVENT));
  return ok;
}

/**
 * 平台公共分类元数据（仅名称/提示，无图）。
 * 编辑器「随机池」勾选与 avatarVariant 联想用；游玩展示图一律来自平台入库缓存。
 */
export const PUBLIC_AVATAR_CATS: { id: string; name: string; hint: string }[] = [
  { id: "female-adult", name: "青年女性", hint: "女 · 成年" },
  { id: "male-adult", name: "青年男性", hint: "男 · 成年" },
  { id: "female-elder", name: "成熟女性", hint: "女 · 老年" },
  { id: "male-elder", name: "成熟男性", hint: "男 · 老年" },
  { id: "female-child", name: "幼年女性", hint: "女 · 幼年" },
  { id: "male-child", name: "幼年男性", hint: "男 · 幼年" },
];
export const PUBLIC_AVATAR_NAMES = new Set(PUBLIC_AVATAR_CATS.map((c) => c.name));

/** 平台头像库缓存（由 AvatarLibraryPicker / 预拉取写入） */
let platformSystemPoolsCache: AvatarSource[] | null = null;
let platformSystemPoolsLoaded = false;

export function setPlatformSystemPoolsCache(pools: AvatarSource[] | null) {
  platformSystemPoolsLoaded = true;
  platformSystemPoolsCache = Array.isArray(pools) ? pools : [];
  window.dispatchEvent(new Event(AVATAR_POOLS_EVENT));
}

export function getPlatformSystemPoolsCache(): AvatarSource[] | null {
  return platformSystemPoolsLoaded ? (platformSystemPoolsCache || []) : null;
}

/** 测试/热更新：重置平台缓存加载态 */
export function resetPlatformSystemPoolsCacheForTests() {
  platformSystemPoolsLoaded = false;
  platformSystemPoolsCache = null;
}

const cur = (slot?: AvatarSlot | null) => (slot === undefined ? getWorldSlot("avatars") : slot ?? undefined);
/** 功能注释：池 images 偶发 undefined；禁止 filter 里读 .length 崩建角头像库 */
const hasImages = (p: { images?: unknown }): p is { images: string[] } => Array.isArray(p.images) && p.images.length > 0;
const mine = (slot: AvatarSlot | undefined, on: (t: { pick?: boolean; random?: boolean }) => boolean | undefined, lib = readAvatarPools()): AvatarSource[] =>
  lib.filter((p) => hasImages(p) && slot?.pools?.[p.name] && on(slot.pools[p.name])).map((p) => ({ name: p.name, images: p.images, source: "mine" }));

/** 游玩端「创作者头像库」：本剧勾了「玩家可选」的我的头像池 */
export const creatorPickPools = (slot?: AvatarSlot | null) => mine(cur(slot), (t) => t.pick);

/**
 * 游玩端「系统头像库」：仅平台 avatar-library 缓存；未加载或空则 []，禁止假图兜底。
 */
export const systemPools = (): AvatarSource[] => {
  if (!platformSystemPoolsLoaded) return [];
  return platformSystemPoolsCache || [];
};

/**
 * 功能注释：本剧勾选的官方风格库 id。
 * stylePacks 是数组（含空数组）= 创作者明确选过。
 * 还没写过 = 全部风格库，老作品不会突然没头像。publicRandom 里的年龄段名字不再当开关。
 */
export function enabledStylePackIds(slot?: AvatarSlot | null): { ids: Set<string>; all: boolean } {
  const s = cur(slot);
  if (Array.isArray(s?.stylePacks)) {
    return {
      all: false,
      ids: new Set(s.stylePacks.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean)),
    };
  }
  return { all: true, ids: new Set() };
}

/** 功能注释：本剧实际可用的平台头像。先按风格库收图，再按性别×年龄分桶，方便人物自动对上。 */
export function platformPoolsForSlot(
  slot?: AvatarSlot | null,
  browse?: { stylePack?: string; background?: string },
): AvatarSource[] {
  const items = getCachedPlatformAvatarItems();
  const sel = enabledStylePackIds(slot);
  const one = String(browse?.stylePack || "").trim();
  const background = String(browse?.background || "").trim();
  if (!items.length) {
    if (!platformSystemPoolsLoaded || one || background || !sel.all) return [];
    return systemPools().filter(hasImages);
  }
  let stylePacks: string[] | undefined;
  if (!sel.all) {
    const ids = [...sel.ids];
    stylePacks = one ? ids.filter((id) => id === one) : ids;
  } else if (one) {
    stylePacks = [one];
  }
  return groupPlatformAvatars(items, { stylePacks, background }).filter(hasImages);
}

/** AI 新增人脉的抽图范围：本剧勾了「随机池」的我的头像池 + 已选官方风格库里的图；顺序尊重剧本 match.prefer */
export function randomPools(slot?: AvatarSlot | null): AvatarSource[] {
  const s = cur(slot);
  const creator = mine(s, (t) => t.random);
  const { prefer } = resolveAvatarMatchPrefs(s);
  // 功能注释：公共库优先只决定谁排前面；平台图已经按本剧风格库筛过
  const platform = platformPoolsForSlot(s);
  return prefer === "public" ? [...platform, ...creator] : [...creator, ...platform];
}

/** 按 avatarVariant 精确找池：顺序尊重剧本 match.prefer（私人/公共），系统库作同名回退 */
export function variantPool(name: string | undefined, slot?: AvatarSlot | null): AvatarSource | undefined {
  if (!name) return undefined;
  const s = cur(slot);
  const creatorHit = mine(s, (t) => t.pick || t.random).find((p) => p.name === name);
  const systemHit = platformPoolsForSlot(s).find((p) => p.name === name);
  const { prefer } = resolveAvatarMatchPrefs(s);
  if (prefer === "public") return systemHit || creatorHit;
  return creatorHit || systemHit;
}

/** 本剧可用作 avatarVariant 的全部池名（编辑器联想 / 校验用）：私人已开的池 + 风格库里实际有图的性别年龄档 */
export const variantNames = (slot?: AvatarSlot | null) => {
  const s = cur(slot);
  const fromPlatform = platformPoolsForSlot(s).map((p) => p.name);
  const pubNames = fromPlatform.length ? fromPlatform : PUBLIC_AVATAR_CATS.map((c) => c.name);
  return [...mine(s, (t) => t.pick || t.random).map((p) => p.name), ...pubNames];
};

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

const keyUrl = (url?: string) => {
  const u = typeof url === "string" ? url.trim() : "";
  return u ? `u:${u}` : "";
};
const keyId = (id?: string) => {
  const s = typeof id === "string" ? id.trim() : "";
  return s ? `id:${s}` : "";
};

/** 功能注释：平台图的展示地址反查条目 id。没有入库 id 的本地图返回空串 */
export function assetIdForAvatarUrl(url?: string): string {
  const u = typeof url === "string" ? url.trim() : "";
  if (!u) return "";
  for (const it of getCachedPlatformAvatarItems()) {
    if (it.id && platformAvatarDisplayUrl(it) === u) return it.id;
  }
  return "";
}

function isTaken(taken: ReadonlySet<string> | undefined, assetId: string, url: string): boolean {
  if (!taken?.size) return false;
  const id = keyId(assetId);
  const u = keyUrl(url);
  return (!!id && taken.has(id)) || (!!u && taken.has(u));
}

/** 功能注释：本局已经用掉的头像。平台条目记 id，本地图记地址。selfUrl 留一张给当前这个人自己 */
export function takenAvatarKeys(
  people: readonly { avatar?: string; avatarAssetId?: string }[] | undefined,
  selfUrl?: string,
): Set<string> {
  const out = new Set<string>();
  let skippedSelf = false;
  const self = typeof selfUrl === "string" ? selfUrl.trim() : "";
  for (const p of people ?? []) {
    const url = typeof p.avatar === "string" ? p.avatar.trim() : "";
    if (!skippedSelf && self && url === self) {
      skippedSelf = true;
      continue;
    }
    const u = keyUrl(url);
    if (u) out.add(u);
    const id = keyId(p.avatarAssetId) || keyId(assetIdForAvatarUrl(url));
    if (id) out.add(id);
  }
  return out;
}

export function rememberAvatarUse(taken: Set<string>, url?: string, assetId?: string) {
  const u = keyUrl(url);
  if (u) taken.add(u);
  const id = keyId(assetId) || keyId(assetIdForAvatarUrl(url));
  if (id) taken.add(id);
}

type AvatarPick = { url: string; variant?: string; assetId?: string };

function pickFree(seed: string, rows: { url: string; assetId?: string; variant?: string }[], taken?: ReadonlySet<string>): AvatarPick {
  const free = rows.filter((r) => r.url && !isTaken(taken, r.assetId || "", r.url));
  if (!free.length) return { url: "" };
  const row = free[hash(seed) % free.length];
  return { url: row.url, ...(row.variant ? { variant: row.variant } : {}), ...(row.assetId ? { assetId: row.assetId } : {}) };
}

/** 按种子（人物 id）确定性抽一张：有 variant 只从同名池抽；本局用过的头像 id / 地址跳过 */
export function drawAvatar(seed: string, variant?: string, strict = false, slot?: AvatarSlot | null, taken?: ReadonlySet<string>): AvatarPick {
  const hit = variantPool(variant?.trim(), slot);
  if (hit) {
    const rows = hit.images.map((url) => ({ url, assetId: assetIdForAvatarUrl(url), variant: hit.name }));
    return pickFree(seed, rows, taken);
  }
  if (strict) return { url: "" };
  const all = randomPools(slot).flatMap((p) => (Array.isArray(p.images) ? p.images : []).map((url) => ({ url, assetId: assetIdForAvatarUrl(url), variant: p.name })));
  return pickFree(seed, all, taken);
}

export { guessAvatarCategory, guessAvatarDims } from "./avatarCategory";
import { guessAvatarCategory, guessAvatarDims } from "./avatarCategory";

function pickHashed(seed: string, rows: { url: string; assetId?: string }[], variant?: string, taken?: ReadonlySet<string>): AvatarPick {
  return pickFree(seed, rows.map((r) => ({ ...r, variant })), taken);
}

/** 功能注释：已选风格库里，按性别 × 年龄取还没人用过的图。勾了通用兜底时，同年龄的「通用」性别可以补上。用完就空，不拿别的年龄凑，也不重复同一张 */
function drawStyledProfile(
  seed: string,
  p: { name?: string; age?: string | number; identity?: string; bio?: string; gender?: string },
  slot?: AvatarSlot | null,
  taken?: ReadonlySet<string>,
): AvatarPick {
  const items = getCachedPlatformAvatarItems();
  if (!items.length) return { url: "" };
  const sel = enabledStylePackIds(slot);
  const filtered = filterPlatformAvatarItems(items, sel.all ? {} : { stylePacks: [...sel.ids] });
  const dims = guessAvatarDims(p);
  const cat = guessAvatarCategory(p);
  const toRow = (it: { id?: string; imageUrl?: string; originalUrl?: string; thumbUrl?: string }) => ({
    url: platformAvatarDisplayUrl(it as Parameters<typeof platformAvatarDisplayUrl>[0]),
    assetId: it.id,
  });
  const exact = filtered.filter((it) => it.gender === dims.gender && it.ageGroup === dims.ageGroup).map(toRow);
  const hit = pickHashed(seed, exact, cat, taken);
  if (hit.url) return hit;
  if (!resolveAvatarMatchPrefs(cur(slot)).allowUniversalFallback) return { url: "" };
  const uni = filtered.filter((it) => it.gender === "universal" && it.ageGroup === dims.ageGroup).map(toRow);
  return pickHashed(`${seed}:uni`, uni, cat, taken);
}

function drawCreatorRandom(seed: string, slot?: AvatarSlot | null, taken?: ReadonlySet<string>): AvatarPick {
  const pools = mine(cur(slot), (t) => t.random);
  const all = pools.flatMap((p) => (Array.isArray(p.images) ? p.images : []).map((url) => ({ url, variant: p.name })));
  return pickFree(seed, all, taken);
}

/**
 * 功能注释：新人物头像只由代码匹配，不读模型给的池名。
 * 公共库优先时先按性别年龄在已选风格库里配，私人库优先时先走勾了「随机池」的私人池。用过的头像 id 跳过。
 */
export function drawProfileAvatar(
  seed: string,
  p: { name?: string; age?: string | number; identity?: string; bio?: string; gender?: string; variant?: string },
  slot?: AvatarSlot | null,
  taken?: ReadonlySet<string>,
): AvatarPick {
  const named = p.variant?.trim();
  if (named && !PUBLIC_AVATAR_NAMES.has(named)) {
    const hit = drawAvatar(seed, named, true, slot, taken);
    if (hit.url) return hit;
  }
  const styled = () => drawStyledProfile(seed, p, slot, taken);
  const creator = () => drawCreatorRandom(seed, slot, taken);
  if (resolveAvatarMatchPrefs(cur(slot)).prefer === "private") {
    const mineHit = creator();
    if (mineHit.url) return mineHit;
    return styled();
  }
  const pubHit = styled();
  if (pubHit.url) return pubHit;
  return creator();
}

/** 功能注释：能当图片地址用的头像。空串、截断的 dataURL、说明文字不当图，避免聊天气泡画出裂图或把 alt 收成一个字。 */
export function usableAvatar(src?: string | null): string {
  const s = typeof src === "string" ? src.trim() : "";
  if (!s) return "";
  if (/^data:image\//i.test(s)) {
    const comma = s.indexOf(",");
    return comma >= 0 && s.length > comma + 32 ? s : "";
  }
  return /^(https?:\/\/|blob:|\/)/i.test(s) ? s : "";
}

export type AvatarRef = { id?: string; avatar?: string; avatarVariant?: string; name?: string };

function worldOf(id?: string) {
  if (!id) return undefined;
  return (getWorldNpcs() ?? []).find((n) => n.id === id);
}

/** 功能注释：作品里已经定好的头像。固定图优先，否则按头像池抽；作者没设就不随机配。 */
function authoredAvatar(id?: string, taken?: ReadonlySet<string>): AvatarPick {
  const w = worldOf(id);
  if (!w) return { url: "" };
  const fixed = usableAvatar(w.avatar);
  if (fixed) return { url: fixed, variant: w.avatarVariant, assetId: assetIdForAvatarUrl(fixed) };
  if (w.avatarVariant) {
    const drawn = drawAvatar(w.id, w.avatarVariant, true, undefined, taken);
    if (drawn.url) return drawn;
  }
  return { url: "" };
}

/**
 * 功能注释：聊天和列表要画的头像。局内可用图优先；没有就用作品里这个人的固定头像或头像池。
 * byName 用于会话 id 对不上档案时按姓名补；avoidIds 用来避开还在场上的其他人，避免把对方的脸安到主角头上。
 */
export function shownAvatar(p: AvatarRef, opt?: { byName?: boolean; avoidIds?: ReadonlySet<string>; peers?: readonly AvatarRef[] }): string | undefined {
  const own = usableAvatar(p.avatar);
  if (own) return own;
  const taken = takenAvatarKeys(opt?.peers, p.avatar);
  const authored = authoredAvatar(p.id, taken);
  if (authored.url && !isTaken(taken, authored.assetId || "", authored.url)) return authored.url;
  if (p.id && p.avatarVariant) {
    const drawn = drawAvatar(p.id, p.avatarVariant, true, undefined, taken);
    if (drawn.url) return drawn.url;
  }
  const name = p.name?.trim();
  if (!opt?.byName || !name) return undefined;
  const blocked = (id?: string) => !!id && id !== p.id && !!opt.avoidIds?.has(id);
  const peer = opt.peers?.find((x) => x.name?.trim() === name && !blocked(x.id) && !!usableAvatar(x.avatar));
  const peerUrl = usableAvatar(peer?.avatar);
  if (peerUrl) return peerUrl;
  const named = (getWorldNpcs() ?? []).find((n) => n.name === name && !blocked(n.id));
  if (!named) return undefined;
  const fixed = usableAvatar(named.avatar);
  if (fixed) return fixed;
  if (named.avatarVariant) {
    const drawn = drawAvatar(named.id, named.avatarVariant, true, undefined, takenAvatarKeys(opt?.peers, p.avatar));
    if (drawn.url) return drawn.url;
  }
  return undefined;
}

/**
 * 功能注释：局内头像是空的或坏的时，用作品里已设的头像补上。
 * 作者预设、又没设头像的人保持首字，不抽平台随机脸；只有 AI 新建的人才走平台头像库。
 */
export function fillMissingAvatars<T extends AvatarRef & { id: string; name: string; avatar: string; avatarAssetId?: string; age?: string; identity?: string; bio?: string; persona?: { gender?: string } }>(
  npcs: T[],
  playerAvatar: string,
  heroId?: string,
  playerName?: string,
): { npcs: T[]; playerAvatar: string; playerAssetId?: string; changed: boolean } {
  const worldIds = new Set((getWorldNpcs() ?? []).map((n) => n.id));
  const taken = takenAvatarKeys([...npcs, { avatar: playerAvatar }]);
  let changed = false;
  const next = npcs.map((n) => {
    if (usableAvatar(n.avatar)) return n;
    const authored = authoredAvatar(n.id, taken);
    if (authored.url && !isTaken(taken, authored.assetId || "", authored.url)) {
      changed = true;
      rememberAvatarUse(taken, authored.url, authored.assetId);
      return { ...n, avatar: authored.url, ...(authored.assetId ? { avatarAssetId: authored.assetId } : {}), ...(authored.variant ? { avatarVariant: authored.variant } : {}) };
    }
    if (worldIds.has(n.id)) return n;
    const av = drawProfileAvatar(n.id, { name: n.name, age: n.age, identity: n.identity, bio: n.bio, gender: n.persona?.gender, variant: n.avatarVariant }, undefined, taken);
    if (!av.url) return n;
    changed = true;
    rememberAvatarUse(taken, av.url, av.assetId);
    return { ...n, avatar: av.url, ...(av.assetId ? { avatarAssetId: av.assetId } : {}), ...(av.variant ? { avatarVariant: av.variant } : {}) };
  });
  let nextPlayer = playerAvatar;
  let playerAssetId: string | undefined;
  if (!usableAvatar(playerAvatar)) {
    const heroNpc = heroId ? next.find((n) => n.id === heroId) : undefined;
    if (heroNpc && usableAvatar(heroNpc.avatar)) {
      changed = true;
      nextPlayer = heroNpc.avatar;
      playerAssetId = heroNpc.avatarAssetId;
    } else {
      const authored = heroId ? authoredAvatar(heroId, taken) : { url: "" };
      const av = authored.url && !isTaken(taken, authored.assetId || "", authored.url)
        ? authored
        : drawProfileAvatar(heroId || playerName || "player", { name: playerName }, undefined, taken);
      if (av.url) {
        changed = true;
        nextPlayer = av.url;
        playerAssetId = av.assetId;
        rememberAvatarUse(taken, av.url, av.assetId);
      }
    }
  }
  return { npcs: changed ? next : npcs, playerAvatar: nextPlayer, playerAssetId, changed };
}
