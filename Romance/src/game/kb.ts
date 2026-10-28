/* ————— 知识库检索引擎（纯规则层，无中文映射）—————
 * 契约：所有词条、关键词、正文中文全部来自 ContentPool（help.yaml）；本模块只做
 * 「关键词命中 + 字符 bigram 余弦」的确定性检索打分，不写死任何领域词汇或阈值文案。
 * 这是一套轻量的"关键词 + 简单向量"检索：先按 keywords 精确子串命中加权，
 * 再用查询与词条文本的 2-gram 集合余弦相似度做模糊排序，取 Top-K 注入提示词。
 */
import { helpNow, helpIntro } from "../worlds/star2005/content";
import { memoBy } from "../mods/live";

export type KbHit = { id: string; title: string; body: string; score: number };

/* 只保留中英数字，去标点/空白，便于中文子串与 bigram 处理 */
function normalize(s: string): string {
  return String(s ?? "").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

/* 2-gram 集合（单字时退化为该字） */
function bigrams(s: string): Set<string> {
  const t = normalize(s);
  const out = new Set<string>();
  if (t.length <= 1) {
    if (t) out.add(t);
    return out;
  }
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}

function cosine(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const g of a) if (b.has(g)) inter++;
  return inter / Math.sqrt(a.size * b.size);
}

/* 预计算每个词条的 bigram 集合（模块级缓存，词条为静态内容池数据） */
/* 按当前世界的资料库缓存（模组切换时自动重建） */
const docIndex = memoBy(() => helpNow(), (h) => (h.docs ?? []).map((d) => ({
  doc: d,
  grams: bigrams(`${d.title}${(d.keywords ?? []).join("")}${d.body}`),
})));

/* 检索：返回相关词条（分数降序）。keywordWeight 控制精确命中相对模糊相似的权重。 */
export function retrieve(query: string, k = 3, minScore = 0.08): KbHit[] {
  const q = normalize(query);
  if (!q) return [];
  const qGrams = bigrams(query);
  const hits: KbHit[] = [];
  for (const { doc, grams } of docIndex()) {
    let kw = 0;
    for (const key of doc.keywords ?? []) {
      const nk = normalize(key);
      if (nk && q.includes(nk)) kw += 1;
    }
    const sim = cosine(qGrams, grams);
    const score = kw * 0.6 + sim;
    if (score >= minScore) hits.push({ id: doc.id, title: doc.title, body: doc.body, score });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, k);
}

/* 拼装为可注入系统提示词的资料段（命中为空则返回空串） */
export function knowledgeBlock(query: string, k = 3): string {
  const hits = retrieve(query, k);
  if (!hits.length) return "";
  const body = hits.map((h) => `◆ ${h.title}\n${h.body}`).join("\n\n");
  return `【游戏资料库】${helpIntro()}\n\n${body}`;
}
