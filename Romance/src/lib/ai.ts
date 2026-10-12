/* ————— AI 接入：配置校验 / SSE 流式 / 结构化解析 / 记忆压缩 / mock 兜底 ————— */
import type { AIConfig, AIStep, GameState, Npc, Player, Segment } from "./types";
import { uid } from "./store";
import { phaseOf } from "../game/logic";
import { STAT_LABELS, STAT_ORDER, WORLD_RULE_DIMS, fameTier, worldRuleLabel } from "../game/data";
import { defaultWorldBook } from "../game/worldbook";
import { knowledgeBlock } from "../game/kb";

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

/* 单回合叙事对好感的最大影响（与金额封顶同理）：AI 只能"建议"小幅变动，
 * 大额好感只能靠确定性玩法（私下联系/情感线）经营，防止模型凭空拉满关系。 */
const AFFINITY_TURN_CAP = 10;

function endpoint(cfg: AIConfig, path: string) {
  const base = cfg.baseUrl.replace(/\/+$/, "");
  return base + path;
}

/* —— 获取模型列表 —— */
export async function fetchModels(cfg: AIConfig): Promise<string[]> {
  const res = await fetch(endpoint(cfg, "/models"), {
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
  });
  if (!res.ok) throw new Error(`模型列表获取失败（${res.status}）`);
  const data = await res.json();
  const list: string[] = (data?.data ?? data ?? [])
    .map((m: { id?: string } | string) => (typeof m === "string" ? m : m.id))
    .filter(Boolean);
  if (!list.length) throw new Error("接口未返回可用模型");
  return list;
}

/* —— 测试连接（发送一次极小请求） —— */
export async function testConnection(cfg: AIConfig): Promise<string> {
  const res = await fetch(endpoint(cfg, "/chat/completions"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model || "gpt-4o-mini",
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 4,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`连接失败（${res.status}）${t.slice(0, 120)}`);
  }
  return "连接成功，模型可用。";
}

export const isConfigured = (cfg: AIConfig) => !!cfg.baseUrl && !!cfg.apiKey && !!cfg.model;

