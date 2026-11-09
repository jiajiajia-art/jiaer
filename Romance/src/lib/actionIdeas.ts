/* 行动灵感 / 事件选项标色：纯函数，不依赖世界注册表，便于单测。
 * 背景：局内没有剧情选项时，输入框旁会展开「行动灵感」。此前写死了某一作品的专名，
 * 在其它作品里会点名不存在的人物；这里改成按「当前地点 / 在场人物 / 主线」生成中性文案。 */

export type ActionIdeaInput = {
  /** 当前所在地点的显示名（可空） */
  locationName?: string;
  /** 此刻在场、可交谈的人物姓名 */
  presentNames?: string[];
  /** 当前主线 / 当前节点的简短文案（可空） */
  mainQuestLabel?: string;
};

/** 地名过长或为占位词时不嵌进句子，避免「去「新地点」看看」这类错位文案 */
const PLACEHOLDER_LOC = /^(新地点|某处|某地|这里|那里|外面|未知|未命名|无)$/;

function cleanLoc(name?: string): string {
  const n = (name ?? "").trim();
  if (!n || n.length > 12 || PLACEHOLDER_LOC.test(n)) return "";
  return n;
}

function cleanQuest(label?: string): string {
  const q = (label ?? "").trim();
  if (!q || q.length > 16) return "";
  return q;
}

/**
 * 功能注释：生成 2~3 条中性、贴合当前场景的行动灵感。
 * 输入：当前地点名 / 在场人物 / 主线文案；输出：可直接填入输入框的短句。
 * 优先级：在场人物 → 地点 → 主线 → 通用兜底；绝不出现任何写死的人名。
 */
export function buildActionIdeas({ locationName, presentNames, mainQuestLabel }: ActionIdeaInput): string[] {
  const loc = cleanLoc(locationName);
  const quest = cleanQuest(mainQuestLabel);
  const names = Array.from(new Set((presentNames ?? []).map((n) => n.trim()).filter(Boolean)));
  const out: string[] = [];

  if (names.length) out.push(`和${names[0]}聊几句`);
  out.push(loc ? `环顾${loc}，留意有什么异样` : "环顾四周，留意有什么异样");
  if (quest) out.push(`想想怎么推进「${quest}」`);
  else if (names.length > 1) out.push(`留意${names[1]}在做什么`);
  else if (loc) out.push(`在${loc}里四处走走`);

  // 兜底：无人 / 无主线时仍保证至少 2 条
  if (out.length < 2) out.push("静下心来，想想接下来该做什么");
  return out.slice(0, 3);
}

/** 进行中事件的最小描述（名称 + 触发词），用于把选项和事件对上号 */
export type ActiveEventHint = { name?: string; keywords?: string[] };

/**
 * 功能注释：找出与「进行中事件」相关的选项下标，用于给选项标色（3.6）。
 * - 没有进行中事件 → 一律不标色（返回空集合，禁止乱标）
 * - 有事件：选项文案命中事件名 / 触发词的都标；一个都没命中时，保底标第一条，保证玩家能分辨「事件项」
 */
export function eventOptionIndexes(
  options: { label: string; value: string }[],
  events: ActiveEventHint[],
): Set<number> {
  const hit = new Set<number>();
  if (!options.length || !events.length) return hit;
  const keys = events
    .flatMap((e) => [e.name ?? "", ...(e.keywords ?? [])])
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length >= 2);
  options.forEach((o, i) => {
    const text = `${o.label} ${o.value}`.toLowerCase();
    if (keys.some((k) => text.includes(k))) hit.add(i);
  });
  if (!hit.size) hit.add(0);
  return hit;
}
