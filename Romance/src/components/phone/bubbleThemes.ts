/**
 * 绿信气泡主题：A 类可改颜色（底色 / 字色走 CSS 变量 --wxb-bg / --wxb-fg），B 类为固定配色的成套风格，另有「自定义」CSS。
 * 气泡元素类名：wxb wxb-A|wxb-B wxb-<id> wxb-me|wxb-them；自定义 CSS 只作用于 .wxb-custom 气泡（逐条加作用域）。
 * 纯数据 + 纯函数，便于单测；样式表由 ensureBubbleCss 注入一次。
 */
export type BubbleKind = "A" | "B";
export type BubbleTheme = { id: string; label: string; kind: BubbleKind; css: string; swatch?: string };

/** A 类默认配色（未自定义时） */
export const A_DEFAULTS = { themBg: "#FFFFFF", meBg: "#A7C7E7", themFg: "#5D534A", meFg: "#FFFFFF" };

const me = (id: string) => `.wxb-${id}.wxb-me`;
const them = (id: string) => `.wxb-${id}.wxb-them`;
const both = (id: string) => `.wxb-${id}`;

export const BUBBLE_THEMES: readonly BubbleTheme[] = [
  // —— A 类：形状 / 质感，颜色可自定 ——
  { id: "a-default", label: "默认", kind: "A", css: `${both("a-default")}{box-shadow:0 1px 2px rgba(0,0,0,.08)}` },
  { id: "a-3d", label: "立体3D", kind: "A", css: `${both("a-3d")}{box-shadow:0 3px 0 rgba(0,0,0,.18),inset 0 1px 0 rgba(255,255,255,.55);transform:translateY(-1px)}` },
  { id: "a-neu", label: "拟态", kind: "A", css: `${both("a-neu")}{box-shadow:5px 5px 12px rgba(0,0,0,.14),-4px -4px 10px rgba(255,255,255,.85)}` },
  { id: "a-stripe", label: "柔和条纹", kind: "A", css: `${both("a-stripe")}{background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.22) 0 7px,transparent 7px 14px)}` },
  { id: "a-grid", label: "网格", kind: "A", css: `${both("a-grid")}{background-image:linear-gradient(rgba(0,0,0,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.06) 1px,transparent 1px);background-size:10px 10px;border:1px solid rgba(0,0,0,.08)}` },
  { id: "a-cute", label: "可爱风", kind: "A", css: `${both("a-cute")}{border:2px dashed rgba(255,255,255,.75);border-radius:18px!important;box-shadow:0 0 0 2px var(--wxb-bg),0 4px 0 2px rgba(0,0,0,.12)}` },
  { id: "a-os", label: "简约os", kind: "A", css: `${both("a-os")}{border:1.5px solid #2b2b2b;border-radius:4px!important;box-shadow:3px 3px 0 #2b2b2b;font-family:ui-monospace,"SF Mono",Menlo,monospace}` },
  // —— B 类：成套风格，配色固定 ——
  { id: "b-neu2", label: "拟态2", kind: "B", swatch: "#e0e5ec", css: `${both("b-neu2")}{background:#e0e5ec;color:#4a5568;border-radius:16px;box-shadow:6px 6px 12px #b8bec7,-6px -6px 12px #ffffff}${me("b-neu2")}{box-shadow:inset 4px 4px 8px #b8bec7,inset -4px -4px 8px #ffffff}` },
  { id: "b-ancient", label: "古风", kind: "B", swatch: "#f3e6c8", css: `${both("b-ancient")}{background:#f6ecd2;color:#4a3420;border:3px double #a0743f;border-radius:6px;font-family:"Songti SC","STSong",serif;box-shadow:0 2px 6px rgba(120,80,30,.18)}${me("b-ancient")}{background:#efdcb4}` },
  { id: "b-guofeng", label: "国风", kind: "B", swatch: "#b22c2c", css: `${me("b-guofeng")}{background:linear-gradient(180deg,#c0392b,#9e2a22);color:#fff4e0;border:1.5px solid #e2b866;border-radius:10px 2px 10px 10px}${them("b-guofeng")}{background:#fff8ef;color:#5b3a1e;border:1.5px solid #c9a063;border-radius:2px 10px 10px 10px}` },
  { id: "b-doodle", label: "手绘涂鸦", kind: "B", swatch: "#fff59d", css: `${both("b-doodle")}{background:#fff;color:#222;border:2px solid #222;border-radius:255px 15px 225px 15px/15px 225px 15px 255px;box-shadow:2px 3px 0 #222}${me("b-doodle")}{background:#fff59d}` },
  { id: "b-doodle2", label: "手绘涂鸦2", kind: "B", swatch: "#ffd6e7", css: `${both("b-doodle2")}{background:#fffdf7;color:#3b2f2f;border:2px dashed #3b2f2f;border-radius:15px 225px 15px 255px/255px 15px 225px 15px;transform:rotate(-.6deg)}${me("b-doodle2")}{background:#ffd6e7;transform:rotate(.6deg)}` },
  { id: "b-cutestripe", label: "可爱条纹", kind: "B", swatch: "#ffc1d6", css: `${both("b-cutestripe")}{color:#7a3550;border-radius:16px;border:2px solid #ff9fbf;background:repeating-linear-gradient(45deg,#ffe3ee 0 8px,#fff4f8 8px 16px)}${me("b-cutestripe")}{border-color:#9fc9ff;color:#2f4f7a;background:repeating-linear-gradient(45deg,#e3f0ff 0 8px,#f4f9ff 8px 16px)}` },
  { id: "b-rainbow", label: "渐变彩虹", kind: "B", swatch: "#ff8fb1", css: `${both("b-rainbow")}{color:#fff;border-radius:16px;text-shadow:0 1px 2px rgba(0,0,0,.25);background:linear-gradient(120deg,#ff8fb1,#ffb86b,#ffe66d,#7bdcb5,#7aa7ff,#c38bff)}${them("b-rainbow")}{background:linear-gradient(120deg,#c38bff,#7aa7ff,#7bdcb5)}` },
  { id: "b-jelly", label: "发光果冻", kind: "B", swatch: "#7ee8fa", css: `${both("b-jelly")}{color:#fff;border-radius:18px;background:linear-gradient(160deg,rgba(126,232,250,.95),rgba(238,192,198,.95));box-shadow:0 0 12px rgba(126,232,250,.7),inset 0 6px 8px rgba(255,255,255,.55),inset 0 -4px 6px rgba(0,0,0,.08)}${them("b-jelly")}{background:linear-gradient(160deg,rgba(255,214,230,.95),rgba(199,206,255,.95));color:#5a4a6e;box-shadow:0 0 12px rgba(255,170,210,.6),inset 0 6px 8px rgba(255,255,255,.6)}` },
  { id: "b-metal", label: "金属质感", kind: "B", swatch: "#c9ced6", css: `${both("b-metal")}{color:#1f2329;border-radius:8px;border:1px solid #8b939e;background:linear-gradient(180deg,#f4f6f8 0%,#c9ced6 48%,#e7eaee 52%,#b4bac4 100%);box-shadow:inset 0 1px 0 #fff,0 2px 4px rgba(0,0,0,.2)}${me("b-metal")}{background:linear-gradient(180deg,#fff3d1 0%,#d8b25a 48%,#f0d38a 52%,#b8913d 100%);border-color:#9a7a33}` },
  { id: "b-ocean", label: "海洋风", kind: "B", swatch: "#4facfe", css: `${both("b-ocean")}{color:#fff;border-radius:18px 18px 18px 6px;background:linear-gradient(160deg,#4facfe,#00c6fb);box-shadow:0 4px 10px rgba(0,140,220,.25)}${them("b-ocean")}{color:#0b4f6c;border-radius:18px 18px 6px 18px;background:linear-gradient(160deg,#e0f7ff,#bfeaff)}` },
  { id: "b-paw", label: "猫爪风", kind: "B", swatch: "#ffe4ea", css: `${both("b-paw")}{color:#7a4b55;border-radius:18px;border:2px solid #ffc2cf;background-color:#fff5f7;background-image:radial-gradient(circle at 20% 30%,rgba(255,170,190,.35) 0 3px,transparent 4px),radial-gradient(circle at 70% 70%,rgba(255,170,190,.35) 0 3px,transparent 4px);background-size:22px 22px}${me("b-paw")}{background-color:#ffe4ea;border-color:#ff9fb5}` },
  { id: "b-green", label: "绿色", kind: "B", swatch: "#95ec69", css: `${me("b-green")}{background:#95ec69;color:#1a1a1a;border-radius:4px}${them("b-green")}{background:#fff;color:#1a1a1a;border-radius:4px}` },
  { id: "custom", label: "自定义", kind: "B", css: "" },
];

