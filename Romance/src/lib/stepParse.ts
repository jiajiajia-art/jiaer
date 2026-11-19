/**
 * 功能注释：AI 回合状态块的纯解析（无依赖，便于单测）；归一化在 lib/ai.ts 的 normalizeStep。
 */
export type StepParseFail = "no-json" | "truncated" | "invalid";

/* 本地容错：去掉 // 与 /* *\/ 注释（不碰字符串里的内容）、尾逗号；
 * 字符串里的裸换行 / 制表符转义；字符串外的全角冒号逗号、中文弯引号当作 JSON 语法符号（模型常这样写）。 */
export function cleanJsonLoose(src: string): string {
  let out = "", inStr = false, esc = false, closer = '"';
  for (let i = 0; i < src.length; i++) {
    const ch = src[i], nx = src[i + 1];
    if (inStr) {
      if (esc) { esc = false; out += ch; continue; }
      if (ch === "\\") { esc = true; out += ch; continue; }
      if (ch === closer) { inStr = false; out += '"'; continue; }
      if (closer !== '"' && ch === '"') { out += '\\"'; continue; }
      if (ch === "\n") { out += "\\n"; continue; }
      if (ch === "\r") { out += "\\r"; continue; }
      if (ch === "\t") { out += "\\t"; continue; }
      out += ch;
      continue;
    }
    if (ch === '"') { inStr = true; closer = '"'; out += ch; continue; }
    if (ch === "\u201c") { inStr = true; closer = "\u201d"; out += '"'; continue; }
    if (ch === "\uff1a") { out += ":"; continue; }
    if (ch === "\uff0c") { out += ","; continue; }
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
 * 功能注释：修复模型常见的「字符串内」错误——中文叙事里直接写英文双引号（"你好"）、字符串里直接换行 / 制表符；
 * 以及字符串外误用全角逗号 / 冒号。内部双引号的判定：其后（跳过空白）不是 , : } ] 或结尾，就视为正文里的引号并转义。
 */
export function repairJsonStrings(src: string): string {
  let out = "", inStr = false, esc = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (esc) { esc = false; out += ch; continue; }
      if (ch === "\\") { esc = true; out += ch; continue; }
      if (ch === "\n") { out += "\\n"; continue; }
      if (ch === "\r") { out += "\\r"; continue; }
      if (ch === "\t") { out += "\\t"; continue; }
      if (ch === '"') {
        let j = i + 1;
        while (j < src.length && /\s/.test(src[j])) j++;
        const nx = src[j];
        if (nx === undefined || nx === "," || nx === ":" || nx === "}" || nx === "]") { inStr = false; out += ch; }
        else out += '\\"';
        continue;
      }
      out += ch;
      continue;
    }
    if (ch === '"') { inStr = true; out += ch; continue; }
    out += ch === "，" ? "," : ch === "：" ? ":" : ch;
  }
  return out;
}

function tryParse(src: string): Record<string, unknown> | null {
  for (const t of [src, cleanJsonLoose(src), cleanJsonLoose(repairJsonStrings(src)), repairJsonStrings(cleanJsonLoose(src))]) {
    try {
      const obj = JSON.parse(t);
      if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj as Record<string, unknown>;
    } catch { /* 下一种 */ }
  }
  return null;
}

/**
 * 功能注释：解析 AI 回合输出的状态块，并给出失败原因。
 * 容错：```json 块缺结尾 ``` 时取到末尾；字符串里含 ``` 时改取到最后一个 ```；无代码块时从每个 { 起逐个尝试到最后一个 }；
 * 去注释与尾逗号；修复字符串内未转义的引号 / 换行。
 * 被截断（括号不配平）的块一律判失败，绝不硬补——状态不完整时宁可重生成也不要半套结算。
 */
export function parseStepJson(full: string): { obj: Record<string, unknown> | null; reason?: StepParseFail } {
  const cands: string[] = [];
  const open = full.search(/```json/i) >= 0 ? full.search(/```json/i) : full.search(/```\s*\{/);
  if (open >= 0) {
    const body = full.slice(open).replace(/^```(json)?/i, "");
    const firstClose = body.indexOf("```");
    const lastClose = body.lastIndexOf("```");
    if (firstClose >= 0) cands.push(body.slice(0, firstClose));
    if (lastClose > firstClose) cands.push(body.slice(0, lastClose));
    if (firstClose < 0) cands.push(body);
  } else {
    const end = full.lastIndexOf("}");
    for (let s = full.indexOf("{"); s >= 0 && cands.length < 8; s = full.indexOf("{", s + 1)) {
      cands.push(end > s ? full.slice(s, end + 1) : full.slice(s));
    }
  }
  const main = cands.find((c) => c.trim()) ?? "";
  if (!main.trim()) return { obj: null, reason: "no-json" };
  for (const c of cands) {
    if (!c.trim()) continue;
    const obj = tryParse(c.trim());
    if (obj) return { obj };
  }
  const last = cands[cands.length - 1];
  return { obj: null, reason: balanced(cleanJsonLoose(repairJsonStrings(last)).trim()) ? "invalid" : "truncated" };
}
