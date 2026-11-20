/**
 * 记忆检索层（纯函数、无网络）：
 * · 向量语义：字符 1~3-gram 的 TF-IDF，哈希投影到固定维度后做余弦（本地「向量库」，无需 embedding 接口）；
 * · 关键词：BM25（字符 bigram 作词元，适配中文无空格）；
 * · 图遍历：人物 / 地点 / 关键词构成的实体共现图，从此刻实体出发走 1 跳；
 * · 融合：RRF（倒数排名融合）合并三路，再按遗忘曲线保持率 · 重要度 · 时近性重排。
 */

export type MemDoc = { id: string; text: string; who: string[]; room?: string; keys: string[] };
export type RetrieveQuery = { text: string; entities: string[]; room?: string };
export type Signals = { vec: number; bm25: number; graph: number };
export type Ranked = { id: string; rrf: number; signals: Signals };

const DIM = 512;

export function normalize(s: string): string {
  return String(s ?? "").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

/** 字符 bigram 词元（单字退化为自身），BM25 与写入去重共用 */
export function bigramTokens(s: string): string[] {
  const t = normalize(s);
  if (t.length <= 1) return t ? [t] : [];
  const out: string[] = [];
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  return out;
}

function grams(s: string): string[] {
  const t = normalize(s);
  const out: string[] = [];
  for (let n = 1; n <= 3; n++) for (let i = 0; i + n <= t.length; i++) out.push(t.slice(i, i + n));
  return out;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** 语料级 IDF（长 gram 天然更稀有，权重更高；单字只作弱信号） */
function idfTable(docs: string[][]): Map<string, number> {
  const df = new Map<string, number>();
  for (const g of docs) for (const x of new Set(g)) df.set(x, (df.get(x) ?? 0) + 1);
  const N = docs.length || 1;
  const idf = new Map<string, number>();
  for (const [k, v] of df) idf.set(k, Math.log(1 + N / v));
  return idf;
}

function embed(gs: string[], idf: Map<string, number>, fallbackIdf: number): Float32Array {
  const v = new Float32Array(DIM);
  const tf = new Map<string, number>();
  for (const g of gs) tf.set(g, (tf.get(g) ?? 0) + 1);
  for (const [g, c] of tf) {
    const lenW = g.length === 1 ? 0.3 : g.length === 2 ? 1 : 1.4;
    const h = hash(g);
    // 符号哈希：减少碰撞带来的系统性正偏
    v[h % DIM] += ((h >>> 31) ? -1 : 1) * (1 + Math.log(c)) * (idf.get(g) ?? fallbackIdf) * lenW;
  }
  let n = 0;
  for (let i = 0; i < DIM; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < DIM; i++) v[i] /= n;
  return v;
}

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < DIM; i++) s += a[i] * b[i];
  return s;
}

/** 两段文本的语义近似度（写入决策用；0~1） */
export function textSimilarity(a: string, b: string): number {
  const ga = grams(a), gb = grams(b);
  if (!ga.length || !gb.length) return 0;
  const idf = idfTable([ga, gb]);
  const vecSim = Math.max(0, dot(embed(ga, idf, 1), embed(gb, idf, 1)));
  const ta = new Set(bigramTokens(a)), tb = new Set(bigramTokens(b));
  let inter = 0;
  for (const x of ta) if (tb.has(x)) inter++;
  const jac = ta.size && tb.size ? inter / (ta.size + tb.size - inter) : 0;
  return Math.max(vecSim, jac);
}

function bm25Scores(docs: string[][], q: string[], k1 = 1.2, b = 0.75): number[] {
  const N = docs.length;
  if (!N || !q.length) return docs.map(() => 0);
  const avg = docs.reduce((s, d) => s + d.length, 0) / N || 1;
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  const qs = [...new Set(q)];
  return docs.map((d) => {
    const tf = new Map<string, number>();
    for (const t of d) tf.set(t, (tf.get(t) ?? 0) + 1);
    let s = 0;
    for (const t of qs) {
      const f = tf.get(t);
      if (!f) continue;
      const n = df.get(t) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      s += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.length) / avg)));
    }
    return s;
  });
}

const entsOf = (d: MemDoc) => [...d.who.map((w) => `p:${w}`), ...(d.room ? [`r:${d.room}`] : []), ...d.keys.map((k) => `k:${normalize(k)}`)];

/** 实体共现图：同一条记忆里出现的实体两两相连 */
function buildGraph(docs: MemDoc[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const d of docs) {
    const es = entsOf(d);
    for (const a of es) {
      if (!adj.has(a)) adj.set(a, new Set());
      for (const b of es) if (a !== b) adj.get(a)!.add(b);
    }
  }
  return adj;
}

/**
 * 混合检索：三路分别排名 → RRF 融合。只返回至少有一路「足够强」信号的记忆，
 * 避免语义近似噪声把无关往事拉进来。
 */
export function hybridRetrieve(docs: MemDoc[], q: RetrieveQuery): Ranked[] {
  if (!docs.length) return [];
  const docGrams = docs.map((d) => grams(`${d.text}${d.keys.join("")}`));
  const idf = idfTable(docGrams);
  const fallbackIdf = Math.log(1 + docs.length);
  const qv = embed(grams(q.text), idf, fallbackIdf);
  const vec = docGrams.map((g) => Math.max(0, dot(embed(g, idf, fallbackIdf), qv)));
  const bm = bm25Scores(docs.map((d) => bigramTokens(`${d.text}${d.keys.join("")}`)), bigramTokens(q.text));
  const bmMax = Math.max(0, ...bm) || 1;

  const adj = buildGraph(docs);
  const direct = new Set([...q.entities.map((e) => `p:${e}`), ...(q.room ? [`r:${q.room}`] : [])]);
  const qn = normalize(q.text);
  for (const d of docs) for (const k of d.keys) { const nk = normalize(k); if (nk.length >= 2 && qn.includes(nk)) direct.add(`k:${nk}`); }
  const hop = new Set<string>();
  for (const e of direct) for (const n of adj.get(e) ?? []) if (!direct.has(n)) hop.add(n);
  const graph = docs.map((d) => {
    let s = 0;
    for (const e of entsOf(d)) s += direct.has(e) ? (e.startsWith("r:") ? 0.6 : 1) : hop.has(e) ? 0.35 : 0;
    return s;
  });

  const rankOf = (scores: number[], min: number) => {
    const idx = scores.map((s, i) => [s, i] as const).filter(([s]) => s > min).sort((a, b) => b[0] - a[0]);
    const r = new Map<number, number>();
    idx.forEach(([, i], k) => r.set(i, k + 1));
    return r;
  };
  const rv = rankOf(vec, 0.12), rb = rankOf(bm, 0), rg = rankOf(graph, 0);
  const K = 60;
  const out: Ranked[] = [];
  docs.forEach((d, i) => {
    const signals = { vec: vec[i], bm25: bm[i] / bmMax, graph: graph[i] };
    // 准入：图上直接相关，或关键词 / 语义足够强
    const strong = signals.graph >= 0.6 || (bm[i] > 0 && signals.bm25 >= 0.3) || signals.vec >= 0.32;
    if (!strong) return;
    let rrf = 0;
    for (const r of [rv, rb, rg]) { const k = r.get(i); if (k) rrf += 1 / (K + k); }
    out.push({ id: d.id, rrf, signals });
  });
  return out.sort((a, b) => b.rrf - a.rrf);
}
