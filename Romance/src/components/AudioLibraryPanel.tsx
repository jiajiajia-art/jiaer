/* 编辑器 · 音频库（BGM & 音效库）：与 CG / 立绘 / 道具同级的原生资源库。
 * 作者上传与 MOD 注入统一管理，id 唯一；MOD 注入的条目只读（由 MOD 维护），其 MOD 未启用时置灰。
 * 检索 · 分类 · 标签筛选 · 分类文件夹 · 试听 · 批量操作 · 皮肤联动 BGM · 三层音量。 */
import { useMemo, useRef, useState } from "react";
import { useGame } from "../store/gameCtx";
import type { AudioAsset, AudioKind } from "../lib/types";
import { SKINS } from "../lib/skins";
import { AUDIO_ACCEPT, AUDIO_KIND_LABEL, EMBED_MB, audioFileProblem, audioOptions, audioUid, delBlob, loopOf, putBlob, readDataUrl, srcKind, useAudioLib } from "../game/audioLib";
import { globalVolume, previewAudio, previewing, setGlobalVolume, setWorkVolume, useAudioEngine } from "../game/audioEngine";
import { EmptyState, SearchBox, matches, useConfirm } from "./EditorKit";
import AudioPicker from "./AudioPicker";
import { IconMusic, IconPause, IconPlay } from "../lib/icons";

const inp = "w-full rounded-lg border border-line bg-paper-2 px-2 py-1 text-[12.5px] text-ink outline-none focus:border-jade";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const chip = (on: boolean) => `rounded-full border px-2 py-0.5 text-[11px] transition ${on ? "border-jade bg-jade/10 font-semibold text-jade" : "border-line text-ink-soft hover:text-ink"}`;

/* 三层音量：平台全局（本机所有作品）→ 作品（存档内）→ 单条音频（在条目里设） */
export function AudioMixer() {
  const { game, commitGame } = useGame();
  useAudioEngine();
  const row = (label: string, hint: string, v: number, set: (v: number) => void, disabled = false) => (
    <label className="flex items-center gap-2 text-[11.5px] text-ink-soft" title={hint}>
      <span className="w-16 shrink-0">{label}</span>
      <input type="range" min={0} max={1} step={0.01} value={v} disabled={disabled} onChange={(e) => set(Number(e.target.value))} className="h-1 flex-1 accent-[var(--jade)]" aria-label={label} />
      <span className="w-8 text-right tabular-nums">{Math.round(v * 100)}</span>
    </label>
  );
  return (
    <div className="space-y-1 rounded-2xl border border-line bg-paper p-3">
      <p className="text-[12px] font-bold text-ink">音量分层 <span className="font-normal text-ink-soft">逐层相乘，互不覆盖</span></p>
      {row("平台全局", "本机所有作品通用", globalVolume(), setGlobalVolume)}
      {row("作品音量", "只影响当前作品，随存档保存", game?.audioVolume ?? 1, (v) => { setWorkVolume(v); if (game) commitGame({ ...game, audioVolume: v }); }, !game)}
      <p className="text-[10.5px] text-ink-soft">单条音频的独立音量在「编辑器 · 音频库」的条目里设置。</p>
    </div>
  );
}

