/**
 * 开局正文导演提示：按世界观 / 开局人际 / 当前主线任务落笔；
 * 人物卡与人际未设定父母时，禁止模型惯性写「爸妈来电」。
 */
import type { GameState, Storyline } from "./types";

/** 功能注释：默认开局指令——不提父母；作品可另设 openingDirective 覆盖正文骨架 */
export const DEFAULT_OPENING_DIRECTIVE =
  "游戏开始，请写主角的开局序幕。正文只依据本作品已给出的世界观氛围、开局人际与当前主线任务来写，用自然平实、有生活细节的笔触交代此刻处境，把画面落在当前地点。结尾停在一个具体的画面或小钩子上（可由开局已相识的人或主线任务自然引出），由人物动作或台词收住；严禁用旁白对玩家总结或喊话，如「今天没什么硬性的事」「这一天怎么过，全看你自己」「新的一天开始了」「属于她的故事才刚刚开始」「接下来会发生什么呢」。最后给出 3~4 个具体可玩的行动选项。";

const PARENT_JOB_LABELS = new Set(["父亲职业", "母亲职业"]);
const PARENT_REL_RE = /父|母|爸|妈|双亲|养父|养母/;

/** 功能注释：人物卡填了父母职业，或开局人际/关系网里已有父母角色 → 才允许序章写父母 */
export function openingParentsAllowed(g: Pick<GameState, "player" | "npcs" | "relNet" | "sim">): boolean {
  const extras = g.player?.extra ?? [];
  if (extras.some((e) => PARENT_JOB_LABELS.has(e.label) && String(e.value ?? "").trim())) return true;
  if ((g.npcs ?? []).some((n) => PARENT_REL_RE.test(String(n.relation ?? "")))) return true;
  const hid = g.sim?.hero;
  const edges = g.relNet?.edges ?? [];
  if (hid && edges.some((e) => e.kind === "parent" && e.b === hid)) return true;
  // 功能注释：明确「没有父母」时一律禁止
  if (hid && g.relNet?.noParents?.includes(hid)) return false;
  return false;
}

/** 功能注释：仅列开局已相识（metPeople），供序章挂钩，勿让模型另编一拨家人 */
export function openingCastLines(g: Pick<GameState, "npcs" | "sim">): string[] {
  const met = new Set(g.sim?.metPeople ?? []);
  const out: string[] = [];
  for (const n of g.npcs ?? []) {
    if (!n?.id || !n.name?.trim() || !met.has(n.id)) continue;
    const rel = n.relation?.trim();
    out.push(rel ? `${n.name.trim()}（${rel}）` : n.name.trim());
    if (out.length >= 12) break;
  }
  return out;
}

/** 功能注释：轻量取当前主线第一步（与 homeMainQuest 同口径，避免单测链路依赖 registry） */
function openingMainQuestHint(
  lines: Storyline[] | undefined,
  flags: Record<string, number> | undefined,
): { lineName: string; stepName: string; stepDesc?: string } | null {
  for (const line of lines ?? []) {
    if (line.enabled === false || !line.nodes?.length) continue;
    if ((flags?.[`quest:${line.id}`] ?? 0) !== 0) continue;
    for (let i = 0; i < line.nodes.length; i++) {
      const node = line.nodes[i];
      const f = flags?.[`quest:${node.id}`] ?? 0;
      if (f !== 0) continue;
      const ready = line.nodes.slice(0, i).every((n) => n.optional || (flags?.[`quest:${n.id}`] ?? 0) > 0);
      if (!ready) continue;
      const stepName = (node.name || line.name || "主线").trim();
      const stepDesc = (node.desc || "").trim() || undefined;
      return { lineName: (line.name || "主线").trim(), stepName, stepDesc };
    }
  }
  return null;
}

export type OpeningPromptEvent = { name?: string; prompt: string };

export type OpeningPlotCtx = {
  location: string;
  routeEvent?: string;
  game: Pick<GameState, "player" | "npcs" | "relNet" | "sim">;
  storylines?: Storyline[];
  /** 作品自定义 openingDirective；空则用 DEFAULT */
  directive?: string;
  /**
   * 功能注释：固定事件里勾了「开局提示词」的条目——用开局地点 + 这些 prompt 写第一场；
   * 未勾选的不要在开局自动播放。
   */
  openingPromptEvents?: OpeningPromptEvent[];
};

