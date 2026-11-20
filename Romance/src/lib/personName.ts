/**
 * 功能注释：生成/校验人物「姓名」——必须有名有姓（如沈晚晴），禁止只有身份称谓（太皇太后、厨娘）。
 * 不依赖 mods/live，便于单测与 worldGen 软校验直接引用。
 */

/** 功能注释：整串即身份/称谓、不能当姓名用的词 */
const TITLE_ONLY = new Set([
  "太皇太后", "皇太后", "太后", "皇后", "皇帝", "皇上", "陛下", "娘娘", "贵妃", "宠妃", "嫔妃", "妃子", "太妃",
  "厨娘", "丫鬟", "宫女", "太监", "公公", "侍卫", "御医", "太医", "掌门", "师父", "师傅",
  "老板", "老板娘", "店小二", "路人", "路人甲", "路人乙", "男人", "女人", "陌生人",
  "小姐", "公子", "少爷", "夫人", "太太", "先生", "老师", "同学",
  "保姆", "奶妈", "管家", "仆人", "侍女", "王爷", "公主", "郡主", "太子", "皇子",
  "将军", "丞相", "大臣", "贵人", "答应", "常在", "姑姑", "姨妈", "叔叔", "阿姨",
  "爷爷", "奶奶", "外婆", "外公", "二姨", "大姨", "小姨", "伯父", "伯母",
  // 功能注释：现代经营/悬疑常见身份占位，禁止当 name（如「夜班房客」曾拖垮整批地点/事件）
  "房客", "夜班房客", "常住房客", "过路客", "旅客", "住客", "店员", "服务员", "前台", "前台员",
  "清洁工", "保洁", "保安", "码头工", "渔民", "邮差", "邮递员", "灯塔看守", "邻居", "熟人",
  // 功能注释：街头摊贩/服务业身份，禁止当姓名（如「烤红薯摊主」）
  "摊主", "烤红薯摊主", "红薯摊主", "小贩", "摊贩", "商贩", "售货员", "收银员",
  "快递员", "外卖员", "骑手", "司机", "出租车司机", "网约车司机", "门卫", "保安员",
  "大叔", "大爷", "大妈", "阿姨", "叔叔", "小哥", "小姐姐",
  // 功能注释：泛称，不是名字
  "神秘人", "黑衣人", "男子", "女子", "少年", "少女", "老人", "老者", "孩子", "某人", "主角",
]);

/**
 * 功能注释：旁白被拆成了人名，如「苏晴又发来一条」。
 * 这种串能过「有名有姓」的字数检查，但不能建档，也不能自愈成另一个随机姓名。
 */
const NARRATION_IN_NAME = /(又发来|发来一条|发来消息|又发了|回了一条|回了条|说了句|问了一句|又来一条)/;

export function isNarrationAsName(raw: unknown): boolean {
  const name = String(raw ?? "").trim();
  return !!name && NARRATION_IN_NAME.test(name);
}

/** 功能注释：夹在姓名里的称谓尾巴，出现则视为未写真名 */
const TITLE_TAIL =
  /(太皇太后|皇太后|太后|皇后|皇帝|皇上|陛下|娘娘|贵妃|厨娘|丫鬟|宫女|掌门|路人|陌生人|太监|侍卫|太医|御医|房客|店员|服务员|住客|旅客|邻居|摊主|老板娘|小贩|摊贩|商贩|售货员|收银员|快递员|外卖员|骑手|司机|门卫|保安|大叔|大爷|大妈)$/;

/** 功能注释：自愈用姓+名池（不依赖 game/names，避免世界生成单测循环依赖） */
const HEAL_SURNAMES = (
  "沈顾陆江温裴谢卫林苏叶白池晏乔岑凌傅阮霍黎谈慕王李张刘陈杨黄赵周徐"
).split("");
const HEAL_GIVEN_F = ["晚晴", "若溪", "清欢", "舒窈", "听澜", "念棠", "知夏", "沐晴", "以南", "书瑶"];
const HEAL_GIVEN_M = ["慎行", "景行", "知远", "承泽", "砚舟", "怀瑾", "时安", "既白", "言蹊", "嘉树"];

function pickHeal<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * 功能注释：合成有名有姓的中文名；avoid 避免同批撞名。
 */
