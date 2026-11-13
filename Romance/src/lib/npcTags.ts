/**
 * 平台内置人物标签：创作者勾选即可，也允许自定义追加。
 * 与模组编辑器人物卡、AI 生成提示共用。
 */

/** 功能注释：50 个常用人物标签（性格/关系/职业气质），供勾选；勿写死娱乐圈专属词占满 */
export const PLATFORM_NPC_TAGS: readonly string[] = Object.freeze([
  "温柔", "强势", "毒舌", "护短", "腹黑", "天然呆", "高冷", "热情",
  "内向", "外向", "稳重", "叛逆", "乐观", "悲观", "敏感", "迟钝",
  "幽默", "严肃", "记仇", "心软", "挑剔", "随和", "完美主义", "佛系",
  "工作狂", "生活家", "冒险", "恋家", "宠粉", "傲娇", "病娇", "元气",
  "清冷", "烟火气", "学霸", "学渣", "财迷", "败家", "洁癖", "吃货",
  "夜猫子", "早起党", "浪漫", "务实", "多疑", "信任人", "社恐", "社牛",
  "嘴硬心软", "行动派",
]);

export function isPlatformNpcTag(tag: string): boolean {
  return (PLATFORM_NPC_TAGS as readonly string[]).includes(String(tag ?? "").trim());
}

/** 功能注释：清洗标签列表——去空白、去重，平台标签优先保留顺序 */
export function normalizeNpcTags(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[、,，\s]+/) : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const t = String(item ?? "").trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export function toggleNpcTag(current: string[] | undefined, tag: string, on: boolean): string[] | undefined {
  const t = String(tag ?? "").trim();
  if (!t) return normalizeNpcTags(current).length ? normalizeNpcTags(current) : undefined;
  const set = new Set(normalizeNpcTags(current));
  if (on) set.add(t);
  else set.delete(t);
  const next = [...set];
  return next.length ? next : undefined;
}

/** 功能注释：AI 提示用——列出平台标签，要求优先从此勾选 */
export function platformNpcTagsPromptLine(): string {
  return `人物标签 tags[] 优先从平台内置选择：${PLATFORM_NPC_TAGS.join("、")}；可少量自定义，勿整段手写长句。`;
}

/**
 * 功能注释：语音嗓音底子按人物标签分三档，按顺序命中第一档即停（引擎 screenShare.timbre 与编辑器说明共用）。
 */
export const NPC_VOICE_TAG_GROUPS: { re: RegExp; effect: string; rate: number; pitch: number; volume?: number }[] = [
  { re: /冷|沉稳|稳重|成熟|严格|严肃|危险|腹黑|慵懒/, effect: "偏慢、偏低沉", rate: 0.94, pitch: 0.95 },
  { re: /温柔|邻家|害羞|内向|治愈|乖/, effect: "偏慢、轻柔", rate: 0.95, pitch: 1.03, volume: 0.9 },
  { re: /直率|活泼|元气|开朗|阳光|爽朗|毒舌|热情|话痨/, effect: "偏快、明亮", rate: 1.07, pitch: 1.04 },
];

/** 功能注释：这组标签里真正决定嗓音的那一个（按标签顺序找第一档命中）；无则 null */
export function voiceDrivingTag(tags: string[] | undefined): { tag: string; effect: string; group: (typeof NPC_VOICE_TAG_GROUPS)[number] } | null {
  const list = tags ?? [];
  for (const g of NPC_VOICE_TAG_GROUPS) {
    const tag = list.find((t) => g.re.test(t));
    if (tag) return { tag, effect: g.effect, group: g };
  }
  return null;
}