type Row = { a: AudioAsset; on: boolean; modName?: string };
export default function AudioLibraryPanel() {
  const { game, commitGame } = useGame();
  useAudioLib();
  useAudioEngine();
  const [confirm, confirmEl] = useConfirm();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<AudioKind | "all">("all");
  const [tag, setTag] = useState<string | null>(null);
  const [folder, setFolder] = useState<string | null>(null); // null = 全部；"" = 未分类
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const author = game?.audio ?? [];
  const folders = game?.audioFolders ?? [];
  const rows: Row[] = useMemo(() => {
    const all = audioOptions().filter((o) => !o.a.id.startsWith("platform:"));
    // 作者音频始终全量列出（即使被启用中的 MOD 以「覆盖」暂时顶替）
    for (const a of author) if (!all.some((o) => o.a === a)) all.push({ a, on: !all.some((o) => o.a.id === a.id), modName: undefined });
    return all;
  }, [author, game?.audio]);
  if (!game) return null;

  const save = (audio: AudioAsset[], extra: Partial<typeof game> = {}) => commitGame({ ...game, audio, ...extra });
  const patch = (id: string, p: Partial<AudioAsset>) => save(author.map((a) => (a.id === id ? { ...a, ...p } : a)));
  const tags = [...new Set(rows.flatMap((r) => r.a.tags ?? []))].sort();
  const shown = rows.filter((r) => (kind === "all" || r.a.kind === kind) && (!tag || r.a.tags?.includes(tag)) && (folder === null || (r.a.folder ?? "") === folder)
    && matches(q, r.a.name, r.a.id, r.a.note, r.modName, ...(r.a.tags ?? [])));
  const mine = (id: string) => author.some((a) => a.id === id);
  const selMine = [...sel].filter(mine);

  const addFiles = async (fs: FileList) => {
    setBusy(true);
    const made: AudioAsset[] = []; const bad: string[] = [];
    for (const f of Array.from(fs)) {
      const why = audioFileProblem(f);
      if (why) { bad.push(`${f.name}（${why}）`); continue; }
      const id = audioUid();
      let src: string;
      if (f.size <= EMBED_MB * 1048576) src = await readDataUrl(f);
      else { try { await putBlob(id, f); src = `idb:${id}`; } catch { bad.push(`${f.name}（本机存储空间不足）`); continue; } }
      const k: AudioKind = kind === "all" ? (f.size < 400 * 1024 ? "sfx" : "bgm") : kind;
      made.push({ id, name: f.name.replace(/\.[^.]+$/, "").slice(0, 40), kind: k, src, loop: k !== "sfx", folder: folder || undefined });
    }
    if (made.length) save([...author, ...made]);
    setMsg([made.length ? `已添加 ${made.length} 条` : "", bad.length ? `未添加：${bad.join("、")}` : ""].filter(Boolean).join("；"));
    setBusy(false);
  };
  const addUrl = () => {
    const u = url.trim();
    if (!/^https?:\/\/\S+\.(mp3|ogg|wav)(\?\S*)?$/i.test(u)) { setMsg("链接需以 http(s) 开头，并以 .mp3 / .ogg / .wav 结尾"); return; }
    const k: AudioKind = kind === "all" ? "bgm" : kind;
    save([...author, { id: audioUid(), name: decodeURIComponent(u.split("/").pop()!.replace(/\.[^.?]+(\?.*)?$/, "")).slice(0, 40) || "新音频", kind: k, src: u, loop: k !== "sfx", folder: folder || undefined }]);
    setUrl(""); setMsg("已添加链接音频");
  };
  const remove = async (ids: string[]) => {
    const list = author.filter((a) => ids.includes(a.id));
    if (!list.length || !(await confirm(`删除 ${list.length} 条音频？引用它们的剧情 / 地点 / 触发器会显示「已失效」。`, { danger: true }))) return;
    for (const a of list) if (a.src.startsWith("idb:")) void delBlob(a.src.slice(4));
    save(author.filter((a) => !ids.includes(a.id)));
    setSel(new Set());
  };
  const batch = (p: (a: AudioAsset) => AudioAsset) => save(author.map((a) => (sel.has(a.id) ? p(a) : a)));
  const addFolder = () => { const n = window.prompt("新文件夹名称")?.trim(); if (n && !folders.includes(n)) commitGame({ ...game, audioFolders: [...folders, n] }); };
  const dropFolder = async (f: string) => {
    if (!(await confirm(`删除文件夹「${f}」？其中的音频会移到「未分类」，不会被删除。`))) return;
    commitGame({ ...game, audioFolders: folders.filter((x) => x !== f), audio: author.map((a) => (a.folder === f ? { ...a, folder: undefined } : a)) });
    if (folder === f) setFolder(null);
  };
  const pickCover = (id: string, f?: File) => { if (f) void readDataUrl(f).then((cover) => patch(id, { cover })); };
  const play = async (a: AudioAsset) => { if (!(await previewAudio(a.id, a.src, a.volume ?? 1))) setMsg(`「${a.name}」无法播放：检查链接或格式`); };

  return (
    <div className="space-y-3 text-[12.5px]">
      {confirmEl}
      <p className="text-[11.5px] leading-relaxed text-ink-soft">作品的统一音频库：剧情节点、地点 / RP 房间、触发器和皮肤都从这里选音频。MOD 启用时，它自带的音频自动加入；关闭或卸载后随之移除。</p>
      <AudioMixer />

      {/* 上传 / 链接 */}
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={busy} onClick={() => fileRef.current?.click()} className="rounded-full bg-jade px-3.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50">{busy ? "上传中…" : "＋ 上传音频"}</button>
        <input ref={fileRef} type="file" multiple accept={AUDIO_ACCEPT} className="hidden" onChange={(e) => { if (e.target.files?.length) void addFiles(e.target.files); e.target.value = ""; }} />
        <div className="flex min-w-[220px] flex-1 gap-1.5">
          <input className={inp} value={url} placeholder="或粘贴 https://…mp3 / ogg / wav" onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addUrl(); }} />
          <button className={`${btn} shrink-0`} disabled={!url.trim()} onClick={addUrl}>添加链接</button>
        </div>
      </div>
      <p className="text-[11px] text-ink-soft">支持 mp3 / ogg / wav。≤{EMBED_MB}MB 直接内嵌（随作品导出）；更大的存在本机浏览器，换设备需重新上传或改用链接。</p>
      {msg && <p className="text-[11.5px] text-jade">{msg}</p>}

      {/* 筛选 */}
      <SearchBox value={q} onChange={setQ} placeholder="搜索名称 / 标签 / 备注 / id" count={shown.length} />
      <div className="flex flex-wrap items-center gap-1">
        {(["all", "bgm", "sfx", "amb"] as const).map((k) => <button key={k} className={chip(kind === k)} aria-pressed={kind === k} onClick={() => setKind(k)}>{k === "all" ? "全部" : AUDIO_KIND_LABEL[k]} {rows.filter((r) => k === "all" || r.a.kind === k).length}</button>)}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[11px] text-ink-soft">文件夹</span>
        <button className={chip(folder === null)} onClick={() => setFolder(null)}>全部</button>
        <button className={chip(folder === "")} onClick={() => setFolder("")}>未分类</button>
        {folders.map((f) => (
          <span key={f} className="inline-flex items-center">
            <button className={chip(folder === f)} onClick={() => setFolder(f)}>{f} {rows.filter((r) => r.a.folder === f).length}</button>
            {folder === f && <button className="px-1 text-[12px] text-ink-soft hover:text-danger" onClick={() => void dropFolder(f)} aria-label={`删除文件夹 ${f}`}>×</button>}
          </span>
        ))}
        <button className={btn} onClick={addFolder}>＋ 文件夹</button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[11px] text-ink-soft">标签</span>
          {tags.map((t) => <button key={t} className={chip(tag === t)} aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>#{t}</button>)}
        </div>
      )}

      {/* 批量 */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-paper-2 px-2 py-1.5 text-[11.5px]">
        <label className="flex items-center gap-1"><input type="checkbox" className="accent-[var(--jade)]" checked={shown.length > 0 && shown.every((r) => sel.has(r.a.id))} onChange={(e) => setSel(e.target.checked ? new Set(shown.map((r) => r.a.id)) : new Set())} />全选当前</label>
        <span className="text-ink-soft">已选 {sel.size}{sel.size > selMine.length ? `（其中 ${sel.size - selMine.length} 条来自 MOD，只读）` : ""}</span>
        {selMine.length > 0 && (<>
          <select className={`${inp} !w-auto`} value="" onChange={(e) => { const v = e.target.value; if (v) batch((a) => ({ ...a, folder: v === "\u0000" ? undefined : v })); }} aria-label="移到文件夹">
            <option value="">移到文件夹…</option><option value={"\u0000"}>未分类</option>{folders.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <select className={`${inp} !w-auto`} value="" onChange={(e) => { const v = e.target.value as AudioKind; if (v) batch((a) => ({ ...a, kind: v })); }} aria-label="改分类">
            <option value="">改分类…</option>{(["bgm", "sfx", "amb"] as const).map((k) => <option key={k} value={k}>{AUDIO_KIND_LABEL[k]}</option>)}
          </select>
          <button className={btn} onClick={() => { const t = window.prompt("给选中的音频加标签")?.trim(); if (t) batch((a) => ({ ...a, tags: [...new Set([...(a.tags ?? []), t])] })); }}>＋ 标签</button>
          <button className={`${btn} hover:!border-danger hover:!text-danger`} onClick={() => void remove(selMine)}>删除</button>
        </>)}
      </div>

      {/* 列表 */}
      {shown.length === 0 ? <EmptyState>{rows.length ? "没有符合筛选的音频。" : "音频库还是空的：上传 mp3 / ogg / wav，或启用自带音频的 MOD。"}</EmptyState> : (
        <ul className="space-y-1.5">
          {shown.map((r) => {
            const a = r.a, own = mine(a.id) && !a._mod, ex = open === a.id && own;
            return (
              <li key={`${a._mod ?? "author"}:${a.id}`} className={`rounded-xl border border-line bg-paper ${r.on ? "" : "opacity-50"}`}>
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <input type="checkbox" className="accent-[var(--jade)]" checked={sel.has(a.id)} onChange={(e) => { const n = new Set(sel); if (e.target.checked) n.add(a.id); else n.delete(a.id); setSel(n); }} aria-label={`选择 ${a.name}`} />
                  <button className={`${btn} shrink-0 !px-2`} disabled={!r.on} onClick={() => void play(a)} aria-label={previewing() === a.id ? "停止试听" : "试听"}>{previewing() === a.id ? <IconPause size={14} /> : <IconPlay size={14} />}</button>
                  {a.cover ? <img src={a.cover} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" /> : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-paper-2 text-[13px] text-ink-soft"><IconMusic size={13} /></span>}
                  <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(ex ? null : a.id)} disabled={!own}>
                    <span className="block truncate font-semibold text-ink">{a.name || "（未命名）"}</span>
                    <span className="block truncate text-[10.5px] text-ink-soft">{AUDIO_KIND_LABEL[a.kind]} · {srcKind(a.src)}{loopOf(a) ? " · 循环" : ""}{a.folder ? ` · ${a.folder}` : ""}{a.tags?.length ? ` · ${a.tags.map((t) => `#${t}`).join(" ")}` : ""} · <span className="font-mono">{a.id}</span></span>
                  </button>
                  <span className={`shrink-0 rounded-full px-1.5 text-[10px] ${a._mod ? "bg-gold/15 text-gold" : "bg-jade/10 text-jade"}`}>{a._mod ? `MOD · ${r.modName ?? a._mod}${r.on ? "" : "（未启用）"}` : r.on ? "作品" : "作品（被 MOD 覆盖中）"}</span>
                </div>
                {ex && (
                  <div className="grid gap-1.5 border-t border-line p-2 sm:grid-cols-2">
                    <label className="text-[11px] text-ink-soft">名称<input className={`${inp} mt-0.5`} value={a.name} onChange={(e) => patch(a.id, { name: e.target.value })} /></label>
                    <label className="text-[11px] text-ink-soft">分类
                      <select className={`${inp} mt-0.5`} value={a.kind} onChange={(e) => patch(a.id, { kind: e.target.value as AudioKind })}>{(["bgm", "sfx", "amb"] as const).map((k) => <option key={k} value={k}>{AUDIO_KIND_LABEL[k]}</option>)}</select>
                    </label>
                    <label className="text-[11px] text-ink-soft">标签（逗号分隔）<input className={`${inp} mt-0.5`} defaultValue={(a.tags ?? []).join(", ")} onBlur={(e) => patch(a.id, { tags: [...new Set(e.target.value.split(/[,，]/).map((t) => t.trim()).filter(Boolean))] })} /></label>
                    <label className="text-[11px] text-ink-soft">文件夹
                      <select className={`${inp} mt-0.5`} value={a.folder ?? ""} onChange={(e) => patch(a.id, { folder: e.target.value || undefined })}><option value="">未分类</option>{folders.map((f) => <option key={f} value={f}>{f}</option>)}</select>
                    </label>
                    <label className="text-[11px] text-ink-soft">默认音量 {Math.round((a.volume ?? 1) * 100)}
                      <input type="range" min={0} max={1} step={0.01} value={a.volume ?? 1} onChange={(e) => patch(a.id, { volume: Number(e.target.value) })} className="mt-1 w-full accent-[var(--jade)]" />
                    </label>
                    <label className="flex items-center gap-1.5 self-end text-[11.5px] text-ink-soft"><input type="checkbox" className="accent-[var(--jade)]" checked={loopOf(a)} onChange={(e) => patch(a.id, { loop: e.target.checked })} />默认循环播放</label>
                    <label className="text-[11px] text-ink-soft">淡入（毫秒）<input type="number" min={0} step={100} className={`${inp} mt-0.5`} value={a.fadeIn ?? ""} placeholder="0" onChange={(e) => patch(a.id, { fadeIn: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value) || 0) })} /></label>
                    <label className="text-[11px] text-ink-soft">淡出（毫秒）<input type="number" min={0} step={100} className={`${inp} mt-0.5`} value={a.fadeOut ?? ""} placeholder="0" onChange={(e) => patch(a.id, { fadeOut: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value) || 0) })} /></label>
                    <label className="text-[11px] text-ink-soft">封面图
                      <span className="mt-0.5 flex gap-1"><input className={inp} value={a.cover?.startsWith("data:") ? "（已上传）" : a.cover ?? ""} placeholder="https://…" onChange={(e) => patch(a.id, { cover: e.target.value || undefined })} />
                        <label className={`${btn} shrink-0 cursor-pointer`}>上传<input type="file" accept="image/*" className="hidden" onChange={(e) => pickCover(a.id, e.target.files?.[0])} /></label></span>
                    </label>
                    <label className="text-[11px] text-ink-soft">备注<input className={`${inp} mt-0.5`} value={a.note ?? ""} onChange={(e) => patch(a.id, { note: e.target.value || undefined })} /></label>
                    <div className="flex items-center justify-between sm:col-span-2">
                      <span className="font-mono text-[10.5px] text-ink-soft">id：{a.id}（MOD 方式 B 按此引用）</span>
                      <button className={`${btn} hover:!border-danger hover:!text-danger`} onClick={() => void remove([a.id])}>删除</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* 皮肤联动 */}
      <div className="space-y-1.5 rounded-2xl border border-line p-3">
        <p className="text-[12px] font-bold text-ink">皮肤联动 BGM <span className="font-normal text-ink-soft">切换到该皮肤时平滑切歌；不设 = 不打断</span></p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {SKINS.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-[11.5px] text-ink-soft">
              <span className="w-14 shrink-0">{s.label}</span>
              <AudioPicker value={game.skinBgm?.[s.id]} kind="bgm" empty="（不联动）" className={inp} onChange={(id) => { const m = { ...(game.skinBgm ?? {}) }; if (id) m[s.id] = id; else delete m[s.id]; commitGame({ ...game, skinBgm: Object.keys(m).length ? m : undefined }); }} />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
