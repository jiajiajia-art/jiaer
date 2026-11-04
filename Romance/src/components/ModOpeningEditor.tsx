import { useEffect, useState } from "react";
import type { CoverCopy, OpeningCopy } from "../mods/types";
import { CoverDiyEditor } from "./CoverDiyPanel";
import { coverMode, fromDiy, toDiy } from "../lib/coverAi";

/* 模组编辑器 · 作品封面（仅背景，供列表/详情/书架）/ 序章文案 */
const inp = "min-w-0 w-full rounded-lg border border-line bg-paper px-2 py-1 text-[12.5px] text-ink outline-none focus:border-jade";
const clean = <T extends object>(o: T) => {
  const n = Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && !v.length)));
  return Object.keys(n).length ? (n as T) : undefined;
};

/* 正文段落：空行分段，去掉首尾空白与空段 */
const toParas = (s: string) => s.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);

function Media({ kind, value, onChange }: { kind: "image" | "video"; value?: string; onChange: (v?: string) => void }) {
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
        <label className="rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade">
          上传{name}
          <input type="file" accept={`${kind}/*`} hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {v && <button type="button" className="rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-coral" onClick={() => { onChange(undefined); setMsg(""); }}>清除</button>}
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

/**
 * 功能注释：作品展示封面——只配背景（固定/轮播/视频）；作者态不提供整页自定义与文字/按钮等页签。
 * 列表/详情/书架用；开局进游戏菜单不再套用这张图。
 */
export function ModCoverEditor({
  value,
  onChange,
  modId,
  workTitle,
  workSummary,
}: {
  value?: CoverCopy;
  onChange: (v?: CoverCopy) => void;
  modId: string;
  /** 功能注释：作品名称，生图预填提示词 */
  workTitle?: string;
  /** 功能注释：作品简介，生图预填提示词 */
  workSummary?: string;
}) {
  const c = value ?? {};
  return (
    <div className="space-y-2.5">
      <p className="text-[11px] leading-relaxed text-ink-soft">
        作品展示封面只用来展示，不做出开始界面。列表、详情、书架卡片会显示这张图；真正开局后不会再显示一次封面。本页只配背景，预览里没有「开始游戏 / 继续游戏 / 配置 AI」。
      </p>
      <CoverDiyEditor
        mode="live"
        author
        bgOnly
        chatKey={`mod.${modId}`}
        value={toDiy(c)}
        onChange={(v) => onChange(clean(fromDiy({ ...c, mode: undefined, html: undefined, htmlUI: undefined }, v)))}
        cvText={{ title: workTitle, intro: workSummary }}
        workTitle={workTitle}
        workSummary={workSummary}
        previewCv={fromDiy({ ...c, title: undefined, kicker: undefined, subtitle: undefined, intro: undefined }, toDiy(c))}
        previewD={toDiy(c)}
      />
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
