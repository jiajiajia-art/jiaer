import { useEffect, useRef, useState } from "react";
import { AUDIO_MAX_MB, EMBED_MB, playableSrc } from "../game/audioLib";
import { loadPlatformAudioFromApi, usePlatformAudio } from "../game/platformAudio";
import type { AudioKind } from "../lib/types";
import { addBgm, localTrackBlob, localTracks } from "./BgmPanel";
import { applyMusicRows, bgmSourceOf, musicRows, SOURCE_LABEL, type MusicRow, type MusicSlice } from "../lib/modMusic";
import { useGame } from "../store/gameCtx";
import { IconPause, IconPlay } from "../lib/icons";
import { Modal } from "./ui";

/* 模组编辑器 · 音乐：一份列表，五种来源。存储仍写回 bgm / audioRefs / platformAudioRefs。
 * 功能注释：「＋ 上传音乐」进弹窗，顶部 tab 切换本地上传 / 平台素材库 / 作品音频库；平台曲子只走弹窗 tab，不另挂独立入口。 */
const sid = () => `t${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 4)}`;
const inp = "min-w-0 w-full rounded-lg border border-line bg-paper px-2 py-1 text-[12.5px] text-ink outline-none focus:border-jade";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const TAB_IDS = ["local", "platform", "work"] as const;
type UploadTab = (typeof TAB_IDS)[number];
const AUDIO_KIND_LABEL: Record<AudioKind, string> = {
  bgm: "背景音乐",
  sfx: "音效",
  amb: "环境氛围音",
};
const TAB_LABEL: Record<UploadTab, string> = {
  local: "本地上传",
  platform: "平台音乐素材库",
  work: "作品音频库",
};

