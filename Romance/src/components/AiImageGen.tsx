import AiRoutePicker from "./AiRoutePicker";
import { useEffect, useRef, useState } from "react";
import { saveWorkImage } from "../lib/saveWorkImage";
import { compressImage } from "../lib/freeStyle";
import { generatePlatformImage, platformImageConfigured } from "../lib/platformImageGen";
import {
  applyCoverImageText,
  composePositivePrompt,
  mergeNegativePrompt,
  splitFramingFromSubject,
  type EditorImagePromptParts,
} from "../lib/editorImagePrompts";
import { fmtImageChargeHint, useAiRoutes } from "../lib/platformAiRoutes";
import { hasPlatformPlayAuth } from "../lib/platformPlayAi";
import { resolveRomancePlayMode } from "../lib/platformRomancePlay";
import { useGame } from "../store/gameCtx";
import ArtStylePicker from "./ArtStylePicker";

const MAX_REFS = 2;

export type AiImageGenPhase = "edit" | "busy" | "done";

/** 功能注释：把 size 文案收成结果角标（竖图标 9:16，其它原样）。 */
function sizeBadge(size?: string): string {
  const m = String(size || "").match(/^(\d+)x(\d+)$/i);
  if (!m) return "已生成";
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (h > w) return "9:16 · 已生成";
  if (w > h) return "16:9 · 已生成";
  return `${w}×${h} · 已生成`;
}

/* AI 生图：编辑（提示词 + 最多 2 张参考图）→ 点「开始生成」→ 生成中 → 结果（重新生成 / 使用这张图）。
 * bare：嵌在 Modal 里时去掉外框与「AI 生成」标题，避免和弹窗标题重复。
 * initialPrompt：地点/人物/封面等可把当前项已有文字预填进提示词（单段，兼容旧调用）。
 * initialParts：三层提示词（画风 / 主体 / 负面词）——有值时弹窗显示主体可编辑框；
 *   正向 = 画风 + 主体，负面词后台静默合并（选画风时写入），不对创作者露出编辑框；
 *   点「开始生成」时回调 onPartsCommit 让作品保存画风与负面词。
 * initialRefs：默认带入的参考图（如重绘人物时的当前头像），最多 2 张，创作者可移除。
 * autoRun / autoApply：兼容旧调用；默认关闭——打开弹窗不得自动开跑，也不得跳过「使用这张图」。 */
