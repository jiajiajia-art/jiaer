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
