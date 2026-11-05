import { useRef, useState } from "react";
import { loadGlobal, saveGlobal } from "../lib/saveScope";
import { defaultTheme, type ThemePref } from "../lib/store";
import { useGame } from "../store/gameCtx";
import { readUserCss, setUserCss } from "./CustomCssPanel";

/* 美化主题包：把「皮肤 / 主色 / 字体 / 顶栏 / 对话框 / 自定义 CSS」打包成一个 JSON，
 * 可导出分享、导入一键套用，并在本地收藏多套随时切换。不含版式方向（属设备偏好）。 */
const FORMAT = "star-theme-pack";
const LIB_KEY = "star:themepacks";
const THEME_KEYS = ["mode", "accent", "skin", "font", "storyBgAlpha", "topbar", "topbarText", "topbarDiy", "dialogStyle", "dialogRadius", "dialogHeight", "bubbleStyle", "avatarShape", "avatarFrame", "sceneBg", "sceneDim", "sceneBlur", "sceneTone", "portrait", "free", "navActive", "dialogDiy", "lookRules", "icons", "cover"] as const;

export type ThemePack = {
  format: typeof FORMAT; version: 1;
  name: string; author?: string; createdAt: number;
  theme: Partial<ThemePref>; css: string;
};

const pickTheme = (t: ThemePref): Partial<ThemePref> => {
  const o: Record<string, unknown> = {};
  for (const k of THEME_KEYS) if (t[k] !== undefined) o[k] = t[k];
  return o as Partial<ThemePref>;
};

function parsePack(raw: string): ThemePack {
  const j = JSON.parse(raw);
  if (!j || j.format !== FORMAT || typeof j.theme !== "object") throw new Error("不是有效的主题包文件");
  return { format: FORMAT, version: 1, name: String(j.name || "未命名主题"), author: j.author ? String(j.author) : undefined,
    createdAt: Number(j.createdAt) || Date.now(), theme: pickTheme({ ...defaultTheme, ...j.theme }), css: typeof j.css === "string" ? j.css : "" };
}

const loadLib = () => loadGlobal<ThemePack[]>(LIB_KEY, []) || [];

export default function ThemePackPanel() {
  const { theme, setTheme } = useGame();
  const [lib, setLib] = useState<ThemePack[]>(loadLib);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const snapshot = (): ThemePack => ({ format: FORMAT, version: 1, name: name.trim() || "我的主题", createdAt: Date.now(), theme: pickTheme(theme), css: readUserCss().css });
  const persist = (l: ThemePack[]) => { setLib(l); if (!saveGlobal(LIB_KEY, l)) setMsg({ ok: false, t: "存储空间不足，未能保存到收藏" }); };

  const apply = (p: ThemePack) => {
    setTheme({ ...theme, ...p.theme });
    setUserCss({ on: true, css: p.css });
    setMsg({ ok: true, t: `已套用「${p.name}」` });
  };
  const download = (p: ThemePack) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(p, null, 2)], { type: "application/json" }));
    a.download = `${p.name.replace(/[\\/:*?"<>|]/g, "_")}.theme.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const onFile = async (f: File) => {
    try {
      const p = parsePack(await f.text());
      persist([p, ...lib.filter((x) => x.name !== p.name)]);
      apply(p);
    } catch (e) { setMsg({ ok: false, t: `导入失败：${e instanceof Error ? e.message : "文件格式错误"}` }); }
  };

  const btn = "rounded-full border border-line bg-paper px-3 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade";
  const fmt = (n: number) => new Date(n).toLocaleDateString();

  return (
    <div className="space-y-4">
      <p className="text-[12px] leading-relaxed text-ink-soft">把当前皮肤、主色、字体、顶栏、对话框、气泡头像、场景与立绘、图标、封面、剧情美化及自定义 CSS 打包成一个 .theme.json，可分享给他人或在本地收藏多套。</p>

      <div className="space-y-2 rounded-xl border border-line bg-paper-2 p-3">
        <p className="text-[11px] font-semibold text-ink-soft">打包当前外观</p>
        <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="主题名，例如：午夜霓虹"
          className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-[13px] text-ink outline-none focus:border-jade" />
        <div className="flex flex-wrap gap-1.5">
          <button className={btn} onClick={() => { const p = snapshot(); persist([p, ...lib.filter((x) => x.name !== p.name)]); setMsg({ ok: true, t: `已收藏「${p.name}」` }); }}>收藏到本地</button>
          <button className={btn} onClick={() => download(snapshot())}>导出文件</button>
          <span className="ml-auto" />
          <button className={btn} onClick={() => fileRef.current?.click()}>导入主题包</button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ""; }} />
        </div>
      </div>

      {msg && <p className={`text-[11.5px] ${msg.ok ? "text-jade" : "text-danger"}`}>{msg.t}</p>}

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-ink-soft">我的主题包 · {lib.length}</p>
        {lib.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-[12px] text-ink-soft">还没有收藏，打包当前外观或导入他人分享的主题包</p>
        ) : lib.map((p) => (
          <div key={p.name + p.createdAt} className="flex items-center gap-3 rounded-xl border border-line bg-paper px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-ink">{p.name}</p>
              <p className="truncate text-[10.5px] text-ink-soft">{[p.theme.skin, p.theme.accent, p.theme.font].filter(Boolean).join(" · ")}{p.css ? ` · CSS ${p.css.length} 字` : ""} · {fmt(p.createdAt)}</p>
            </div>
            <button className={btn} onClick={() => apply(p)}>套用</button>
            <button className={btn} onClick={() => download(p)}>导出</button>
            <button className={`${btn} hover:border-danger hover:text-danger`} onClick={() => { if (confirm(`删除「${p.name}」？`)) persist(lib.filter((x) => x !== p)); }}>删除</button>
          </div>
        ))}
      </div>
    </div>
  );
}
