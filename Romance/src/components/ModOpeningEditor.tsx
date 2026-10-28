import { useEffect, useRef, useState } from "react";
import type { CoverCopy, OpeningCopy } from "../mods/types";
import { CoverDiyEditor } from "./CoverDiyPanel";
import { coverMode, fromDiy, toDiy } from "../lib/coverAi";

/* 模组编辑器 · 开局封面（自由搭配 / AI 对话 / 自定义 HTML）/ 序章：文案 + 图片/视频（上传或直链），留空项沿用默认 */
const inp = "min-w-0 w-full rounded-lg border border-line bg-paper px-2 py-1 text-[12.5px] text-ink outline-none focus:border-jade";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const clean = <T extends object>(o: T) => {
  const n = Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && !v.length)));
  return Object.keys(n).length ? (n as T) : undefined;
};

/* 正文段落：空行分段，去掉首尾空白与空段 */
const toParas = (s: string) => s.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);

function Media({ kind, value, onChange }: { kind: "image" | "video"; value?: string; onChange: (v?: string) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const pick = (f?: File) => {
    if (!f) return;
    const mb = f.size / 1048576;
    if (mb > 25) return setMsg(`文件 ${mb.toFixed(1)}MB 过大，请压缩或改用直链`);
    setMsg(mb > 5 ? `${mb.toFixed(1)}MB · 内嵌较大，可能占满本地存储，建议直链` : "");
    const r = new FileReader();
    r.onload = () => onChange(String(r.result));
    r.readAsDataURL(f);
  };
  const v = value ?? "";
  const name = kind === "image" ? "图片" : "视频";
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <button type="button" className={btn} onClick={() => file.current?.click()}>上传{name}</button>
        {v && <button type="button" className={`${btn} hover:!text-coral`} onClick={() => { onChange(undefined); setMsg(""); }}>清除</button>}
        <input ref={file} type="file" accept={`${kind}/*`} hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      <input className={`${inp} font-mono text-[11.5px]`} value={v.startsWith("data:") ? "" : v} onChange={(e) => onChange(e.target.value || undefined)}
        placeholder={v.startsWith("data:") ? `已上传本地${name}（可改贴直链）` : `或粘贴${name}直链 https://…`} />
      {msg && <p className="text-[10.5px] text-coral">{msg}</p>}
      {v && (kind === "image"
        ? <img src={(v) || undefined} alt="" className="h-28 w-full rounded-lg border border-line object-cover" />
        : <video src={(v) || undefined} muted controls playsInline className="h-36 w-full rounded-lg border border-line bg-black object-contain" />)}
    </div>
  );
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block space-y-1"><span className="text-[10.5px] font-bold tracking-[0.12em] text-ink-soft">{label}</span>{children}</label>
);

export { coverMode }; // 兼容旧引用；实现在 lib/coverAi

const HTML_TIP = `<!-- 在按钮上调用 parent.postMessage("start", "*") 即可开始游戏；可用指令：start / continue / config -->`;

