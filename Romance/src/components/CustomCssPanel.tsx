import { loadGlobal, saveGlobal } from "../lib/saveScope";
import { useEffect, useRef, useState } from "react";
import { useConfirm } from "./EditorKit";
import { StatusMark } from "../lib/icons";

/* 自定义 CSS：叠加在当前皮肤之上（皮肤管基调，CSS 管细节）。存 localStorage，启动即注入。 */
export const USER_CSS_KEY = "star:usercss";
const KEY = USER_CSS_KEY;
export type UserCssCfg = { on: boolean; css: string };
type Cfg = UserCssCfg;
export const readUserCss = (): Cfg => ({ on: true, css: "", ...(loadGlobal<Partial<Cfg>>(KEY, {}) || {}) });
const read = readUserCss;
/* 外部（如主题包导入）写入 CSS 后调用，面板会同步刷新 */
export function setUserCss(c: Cfg) {
  saveGlobal(KEY, c); applyUserCss(c);
  window.dispatchEvent(new CustomEvent("star:usercss", { detail: c }));
}

export function applyUserCss(c: Cfg = read()) {
  if (typeof document === "undefined") return;
  let el = document.getElementById("user-css") as HTMLStyleElement | null;
  if (!el) { el = document.createElement("style"); el.id = "user-css"; }
  document.head.appendChild(el); // 始终放在最后，优先级最高
  el.textContent = c.on ? c.css : "";
}
applyUserCss();

const VARS: [string, string][] = [
  ["--paper", "页面底色"], ["--paper-2", "卡片底色"], ["--ink", "正文字色"], ["--ink-soft", "次要字色"],
  ["--jade", "主色（按钮 / 高亮）"], ["--jade-deep", "主色·深"], ["--coral", "辅色"], ["--gold", "点缀金"], ["--line", "描边"], ["--danger", "警示红"],
];
const SNIPPETS: { name: string; css: string }[] = [
  { name: "改配色", css: `:root {\n  --jade: #7c4dff;\n  --coral: #ff6f91;\n  --paper: #fbf7ff;\n  --line: #e6dcf5;\n}` },
  { name: "全局圆角更大", css: `.rounded-xl, .rounded-2xl { border-radius: 22px !important; }` },
  { name: "直角硬朗风", css: `[class*="rounded"] { border-radius: 4px !important; }` },
  { name: "字号放大", css: `html { font-size: 17px; }` },
  { name: "背景图", css: `body {\n  background: url("https://…/bg.jpg") center / cover fixed;\n}` },
  { name: "去掉动画", css: `*, *::before, *::after { animation: none !important; transition: none !important; }` },
];

export default function CustomCssPanel() {
  const [confirm, confirmEl] = useConfirm();
  const [cfg, setCfg] = useState<Cfg>(read);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const h = (e: Event) => setCfg((e as CustomEvent<Cfg>).detail);
    window.addEventListener("star:usercss", h);
    return () => window.removeEventListener("star:usercss", h);
  }, []);

  // 输入即预览（防抖）并保存
  useEffect(() => {
    const t = setTimeout(() => { applyUserCss(cfg); if (!saveGlobal(KEY, cfg)) setMsg("存储空间不足，未能保存"); }, 250);
    return () => clearTimeout(t);
  }, [cfg]);

  // 粗检：括号是否配平
  const bal = (cfg.css.match(/{/g)?.length ?? 0) - (cfg.css.match(/}/g)?.length ?? 0);

  const insert = (s: string) => {
    const ta = taRef.current; const p = ta?.selectionStart ?? cfg.css.length;
    const pre = cfg.css.slice(0, p), post = cfg.css.slice(p);
    const add = (pre && !pre.endsWith("\n") ? "\n\n" : "") + s + "\n";
    setCfg({ ...cfg, css: pre + add + post, on: true });
    requestAnimationFrame(() => { ta?.focus(); ta?.setSelectionRange(p + add.length, p + add.length); });
  };
  const exportCss = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([cfg.css], { type: "text/css" })); a.download = "my-skin.css"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const btn = "rounded-full border border-line bg-paper px-3 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";

  return (
    <div className="space-y-3">
      {confirmEl}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] leading-relaxed text-ink-soft">在当前皮肤之上叠加你的 CSS，输入即实时预览、自动保存。</p>
        <button role="switch" aria-checked={cfg.on} onClick={() => setCfg({ ...cfg, on: !cfg.on })}
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${cfg.on ? "bg-jade" : "bg-line"}`} aria-label="启用自定义 CSS">
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${cfg.on ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-ink-soft">快捷片段（插入到光标处）</p>
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 sm:flex-wrap">
          {SNIPPETS.map((s) => <button key={s.name} className={`${btn} shrink-0`} onClick={() => insert(s.css)}>＋ {s.name}</button>)}
        </div>
      </div>

      <textarea ref={taRef} value={cfg.css} spellCheck={false} onChange={(e) => setCfg({ ...cfg, css: e.target.value })}
        onKeyDown={(e) => { if (e.key === "Tab") { e.preventDefault(); const t = e.currentTarget, p = t.selectionStart; setCfg({ ...cfg, css: cfg.css.slice(0, p) + "  " + cfg.css.slice(t.selectionEnd) }); requestAnimationFrame(() => t.setSelectionRange(p + 2, p + 2)); } }}
        placeholder={":root {\n  --jade: #e0457b;\n}\n/* 写任意 CSS，会覆盖皮肤样式 */"}
        rows={10}
        className={`w-full resize-y rounded-xl border bg-[#1e1b22] p-3 font-mono text-[13px] leading-relaxed text-[#f3e9ff] outline-none placeholder:text-white/30 focus:border-jade ${bal ? "border-danger" : "border-line"} ${cfg.on ? "" : "opacity-60"}`} />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`text-[11px] ${bal ? "text-danger" : "text-ink-soft"}`}>{bal ? <StatusMark kind="warn">{`花括号不配平（${bal > 0 ? `少 ${bal} 个 }` : `多 ${-bal} 个 }`}）`}</StatusMark> : `${cfg.css.length} 字符${cfg.on ? " · 已生效" : " · 已停用"}`}</span>
        <span className="ml-auto" />
        <button className={btn} onClick={() => fileRef.current?.click()}>导入 .css</button>
        <button className={btn} disabled={!cfg.css.trim()} onClick={exportCss}>导出</button>
        <button className={btn} disabled={!cfg.css} onClick={async () => { if (await confirm("清空全部自定义 CSS？", { ok: "清空" })) setCfg({ ...cfg, css: "" }); }}>清空</button>
        <input ref={fileRef} type="file" accept=".css,text/css" className="hidden"
          onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setCfg({ on: true, css: await f.text() }); setMsg(`已导入 ${f.name}`); } e.target.value = ""; }} />
      </div>
      {msg && <p className="text-[11px] text-jade">{msg}</p>}

      <details className="rounded-xl border border-line bg-paper">
        <summary className="cursor-pointer px-3 py-2 text-[12px] font-semibold text-ink">可用颜色变量 · 点击插入</summary>
        <div className="grid grid-cols-1 gap-1 border-t border-line p-2 sm:grid-cols-2">
          {VARS.map(([v, d]) => (
            <button key={v} onClick={() => insert(`:root { ${v}: ${getComputedStyle(document.documentElement).getPropertyValue(v).trim() || "#000"}; }`)}
              className="flex items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-paper-2">
              <span className="h-4 w-4 shrink-0 rounded border border-line" style={{ background: `var(${v})` }} />
              <code className="text-[11.5px] text-ink">{v}</code>
              <span className="truncate text-[11px] text-ink-soft">{d}</span>
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
