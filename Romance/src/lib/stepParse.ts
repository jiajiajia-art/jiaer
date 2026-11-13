/**
 * 功能注释：AI 回合状态块的纯解析（无依赖，便于单测）；归一化在 lib/ai.ts 的 normalizeStep。
 */
export type StepParseFail = "no-json" | "truncated" | "invalid";

/* 本地容错：去掉 // 与 /* *\/ 注释（不碰字符串里的内容）、尾逗号 */
export function cleanJsonLoose(src: string): string {
  let out = "", inStr = false, esc = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i], nx = src[i + 1];
    if (inStr) {
      out += ch;
      if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; out += ch; continue; }
    if (ch === "/" && nx === "/") { while (i < src.length && src[i] !== "\n") i++; out += "\n"; continue; }
    if (ch === "/" && nx === "*") { i += 2; while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++; i++; continue; }
    out += ch;
  }
  return out.replace(/,\s*([}\]])/g, "$1");
}

/** 功能注释：括号是否配平（忽略字符串内），用来判断状态块是不是被截断 */
export function balanced(src: string): boolean {
  let depth = 0, inStr = false, esc = false;
  for (const ch of src) {
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") depth--;
  }
  return depth === 0 && !inStr;
}

/**
 * 功能注释：解析 AI 回合输出的状态块，并给出失败原因。
 * 容错：```json 块缺结尾 ``` 时取到末尾；无代码块时取第一个 { 到最后一个 }；去注释与尾逗号。
 * 被截断（括号不配平）的块一律判失败，绝不硬补——状态不完整时宁可重生成也不要半套结算。
 */
export function parseStepJson(full: string): { obj: Record<string, unknown> | null; reason?: StepParseFail } {
  let jsonStr = "";
  const closed = full.match(/```json\s*([\s\S]*?)```/i) || full.match(/```\s*(\{[\s\S]*?)```/);
  if (closed) jsonStr = closed[1];
  else {
    const open = full.search(/```json/i);
    if (open >= 0) jsonStr = full.slice(open).replace(/^```json/i, "");
    else {
      const start = full.indexOf("{");
      const end = full.lastIndexOf("}");
      if (start >= 0) jsonStr = end > start ? full.slice(start, end + 1) : full.slice(start);
    }
  }
  if (!jsonStr.trim()) return { obj: null, reason: "no-json" };
  const tries = [jsonStr, cleanJsonLoose(jsonStr)];
  for (const t of tries) {
    try {
      const obj = JSON.parse(t);
      if (obj && typeof obj === "object" && !Array.isArray(obj)) return { obj: obj as Record<string, unknown> };
    } catch { /* 下一种 */ }
  }
  return { obj: null, reason: balanced(cleanJsonLoose(jsonStr).trim()) ? "invalid" : "truncated" };
}