/* —— SSE 流式对话；onDelta 收到增量文本；返回完整文本 —— */
export async function streamChat(
  cfg: AIConfig,
  messages: ChatMsg[],
  onDelta: (chunk: string, full: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(endpoint(cfg, "/chat/completions"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    signal,
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature: cfg.temperature,
      top_p: cfg.topP,
      stream: true,
    }),
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    throw new Error(`请求失败（${res.status}）${t.slice(0, 160)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        const delta: string = json?.choices?.[0]?.delta?.content ?? "";
        if (delta) {
          full += delta;
          onDelta(delta, full);
        }
      } catch {
        /* 跳过不完整分片 */
      }
    }
  }
  return full;
}

/* —— 非流式（记忆压缩用） —— */
export async function complete(cfg: AIConfig, messages: ChatMsg[]): Promise<string> {
  const res = await fetch(endpoint(cfg, "/chat/completions"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ model: cfg.model, messages, temperature: 0.4 }),
  });
  if (!res.ok) throw new Error(`请求失败（${res.status}）`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

/* ————— 内容解析 ————— */

// 流式过程中，把 JSON 数据块从展示文本里剔除（玩家只看到剧情）
export function displayText(full: string): string {
  let t = full;
  const fence = t.search(/```json|```\s*\{/i);
  if (fence >= 0) t = t.slice(0, fence);
  else {
    const brace = t.search(/\n\s*\{[\s\S]*"(narration|options|world|player_changes|npc_changes)"/);
    if (brace >= 0) t = t.slice(0, brace);
  }
  return t.trim();
}

/* AI 输出异常检测：正常中文叙事每隔十几个字必有标点，
 * 若出现「大量连续汉字、中间无任何标点/空白」的特征，判为乱码，
 * 前端据此拦截、引导重新生成，而非把乱码渲染给玩家。 */
const GARBLE_RUN = 60; // 连续无标点汉字达到该长度即判为异常
export function looksGarbled(text: string): boolean {
  if (!text) return false;
  const runs = text.match(/[一-鿿]{40,}/g);
  return !!runs && runs.some((r) => r.length >= GARBLE_RUN);
}

// 把散文剧情解析为分段（旁白 / 对话）
export function proseToSegments(prose: string): Segment[] {
  const segs: Segment[] = [];
  const lines = prose.split(/\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // 丢弃模型偶尔漏出的字段标签行（如「【剧情正文】」「【正文】」），避免当成旁白显示
    if (/^[【\[](剧情)?正文[】\]]$/.test(line)) continue;
    const m = line.match(/^[【「\[](.+?)[】」\]][:：]?\s*(.*)$/);
    if (m && m[2]) segs.push({ kind: "dialogue", speaker: m[1], text: m[2] });
    else segs.push({ kind: "narration", text: line });
  }
  return segs;
}

// 从完整回复里抽取 JSON 数据块
export function extractStep(full: string): AIStep | null {
  let jsonStr = "";
  const fence = full.match(/```json\s*([\s\S]*?)```/i) || full.match(/```\s*([\s\S]*?)```/);
  if (fence) jsonStr = fence[1];
  else {
    const start = full.indexOf("{");
    const end = full.lastIndexOf("}");
    if (start >= 0 && end > start) jsonStr = full.slice(start, end + 1);
  }
  if (!jsonStr.trim()) return null;
  try {
    return JSON.parse(jsonStr) as AIStep;
  } catch {
    return null;
  }
}

/* ————— 系统提示词 ————— */
export function buildSimSnapshot(state: GameState): string {
  const s = state.sim;
  if (!s) return "";
  const stats = STAT_ORDER.map((k) => `${STAT_LABELS[k]}${s.stats[k]}`).join("、");
  const tier = fameTier(s.fame).label;
  const active = s.activeGigId ? `进行中通告剩余 ${s.gigDaysLeft} 天` : "无在拍通告";
  return `【事业数值引擎（真实数据，剧情须与之一致）】
第 ${s.week} 周 · ${phaseOf(s.week)}｜名气 ${s.fame}（${tier}）｜口碑 ${s.reputation}｜压力 ${s.stress}｜资金 ¥${(s.money / 10000).toFixed(1)}万｜行动力 ${s.energy}
八维：${stats}
作品 ${s.works}｜奖项 ${s.awards}｜黑粉 ${s.blackFans}｜负责人信任 ${s.trust}｜${active}${s.dating ? `｜已确认交往：${s.dating}` : ""}`;
}

/* 世界·社会规则块：仅当玩家在设置里开启时注入，让 AI 的世界观与叙事遵循这些设定。 */
function buildWorldRules(state: GameState): string {
  const wr = state.worldRules;
  if (!wr?.enabled) return "";
  const lines = WORLD_RULE_DIMS.map((d) => `${d.label}：${worldRuleLabel(d.id, wr.choices[d.id] ?? d.def)}`).join("｜");
  return `【世界·社会规则】（玩家设定，本局世界观须严格遵循；与现实不符处以此为准）
${lines}

`;
}

export function buildSystemPrompt(state: GameState): string {
  const p = state.player;
  return `你是一款名为《今夜她是主角·女明星养成沉浸式模拟器》的中文沉浸式养成模拟器的游戏主持（GM），文风为晋江言情/复古娱乐圈质感，细腻、有画面感、克制而深情。

【主角设定】
姓名：${p.name}｜年龄：${p.age}｜性别：${p.gender}｜身份：${p.identity}｜家世：${p.background}｜阶层：${p.klass}
${(p.extra ?? []).map((e) => `${e.label}：${e.value}`).join("｜") || ""}
人设：${p.description}
特质：${p.traits.map((t) => t.name).join("、") || "暂无"}

${buildWorldRules(state)}${buildSimSnapshot(state)}

【核心人物】（"近况记忆"是该角色与主角相处的往事，交谈时须记得、并保持各自身份口吻）
${state.npcs
  .map((n) => {
    const mem = (n.interactions ?? []).slice(-3).map((it) => it.text).join("；");
    return `- ${n.name}（${n.identity}，与主角：${n.relation}，好感${n.affinity}，心情${n.mood || "平静"}）${mem ? `\n  · 近况记忆：${mem}` : ""}`;
  })
  .join("\n")}

【已知记忆（前情摘要）】
${state.memory || "（游戏刚刚开始）"}

【输出规范 · 严格遵守】
1. 先输出【剧情正文】：旁白用自然段落；人物台词单独成行，格式为「角色名」：台词。多换行，画面细腻。不要输出任何字段名或代码。
2. 正文之后，紧跟一个 \`\`\`json 代码块，包含本回合的结构化数据，字段：
{
  "narration": "本回合旁白（与正文一致的纯文本）",
  "dialogue": [{"speaker":"角色名","text":"台词"}],
  "system": "系统提示，可省略",
  "options": [{"label":"给玩家看的选项文案","value":"发给你的指令"}],
  "world": {"time":"游戏内时间","location":"当前地点","weather":"天气","note":"一句话状态"},
  "player_changes": {"attrs":[{"key":"fame","label":"名气","delta":5}],"traits_add":[{"name":"","kind":"positive"}],"identity":"如有变化","history_add":{"title":"","detail":""}},
  "npc_changes": [{"id":"guchen","name":"顾沉","affinity_delta":8,"dims":[{"label":"爱慕","delta":5}],"reason":"原因","interaction":"本回合互动一句话","mood":"心情"}],
  "game_end": false,
  "epilogue": "仅当你判定结局到来时给出，≥1000字的主角生平后记"
}
3. options 给 3~4 个，文案就是玩家点击后要发生的事，具体可玩。没有数值变化的字段就省略，不要编造无意义的变动。
4. 只有当故事自然抵达结局（成名/隐退/婚恋定局/意外等）才把 game_end 设为 true 并给出 epilogue。`;
}

/* 世界书检索（借鉴酒馆 SillyTavern 世界书机制）：
 * · 蓝灯（constant / 关键词为空）——每回合常驻注入；
 * · 绿灯（关键词触发）——扫描最近若干回合对话 + 本回合输入 + 当前场景，命中关键词才注入；
 * · 命中条目按 order 升序排列（越小越靠前、越受模型重视），并受字数预算上限约束。
 * 拼装为一段可注入系统提示的参考资料；无命中则返回空串。 */
const WB_SCAN_TURNS = 4; // 扫描最近的对话回合数（绿灯关键词的检索窗口）
const WB_CHAR_BUDGET = 1600; // 注入正文的字数上限，防止挤占剧情上下文

function worldBookBlock(state: GameState, query: string): string {
  const book = state.worldBook ?? defaultWorldBook();
  if (!book.length) return "";
  // 检索文本：本回合输入 + 当前场景 + 最近数回合对话原文
  const recentText = state.story
    .slice(-WB_SCAN_TURNS)
    .map((t) => t.segments.map((s) => (s.kind === "dialogue" ? `${s.speaker}${s.text}` : s.text)).join(" "))
    .join(" ");
  const hay = `${query} ${state.world?.note ?? ""} ${state.world?.location ?? ""} ${recentText}`.toLowerCase();
  const hits = book.filter((e) => {
    if (!e.enabled || !e.content.trim()) return false;
    const keys = e.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
    const isConstant = e.constant || keys.length === 0; // 兼容旧档：无关键词视为常驻
    if (isConstant) return true; // 蓝灯常驻，不受概率影响
    if (!keys.some((k) => hay.includes(k))) return false; // 绿灯未命中关键词
    const prob = e.probability ?? 100; // 命中后按触发概率决定是否注入
    return prob >= 100 || Math.random() * 100 < prob;
  });
  if (!hits.length) return "";
  // 按插入顺序排列：order 越小越靠前（缺省 100），同序保持原相对次序
  hits.sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
  // 字数预算：按序累加，超出上限即停止（核心/靠前条目优先保留）
  const parts: string[] = [];
  let used = 0;
  for (const e of hits) {
    const block = `◆ ${e.title || "设定"}\n${e.content.trim()}`;
    if (used + block.length > WB_CHAR_BUDGET && parts.length) break;
    parts.push(block);
    used += block.length;
  }
  return `【世界书 · 设定参考】（玩家为本局撰写的世界设定，须据此演绎，勿与之冲突）\n${parts.join("\n\n")}`;
}

/* 当前点位的玩家自定义（地图编辑器）：改名 / 场景描述 / 就地物件，注入让 AI 叙事与之一致。 */
function mapSpotBlock(state: GameState): string {
  const room = state.sim?.room;
  const edit = room ? (state.mapEdits ?? {})[room] : undefined;
  if (!edit) return "";
  const lines: string[] = [];
  if (edit.name?.trim()) lines.push(`地点名称：${edit.name.trim()}`);
  if (edit.desc?.trim()) lines.push(`场景描述：${edit.desc.trim()}`);
  const items = (edit.items ?? []).filter((it) => it.name.trim());
  if (items.length) lines.push(`此处可见物件：${items.map((it) => `${it.name}（${it.desc.trim() || "无描述"}）`).join("；")}`);
  if (!lines.length) return "";
  return `【当前场景 · 玩家自定义】（本局所在地由玩家设定，须据此演绎）\n${lines.join("\n")}`;
}

export function buildMessages(state: GameState, userInput: string): ChatMsg[] {
  const input = typeof userInput === "string" ? userInput : String(userInput ?? "");
  const msgs: ChatMsg[] = [{ role: "system", content: buildSystemPrompt(state) }];
  if (state.globalSystemPrompt?.trim()) msgs.push({ role: "system", content: `【全局叙事基调】\n${state.globalSystemPrompt.trim()}\n\n以上内容只控制表达风格与主持原则，不属于世界书，也不改变游戏事实。` });
  // 知识库：按玩家输入检索 help 文档，命中则注入，避免模型编造游戏机制/世界设定
  const kb = knowledgeBlock(input);
  if (kb) msgs.push({ role: "system", content: kb });
  // 世界书：玩家撰写的设定片段，按关键词命中注入
  const wb = worldBookBlock(state, input);
  if (wb) msgs.push({ role: "system", content: wb });
  // 地图编辑器：当前点位的玩家自定义（改名/描述/物件），让叙事与所见场景一致
  const ms = mapSpotBlock(state);
  if (ms) msgs.push({ role: "system", content: ms });
  // 只带最近若干回合原文，早期靠 memory
  const recent = state.story.slice(-6);
  for (const t of recent) {
    const text = t.segments.map((s) => (s.kind === "dialogue" ? `「${s.speaker}」：${s.text}` : s.text)).join("\n");
    msgs.push({ role: t.role === "player" ? "user" : "assistant", content: text });
  }
  msgs.push({ role: "user", content: input });
  return msgs;
}

/* —— 记忆压缩（每 5 回合，异步，仅主线） —— */
export async function compressMemory(cfg: AIConfig, state: GameState): Promise<string> {
  const transcript = state.story
    .map((t) => t.segments.map((s) => (s.kind === "dialogue" ? `${s.speaker}:${s.text}` : s.text)).join(" "))
    .join("\n");
  const prompt = `请把下面这段养成剧情压缩成不超过 400 字的主线记忆摘要，只保留：关键剧情推进、人物关系变化、主角重要抉择与结果。不要写无关细节。已有旧摘要可并入。

旧摘要：${state.memory || "无"}

近期剧情：
${transcript.slice(-4000)}`;
  if (isConfigured(cfg)) {
    try {
      const out = await complete(cfg, [{ role: "user", content: prompt }]);
      if (out.trim()) return out.trim();
    } catch {
      /* 失败则退回本地压缩 */
    }
  }
  // 本地兜底：截取最近关键句
  const merged = (state.memory + " " + transcript).replace(/\s+/g, " ").trim();
  return merged.slice(-600);
}

/* ————— 应用 AIStep 到状态，返回新状态 + 变更提示 ————— */
export function applyStep(state: GameState, step: AIStep): { next: GameState; changes: string[] } {
  const next: GameState = structuredClone(state);
  const changes: string[] = [];
  const turn = next.turnCount + 1;
  const time = step.world?.time || next.world.time;

  if (step.world) next.world = { ...next.world, ...step.world };

  // 玩家变更
  const pc = step.player_changes;
  if (pc) {
    if (pc.identity) next.player.identity = pc.identity;
    for (const a of pc.attrs ?? []) {
      let attr = next.player.attrs.find((x) => x.key === a.key || x.label === a.label);
      if (!attr) {
        attr = { key: a.key || a.label || uid(), label: a.label || a.key || "属性", value: 0, max: a.max ?? 999, icon: a.icon };
        next.player.attrs.push(attr);
      }
      const before = attr.value;
      if (typeof a.value === "number") attr.value = a.value;
      else if (typeof a.delta === "number") attr.value += a.delta;
      if (a.max) attr.max = a.max;
      attr.value = Math.max(0, Math.min(attr.max, Math.round(attr.value)));
      const d = attr.value - before;
      if (d) changes.push(`${attr.label} ${d > 0 ? "+" : ""}${d}`);
      // 同步回确定性引擎，保持数值一致
      const s = next.sim;
      if (s && d) {
        if (attr.key === "fame") s.fame = Math.max(0, Math.min(1000, s.fame + d));
        else if (attr.key === "reputation") s.reputation = Math.max(0, Math.min(100, s.reputation + d));
        else if (attr.key === "stress") s.stress = Math.max(0, Math.min(100, s.stress + d));
        else if (attr.key in s.stats) s.stats[attr.key as keyof typeof s.stats] = Math.max(0, Math.min(999, s.stats[attr.key as keyof typeof s.stats] + d));
      }
    }
    // 资金变更（AI 可用特殊属性 key: money，单位元）
    // 拒绝超额金钱：单回合叙事金额封顶 ±20 万，避免 AI 凭空发钱破坏账本平衡
    const moneyAttr = (pc.attrs ?? []).find((a) => a.key === "money");
    if (moneyAttr && next.sim && typeof moneyAttr.delta === "number" && Number.isFinite(moneyAttr.delta)) {
      const md = Math.max(-200000, Math.min(200000, Math.round(moneyAttr.delta)));
      next.sim.money += md;
    }
    for (const t of pc.traits_add ?? []) {
      if (!next.player.traits.some((x) => x.name === t.name)) {
        next.player.traits.push(t);
        changes.push(`获得特质「${t.name}」`);
      }
    }
    for (const e of pc.extra ?? []) {
      const ex = next.player.extra.find((x) => x.label === e.label);
      if (ex) ex.value = e.value;
      else next.player.extra.push(e);
    }
    if (pc.history_add) {
      next.player.history.push({ turn, time, title: pc.history_add.title, detail: pc.history_add.detail });
    }
  }

  // AI 生成的标签可能夹带空串/空白/null 或重复项——去空去重再落账，
  // 否则前端以标签值作 key 渲染时会触发 React「唯一 key」告警。
  const cleanTags = (raw: unknown): string[] =>
    Array.isArray(raw) ? Array.from(new Set(raw.map((t) => (typeof t === "string" ? t.trim() : "")).filter(Boolean))) : [];

  // NPC 变更
  for (const nc of step.npc_changes ?? []) {
    let npc: Npc | undefined = next.npcs.find((x) => x.id === nc.id || x.name === nc.name);
    if (!npc) {
      npc = {
        id: nc.id || uid(),
        name: nc.name,
        age: "",
        identity: nc.identity || "神秘人物",
        relation: nc.relation || "初识",
        avatar: "",
        bio: nc.bio || "",
        mood: nc.mood || "平静",
        affinity: 0,
        dims: [
          { label: "信任", value: 0 },
          { label: "爱慕", value: 0 },
          { label: "友善", value: 0 },
          { label: "敌意", value: 0 },
        ],
        tags: cleanTags(nc.tags),
        attrs: [],
        affinityHistory: [],
        interactions: [],
      };
      next.npcs.push(npc);
      changes.push(`结识 ${npc.name}`);
    }
    if (nc.identity) npc.identity = nc.identity;
    if (nc.relation) npc.relation = nc.relation;
    if (nc.bio) npc.bio = nc.bio;
    if (nc.mood) npc.mood = nc.mood;
    if (nc.tags?.length) npc.tags = cleanTags([...npc.tags, ...nc.tags]);
    // 好感统一走确定性引擎 s.rel：AI 的 affinity_delta 只作「建议」，按单回合上限钳制后
    // 落账到 s.rel（0~cap），再镜像回展示轴 npc.affinity。杜绝 AI 绕开冷却/衰减/上限凭空拉满。
    if (typeof nc.affinity_delta === "number" && nc.affinity_delta !== 0 && next.sim) {
      const cap = npc.id === "guchen" || npc.id === "songshixu" ? 1000 : 100;
      const capped = Math.max(-AFFINITY_TURN_CAP, Math.min(AFFINITY_TURN_CAP, Math.round(nc.affinity_delta)));
      const before = next.sim.rel[npc.id] ?? 0;
      const after = Math.max(0, Math.min(cap, before + capped));
      const eff = after - before;
      if (eff !== 0) {
        next.sim.rel[npc.id] = after;
        npc.affinityHistory.push({ turn, delta: eff, reason: nc.reason || "" });
        changes.push(`${npc.name} 好感 ${eff > 0 ? "+" : ""}${eff}`);
      }
    }
    // 展示轴镜像自引擎好感（0~100）；无引擎条目（AI 临时创建的人物）则维持原值
    {
      const relv = next.sim?.rel[npc.id];
      if (relv !== undefined) npc.affinity = Math.max(0, Math.min(100, relv));
    }
    for (const d of nc.dims ?? []) {
      let dim = npc.dims.find((x) => x.label === d.label);
      if (!dim) {
        dim = { label: d.label, value: 0 };
        npc.dims.push(dim);
      }
      if (typeof d.value === "number") dim.value = d.value;
      else if (typeof d.delta === "number") dim.value = Math.max(-100, Math.min(100, dim.value + d.delta));
    }
    if (nc.interaction) npc.interactions.push({ turn, time, text: nc.interaction });
  }

  next.turnCount = turn;
  next.options = step.options ?? [];
  if (step.game_end) {
    next.ended = true;
    if (step.epilogue) next.epilogue = step.epilogue;
  }
  next.updatedAt = Date.now();
  return { next, changes };
}

/* ————— 结局后记：未配置 AI 时的一次性兜底文案（非逐回合生成，不含随机假数据） ————— */
export function mockEpilogue(p: Player): string {
  const n = p.name;
  return [
    `【${n}·后记】`,
    `很多年后，人们提起${n}，总要先顿一顿，像在心里把一整个时代重新走过一遍。`,
    `初春，她拎着一只旧行李箱住进天光公寓的那天，谁也没想到这个在镜子前把转身练到第三十七遍的女孩，会把自己的名字写进华语娱乐圈的年鉴里。那时她一无所有，只有一身不肯认输的倔强，和窗外那盏隔壁常亮到深夜的灯。`,
    `出道的头两年是最难的。她接过没人要的配角，在暴雨里补拍过整夜的戏，也在颁奖礼的角落里，看着别人上台。她学会了在通告车上补眠，学会了把眼泪咽回去再笑给镜头，也学会了辨认哪些递到面前的合同是机会、哪些是陷阱。她跌过、被夺过资源、被黑过热搜，可每一次她都从灰烬里站起来，比从前更亮。`,
    `事业攀上高处时，她终于遇见了那些真正留在生命里的人——有人教她"先信，观众才会信"，有人在她最狼狈时递来一碗热面，也有人把新写的歌，第一个唱给她听。她不是没有软肋的人，只是把软肋都藏进了作品里，于是她的每一个角色都活得那样疼、那样真。`,
    `盛名之下，她做过最勇敢的决定，往往不是接下多大的戏，而是懂得在什么时候说"不"。她把一部分光让给了后来的年轻人，把一部分时间还给了自己，也终于敢在镜头之外，认领属于自己的那份平凡的幸福。`,
    `晚年的${n}很少再谈论奖杯。她说，她记得的都是些很小的事：第一次听见台下有人喊她名字时腿在发抖，深夜排练厅打翻的那杯凉掉的茶，还有很多很多盏，在她看不见的地方，一直为她亮着的灯。`,
    `她把一生活成了一部长剧——有序章的青涩，有高潮的滚烫，也有落幕时的温柔。灯暗下去的时候，她对着空荡荡的舞台鞠了一躬，像在谢幕，也像在道别。`,
    `而那盏灯，据说至今还亮着。`,
  ].join("\n\n");
}
