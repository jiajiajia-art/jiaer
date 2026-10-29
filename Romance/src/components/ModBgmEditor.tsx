import { useEffect, useRef, useState } from "react";
import type { ModTrack } from "../mods/types";
import { addBgm, localTracks } from "./BgmPanel";
import { IconPause, IconPlay } from "../lib/icons";

/* 模组编辑器 · 内置音乐：链接 / 上传内嵌（小文件随模组导出）/ 引用本机音乐库；可试听、设开局播放。 */
const EMBED_MB = 1; // 模组存 localStorage（约 5MB 配额），内嵌只收小文件
const sid = () => `t${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 4)}`;
const inp = "min-w-0 w-full rounded-lg border border-line bg-paper px-2 py-1 text-[12.5px] text-ink outline-none focus:border-jade";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
/** 功能注释：脏曲目可能没有 src，禁止 undefined.startsWith 崩整页 */
const kindOf = (src: unknown) => {
  const s = typeof src === "string" ? src : "";
  return s.startsWith("data:") ? "内嵌" : s.startsWith("local:") ? "本机" : "链接";
};

export default function ModBgmEditor({ list, onChange }: { list: ModTrack[]; onChange: (l: ModTrack[]) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [lib, setLib] = useState<{ id: string; name: string; size: number }[]>([]);
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState("");
  const [trying, setTrying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => { void localTracks().then(setLib); return () => audio.current?.pause(); }, []);

  const set = (i: number, p: Partial<ModTrack>) => onChange(list.map((t, j) => (j === i ? { ...t, ...p } : p.autoplay ? { ...t, autoplay: false } : t)));
  const push = (t: Omit<ModTrack, "id">) => onChange([...list, { id: sid(), ...t }]);

  const upload = async (fs: FileList) => {
    const out: string[] = [];
    for (const f of Array.from(fs)) {
      const name = f.name.replace(/\.[^.]+$/, "");
      if (f.size <= EMBED_MB * 1048576) {
        const src = await new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result)); fr.readAsDataURL(f); });
        push({ name, src }); out.push(`「${name}」已内嵌`);
      } else {
        const dt = new DataTransfer(); dt.items.add(f);
        const before = new Set((await localTracks()).map((t) => t.id));
        await addBgm(dt.files);
        const all = await localTracks(); setLib(all);
        const nt = all.find((t) => !before.has(t.id));
        if (nt) { push({ name, src: `local:${nt.id}` }); out.push(`「${name}」较大，已存入本机音乐库并引用（导出分享时不随带）`); }
      }
    }
    setMsg(out.join("；"));
  };

  const preview = (t: ModTrack) => {
    if (trying === t.id) { audio.current?.pause(); setTrying(null); return; }
    audio.current?.pause();
    const src = typeof t.src === "string" ? t.src : "";
    if (!src) { setMsg("这首没有音频地址"); return; }
    if (src.startsWith("local:")) { setMsg("本机音乐请到「游戏设置 · 背景音乐」试听"); return; }
    const a = new Audio(src); audio.current = a; a.onended = () => setTrying(null);
    a.play().then(() => setTrying(t.id)).catch(() => setMsg(`「${t.name}」无法播放，检查链接或格式`));
  };

  return (
    <div className="space-y-2">
      {list.map((t, i) => (
        <div key={t.id} className="space-y-1.5 rounded-xl border border-line bg-paper-2 p-2">
          <div className="flex items-center gap-1.5">
            <button className={`${btn} shrink-0`} onClick={() => preview(t)} aria-label="试听">{trying === t.id ? <IconPause size={14} /> : <IconPlay size={14} />}</button>
            <input className={`${inp} ${String(t.name ?? "").trim() ? "" : "!border-danger"}`} value={String(t.name ?? "")} placeholder="曲名" onChange={(e) => set(i, { name: e.target.value })} />
            <span className="shrink-0 rounded-full bg-line/60 px-1.5 text-[10px] text-ink-soft">{kindOf(t.src)}</span>
            <button className={`${btn} shrink-0`} disabled={i === 0} onClick={() => { const l = [...list]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; onChange(l); }} aria-label="上移">↑</button>
            <button className={`${btn} shrink-0`} onClick={() => onChange(list.filter((_, j) => j !== i))} aria-label="删除">×</button>
          </div>
          {kindOf(t.src) === "链接" && <input className={inp} value={t.src} placeholder="https://…mp3" onChange={(e) => set(i, { src: e.target.value.trim() })} />}
          <label className="flex items-center gap-1.5 text-[11.5px] text-ink-soft">
            <input type="checkbox" checked={!!t.autoplay} onChange={(e) => set(i, { autoplay: e.target.checked })} className="accent-[var(--jade)]" />
            进入本世界时自动播放（只能选一首）
          </label>
        </div>
      ))}

      <div className="flex flex-wrap gap-1.5">
        <button className="rounded-full bg-jade px-3 py-1 text-[11.5px] font-semibold text-white" onClick={() => fileRef.current?.click()}>＋ 上传音乐</button>
        <input ref={fileRef} type="file" multiple accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac,.opus" className="hidden"
          onChange={async (e) => { if (e.target.files?.length) await upload(e.target.files); e.target.value = ""; }} />
        {lib.length > 0 && (
          <select className={`${inp} !w-auto`} value="" onChange={(e) => { const t = lib.find((x) => x.id === e.target.value); if (t) push({ name: t.name, src: `local:${t.id}` }); }}>
            <option value="">从我的音乐库选…</option>
            {lib.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
      </div>
      <div className="flex gap-1.5">
        <input className={inp} value={url} placeholder="或粘贴音频链接 https://…" onChange={(e) => setUrl(e.target.value)} />
        <button className={`${btn} shrink-0`} disabled={!/^https?:\/\//.test(url.trim())} onClick={() => { const u = url.trim(); push({ name: decodeURIComponent(u.split("/").pop()?.replace(/\.[^.]+$/, "") || "新曲目"), src: u }); setUrl(""); }}>添加链接</button>
      </div>
      {msg && <p className="text-[11px] text-jade">{msg}</p>}
      <p className="text-[11px] leading-relaxed text-ink-soft">≤{EMBED_MB}MB 的文件直接内嵌进模组，导出分享也带着；更大的存本机音乐库（只在这台设备可用），建议改用链接。</p>
    </div>
  );
}
