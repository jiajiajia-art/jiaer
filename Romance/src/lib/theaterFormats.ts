/**
 * 小剧场格式（参考小红书 / 酒馆流行的「小剧场」玩法）：让角色用朋友圈、群聊截图、论坛帖、日记、
 * 直播弹幕、搜索记录、备忘录等「媒介」演一段番外，AI 输出一张自带样式的 HTML 卡片，在无脚本沙盒里展示。
 * 本文件只放纯逻辑（格式表 / 指令拼装 / 输出解析 / HTML 清洗），便于单测。
 */
export type TheaterFormatId = "moments" | "groupchat" | "forum" | "diary" | "live" | "search" | "memo" | "text";
export type TheaterFormat = { id: TheaterFormatId; label: string; hint: string; brief: string };

export const THEATER_FORMATS: readonly TheaterFormat[] = [
  { id: "moments", label: "朋友圈", hint: "动态 + 点赞评论", brief: "仿手机朋友圈：1~3 条某位角色发的动态（头像首字圆标、昵称、配文、时间、可用色块代替配图），下方是其他角色的点赞名单与评论区互怼 / 暗戳戳互动，评论 4~10 条。" },
  { id: "groupchat", label: "群聊", hint: "聊天记录截图", brief: "仿手机群聊截图：顶部群名与人数，气泡左右分布（主角在右），带昵称与首字头像，穿插表情包文字描述、撤回提示、@某人、时间分隔条，12~24 条消息，要有反转或笑点。" },
  { id: "forum", label: "论坛帖", hint: "匿名树洞 / 吃瓜", brief: "仿匿名论坛 / 树洞帖：标题、楼主匿名发帖（隐晦描述与主角有关的事），下面 6~12 层回复，楼层号、匿名昵称、点赞数，角色们马甲互认或暗中护短，结尾可有楼主更新。" },
  { id: "diary", label: "日记", hint: "某位角色的手账", brief: "仿某位角色的私人日记 / 手账页：日期、天气、心情贴纸（用小色块与文字表示），手写感排版，有划掉重写的句子（用删除线），写 TA 对主角没说出口的在意。" },
  { id: "live", label: "直播间", hint: "弹幕 + 礼物", brief: "仿直播间画面：主播（某位角色）与直播标题、在线人数，画面描述一句，右侧或下方滚动弹幕 15~25 条（观众与其他角色的马甲），穿插礼物特效提示与主播回应。" },
  { id: "search", label: "搜索记录", hint: "TA 手机里的搜索", brief: "仿某位角色手机浏览器的搜索历史：8~14 条搜索词（带时间），从正经到越来越暴露心事，偶尔有删除记录的提示，末尾一条最戳人。" },
  { id: "memo", label: "备忘录", hint: "清单与碎碎念", brief: "仿手机备忘录：标题、修改时间，若干条待办清单（打勾 / 未勾）与碎碎念，内容关于主角，透出角色的小心思。" },
  { id: "text", label: "番外", hint: "纯文字短剧", brief: "" },
];

export const theaterFormatOf = (id?: string): TheaterFormat => THEATER_FORMATS.find((f) => f.id === id) ?? THEATER_FORMATS[THEATER_FORMATS.length - 1];

/** 拼装发给 AI 的小剧场指令（cast 为此地在场人物名，空 = 让 AI 从核心人物里挑） */
export function buildTheaterDirective(formatId: string | undefined, topic: string, cast: string[]): string {
  const f = theaterFormatOf(formatId);
  const who = `主角${cast.length ? `与${cast.join("、")}` : "与【核心人物】里合适的一两位"}`;
  const head = `【小剧场 · 番外，不是正式剧情】形式：${f.label}。${topic ? `主题：「${topic}」。` : "主题自拟：轻松、有趣、甜或有反差萌。"}
出场人物：${who}；人物性格、口吻、彼此关系必须符合设定，可以夸张、玩梗、脑洞，但不要崩人设。这是平行番外：不推进主线、不影响正式剧情，不要写任何结算或数值。`;
  if (f.id === "text") {
    return `${head}
篇幅 300~600 字，旁白与「角色名」：台词交替，结尾落在一个有趣或温暖的瞬间。
输出格式：第一行「【标题】」+ 6~12 字标题；然后是剧情正文；最后一行「【梗概】」+ 一句话梗概（30 字内）。不要输出 JSON、选项或其他字段。`;
  }
  return `${head}
${f.brief}
用 HTML 做成一张精致的「${f.label}」卡片：
- 只输出一个 \`\`\`html 代码块，内容是完整的 HTML（可含 <style>），宽度适配 360px 手机竖屏，内容高度自适应；
- 只用内联 CSS / <style>，不要 <script>、不要外链图片与字体、不要表单；头像用带首字的圆形色块，配图用渐变色块或 emoji 代替；
- 配色干净有质感，贴近真实 App 的样子，文字清晰可读；
- 内容全部中文，人名写全名。
输出格式：第一行「【标题】」+ 6~12 字标题；然后是 \`\`\`html 代码块；最后一行「【梗概】」+ 一句话梗概（30 字内，说清发生了什么）。不要输出 JSON、选项或其他字段。`;
}

export type TheaterParsed = { title: string; summary: string; prose: string; html: string };

/** 解析 AI 输出：标题 / 梗概 / HTML（有则清洗）/ 纯文字正文（去掉标题、梗概与代码块） */
export function parseTheaterOutput(raw: string): TheaterParsed {
  const text = String(raw ?? "");
  const title = (text.match(/【标题】\s*([^\n]+)/)?.[1] ?? "").replace(/[【】「」《》*#]/g, "").trim().slice(0, 20);
  const summary = (text.match(/【梗概】\s*([^\n]+)/)?.[1] ?? "").replace(/[*#]/g, "").trim().slice(0, 60);
  const fenced = /```(?:html)?\s*\n([\s\S]*?)(?:```|$)/i.exec(text)?.[1]?.trim() ?? "";
  const html = /<[a-z!][\s\S]*>/i.test(fenced) ? sanitizeTheaterHtml(fenced) : "";
  const prose = text
    .replace(/```[\s\S]*?(```|$)/g, "")
    .replace(/^.*【标题】[^\n]*\n?/m, "")
    .replace(/\n?.*【梗概】[^\n]*/m, "")
    .trim();
  return { title, summary, prose, html };
}

/** 清洗：去脚本 / 事件属性 / javascript: / 外链资源与表单；展示时再放进无脚本沙盒，双保险 */
export function sanitizeTheaterHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script[^>]*>/gi, "")
    .replace(/<(iframe|object|embed|form|link|meta|base)\b[^>]*>(?:[\s\S]*?<\/\1\s*>)?/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "$1=$2#$2")
    .replace(/url\(\s*(['"]?)\s*(https?:|\/\/)[^)]*\)/gi, "none")
    .replace(/\s(src)\s*=\s*("|')\s*(https?:|\/\/)[^"']*\2/gi, "");
}

/** 沙盒文档：统一字体与底色，宽度跟随容器 */
export function theaterSrcDoc(html: string): string {
  const body = /<html[\s>]/i.test(html) ? html : `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${html}</body></html>`;
  const base = `<style>html,body{margin:0;padding:0;background:transparent;font-family:"PingFang SC","Microsoft YaHei",system-ui,sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden}*{box-sizing:border-box;max-width:100%}</style>`;
  return body.replace(/<head([^>]*)>/i, `<head$1>${base}`).replace(/^(?![\s\S]*<head)/, base);
}
