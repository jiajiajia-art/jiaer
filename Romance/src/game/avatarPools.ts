import type { AvatarSlot } from "../lib/types";
import { resolveAvatarMatchPrefs } from "../lib/types";
import { getWorldSlot } from "../mods/registry";
import { loadGlobal, saveGlobal } from "../lib/saveScope";

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

/** AI 新增人脉的抽图范围：本剧勾了「随机池」的我的头像池 + 勾了随机的平台分类；顺序尊重剧本 match.prefer */
export function randomPools(slot?: AvatarSlot | null): AvatarSource[] {
  const s = cur(slot);
  // 功能注释：publicRandom 常被 AI 写成对象；非数组按空，禁止 new Set(非数组) → is not iterable
  const on = new Set(Array.isArray(s?.publicRandom) ? s.publicRandom : []);
  const creator = mine(s, (t) => t.random);
  const platform = systemPools().filter((p) => on.has(p.name) && hasImages(p));
  const { prefer } = resolveAvatarMatchPrefs(s);
  // 功能注释：公共优先时平台分类在前；私人/创作者优先时我的池在前；系统始终可在平台侧作最终回退
  return prefer === "public" ? [...platform, ...creator] : [...creator, ...platform];
}

/** 按 avatarVariant 精确找池：顺序尊重剧本 match.prefer（私人/公共），系统库作同名回退 */
export function variantPool(name: string | undefined, slot?: AvatarSlot | null): AvatarSource | undefined {
  if (!name) return undefined;
  const s = cur(slot);
  const creatorHit = mine(s, (t) => t.pick || t.random).find((p) => p.name === name);
  const systemHit = systemPools().find((p) => p.name === name && hasImages(p));
  const { prefer } = resolveAvatarMatchPrefs(s);
  if (prefer === "public") return systemHit || creatorHit;
  return creatorHit || systemHit;
}

/** 本剧可用作 avatarVariant 的全部池名（编辑器联想 / 校验用） */
export const variantNames = (slot?: AvatarSlot | null) => {
  const s = cur(slot);
  return [...mine(s, (t) => t.pick || t.random).map((p) => p.name), ...PUBLIC_AVATAR_CATS.map((c) => c.name)];
};

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
/** 按种子（人物 id）确定性抽一张：有 variant 只从同名池抽；strict=false 时找不到同名池则落到随机池 */
export function drawAvatar(seed: string, variant?: string, strict = false, slot?: AvatarSlot | null): { url: string; variant?: string } {
  const hit = variantPool(variant?.trim(), slot);
  if (hit) return { url: hit.images[hash(seed) % hit.images.length], variant: hit.name };
  if (strict) return { url: "" };
  const all = randomPools(slot).flatMap((p) => (Array.isArray(p.images) ? p.images : []).map((url) => ({ url, variant: p.name })));
  return all.length ? all[hash(seed) % all.length] : { url: "" };
}
