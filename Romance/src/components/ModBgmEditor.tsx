import { useEffect, useRef, useState } from "react";
import { EMBED_MB, playableSrc } from "../game/audioLib";
import { PLATFORM_AUDIO } from "../game/platformAudio";
import { addBgm, localTrackBlob, localTracks } from "./BgmPanel";
import { applyMusicRows, bgmSourceOf, musicRows, SOURCE_LABEL, type MusicRow, type MusicSlice } from "../lib/modMusic";
import { useGame } from "../store/gameCtx";
import { IconPause, IconPlay } from "../lib/icons";

/* 模组编辑器 · 音乐：一份列表，五种来源。存储仍写回 bgm / audioRefs / platformAudioRefs。 */
const sid = () => `t${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 4)}`;
const inp = "min-w-0 w-full rounded-lg border border-line bg-paper px-2 py-1 text-[12.5px] text-ink outline-none focus:border-jade";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";

export default function ModBgmEditor({ bgm, audioRefs, platformAudioRefs, platformAutoplay, musicOrder, onChange }: MusicSlice & { onChange: (patch: ReturnType<typeof applyMusicRows>) => void }) {
  const { game } = useGame();
  const author = (game?.audio ?? []).map((a) => ({ id: a.id, name: a.name, src: a.src }));
  const look = { author, platform: PLATFORM_AUDIO };
  const rows = musicRows({ bgm, audioRefs, platformAudioRefs, platformAutoplay, musicOrder }, look);
  const fileRef = useRef<HTMLInputElement>(null);
  const [lib, setLib] = useState<{ id: string; name: string; size: number }[]>([]);
  const [url, setUrl] = useState("");
  const [refId, setRefId] = useState("");
  const [platId, setPlatId] = useState("");
  const [msg, setMsg] = useState("");
  const [trying, setTrying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => { void localTracks().then(setLib); return () => audio.current?.pause(); }, []);

  const commit = (next: MusicRow[]) => onChange(applyMusicRows(next));
  const pushBgm = (name: string, src: string, into = rows) => {
    const id = sid();
    return [...into, { key: `b:${id}`, source: bgmSourceOf(src), id, name, src, autoplay: false, missing: false, nameLocked: false } satisfies MusicRow];
  };

  const upload = async (fs: FileList) => {
    const notes: string[] = [];
    let next = rows;
    for (const f of Array.from(fs)) {
      const name = f.name.replace(/\.[^.]+$/, "");
      if (f.size <= EMBED_MB * 1048576) {
        const src = await new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result)); fr.readAsDataURL(f); });
        next = pushBgm(name, src, next);
        notes.push(`「${name}」已内嵌`);
      } else {
        const dt = new DataTransfer(); dt.items.add(f);
        const before = new Set((await localTracks()).map((t) => t.id));
        await addBgm(dt.files);
        const all = await localTracks(); setLib(all);
        const nt = all.find((t) => !before.has(t.id));
        if (nt) { next = pushBgm(name, `local:${nt.id}`, next); notes.push(`「${name}」较大，已存入本机音乐库（导出分享不带着）`); }
      }
    }
    commit(next);
    setMsg(notes.join("；"));
  };

  const preview = async (row: MusicRow) => {
    if (trying === row.key) { audio.current?.pause(); setTrying(null); return; }
    audio.current?.pause();
    if (row.missing || !row.src) { setMsg(row.source === "ref" || row.source === "platform" ? "这首已失效，库里没有可播放的文件" : "这首没有音频地址"); return; }
    let src = row.src;
    if (src.startsWith("local:")) {
      const blob = await localTrackBlob(src.slice(6));
      if (!blob) { setMsg("本机音乐库里已经没有这首"); return; }
      src = URL.createObjectURL(blob);
    } else if (src.startsWith("idb:")) {
      const u = await playableSrc(src);
      if (!u) { setMsg("作品音频库里已经没有这首文件"); return; }
      src = u;
    }
    const a = new Audio(src);
    audio.current = a;
    a.onended = () => setTrying(null);
    a.play().then(() => setTrying(row.key)).catch(() => setMsg(`「${row.name}」无法播放，检查链接或格式`));
  };

  const refChoices = author.filter((a) => !rows.some((r) => r.source === "ref" && r.id === a.id));
  const platChoices = PLATFORM_AUDIO.filter((p) => !rows.some((r) => r.source === "platform" && r.id === p.id));

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={row.key} className="space-y-1.5 rounded-xl border border-line bg-paper-2 p-2">
          <div className="flex items-center gap-1.5">
            <button type="button" className={`${btn} shrink-0`} onClick={() => void preview(row)} aria-label="试听">{trying === row.key ? <IconPause size={14} /> : <IconPlay size={14} />}</button>
            {row.nameLocked
              ? <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{row.name}</span>
              : <input className={`${inp} ${row.name.trim() ? "" : "!border-danger"}`} value={row.name} placeholder="曲名" onChange={(e) => commit(rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))} />}
            <span className="shrink-0 rounded-full bg-line/60 px-1.5 text-[10px] text-ink-soft">{SOURCE_LABEL[row.source]}</span>
            {row.missing && <span className="shrink-0 rounded-full bg-danger/15 px-1.5 text-[10px] text-danger">失效</span>}
            <button type="button" className={`${btn} shrink-0`} disabled={i === 0} onClick={() => { const l = [...rows]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; commit(l); }} aria-label="上移">↑</button>
            <button type="button" className={`${btn} shrink-0`} disabled={i === rows.length - 1} onClick={() => { const l = [...rows]; [l[i + 1], l[i]] = [l[i], l[i + 1]]; commit(l); }} aria-label="下移">↓</button>
            <button type="button" className={`${btn} shrink-0`} onClick={() => commit(rows.filter((_, j) => j !== i))} aria-label="删除">×</button>
          </div>
          {row.source === "link" && <input className={inp} value={row.src ?? ""} placeholder="https://…mp3" onChange={(e) => commit(rows.map((r, j) => (j === i ? { ...r, src: e.target.value.trim() } : r)))} />}
          {row.source !== "ref" && !row.missing && (
            <label className="flex items-center gap-1.5 text-[11.5px] text-ink-soft">
              <input type="checkbox" checked={row.autoplay} onChange={(e) => commit(rows.map((r) => ({ ...r, autoplay: r.key === row.key ? e.target.checked : false })))} className="accent-[var(--jade)]" />
              进入本世界时自动播放（只能选一首）
            </label>
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-1.5">
        <button type="button" className="rounded-full bg-jade px-3 py-1 text-[11.5px] font-semibold text-white" onClick={() => fileRef.current?.click()}>＋ 上传音乐</button>
        <input ref={fileRef} type="file" multiple accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac,.opus" className="hidden"
          onChange={async (e) => { if (e.target.files?.length) await upload(e.target.files); e.target.value = ""; }} />
        {lib.length > 0 && (
          <select className={`${inp} !w-auto`} value="" aria-label="从本机音乐库选" onChange={(e) => { const t = lib.find((x) => x.id === e.target.value); if (t) commit(pushBgm(t.name, `local:${t.id}`)); }}>
            <option value="">从本机音乐库选…</option>
            {lib.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        {author.length === 0 ? (
          <button type="button" className={btn} disabled>从作品音频库引用（音频库还是空的）</button>
        ) : (
          <select className={`${inp} !w-auto`} value={refId} aria-label="从作品音频库引用" onChange={(e) => {
            const id = e.target.value;
            setRefId("");
            const a = author.find((x) => x.id === id);
            if (!a || rows.some((r) => r.source === "ref" && r.id === id)) return;
            commit([...rows, { key: `a:${id}`, source: "ref", id, name: a.name, src: a.src, autoplay: false, missing: false, nameLocked: true }]);
          }}>
            <option value="">{refChoices.length ? "从作品音频库引用…" : "作品音频库里的曲子都已引用"}</option>
            {refChoices.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
        {PLATFORM_AUDIO.length > 0 && (
          <select className={`${inp} !w-auto`} value={platId} aria-label="从平台曲库选" onChange={(e) => {
            const id = e.target.value;
            setPlatId("");
            const p = PLATFORM_AUDIO.find((x) => x.id === id);
            if (!p || rows.some((r) => r.source === "platform" && r.id === id)) return;
            commit([...rows, { key: p.id, source: "platform", id: p.id, name: p.name, src: p.src, autoplay: false, missing: false, nameLocked: true }]);
          }}>
            <option value="">{platChoices.length ? "从平台曲库选…" : "平台曲库里的曲子都已加入"}</option>
            {platChoices.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>
      <div className="flex gap-1.5">
        <input className={inp} value={url} placeholder="或粘贴音频链接 https://…" onChange={(e) => setUrl(e.target.value)} />
        <button type="button" className={`${btn} shrink-0`} disabled={!/^https?:\/\//.test(url.trim())} onClick={() => { const u = url.trim(); commit(pushBgm(decodeURIComponent(u.split("/").pop()?.replace(/\.[^.]+$/, "") || "新曲目"), u)); setUrl(""); }}>添加链接</button>
      </div>
      {msg && <p className="text-[11px] text-jade">{msg}</p>}
      <p className="text-[11px] leading-relaxed text-ink-soft">内嵌：≤{EMBED_MB}MB，文件进模组，导出分享别人也能听到。本机：更大的文件只在这台电脑。链接：https 地址，不占模组体积。引用和平台只记 id，不打包文件。</p>
    </div>
  );
}