/** 功能注释：只保留勾选且有正文的开局提示词，供编辑器预览与开局拼装共用 */
export function pickOpeningPromptEvents(
  events: Array<{ name?: string; prompt?: string; openingPrompt?: boolean } | null | undefined> | undefined,
): OpeningPromptEvent[] {
  const out: OpeningPromptEvent[] = [];
  for (const e of events ?? []) {
    if (!e || e.openingPrompt !== true) continue;
    const prompt = String(e.prompt ?? "").trim();
    if (!prompt) continue;
    out.push({ name: String(e.name ?? "").trim() || undefined, prompt });
  }
  return out;
}

/**
 * 功能注释：拼开局 runTurn 幕后提示。固定注入地点、人际、主线与「无父母则禁写父母」约束。
 */
export function buildOpeningPlotPrompt(ctx: OpeningPlotCtx): string {
  const parentsOk = openingParentsAllowed(ctx.game);
  const cast = openingCastLines(ctx.game);
  const quest = openingMainQuestHint(ctx.storylines, ctx.game.sim?.flags);
  const directive = (ctx.directive ?? "").trim() || DEFAULT_OPENING_DIRECTIVE;
  const openingPrompts = (ctx.openingPromptEvents ?? []).filter((e) => e.prompt.trim());

  const bits: string[] = [];
  if (ctx.routeEvent?.trim()) bits.push(ctx.routeEvent.trim().endsWith("\n") ? ctx.routeEvent.trim() : `${ctx.routeEvent.trim()}\n`);

  bits.push(
    `【开局地点】主角此刻身处「${ctx.location}」，序章收束时必须仍在这里，world.location 保持为「${ctx.location}」。`,
  );
  if (openingPrompts.length) {
    const lines = openingPrompts.map((e, i) => {
      const title = e.name?.trim() || `提示词 ${i + 1}`;
      return `- 「${title}」：${e.prompt.trim()}`;
    });
    bits.push(
      `【开局提示词】结合开局地点，把下列已勾选固定事件提示词自然写进第一场剧情（未勾选的固定事件不要在开局自动播放）：\n${lines.join("\n")}`,
    );
  }
  bits.push(
    "【序章篇幅与文风】正文约 450~550 字（不含 JSON），写成自然连贯的开场白；严禁写章节标题、时间标题。文风追求生活化、烟火气与真实人情味——严禁生造说教比喻与矫揉造作的 AI 腔调（如「把这话说得很轻，轻得像怕惊着她」「舞台上的那口气，只有站上去的人才懂」）。",
  );
  bits.push(
    "【取材范围】只按本作品世界观氛围、下列开局人际与当前主线任务来写；不得套用「爸妈来电叮嘱」之类通用开场模板。",
  );
  if (cast.length) {
    bits.push(`【开局人际】可自然带出（勿新增名单外的家人）：${cast.join("、")}。`);
  } else {
    bits.push("【开局人际】本局暂无已标开局相识的人物；可用场景里的路人气息，但不要编造主角的父母或未设定亲属。");
  }
  if (quest) {
    const detail = quest.stepDesc ? `——${quest.stepDesc}` : "";
    bits.push(`【当前主线】「${quest.lineName}」· ${quest.stepName}${detail}。序章结尾的钩子应能接到这条主线，而不是无关的家庭电话。`);
  } else {
    bits.push("【当前主线】作品未配置进行中的主线节点；结尾钩子用当下地点与处境即可，仍不要写父母来电。");
  }
  if (!parentsOk) {
    bits.push(
      "【人际约束】人物卡未填父母职业，开局人际与关系网也未设定父母：严禁出现母亲/父亲/爸妈来电、唠叨、问钱、寄酱菜、劝阻入行等情节，也不得暗示「家里刚打来电话」。",
    );
  }

  bits.push(directive);
  return bits.join("\n");
}
