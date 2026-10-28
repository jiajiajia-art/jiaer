import { useEffect, useRef, useState } from "react";
import { useGame } from "../store/gameCtx";
import ImagePicker from "./ImagePicker";
import {
  FREE_COLORS, FREE_SLOTS, type Asset, type FreeImg, type FreeSlot, type FreeStyle, type ImgHost,
  loadAssets, loadHost, saveAssets, saveHost, uploadImage,
} from "../lib/freeStyle";

/* 自由美化的零件：按「改的东西出现在哪」分别嵌进美化页对应位置，不再集中成一个大杂烩。
 *   AssetLibrary → 素材与代码 · 素材库
 *   SlotImage    → 各部位（全局背景 / 顶栏 / 对话框 / 气泡）旁边
 *   FreeColors   → 配色
 *   FreeFont     → 字体 */
const btn = "rounded-full border border-line bg-paper px-3 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const inp = "min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-1.5 text-[12.5px] text-ink outline-none focus:border-jade";
export const SubTitle = ({ t, d }: { t: string; d?: string }) => (
  <p className="mb-1.5 mt-4 flex items-baseline gap-2 text-[12.5px] font-bold text-ink first:mt-0">{t}{d && <span className="text-[10.5px] font-normal text-ink-soft">{d}</span>}</p>
);

function useFree() {
  const { theme, setTheme } = useGame();
  const f: FreeStyle = theme.free ?? {};
  const set = (p: Partial<FreeStyle>) => setTheme({ ...theme, free: { ...f, on: true, ...p } });
  return { f, set };
}