export function inventProperPersonName(
  gender: unknown = "女",
  avoid?: Set<string>,
): string {
  const male = /男/.test(String(gender ?? ""));
  const given = male ? HEAL_GIVEN_M : HEAL_GIVEN_F;
  for (let i = 0; i < 40; i += 1) {
    const n = `${pickHeal(HEAL_SURNAMES)}${pickHeal(given)}`;
    if (!avoid?.has(n) && isProperPersonName(n)) {
      avoid?.add(n);
      return n;
    }
  }
  const fallback = `${pickHeal(HEAL_SURNAMES)}${pickHeal(given)}`;
  avoid?.add(fallback);
  return fallback;
}

export type HealNpcNameResult = {
  name: string;
  role?: string;
  healed: boolean;
};

/**
 * 功能注释：把身份占位名（夜班房客/厨娘）挪到 role，并补一个真名，避免整批人物+地点生成失败。
 */
export function healNpcNameFields(
  npc: { name?: unknown; role?: unknown; gender?: unknown },
  avoid?: Set<string>,
): HealNpcNameResult {
  const rawName = String(npc.name ?? "").trim();
  const rawRole = String(npc.role ?? "").trim();
  if (rawName && isProperPersonName(rawName)) {
    if (rawName) avoid?.add(rawName);
    return { name: rawName, role: rawRole || undefined, healed: false };
  }
  const nextRole = rawRole || rawName || undefined;
  const nextName = inventProperPersonName(npc.gender, avoid);
  return { name: nextName, role: nextRole, healed: true };
}

/**
 * 功能注释：批量自愈人物 name/role；返回是否改过任一条（供生成管线日志/单测）。
 */
export function healNpcListNames(npcs: unknown[]): { npcs: Record<string, unknown>[]; healedCount: number } {
  if (!Array.isArray(npcs) || !npcs.length) return { npcs: [], healedCount: 0 };
  const avoid = new Set<string>();
  let healedCount = 0;
  const next = npcs.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return row as Record<string, unknown>;
    const n = { ...(row as Record<string, unknown>) };
    const h = healNpcNameFields(n, avoid);
    if (h.healed) healedCount += 1;
    n.name = h.name;
    if (h.role) n.role = h.role;
    else if (!String(n.role ?? "").trim() && h.healed) delete n.role;
    return n;
  });
  return { npcs: next, healedCount };
}

export type RuntimeNpcNameSlice = {
  name: string;
  identity?: string;
  aliases?: string[];
  persona?: { gender?: string };
};

/**
 * 功能注释：局内 NPC 自愈——身份占了 name（烤红薯摊主）时挪到 identity，并补有姓有名；旧称呼进 aliases。
 */
export function healRuntimeNpcName<T extends RuntimeNpcNameSlice>(
  npc: T,
  avoid?: Set<string>,
): T & { healed: boolean } {
  const rawName = String(npc.name ?? "").trim();
  if (rawName && isProperPersonName(rawName)) {
    avoid?.add(rawName);
    return { ...npc, name: rawName, healed: false };
  }
  const rawId = String(npc.identity ?? "").trim();
  const nextIdentity = rawId || rawName || "路人";
  const nextName = inventProperPersonName(npc.persona?.gender, avoid);
  const aliases = [...(npc.aliases ?? [])];
  if (rawName && rawName !== nextName && !aliases.includes(rawName)) aliases.push(rawName);
  return {
    ...npc,
    name: nextName,
    identity: nextIdentity,
    aliases: aliases.length ? aliases : npc.aliases,
    healed: true,
  };
}

/**
 * 功能注释：去掉被误建成人物的旁白串（「苏晴又发来一条」）。
 * 不改名：改名会在地图上留下一个随机陌生人。无改动时返回原数组引用。
 */
export function dropNarrationNamedNpcs<T extends { name?: unknown }>(npcs: T[]): { npcs: T[]; dropped: number } {
  if (!npcs.some((n) => isNarrationAsName(n?.name))) return { npcs, dropped: 0 };
  const next = npcs.filter((n) => !isNarrationAsName(n?.name));
  return { npcs: next, dropped: npcs.length - next.length };
}