export default function AiImageGen({
  onPick,
  placeholder,
  size,
  bare = false,
  initialPrompt,
  initialParts,
  initialRefs,
  onPartsCommit,
  autoRun = false,
  autoApply = false,
  onPhaseChange,
  scenePortrait = false,
}: {
  onPick: (src: string) => void;
  placeholder?: string;
  size?: string;
  bare?: boolean;
  initialPrompt?: string;
  initialParts?: EditorImagePromptParts;
  initialRefs?: string[];
  /** 功能注释：开始生成时把当前三段文字交回外层（用于保存作品画风 / 负面词） */
  onPartsCommit?: (parts: EditorImagePromptParts) => void;
  autoRun?: boolean;
  autoApply?: boolean;
  /** 功能注释：供外层 Modal 改标题（生成结果）或锁定关闭 */
  onPhaseChange?: (phase: AiImageGenPhase) => void;
  scenePortrait?: boolean;
}) {
  const { cfg } = useGame();
  const { current: imageRoute } = useAiRoutes("image");
  // 功能注释：游玩扣 KK，创作/审核扣织梦豆——与生图计费 scene 一致
  const chargeCurrency = resolveRomancePlayMode().mode === "play" ? "kk" : "points";
  const [prompt, setPrompt] = useState(initialPrompt ?? "");
  const layered = Boolean(initialParts);
  const [style, setStyle] = useState(initialParts?.style ?? "");
  // 功能注释：构图收尾句（9:16 等）只静默拼进请求，不进可编辑主体框
  const initialSplit = splitFramingFromSubject(initialParts?.subject ?? "");
  const [subject, setSubject] = useState(initialSplit.subject);
  const [framing] = useState(String(initialParts?.framing || initialSplit.framing || "").trim());
  const [negative, setNegative] = useState(initialParts?.negative ?? "");
  const [imageText, setImageText] = useState("");
  // 功能注释：重绘时默认把当前图作为参考图（最多 MAX_REFS 张），创作者可点「移除」
  const [refs, setRefs] = useState<string[]>(() => (initialRefs ?? []).filter(Boolean).slice(0, MAX_REFS));
  // 功能注释：参考图 / 选画风两 Tab；画风正向词由后台配置，创作者只点选、不手改
  const [prepTab, setPrepTab] = useState<"refs" | "stylePick">(
    () => ((initialRefs ?? []).filter(Boolean).length > 0 ? "refs" : "stylePick"),
  );
  const onPartsCommitRef = useRef(onPartsCommit);
  onPartsCommitRef.current = onPartsCommit;
  const [phase, setPhase] = useState<AiImageGenPhase>("edit");
  const [err, setErr] = useState("");
  const [img, setImg] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const [elapsed, setElapsed] = useState(0);
  const ok = platformImageConfigured(cfg);
  const busyRef = useRef(false);
  const ranRef = useRef(false);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const abortRef = useRef<AbortController | null>(null);
  const onPhaseRef = useRef(onPhaseChange);
  onPhaseRef.current = onPhaseChange;
  const refInputRef = useRef<HTMLInputElement>(null);

  const goPhase = (next: AiImageGenPhase) => {
    setPhase(next);
    onPhaseRef.current?.(next);
  };

  useEffect(() => {
    if (initialPrompt != null && initialPrompt !== "") setPrompt(initialPrompt);
  }, [initialPrompt]);

  // 功能注释：有三层时，正向 = 画风 + 主体 + framing（静默）；没有则沿用单段 prompt
  // 功能注释：单段模式也可选画风；选了就拼在提示词前
  const basePositive = layered
    ? composePositivePrompt({ style, subject, framing })
    : (style.trim() ? composePositivePrompt({ style, subject: prompt }) : prompt.trim());
  const { prompt: positive, negative: requestNegative } = applyCoverImageText(
    basePositive,
    negative.trim(),
    initialParts?.allowImageText ? imageText : "",
    [style.trim(), framing].filter(Boolean).join("。"),
  );

  // 功能注释：生成中显示已用秒数，驱动进度条缓升（不到 100%，完成后再满）
  useEffect(() => {
    if (phase !== "busy") return;
    setElapsed(0);
    const t0 = Date.now();
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 250);
    return () => window.clearInterval(id);
  }, [phase]);

  const progressPct = phase === "busy" ? Math.min(92, Math.round((1 - Math.exp(-elapsed / 28)) * 100)) : phase === "done" ? 100 : 0;

  const cancelBusy = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    busyRef.current = false;
    setErr("");
    goPhase("edit");
  };

  const run = async (text?: string) => {
    const p = (text ?? positive).trim();
    if (!p || busyRef.current) return;
    if (layered) onPartsCommitRef.current?.({ style: style.trim(), subject: subject.trim(), negative: negative.trim() });
    busyRef.current = true;
    setErr("");
    setImg("");
    goPhase("busy");
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const url = await generatePlatformImage(cfg, p, size, {
        referenceImages: refs,
        negativePrompt: requestNegative || undefined,
        signal: ac.signal,
        feature: "image:ai-image-gen",
      });
      if (ac.signal.aborted) return;
      setImg(url);
      goPhase("done");
      if (autoApply) await applyImage(url);
    } catch (e) {
      if (ac.signal.aborted || (e as Error)?.name === "AbortError") {
        goPhase("edit");
        return;
      }
      setErr((e as Error).message || "生图失败");
      goPhase("edit");
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      busyRef.current = false;
    }
  };

  const applyImage = async (url: string) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setErr("");
    try {
      const cloudUrl = await saveWorkImage(url, scenePortrait);
      if (mountedRef.current) onPickRef.current(cloudUrl);
    } catch (e) {
      setErr(`保存到云端失败：${(e as Error).message}`);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  // 功能注释：仅旧调用显式 autoRun=true 时自动开跑；默认打开停在编辑页
  useEffect(() => {
    if (!autoRun || ranRef.current || !ok) return;
    const p = String(initialPrompt ?? "").trim();
    if (!p) return;
    ranRef.current = true;
    void run(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在打开时跑一次
  }, [autoRun, ok, initialPrompt]);

  const addRefFiles = async (files: FileList | null) => {
    if (!files?.length || phase === "busy") return;
    const room = MAX_REFS - refs.length;
    if (room <= 0) return;
    const picked = Array.from(files).slice(0, room);
    try {
      const urls = await Promise.all(picked.map((f) => compressImage(f, 1280, 0.88)));
      setRefs((prev) => [...prev, ...urls].slice(0, MAX_REFS));
    } catch {
      setErr("参考图读取失败，请换一张再试");
    }
  };

  const locked = phase === "busy";
  const showResult = phase === "done" && !!img;

  const fieldCls = `w-full rounded-xl border border-line/80 px-2.5 py-2 text-[12.5px] leading-relaxed text-ink shadow-[inset_0_1px_2px_rgba(40,20,30,0.04)] outline-none transition placeholder:text-ink-soft/55 focus:border-[color:var(--jade)] focus:ring-2 focus:ring-[color:var(--jade)]/15 ${
    locked ? "cursor-not-allowed bg-[#f7f3f1] text-ink-soft" : "bg-white"
  }`;

  return (
    <div className={bare ? "space-y-2.5 pt-0.5" : "space-y-2.5 rounded-2xl border border-dashed border-[color:var(--jade)]/35 bg-[color:var(--jade)]/[0.03] p-3"}>
      {!bare && <p className="text-[11.5px] font-bold text-[color:var(--jade)]">AI 生成</p>}
      {!ok && (
        <p className="rounded-xl bg-[#f7f3f1] px-3 py-1.5 text-[11px] leading-snug text-ink-soft">
          请先登录平台账号后再生图。
        </p>
      )}

      {/* 功能注释：无线路时 AiRoutePicker 返回 null，勿包空框 */}
      {ok && !locked ? <AiRoutePicker capability="image" compact /> : null}

      {showResult ? (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-2xl border border-line/80 bg-[#f7f3f1] shadow-[0_8px_24px_-18px_rgba(40,20,30,0.45)]">
            <img src={img || undefined} alt="生成结果" className="mx-auto max-h-[360px] w-full object-contain" />
            <span className="absolute bottom-2.5 right-2.5 rounded-full bg-black/55 px-2.5 py-0.5 text-[10.5px] font-semibold text-white backdrop-blur-sm">
              {sizeBadge(size)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { void run(); }}
              disabled={saving || !ok || !positive}
              className="rounded-2xl border border-line bg-white py-2.5 text-[13px] font-bold text-ink transition hover:border-[color:var(--jade)]/40 disabled:opacity-40"
            >
              重新生成
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => { void applyImage(img); }}
              className="rounded-2xl bg-[color:var(--jade)] py-2.5 text-[13px] font-bold text-white shadow-[0_8px_18px_-10px_rgba(180,40,60,0.55)] transition"
            >
              {saving ? "正在保存到云端…" : "使用这张图"}
            </button>
          </div>

        </div>
      ) : (
        <>
          {/* 功能注释：参考图 / 选画风紧凑双 Tab；画风正向词后台配置，创作者端只选不改 */}
          <div className="overflow-hidden rounded-xl border border-line/80 bg-white shadow-[0_1px_0_rgba(255,255,255,0.8)_inset]">
            <div className="grid grid-cols-2 gap-1 bg-[#f6f1ef] p-1" role="tablist" aria-label="生图准备">
              {(
                [
                  ["refs", "参考图", refs.length > 0 ? String(refs.length) : ""],
                  ["stylePick", "选画风", style.trim() ? "已选" : ""],
                ] as const
              ).map(([id, label, badge]) => {
                const on = prepTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setPrepTab(id)}
                    className={`rounded-lg px-2 py-1.5 text-[12px] font-bold transition ${
                      on
                        ? "bg-white text-[color:var(--jade)] shadow-[0_1px_3px_rgba(40,20,30,0.1)]"
                        : "text-ink-soft hover:text-ink"
                    }`}
                  >
                    {label}
                    {badge ? (
                      <span className={`ml-1 inline-grid min-w-[1.1rem] place-items-center rounded-full px-1 text-[9px] font-black ${
                        on ? "bg-[color:var(--jade)]/12 text-[color:var(--jade)]" : "bg-black/5 text-ink-soft"
                      }`}>{badge}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="p-2" role="tabpanel">
              {prepTab === "refs" && (
                <div>
                  <p className="mb-1 text-[10px] font-semibold tracking-wide text-ink-soft">
                    可选 · 最多 {MAX_REFS} 张{(initialRefs?.length ?? 0) > 0 ? " · 已带入当前头像" : ""}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {refs.map((src, i) => (
                      <div key={`${i}-${src.slice(0, 24)}`} className="relative h-14 w-14 overflow-hidden rounded-xl border border-line bg-[#f7f3f1] shadow-sm">
                        <img src={src} alt={`参考图 ${i + 1}`} className="h-full w-full object-cover" />
                        {!locked && (
                          <button
                            type="button"
                            className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-[9.5px] font-semibold text-white backdrop-blur-[2px]"
                            onClick={() => setRefs((prev) => prev.filter((_, j) => j !== i))}
                          >
                            移除
                          </button>
                        )}
                      </div>
                    ))}
                    {refs.length < MAX_REFS && !locked && (
                      <button
                        type="button"
                        onClick={() => refInputRef.current?.click()}
                        className="flex h-14 min-w-[6.5rem] flex-1 items-center justify-center rounded-xl border border-dashed border-[color:var(--jade)]/35 bg-[color:var(--jade)]/[0.03] px-2 text-[11.5px] font-semibold text-[color:var(--jade)] transition hover:border-[color:var(--jade)] hover:bg-[color:var(--jade)]/[0.07]"
                      >
                        + 上传参考图
                      </button>
                    )}
                    {refs.length > 0 && locked && (
                      <p className="self-center text-[11px] text-ink-soft">已上传 {refs.length} 张参考图</p>
                    )}
                    {refs.length === 0 && locked && (
                      <p className="text-[11px] text-ink-soft">未使用参考图</p>
                    )}
                  </div>
                  <input
                    ref={refInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      void addRefFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </div>
              )}

              {prepTab === "stylePick" && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold tracking-wide text-ink-soft">选填 · 点选即可，不会自动生图</p>
                  <ArtStylePicker value={style} disabled={locked} onChange={(v, preset) => {
                    // 功能注释：只改画风，绝不在此触发 run
                    setStyle(v);
                    if (preset) setNegative((n) => mergeNegativePrompt(n, preset.negative));
                  }} />
                </div>
              )}
            </div>
          </div>

          {initialParts?.allowImageText && (
            <label className="block">
              <span className="mb-1 block text-[10.5px] font-semibold tracking-wide text-ink-soft">
                图片文字（选填）
              </span>
              <input
                type="text"
                value={imageText}
                readOnly={locked}
                onChange={(e) => setImageText(e.target.value)}
                placeholder="输入要画在封面上的文字，如作品名"
                className={fieldCls}
              />
            </label>
          )}

          {layered ? (
            <div>
              <p className="mb-1 text-[10.5px] font-semibold tracking-wide text-ink-soft">
                {locked ? "本张主体 · 生成中不可改" : "本张主体"}
              </p>
              <textarea
                rows={2}
                value={subject}
                readOnly={locked}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={placeholder ?? "这一张画什么：主体、场景、光线……"}
                className={fieldCls}
              />
            </div>
          ) : (
            <div>
              <p className="mb-1 text-[10.5px] font-semibold tracking-wide text-ink-soft">
                {locked ? "提示词 · 生成中不可改" : "提示词"}
              </p>
              <textarea
                rows={2}
                value={prompt}
                readOnly={locked}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={placeholder ?? "描述画面：主体、场景、光线、风格……"}
                className={fieldCls}
              />
            </div>
          )}

          {locked ? (
            <div className="space-y-1 rounded-xl border border-line/70 bg-[#f7f3f1] px-2.5 py-2">
              <div className="h-1 overflow-hidden rounded-full bg-black/5">
                <div className="h-full rounded-full bg-[color:var(--jade)] transition-[width] duration-300" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="flex items-center gap-2">
                <button type="button" disabled className="min-w-0 flex-1 rounded-lg bg-[color:var(--jade)]/15 py-1.5 text-[12.5px] font-bold text-[color:var(--jade)]">
                  生成中… {elapsed}s
                </button>
                <button type="button" onClick={cancelBusy} className="shrink-0 px-1.5 text-[12px] font-semibold text-ink-soft underline-offset-2 hover:text-danger hover:underline">
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { void run(); }}
              disabled={!ok || !positive}
              title={!ok ? "请先登录" : !positive ? "请先填写提示词或选择画风" : "点击后才开始生图"}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--jade)] px-3 py-2 text-white shadow-[0_6px_14px_-12px_rgba(180,40,60,0.55)] transition enabled:hover:brightness-[1.03] disabled:cursor-not-allowed disabled:bg-[#d9c8cb] disabled:shadow-none"
            >
              <span className="text-[13px] font-bold tracking-wide">开始生成</span>
              {(() => {
                const fee = fmtImageChargeHint(imageRoute, {
                  personalFallback: !hasPlatformPlayAuth(),
                  currency: chargeCurrency,
                });
                return fee ? <span className="text-[11px] font-semibold tabular-nums text-white/85">· {fee}</span> : null;
              })()}
            </button>
          )}
        </>
      )}

      {err && <p className="rounded-xl bg-danger/10 px-3 py-2 text-[11.5px] text-danger">{err}</p>}
    </div>
  );
}