export const bubbleThemeOf = (id?: string): BubbleTheme | undefined => BUBBLE_THEMES.find((t) => t.id === id);

/** 自定义 CSS 示例（放进输入框占位） */
export const CUSTOM_CSS_HINT = `/* 用 .wxb-me（我的）/ .wxb-them（好友）写样式，只作用于聊天气泡 */
.wxb-me { background: #ffd1dc; color: #7a3550; border-radius: 16px; }
.wxb-them { background: #fff; color: #333; border: 1px solid #eee; }`;

/**
 * 给自定义 CSS 加作用域：每条选择器限定到 .wxb-custom 气泡上，去掉 @import / 外链 / 脚本痕迹，避免影响页面其他部分。
 * 支持普通规则与 @keyframes；其他 at-rule（如 @media）丢弃。
 */
export function scopeCustomCss(raw: string, scope = ".wxb-custom"): string {
  let css = String(raw ?? "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/<\/?style[^>]*>/gi, "")
    .replace(/@import[^;]*;?/gi, "")
    .replace(/url\(\s*(['"]?)\s*(https?:|\/\/|javascript:)[^)]*\)/gi, "none")
    .replace(/expression\s*\(/gi, "(")
    .replace(/javascript:/gi, "");
  const out: string[] = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open < 0) break;
    const head = css.slice(i, open).trim();
    // 找到与之匹配的右括号（@keyframes 内含嵌套）
    let depth = 1, j = open + 1;
    while (j < css.length && depth) { if (css[j] === "{") depth++; else if (css[j] === "}") depth--; j++; }
    const body = css.slice(open + 1, j - 1);
    i = j;
    if (!head) continue;
    if (head.startsWith("@")) {
      if (/^@(-webkit-)?keyframes\s+[\w-]+$/i.test(head)) out.push(`${head}{${body}}`);
      continue;
    }
    const sels = head.split(",").map((s) => s.trim()).filter(Boolean).map((s) => {
      const pseudo = s.match(/::?(before|after|first-line|first-letter|selection|placeholder)$/i);
      const base = pseudo ? s.slice(0, pseudo.index).trim() : s;
      return `${scope}:is(${base || "*"})${pseudo ? pseudo[0] : ""}`;
    });
    if (sels.length) out.push(`${sels.join(",")}{${body.replace(/[{}]/g, "")}}`);
  }
  return out.join("\n");
}

/** 气泡基础样式（全部主题共用）+ 各主题 CSS */
export function bubbleThemesCss(): string {
  const base = `.wxb{display:inline-block;max-width:100%;word-break:break-word;transition:background .2s,box-shadow .2s}.wxb-A{background:var(--wxb-bg);color:var(--wxb-fg)}`;
  return base + BUBBLE_THEMES.map((t) => t.css).join("");
}

/** 注入 / 刷新样式表（浏览器环境）；customCss 变化时只更新自定义那张 */
export function ensureBubbleCss(customCss: string, previewCss?: string): void {
  if (typeof document === "undefined") return;
  const put = (id: string, text: string) => {
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (!el) { el = document.createElement("style"); el.id = id; document.head.appendChild(el); }
    if (el.textContent !== text) el.textContent = text;
  };
  put("wxb-themes", bubbleThemesCss());
  put("wxb-custom", scopeCustomCss(customCss, ".wxb-custom"));
  put("wxb-custom-preview", scopeCustomCss(previewCss ?? "", ".wxb-custom-preview"));
}
