/* 角色卡增强：约束规则区 / 示例对话（场景标签 + 权重 + 格式校验）/ 单卡屏蔽词。
 * 数据挂在 NpcPersona 上，主线（在场角色的独立 system）、微信私聊、群聊共用。 */
import type { CharExample, CharRuleKey, GameState, NpcPersona, Segment } from "../lib/types";

export const RULE_FIELDS: { key: CharRuleKey; label: string; hint: string }[] = [
  { key: "forbid", label: "禁止行为", hint: "如：不抽烟、不说脏话、不主动肢体接触" },
  { key: "ooc", label: "OOC 红线", hint: "如：永远不会背叛主角；不会承认自己是 AI" },
];

export const EXAMPLE_TAGS = ["日常闲聊", "争吵", "告白", "安慰", "调情", "吃醋"];
// 场景标签 → 检索线索：标签本身之外，这些词出现在近期对话里也算命中
const TAG_CUES: Record<string, RegExp> = {
  日常闲聊: /吃饭|在干嘛|今天|天气|周末|最近|聊聊/,
  争吵: /吵|凭什么|生气|滚|闭嘴|讨厌|你够了|分手|骗/,
  告白: /喜欢你|爱你|在一起|表白|告白|心动/,
  安慰: /难过|哭|没事吧|累了|委屈|失败|压力/,
  调情: /想你|亲|抱|撩|宝贝|宝宝/,
  吃醋: /吃醋|那个人是谁|别的|他是谁|她是谁/,
};

export const rulesFilled = (ps?: NpcPersona) => RULE_FIELDS.filter((f) => ps?.rules?.[f.key]?.trim());
export const blockWordsOf = (ps?: NpcPersona) => (ps?.blockWords ?? []).map((w) => w.trim()).filter(Boolean);

/* 按「权重 × 场景命中」挑示例：命中 ×3，同分按权重、再按原顺序；总长 ≤ budget */
export function pickExamples(ps: NpcPersona | undefined, hay: string, max = 3, budget = 700): CharExample[] {
  const list = (ps?.examples ?? []).filter((e) => e.text.trim());
  const scored = list.map((e, i) => {
    const w = Math.min(5, Math.max(1, e.weight ?? 1));
    const hit = (e.tags ?? []).some((t) => (t && hay.includes(t)) || TAG_CUES[t]?.test(hay));
    return { e, i, s: w * (hit ? 3 : 1) };
  }).sort((a, b) => b.s - a.s || a.i - b.i);
  const out: CharExample[] = [];
  let used = 0;
  for (const { e } of scored) {
    if (out.length >= max || used + e.text.length > budget) continue;
    out.push(e);
    used += e.text.length;
  }
  return out;
}

/* 一段角色卡指令（主线在场角色、私聊共用）；compact = 群聊（不带示例对话，省篇幅） */
export function charCardBlock(name: string, ps: NpcPersona | undefined, hay: string, compact = false): string {
  const rules = rulesFilled(ps).map((f) => `${f.label}：${ps!.rules![f.key]!.trim()}`);
  const words = blockWordsOf(ps);
  const ex = compact ? [] : pickExamples(ps, hay);
  const parts: string[] = [];
  if (rules.length) parts.push(`【${name} · 角色约束（最高优先，违反即 OOC）】\n${rules.map((r) => `- ${r}`).join("\n")}`);
  if (words.length) parts.push(`【${name} · 屏蔽词（优先于任何全局设定，TA 的台词与动作描写里一个字都不能出现）】${words.join("、")}`);
  if (ex.length) parts.push(`【${name} · 示例对话（只学口吻与格式：*动作*「台词」(小声/旁白)，不得照抄内容；越靠前越该参考）】\n${ex.map((e) => `${e.tags?.length ? `[${e.tags.join("/")}] ` : ""}${e.text.trim()}`).join("\n")}`);
  return parts.join("\n");
}

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/* 把屏蔽词替换成等长的「＊」 */
export function maskWords(text: string, words: string[]): string {
  if (!words.length || !text) return text;
  const re = new RegExp([...words].sort((a, b) => b.length - a.length).map(escRe).join("|"), "gi");
  return text.replace(re, (m) => "＊".repeat([...m].length));
}

/* 主线输出：说话人是某张卡的角色时，按 TA 的屏蔽词遮掉台词 */
export function maskStorySegments(g: GameState, segs: Segment[]): Segment[] {
  const byName = new Map(g.npcs.filter((n) => blockWordsOf(n.persona).length).map((n) => [n.name, blockWordsOf(n.persona)]));
  if (!byName.size) return segs;
  return segs.map((s) => (s.kind === "dialogue" && byName.has(s.speaker) ? { ...s, text: maskWords(s.text, byName.get(s.speaker)!) } : s));
}

/* 示例对话格式校验：切成 动作 *…* / 台词 「…」 / 括注 (…)（…）/ 不合规片段 */
export type ExPart = { kind: "act" | "say" | "aside" | "bad" | "space"; text: string };
export function lintExample(line: string): ExPart[] {
  const out: ExPart[] = [];
  const re = /\*[^*\n]+\*|「[^」\n]*」|[（(][^）)\n]*[）)]|\s+/g;
  let last = 0;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (m.index > last) out.push({ kind: "bad", text: line.slice(last, m.index) });
    const t = m[0];
    out.push({ kind: /^\s+$/.test(t) ? "space" : t[0] === "*" ? "act" : t[0] === "「" ? "say" : "aside", text: t });
    last = m.index + t.length;
  }
  if (last < line.length) out.push({ kind: "bad", text: line.slice(last) });
  return out;
}
// 允许「名字：」这类说话人前缀，不算格式错误
export const exampleIssues = (text: string) =>
  text.split("\n").filter((l) => l.trim()).filter((l) => lintExample(l.replace(/^\s*[^\s:：「*（(]{1,8}[:：]\s*/, "")).some((p) => p.kind === "bad")).length;