function HtmlCover({ c, set }: { c: CoverCopy; set: (p: Partial<CoverCopy>) => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const pick = (f?: File) => {
    if (!f) return;
    if (f.size > 5 * 1048576) return setMsg("HTML 超过 5MB，请把大图改成直链");
    setMsg("");
    const r = new FileReader();
    r.onload = () => set({ html: String(r.result) });
    r.readAsText(f);
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <button type="button" className={btn} onClick={() => file.current?.click()}>上传 .html 文件</button>
        {c.html && <button type="button" className={`${btn} hover:!text-coral`} onClick={() => set({ html: undefined })}>清除</button>}
        <input ref={file} type="file" accept=".html,.htm,text/html" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      <textarea className={`${inp} font-mono text-[11px]`} rows={6} value={c.html ?? ""} onChange={(e) => set({ html: e.target.value })} placeholder={`或直接粘贴 HTML 代码\n${HTML_TIP}`} />
      {msg && <p className="text-[10.5px] text-coral">{msg}</p>}
      <p className="text-[10.5px] leading-relaxed text-ink-soft">HTML 在沙箱中全屏运行（可用脚本与外链资源）。按钮调用 <code className="font-mono">parent.postMessage("start", "*")</code> 可开始游戏，另支持 continue / config。</p>
      <label className="flex items-center gap-2 text-[12px] text-ink">
        <input type="checkbox" className="accent-jade" checked={c.htmlUI !== false} onChange={(e) => set({ htmlUI: e.target.checked ? undefined : false })} />
        在 HTML 上叠加内置按钮（开始 / 继续 / 配置）
      </label>
      {c.html && <iframe title="封面预览" sandbox="allow-scripts" srcDoc={c.html} className="h-56 w-full rounded-lg border border-line bg-white" />}
    </div>
  );
}

export function ModCoverEditor({ value, onChange, modId }: { value?: CoverCopy; onChange: (v?: CoverCopy) => void; modId: string }) {
  const c = value ?? {};
  const set = (p: Partial<CoverCopy>) => onChange(clean({ ...c, ...p }));
  const html = coverMode(c) === "html";
  return (
    <div className="space-y-2.5">
      <p className="text-[11px] leading-relaxed text-ink-soft">进入游戏的第一屏，选中此世界观即生效。可以和 AI 对话生成，也能逐项自由搭配（画布布局唯一入口在「① 基础 → 开局封面」）；玩家若在「美化 → 封面」自定，会叠在你的封面上。</p>
      <Row label="封面做法">
        <div className="grid grid-cols-2 gap-1.5">
          {([[false, "自由搭配 · AI 对话", "实时预览里手动搭配，AI 对话里聊着改"], [true, "自定义 HTML", "整页自己写，沙箱全屏运行"]] as const).map(([h, l, d]) => (
            <button key={l} type="button" onClick={() => set({ mode: h ? "html" : undefined })}
              className={`rounded-xl border px-3 py-2 text-left transition ${html === h ? "border-jade bg-jade/10" : "border-line bg-paper hover:border-jade/50"}`}>
              <span className={`block text-[12.5px] font-bold ${html === h ? "text-jade" : "text-ink"}`}>{l}</span>
              <span className="mt-0.5 block text-[10.5px] leading-snug text-ink-soft">{d}</span>
            </button>
          ))}
        </div>
      </Row>
      {html
        ? <HtmlCover c={c} set={set} />
        : <CoverDiyEditor mode="switch" author chatKey={`mod.${modId}`} value={toDiy(c)} onChange={(v) => onChange(clean(fromDiy(c, v)))} cvText={{}} previewCv={fromDiy(c, toDiy(c))} />}
    </div>
  );
}

export default function ModOpeningEditor({ value, onChange }: { value?: OpeningCopy; onChange: (v?: OpeningCopy) => void }) {
  const o = value ?? {};
  const set = (p: Partial<OpeningCopy>) => onChange(clean({ ...o, ...p }));
  const [text, setText] = useState((o.paragraphs ?? []).join("\n\n"));
  // 外部改了段落（AI 改写、撤销等）时同步输入框；本框输入回传的同一份段落不覆盖，保留正在敲的空行
  useEffect(() => {
    const next = (o.paragraphs ?? []).join("\n\n");
    setText((cur) => (toParas(cur).join("\n\n") === next ? cur : next));
  }, [o.paragraphs]);
  return (
    <div className="space-y-2.5">
      <p className="text-[11px] leading-relaxed text-ink-soft">
        建角后、点「开始」前的开幕页：只展示下方配置的文字 / 图 / 视频 / 自定义页。系统不会追加手记、时间或地点；正式开局剧情在玩家点「开始」后于剧情区由 AI 单独生成。全部留空则跳过开幕，直接入局生成开局剧情。
      </p>
      <Row label="顶部小字"><input className={inp} value={o.kicker ?? ""} onChange={(e) => set({ kicker: e.target.value })} placeholder="PROLOGUE" /></Row>
      <Row label="标题"><input className={inp} value={o.title ?? ""} onChange={(e) => set({ title: e.target.value })} placeholder="开幕标题" /></Row>
      <Row label="副标题"><input className={inp} value={o.subtitle ?? ""} onChange={(e) => set({ subtitle: e.target.value })} placeholder="可选" /></Row>
      <Row label="正文段落（空行分段，逐段浮现）">
        <textarea className={inp} rows={7} value={text}
          onChange={(e) => { setText(e.target.value); set({ paragraphs: toParas(e.target.value), mode: "fixed" }); }}
          placeholder={"可用占位：{name} 主角名 · {school} 母校 · {father}/{mother} 父母职业 · {money} 开局资金 · {parents} 父母态度段\n\n空行分隔每一段"} />
      </Row>
      <Row label="正文 HTML（可选，填了替代上面的段落）">
        <textarea className={`${inp} font-mono text-[12px]`} rows={6} value={o.html ?? ""}
          onChange={(e) => set({ html: e.target.value, mode: "fixed" })}
          placeholder={"<p>{name}站在窗前……</p>\n\n额外占位：{location} 开局地点 · {time} 开局时间；支持 p / h3 / ul / b 等排版标签"} />
      </Row>
      <div className="grid grid-cols-2 gap-2">
        <Row label="浮现完提示"><input className={inp} value={o.waiting ?? ""} onChange={(e) => set({ waiting: e.target.value })} placeholder="灯亮了。" /></Row>
        <Row label="按钮文案"><input className={inp} value={o.cta ?? ""} onChange={(e) => set({ cta: e.target.value })} placeholder="走上台去" /></Row>
      </div>
      <Row label="头图（替换默认星夜剧场）"><Media kind="image" value={o.image} onChange={(image) => set({ image })} /></Row>
      <Row label="序幕视频"><Media kind="video" value={o.video} onChange={(video) => set({ video })} /></Row>
      {o.video && (
        <Row label="视频播放方式">
          <select className={inp} value={o.videoMode ?? "header"} onChange={(e) => set({ videoMode: e.target.value as "header" | "full" })}>
            <option value="header">作头图循环播放（静音）</option>
            <option value="full">先全屏播完（可跳过）再进文字；无文字则直接开局</option>
          </select>
        </Row>
      )}
    </div>
  );
}
