/* 平台头像分类猜测（无依赖，便于单测）：分类名与 avatarPools.PUBLIC_AVATAR_CATS / 平台头像库分组一致 */
const CATEGORY_NAME: Record<string, string> = {
  "female-adult": "青年女性",
  "male-adult": "青年男性",
  "female-elder": "成熟女性",
  "male-elder": "成熟男性",
  "female-child": "幼年女性",
  "male-child": "幼年男性",
};

export type AvatarDims = { gender: "female" | "male"; ageGroup: "child" | "adult" | "elder" };

/** 功能注释：按人物资料猜性别和年龄段。年龄段 id 与头像库 age_group 一致（child / adult / elder） */
export function guessAvatarDims(p: { name?: string; age?: string | number; identity?: string; bio?: string; gender?: string }): AvatarDims {
  const text = `${p.gender ?? ""} ${p.identity ?? ""} ${p.bio ?? ""} ${p.name ?? ""}`;
  const female = /女|她|姐|妹|姑娘|小姐|夫人|娘|妈|母|婆|嫂|姨|妃|公主|闺|媳/.test(text);
  const male = /男|他|哥|弟|先生|少爷|公子|爷|父|爸|叔|伯|王爷|皇帝|郎|汉/.test(text);
  const isFemale = p.gender === "女" || p.gender === "female" || (female && !(male && /男|他/.test(text) && !/女|她/.test(text)));
  const n = Number(String(p.age ?? "").match(/\d+/)?.[0]);
  let ageGroup: AvatarDims["ageGroup"] = "adult";
  if (Number.isFinite(n)) ageGroup = n < 14 ? "child" : n >= 50 ? "elder" : "adult";
  else if (/老|奶奶|爷爷|婆婆|老爷|长者|大娘|大爷/.test(text)) ageGroup = "elder";
  else if (/孩子|小孩|童|幼|娃/.test(text)) ageGroup = "child";
  return { gender: isFemale ? "female" : "male", ageGroup };
}

/** 功能注释：猜出的性别 × 年龄段对应的池名，供同名池回退 */
export function guessAvatarCategory(p: { name?: string; age?: string | number; identity?: string; bio?: string; gender?: string }): string {
  const d = guessAvatarDims(p);
  return CATEGORY_NAME[`${d.gender}-${d.ageGroup}`] ?? "青年女性";
}

