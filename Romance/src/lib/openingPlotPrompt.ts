/**
 * 开局正文导演提示：按世界观 / 开局人际 / 当前主线任务落笔；
 * 人物卡与人际未设定父母时，禁止模型惯性写「爸妈来电」。
 */
import type { GameState, Storyline } from "./types";
import { entertainmentPlayOn } from "../mods/registry";

/** 功能注释：默认开局指令——不提父母；作品可另设 openingDirective 覆盖正文骨架 */
export const DEFAULT_OPENING_DIRECTIVE =
  "游戏开始，请按作品设定写主角在当前地点遇到的第一件事。用开局人际与当前主线交代眼下的处境，停在玩家可以回应的动作或台词上。最后给出 3 个能接上当前场景的行动选项。";

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
  /** 功能注释：开局地点的场景描述，避免模型只看到地名就另编一套日常 */
  locationDesc?: string;
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

  const placeDesc = (ctx.locationDesc ?? "").trim();
  bits.push(
    `【开局地点】主角此刻身处「${ctx.location}」${placeDesc ? `。此地是：${placeDesc}` : ""}。序章必须写这里，不得改成别的城市、别的房子或另一套职业日常。world.location 保持为「${ctx.location}」。`,
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
    "【序章篇幅与文风】沿用文风基底和作品明确指定的文风、视角与篇幅。作品未指定篇幅时，写到玩家看清眼前发生了什么、知道能怎么接就停；一次简短搭话可以只写几句，涉及开局事件时按事件所需展开。让在场人物尽早说出或做出引发互动的事。正文直接进入场景，省略章节标题和时间标题。",
  );
  bits.push(
    "【取材范围】必须遵守作品系统提示词里的时代、地点、人物身份、禁忌，以及它写明的开局第一幕。下面的开局人际、主线与开局提示词也要写进去。不得另编一套无关的日常（例如系统提示词没写的经纪公司、招聘、陌生来电）。未设定父母时，也不得套用「爸妈来电叮嘱」模板。",
  );
  if (!entertainmentPlayOn()) {
    bits.push(
      "【题材边界】本作品没有演艺事业。开局不得出现经纪公司、经纪人、通告、试镜、出道、粉丝、黑粉、名气、片场、练习生、选角、星探、综艺、代言、红毯，也不得把主角写成艺人或正在投简历进娱乐圈的人。",
    );
  }
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
  const openingMentionsParents = openingPrompts.some((e) => PARENT_REL_RE.test(e.prompt));
  if (!parentsOk && !openingMentionsParents) {
    bits.push(
      "【人际约束】人物卡未填父母职业，开局人际与关系网也未设定父母：严禁出现母亲/父亲/爸妈来电、唠叨、问钱、寄酱菜、劝阻入行等情节，也不得暗示「家里刚打来电话」。",
    );
  }

  bits.push(directive);
  return bits.join("\n");
}
