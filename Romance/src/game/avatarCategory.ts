/* 平台头像分类猜测（无依赖，便于单测）：分类名与 avatarPools.PUBLIC_AVATAR_CATS / 平台头像库分组一致 */
const CATEGORY_NAME: Record<string, string> = {
  "female-adult": "青年女性",
  "male-adult": "青年男性",
  "female-elder": "成熟女性",
  "male-elder": "成熟男性",
  "female-child": "幼年女性",
  "male-child": "幼年男性",
};

/** 功能注释：按人物资料猜平台头像分类（性别 × 年龄段），用于新人物套用平台头像库 */
export function guessAvatarCategory(p: { name?: string; age?: string | number; identity?: string; bio?: string; gender?: string }): string {
  const text = `${p.gender ?? ""} ${p.identity ?? ""} ${p.bio ?? ""} ${p.name ?? ""}`;
  const female = /女|她|姐|妹|姑娘|小姐|夫人|娘|妈|母|婆|嫂|姨|妃|公主|闺|媳/.test(text);
  const male = /男|他|哥|弟|先生|少爷|公子|爷|父|爸|叔|伯|王爷|皇帝|郎|汉/.test(text);
  const isFemale = p.gender === "女" || (female && !(male && /男|他/.test(text) && !/女|她/.test(text)));
  const n = Number(String(p.age ?? "").match(/\d+/)?.[0]);
  let ageGroup: "child" | "adult" | "elder" = "adult";
  if (Number.isFinite(n)) ageGroup = n < 14 ? "child" : n >= 50 ? "elder" : "adult";
  else if (/老|奶奶|爷爷|婆婆|老爷|长者|大娘|大爷/.test(text)) ageGroup = "elder";
  else if (/孩子|小孩|童|幼|娃/.test(text)) ageGroup = "child";
  return CATEGORY_NAME[`${isFemale ? "female" : "male"}-${ageGroup}`] ?? "青年女性";
}