export default function ModBgmEditor({ bgm, audioRefs, platformAudioRefs, platformAutoplay, musicOrder, onChange }: MusicSlice & { onChange: (patch: ReturnType<typeof applyMusicRows>) => void }) {
  const PLATFORM_AUDIO = usePlatformAudio(); // 运营后台音频库（加载完成后自动刷新）
  const { game } = useGame();
  const author = (game?.audio ?? []).map((a) => ({ id: a.id, name: a.name, src: a.src }));
  const look = { author, platform: PLATFORM_AUDIO };
  const rows = musicRows({ bgm, audioRefs, platformAudioRefs, platformAutoplay, musicOrder }, look);
  const fileRef = useRef<HTMLInputElement>(null);
  const [lib, setLib] = useState<{ id: string; name: string; size: number }[]>([]);
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState("");
  const [trying, setTrying] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploadTab, setUploadTab] = useState<UploadTab>("local");
  const [platformKind, setPlatformKind] = useState<AudioKind | "">("");
  const [platformTag, setPlatformTag] = useState("");
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
      if (f.size > AUDIO_MAX_MB * 1048576) {
        notes.push(`「${f.name}」超过 ${AUDIO_MAX_MB} MB，上传失败`);
        continue;
      }
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
    if (next !== rows) commit(next);
    setMsg(notes.join("；"));
    setPickerOpen(false);
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

  // 功能注释：已加入的曲子不再隐藏，列表里标「已上传」并置灰，作者回来看也知道传过哪些
  const refChoices = author.map((a) => ({ ...a, added: rows.some((r) => r.source === "ref" && r.id === a.id) }));
  const platChoices = PLATFORM_AUDIO.map((p) => ({ ...p, added: rows.some((r) => r.source === "platform" && r.id === p.id) }));
  const platformTags = [...new Set(PLATFORM_AUDIO.flatMap((track) => track.tags ?? []))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const selectedPlatformTag = platformTags.includes(platformTag) ? platformTag : "";
  const filteredPlatformChoices = platChoices.filter((track) =>
    (!platformKind || track.kind === platformKind) && (!selectedPlatformTag || track.tags?.includes(selectedPlatformTag)),
  );
  const localChoices = lib.map((t) => ({ ...t, added: rows.some((r) => r.source === "local" && r.src === `local:${t.id}`) }));

  const addPlatform = (id: string) => {
    const p = PLATFORM_AUDIO.find((x) => x.id === id);
    if (!p || rows.some((r) => r.source === "platform" && r.id === id)) return;
    commit([...rows, { key: p.id, source: "platform", id: p.id, name: p.name, src: p.src, autoplay: false, missing: false, nameLocked: true }]);
    setPickerOpen(false);
  };
  const addWorkRef = (id: string) => {
    const a = author.find((x) => x.id === id);
    if (!a || rows.some((r) => r.source === "ref" && r.id === id)) return;
    commit([...rows, { key: `a:${id}`, source: "ref", id, name: a.name, src: a.src, autoplay: false, missing: false, nameLocked: true }]);
    setPickerOpen(false);
  };
  const addLocal = (id: string) => {
    const t = lib.find((x) => x.id === id);
    if (!t) return;
    commit(pushBgm(t.name, `local:${t.id}`));
    setPickerOpen(false);
  };

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
        {/* 功能注释：统一入口弹窗；平台曲 / 作品库 / 本机库都走 tab，禁止再挂平台曲独立下拉 */}
        <button type="button" className="rounded-full bg-jade px-3 py-1 text-[11.5px] font-semibold text-white" onClick={() => { setUploadTab("local"); setPickerOpen(true); }}>＋ 上传音乐</button>
      </div>
      <div className="flex gap-1.5">
        <input className={inp} value={url} placeholder="或粘贴音频链接 https://…" onChange={(e) => setUrl(e.target.value)} />
        <button type="button" className={`${btn} shrink-0`} disabled={!/^https?:\/\//.test(url.trim())} onClick={() => { const u = url.trim(); commit(pushBgm(decodeURIComponent(u.split("/").pop()?.replace(/\.[^.]+$/, "") || "新曲目"), u)); setUrl(""); }}>添加链接</button>
      </div>
      {msg && <p className="text-[11px] text-jade">{msg}</p>}
      <p className="text-[11px] leading-relaxed text-ink-soft">单个音频文件最大 {AUDIO_MAX_MB} MB。</p>

      {pickerOpen && (
        <Modal title="添加音乐" onClose={() => setPickerOpen(false)}>
          <div className="space-y-3">
            <div role="tablist" aria-label="添加音乐来源" className="flex flex-wrap gap-1.5 border-b border-line pb-2">
              {TAB_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={uploadTab === id}
                  className={`rounded-full px-3 py-1 text-[12px] font-semibold transition ${uploadTab === id ? "bg-jade text-white" : "border border-line bg-paper text-ink hover:border-jade hover:text-jade"}`}
                  onClick={() => {
                    setUploadTab(id);
                    if (id === "platform") void loadPlatformAudioFromApi(true);
                  }}
                >
                  {TAB_LABEL[id]}
                </button>
              ))}
            </div>

            {uploadTab === "local" && (
              <div role="tabpanel" aria-label="本地上传" className="space-y-2.5">
                <input ref={fileRef} type="file" multiple accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac,.opus" className="hidden"
                  onChange={async (e) => { if (e.target.files?.length) await upload(e.target.files); e.target.value = ""; }} />
                <button type="button" className="w-full rounded-xl border border-dashed border-line bg-paper-2 px-3 py-6 text-[13px] font-semibold text-ink transition hover:border-jade hover:text-jade" onClick={() => fileRef.current?.click()}>
                  点击选择本机音频文件（可多选）
                </button>
                <p className="text-[11px] leading-relaxed text-ink-soft">单个音频文件最大 {AUDIO_MAX_MB} MB。</p>
                {lib.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11.5px] font-bold text-ink">本机音乐库</p>
                    {localChoices.length === 0 ? null : (
                      <ul className="max-h-48 space-y-1 overflow-y-auto">
                        {localChoices.map((t) => (
                          <li key={t.id}>
                            <button type="button" disabled={t.added} className="flex w-full items-center justify-between rounded-lg border border-line bg-paper px-2.5 py-1.5 text-left text-[12.5px] text-ink transition hover:border-jade disabled:cursor-default disabled:opacity-60 disabled:hover:border-line" onClick={() => addLocal(t.id)}>
                              <span className="min-w-0 truncate">{t.name}</span>
                              {t.added ? <span className="shrink-0 text-[11px] text-ink-soft">已上传</span> : <span className="shrink-0 text-[11px] text-jade">加入</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}

            {uploadTab === "platform" && (
              <div role="tabpanel" aria-label="平台音乐素材库" className="space-y-2">
                {PLATFORM_AUDIO.length === 0 ? (
                  <p className="text-[12px] text-ink-soft">平台曲库暂无可用曲子</p>
                ) : (
                  <>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="min-w-0 space-y-1 text-[12px] text-ink-soft">
                      <span>音频类型</span>
                      <select className={inp} value={platformKind} onChange={(e) => setPlatformKind(e.target.value as AudioKind | "")}>
                        <option value="">全部类型</option>
                        {Object.entries(AUDIO_KIND_LABEL).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
                      </select>
                    </label>
                    <label className="min-w-0 space-y-1 text-[12px] text-ink-soft">
                      <span>平台分类</span>
                      <select className={inp} value={selectedPlatformTag} onChange={(e) => setPlatformTag(e.target.value)}>
                        <option value="">全部分类</option>
                        {platformTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
                      </select>
                    </label>
                  </div>
                  {filteredPlatformChoices.length === 0 ? <p className="text-[12px] text-ink-soft">没有符合当前分类的音频</p> : (
                  <ul className="max-h-64 space-y-1 overflow-y-auto">
                    {filteredPlatformChoices.map((p) => (
                      <li key={p.id}>
                        <button type="button" disabled={p.added} className="flex w-full items-center justify-between rounded-lg border border-line bg-paper px-2.5 py-1.5 text-left text-[12.5px] text-ink transition hover:border-jade disabled:cursor-default disabled:opacity-60 disabled:hover:border-line" onClick={() => addPlatform(p.id)}>
                          <span className="min-w-0">
                            <span className="block truncate">{p.name}</span>
                            <span className="block break-words text-[11px] text-ink-soft">{[AUDIO_KIND_LABEL[p.kind], ...(p.tags ?? [])].join(" · ")}</span>
                          </span>
                          {p.added ? <span className="shrink-0 text-[11px] text-ink-soft">已上传</span> : <span className="shrink-0 text-[11px] text-jade">加入</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                  )}
                  </>
                )}
              </div>
            )}

            {uploadTab === "work" && (
              <div role="tabpanel" aria-label="作品音频库" className="space-y-2">
                {author.length === 0 ? (
                  <p className="text-[12px] text-ink-soft">作品音频库还是空的，先在音频库上传后再来引用</p>
                ) : (
                  <ul className="max-h-64 space-y-1 overflow-y-auto">
                    {refChoices.map((a) => (
                      <li key={a.id}>
                        <button type="button" disabled={a.added} className="flex w-full items-center justify-between rounded-lg border border-line bg-paper px-2.5 py-1.5 text-left text-[12.5px] text-ink transition hover:border-jade disabled:cursor-default disabled:opacity-60 disabled:hover:border-line" onClick={() => addWorkRef(a.id)}>
                          <span className="min-w-0 truncate">{a.name}</span>
                          {a.added ? <span className="shrink-0 text-[11px] text-ink-soft">已上传</span> : <span className="shrink-0 text-[11px] text-jade">引用</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
