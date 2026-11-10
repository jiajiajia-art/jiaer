/**
 * 功能注释：生成/校验人物「姓名」——必须有名有姓（如沈晚晴），禁止只有身份称谓（太皇太后、厨娘）。
 * 不依赖 mods/live，便于单测与 worldGen 软校验直接引用。
 */

/** 常见单字姓（与 game/names 字库对齐，避免循环依赖） */
const SURNAMES_SINGLE = new Set(
  (
    "王李张刘陈杨黄赵吴周徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾肖田董袁潘于蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹孟熊秦邱江尹薛闫段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤" +
    "沈顾陆江温裴谢卫云简秋商宁楚萧容季苏叶白池晏祁闻乔岑凌傅俞虞殷纪蓝洛阮霍黎谈慕"
  ).split(""),
);

const SURNAMES_COMPOUND = [
  "欧阳", "上官", "司马", "诸葛", "东方", "慕容", "南宫", "司徒", "皇甫", "独孤", "令狐", "宇文", "长孙", "夏侯", "公孙", "端木", "百里", "钟离", "澹台", "轩辕",
] as const;

/** 功能注释：整串即身份/称谓、不能当姓名用的词 */
const TITLE_ONLY = new Set([
  "太皇太后", "皇太后", "太后", "皇后", "皇帝", "皇上", "陛下", "娘娘", "贵妃", "宠妃", "嫔妃", "妃子", "太妃",
  "厨娘", "丫鬟", "宫女", "太监", "公公", "侍卫", "御医", "太医", "掌门", "师父", "师傅",
  "老板", "店小二", "路人", "路人甲", "路人乙", "男人", "女人", "陌生人",
  "小姐", "公子", "少爷", "夫人", "太太", "先生", "老师", "同学",
  "保姆", "奶妈", "管家", "仆人", "侍女", "王爷", "公主", "郡主", "太子", "皇子",
  "将军", "丞相", "大臣", "贵人", "答应", "常在", "姑姑", "姨妈", "叔叔", "阿姨",
  "爷爷", "奶奶", "外婆", "外公", "二姨", "大姨", "小姨", "伯父", "伯母",
  // 功能注释：现代经营/悬疑常见身份占位，禁止当 name（如「夜班房客」曾拖垮整批地点/事件）
  "房客", "夜班房客", "常住房客", "过路客", "旅客", "住客", "店员", "服务员", "前台", "前台员",
  "清洁工", "保洁", "保安", "码头工", "渔民", "邮差", "邮递员", "灯塔看守", "邻居", "熟人",
]);

/** 功能注释：夹在姓名里的称谓尾巴，出现则视为未写真名 */
const TITLE_TAIL =
  /(太皇太后|皇太后|太后|皇后|皇帝|皇上|陛下|娘娘|贵妃|厨娘|丫鬟|宫女|掌门|路人|陌生人|太监|侍卫|太医|御医|房客|店员|服务员|住客|旅客|邻居)$/;

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

/**
 * 功能注释：是否像「姓+名」真人名。身份/称号应写到 role 或 bio，不得占 name。
 */
export function isProperPersonName(raw: unknown): boolean {
  const name = String(raw ?? "").trim();
  if (name.length < 2 || name.length > 8) return false;
  if (TITLE_ONLY.has(name)) return false;
  if (/^[A-Za-z][A-Za-z'-]{0,20}\s+[A-Za-z][A-Za-z'-]{0,20}$/.test(name)) return true;
  const cjk = name.replace(/[·・]/g, "");
  if (!/^[\u4e00-\u9fff]{2,6}$/.test(cjk)) return false;
  if (TITLE_ONLY.has(cjk) || TITLE_TAIL.test(cjk)) return false;
  for (const s of SURNAMES_COMPOUND) {
    if (cjk.startsWith(s) && cjk.length > s.length) return true;
  }
  return SURNAMES_SINGLE.has(cjk[0]!) && cjk.length >= 2;
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