/** 功能注释：批量自愈存档里的 NPC 姓名；无改动时返回原数组引用 */
export function healGameNpcsNames<T extends RuntimeNpcNameSlice>(npcs: T[]): { npcs: T[]; healedCount: number } {
  if (!npcs.length) return { npcs, healedCount: 0 };
  const avoid = new Set<string>();
  let healedCount = 0;
  let changed = false;
  const next = npcs.map((n) => {
    const h = healRuntimeNpcName(n, avoid);
    if (h.healed) {
      healedCount += 1;
      changed = true;
      const { healed: _h, ...rest } = h;
      return rest as T;
    }
    return n;
  });
  return { npcs: changed ? next : npcs, healedCount };
}

/**
 * 功能注释：是否像真人名。只拦「身份 / 称谓 / 昵称占了姓名」的情况（厨娘、夜班房客、老冯），
 * 不再要求首字在中文姓氏表里——否则「五条悟」这类日文名、「Arthur」这类西式单名会被判不合格，
 * 读档自愈时被换成随机中文名（B-01 五条悟→顾沐晴、C-06 中世纪世界出中文名）。
 */
export function isProperPersonName(raw: unknown): boolean {
  const name = String(raw ?? "").trim();
  if (name.length < 2 || name.length > 24) return false;
  if (TITLE_ONLY.has(name)) return false;
  // 西式名：单个或多个首字母大写的词（Arthur / Arthur Pendragon / Jean-Luc）
  if (/^[A-Z][A-Za-z'-]{1,20}(?:\s+[A-Z][A-Za-z'-]{0,20}){0,3}$/.test(name)) return true;
  const cjk = name.replace(/[·・\s]/g, "");
  // 中日文名（含假名、长音符）
  if (!/^[\u3040-\u30ff\u4e00-\u9fffー]{2,8}$/.test(cjk)) return false;
  if (TITLE_ONLY.has(cjk) || TITLE_TAIL.test(cjk)) return false;
  // 昵称：老冯 / 小李
  if (/^[老小][\u4e00-\u9fff]$/.test(cjk)) return false;
  return true;
}

/** 功能注释：软校验失败文案；身份应放 role/简介 */
export function improperPersonNameReason(raw: unknown): string | null {
  const name = String(raw ?? "").trim();
  if (!name) return "人物缺少姓名";
  if (isProperPersonName(name)) return null;
  return `人物「${name}」须有名有姓（如沈晚晴），身份写到称号或小传`;
}

/**
 * 功能注释：所属势力只能绑当前作品仍存在的 startFactions；失效 id 一律清空。
 */
export function sanitizeNpcFactionId(
  factionId: unknown,
  factionIds: ReadonlySet<string> | readonly string[],
): string | undefined {
  const id = typeof factionId === "string" ? factionId.trim() : "";
  if (!id) return undefined;
  const set = factionIds instanceof Set
    ? factionIds
    : new Set((factionIds as readonly string[]).filter(Boolean));
  return set.has(id) ? id : undefined;
}

/**
 * 功能注释：读档时按人物 id 把姓名对齐到作品当前设定（作品里的人物以作品为准，局内不提供改名）：
 * · C-03 作者在编辑器改名后，旧存档 / 作者预览档仍显示 AI 起的旧名；
 * · B-01 旧版自愈把「五条悟」误改成随机中文名的存档，读档时恢复原名。
 * 旧名放进 aliases，剧情里旧称呼仍能被识别。无改动时返回原数组引用。
 */
export function syncNpcNamesFromWorld<T extends { id: string; name: string; aliases?: string[] }>(
  npcs: T[],
  worldNpcs: readonly { id?: string; name?: string }[] | undefined,
): { npcs: T[]; syncedCount: number } {
  const byId = new Map<string, string>();
  for (const w of worldNpcs ?? []) {
    const nm = String(w?.name ?? "").trim();
    if (w?.id && nm && isProperPersonName(nm)) byId.set(w.id, nm);
  }
  if (!byId.size) return { npcs, syncedCount: 0 };
  let syncedCount = 0;
  const next = npcs.map((n) => {
    const want = byId.get(n.id);
    if (!want || want === n.name) return n;
    syncedCount += 1;
    const old = String(n.name ?? "").trim();
    const aliases = (n.aliases ?? []).filter((a) => a !== want);
    if (old && !aliases.includes(old)) aliases.push(old);
    return { ...n, name: want, aliases };
  });
  return { npcs: syncedCount ? next : npcs, syncedCount };
}
