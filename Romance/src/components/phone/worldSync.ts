import { getWorld } from "../../mods/registry";
import { loadData, saveData, onClearPlayerMemory } from "../../lib/saveScope";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { complete, isConfigured, buildSimSnapshot } from "../../lib/ai";
import { affinityOf, romanceBlock } from "../../game/npcKnowledge";
import type { AIConfig, GameState } from "../../lib/types";

/* 小手机 ×「世界剧情」同步层。
 * - 每个应用用 useWorldSync(appId, handler) 登记自己的刷新逻辑；状态栏右上角那颗固定的刷新键只调用当前应用登记的 handler。
 * - 所有 AI 请求统一走 syncJson：注入「主线记忆摘要 + 最近剧情 + 数值 + 人物」，并附上该应用的「应用记忆摘要」。
 * - 模型每次额外返回 "_mem"（≤200 字的应用记忆摘要），存进 localStorage，下次刷新再传入，保证同一应用内容前后连贯。
 * - 生成结果由各应用用 loadFeed / saveFeed 自行缓存，重进应用不丢失。 */

const MEM_KEY = (app: string) => `star2005.phone.mem.${app}`;
const FEED_KEY = (app: string) => `star2005.phone.feed.${app}`;

// 应用记忆 / 内容缓存都是存档私有数据：按 saveId 隔离（如咸鱼集市的「已拍下」不会串到新存档）
export function getAppMem(app: string): string {
  return loadData<string>(MEM_KEY(app), "");
}
function setAppMem(app: string, mem: string) {
  saveData(MEM_KEY(app), mem.slice(0, 400));
}

export function loadFeed<T>(app: string): T | null {
  return loadData<T | null>(FEED_KEY(app), null);
}
export function saveFeed<T>(app: string, data: T) {
  saveData(FEED_KEY(app), data);
}

/* 世界剧情上下文：主线以「记忆摘要」形式传入，再补最近两回合原文 */
export function phoneContext(game: GameState): string {
  const npcLine = game.npcs.slice(0, 12).map((n) => {
    const love = romanceBlock(game, n.id, true); // 家人返回空
    return `${n.name}（${n.identity}，与主角${n.relation}，好感${affinityOf(game, n.id)}${love ? `，${love}` : ""}，心情${n.mood || "平常"}）`;
  }).join("、");
  const last = game.story.slice(-2).map((t) => t.segments.map((s) => (s.kind === "dialogue" ? `${s.speaker}：${s.text}` : s.text)).join(" ")).join("\n");
  return `${buildSimSnapshot(game)}
主角：${game.player.name}（${game.player.identity}）${game.player.description ? `，${game.player.description}` : ""}
圈内人物：${npcLine || "（暂无）"}
【主线记忆摘要】${game.memory || "（游戏刚开始）"}
【最近剧情】${last || "（暂无）"}
${PUBLIC_VOICE}`;
}

/* 以上数值与剧情是给 AI 的幕后资料；小手机里的发言者是剧中人，只能知道他们在现实中可能知道的事 */
const PUBLIC_VOICE = `【网络发言真实性·必须遵守】
· 上面的数值（演技/歌艺/名气/压力/行动力/好感/爱慕等任何分数）、阶段名（素人期等）、"八维""属性""数据"这类游戏术语，网友与圈内人一概看不到，严禁在任何发言里出现数字评分或游戏术语；只能转化为现实里可感知的说法（如"台词功底扎实""还没什么名气""看着挺累"）。
· 好感、爱慕是幕后资料，只用来把握分寸：好感决定熟络与热络，爱慕是本人私下的心动——只能由本人含蓄流露（更上心、偏爱、在意、偶尔吃醋），不能直白说破；爱慕为 0 或标注不可攻略的人不暧昧；主角的家人只有亲情。朋友圈、微博、论坛、评论区等公开内容里，不得写出未公开的心意、暗恋或私下往来，旁人与网友无从知晓，更不能替当事人点破。
· 信息不对称：陌生网友、路人、营销号只知道公开或可目击的事；合同条款、违约金金额、家庭矛盾、内心想法、私下对话等私密信息不得被路人点破，除非剧情里已明确曝光或泄露。熟人也只知道自己亲历或听说的部分，可以猜错。
· 主角尚无名气时，关于她的帖子应极少且模糊（多半不点名，或只是邻居、同学的随口一提）；大部分内容写这个世界里别的人、别的事、别的热点，让网络像真实的网络。
· 语气像真人随手发帖：口语化、有错落、带情绪与偏见，可以八卦但别像剧情复述或数据播报。`;

function parseJson<T>(raw: string): T | null {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let s = fence ? fence[1] : raw;
  const a = s.search(/[[{]/), b = Math.max(s.lastIndexOf("]"), s.lastIndexOf("}"));
  if (a < 0 || b <= a) return null;
  s = s.slice(a, b + 1);
  try { return JSON.parse(s) as T; } catch { return null; }
}

/* 统一的同步请求：task 描述要生成什么、返回 JSON 对象的结构。返回对象（已剥掉 _mem），失败或未配置返回 null。 */
export async function syncJson<T extends object>(cfg: AIConfig, game: GameState, app: string, appLabel: string, task: string): Promise<T | null> {
  if (!isConfigured(cfg)) return null;
  const mem = getAppMem(app);
  const out = await complete(cfg, [
    { role: "system", content: `你是文字游戏《${getWorld().chain[0]?.name || "未命名作品"}》里小手机应用「${appLabel}」的内容引擎。内容必须紧扣世界剧情与人物现状，并与该应用过往内容前后连贯（人物、事件、时间线不得矛盾）。只输出 JSON 对象，不要任何解释。` },
    { role: "user", content: `${phoneContext(game)}\n【本应用记忆摘要】${mem || "（首次打开，暂无）"}\n\n任务：${task}\n\n另外务必在 JSON 对象里附加字段 "_mem"：用 ≤200 字概括本应用至今（含本次）出现过的关键内容，供下次续写保持连贯。` },
  ]);
  const p = parseJson<T & { _mem?: unknown }>(out);
  if (!p || typeof p !== "object" || Array.isArray(p)) return null;
  if (typeof p._mem === "string" && p._mem.trim()) setAppMem(app, p._mem.trim());
  delete p._mem;
  return p as T;
}

/* ── 刷新键登记表 ── */
type Handler = () => Promise<string | void>;
const handlers = new Map<string, Handler>();
let busyApp: string | null = null;
let version = 0;
const subs = new Set<() => void>();
const emit = () => { version++; subs.forEach((f) => f()); };
// 切档：丢弃进行中的刷新状态，避免旧存档的请求结果写进新存档界面
onClearPlayerMemory(() => { busyApp = null; emit(); });
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

/* 应用内调用：登记右上角刷新逻辑。handler 返回的字符串会作为提示条显示。 */
/** autoWhen：打开应用时内容为空（且能生成）就自动按当前世界生成一次，不再用预设内容垫底 */
export function useWorldSync(app: string, handler: Handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    handlers.set(app, () => ref.current());
    emit();
    return () => { handlers.delete(app); emit(); };
  }, [app]);
}

export function useSyncState(app: string | null) {
  useSyncExternalStore(subscribe, () => version);
  return { available: !!app && handlers.has(app), busy: !!app && busyApp === app };
}

export async function runSync(app: string): Promise<string> {
  const h = handlers.get(app);
  if (!h || busyApp) return "";
  busyApp = app; emit();
  try { return (await h()) || "已联动世界剧情刷新"; }
  catch { return "刷新失败，请稍后再试"; }
  finally { busyApp = null; emit(); }
}