/* 某个部位的贴图：上传 / 素材库 / 链接 + 透明度 + 铺法 */
export function SlotImage({ slot, label }: { slot: FreeSlot; label?: string }) {
  const { f, set } = useFree();
  const img = f.imgs?.[slot];
  const name = label ?? FREE_SLOTS.find((s) => s[0] === slot)?.[1] ?? "贴图";
  const setImg = (v?: Partial<FreeImg>) => {
    const imgs = { ...(f.imgs ?? {}) };
    if (!v) delete imgs[slot]; else imgs[slot] = { ...(imgs[slot] ?? { url: "" }), ...v };
    set({ imgs });
  };
  return (
    <div>
      <ImagePicker value={img?.url} label={name} onChange={(u) => (u ? setImg({ url: u }) : setImg())} />
      {img?.url && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-soft">
          <span>透明度</span>
          <input type="range" min={5} max={100} step={5} value={img.opacity ?? 100} onChange={(e) => setImg({ opacity: +e.target.value })} className="w-28 accent-[var(--jade)]" aria-label={`${name}透明度`} />
          <span className="w-8 tabular-nums">{img.opacity ?? 100}%</span>
          {([["cover", "铺满"], ["contain", "完整"], ["repeat", "平铺"]] as const).map(([v, l]) => (
            <button key={v} aria-pressed={(img.fit ?? "cover") === v} onClick={() => setImg({ fit: v })}
              className={`rounded-full border px-2 py-0.5 ${(img.fit ?? "cover") === v ? "border-jade bg-jade/10 font-bold text-jade" : "border-line bg-paper text-ink"}`}>{l}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* 自定义取色：覆盖皮肤 / 主色，留空跟随 */
export function FreeColors() {
  const { f, set } = useFree();
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      {FREE_COLORS.map(([k, label]) => {
        const v = f.colors?.[k];
        const cur = v || getComputedStyle(document.documentElement).getPropertyValue(`--${k}`).trim() || "#888888";
        return (
          <label key={k} className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 ${v ? "border-jade/60 bg-jade/5" : "border-line bg-paper"}`}>
            <input type="color" value={/^#[0-9a-f]{6}$/i.test(cur) ? cur : "#888888"} onChange={(e) => set({ colors: { ...(f.colors ?? {}), [k]: e.target.value } })}
              className="h-6 w-6 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0" aria-label={label} />
            <span className="min-w-0 flex-1 truncate text-[11.5px]">{label}</span>
            {v ? <button type="button" className="text-[11px] text-ink-soft hover:text-danger" aria-label={`重置${label}`} onClick={(e) => { e.preventDefault(); const c = { ...(f.colors ?? {}) }; delete c[k]; set({ colors: c }); }}>×</button> : <span className="text-[10px] text-ink-soft">默认</span>}
          </label>
        );
      })}
    </div>
  );
}

/* 自定义字体文件：上传或直链 */
export function FreeFont() {
  const { f, set } = useFree();
  const ref = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState("");
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        <button className={btn} onClick={() => ref.current?.click()}>上传字体文件</button>
        <input defaultValue={f.font?.url?.startsWith("data:") ? "" : f.font?.url ?? ""} key={f.font?.url} placeholder="或粘贴字体直链 …/xx.woff2，回车应用" className={inp}
          onKeyDown={(e) => { const v = e.currentTarget.value.trim(); if (e.key === "Enter" && /^https?:\/\//.test(v)) set({ font: { name: f.font?.name || "自定义字体", url: v } }); }} />
        {f.font?.url && <button className={btn} onClick={() => set({ font: undefined })}>移除</button>}
        <input ref={ref} type="file" accept=".woff2,.woff,.ttf,.otf" className="hidden" onChange={(e) => {
          const file = e.target.files?.[0]; e.target.value = "";
          if (!file) return;
          if (file.size > 2.5 * 1024 * 1024) return setErr("字体超过 2.5MB：中文字体建议用子集化的 woff2，或放到网盘 / CDN 后粘贴直链");
          setErr("");
          const r = new FileReader(); r.onload = () => set({ font: { name: file.name.replace(/\.[^.]+$/, ""), url: String(r.result) } }); r.readAsDataURL(file);
        }} />
      </div>
      <p className="mt-1 text-[10.5px] text-ink-soft">支持 woff2 / woff / ttf / otf，设置后优先于上方预设字体。</p>
      {err && <p className="mt-1 text-[11px] text-danger">{err}</p>}
      {f.font?.url && <p className="mt-1.5 rounded-lg bg-paper-2 px-3 py-2 text-[14px]" style={{ fontFamily: `"${f.font.name}"` }}>字体预览 · 永和九年，岁在癸丑 Aa 123同在 ABC 123</p>}
    </div>
  );
}

/* 素材库 + 图床配置：所有图片位共用这里的素材 */
export function AssetLibrary() {
  const [assets, setAssets] = useState<Asset[]>(loadAssets);
  const [host, setHostState] = useState<ImgHost>(loadHost);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { const h = () => setAssets(loadAssets()); window.addEventListener("star:assets", h); return () => window.removeEventListener("star:assets", h); }, []);

  const persist = (a: Asset[]) => { setAssets(a); if (!saveAssets(a)) setMsg({ ok: false, t: "本地存储空间不足：请删掉一些本地图片，或改用图床" }); };
  const setHost = (h: ImgHost) => { setHostState(h); saveHost(h); };
  const onFiles = async (files: FileList) => {
    setBusy(true); setMsg(null);
    try {
      let hosted = false;
      for (const file of Array.from(files)) hosted = (await uploadImage(file)).hosted;
      setAssets(loadAssets());
      setMsg({ ok: true, t: hosted ? "已上传到图床（公网链接，可随主题包分享）" : "已存为本地图片（仅本机可用；想分享请配置图床）" });
    } catch (e) { setMsg({ ok: false, t: `上传失败：${(e as Error).message}` }); }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-paper-2 p-3">
        <p className="mb-1.5 text-[12px] font-bold text-ink">上传方式</p>
        <div className="flex flex-wrap gap-1.5 text-[11.5px]">
          {([["none", "本地保存", "压缩后存本机"], ["imgbb", "imgbb 图床", "公网链接，可分享"]] as const).map(([k, l, d]) => (
            <button key={k} aria-pressed={host.kind === k} onClick={() => setHost({ ...host, kind: k })}
              className={`rounded-xl border px-3 py-1.5 text-left ${host.kind === k ? "border-jade bg-jade/10 text-jade" : "border-line bg-paper text-ink"}`}>
              <span className="block font-bold">{l}</span><span className="block text-[10px] opacity-75">{d}</span>
            </button>
          ))}
        </div>
        {host.kind === "imgbb" && (
          <div className="mt-2 space-y-1">
            <input type="password" value={host.key ?? ""} onChange={(e) => setHost({ ...host, key: e.target.value.trim() })} placeholder="粘贴 imgbb API Key（api.imgbb.com 免费申请）" className={`${inp} w-full`} />
            <p className="text-[10.5px] text-ink-soft">Key 只保存在本机，不会写进主题包。用其他图床也行：上传后把直链粘到下方。</p>
          </div>
        )}
      </div>

      <div className="flex gap-1.5">
        <button className={btn} disabled={busy} onClick={() => ref.current?.click()}>{busy ? "上传中…" : "上传图片"}</button>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="或粘贴图片直链 https://…" className={inp} />
        <button className={btn} disabled={!/^https?:\/\//.test(url.trim())} onClick={() => { persist([{ id: Math.random().toString(36).slice(2, 9), name: "链接图片", url: url.trim(), at: Date.now() }, ...assets]); setUrl(""); }}>添加</button>
        <input ref={ref} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) void onFiles(e.target.files); e.target.value = ""; }} />
      </div>
      {msg && <p className={`text-[11px] ${msg.ok ? "text-jade" : "text-danger"}`}>{msg.t}</p>}

      {assets.length ? (
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
          {assets.map((a) => (
            <div key={a.id} className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-paper">
              <img src={a.url} alt={a.name} className="h-full w-full object-cover" loading="lazy" />
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1 text-[9.5px] text-white">{a.url.startsWith("data:") ? "本地 · " : ""}{a.name}</span>
              <div className="absolute inset-0 hidden items-center justify-center gap-1 bg-black/45 group-hover:flex">
                {!a.url.startsWith("data:") && <button className="rounded-full bg-white/90 px-1.5 text-[10px]" onClick={() => { void navigator.clipboard?.writeText(a.url); setMsg({ ok: true, t: "已复制链接" }); }}>复制</button>}
                <button className="rounded-full bg-white/90 px-1.5 text-[10px] text-danger" onClick={() => persist(assets.filter((x) => x.id !== a.id))}>删除</button>
              </div>
            </div>
          ))}
        </div>
      ) : <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-[12px] text-ink-soft">素材库是空的。在这里批量上传，或在任意图片位点「+」上传，都会收进来。</p>}
    </div>
  );
}
