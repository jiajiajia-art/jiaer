import AiRoutePicker from "./AiRoutePicker";
import { addTempAsset, keepAsset, isAssetKept } from "../lib/freeStyle";
import { useEffect, useRef, useState } from "react";
import { compressImage } from "../lib/freeStyle";
import { generatePlatformImage, platformImageConfigured } from "../lib/platformImageGen";
import { composePositivePrompt, type EditorImagePromptParts } from "../lib/editorImagePrompts";
import { useGame } from "../store/gameCtx";

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
 * initialParts：三层提示词（画风 / 主体 / 负面词）——有值时弹窗显示三个可编辑框，
 *   正向 = 画风 + 主体，负面词单独传给生图；点「开始生成」时回调 onPartsCommit 让作品保存画风与负面词。
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
}) {
  const { cfg } = useGame();
  const [prompt, setPrompt] = useState(initialPrompt ?? "");
  const layered = Boolean(initialParts);
  const [style, setStyle] = useState(initialParts?.style ?? "");
  const [subject, setSubject] = useState(initialParts?.subject ?? "");
  const [negative, setNegative] = useState(initialParts?.negative ?? "");
  // 功能注释：重绘时默认把当前图作为参考图（最多 MAX_REFS 张），创作者可点「移除」
  const [refs, setRefs] = useState<string[]>(() => (initialRefs ?? []).filter(Boolean).slice(0, MAX_REFS));
  const onPartsCommitRef = useRef(onPartsCommit);
  onPartsCommitRef.current = onPartsCommit;
  const [phase, setPhase] = useState<AiImageGenPhase>("edit");
  const [err, setErr] = useState("");
  const [img, setImg] = useState("");
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

  // 功能注释：有三层时，正向 = 画风 + 主体；没有则沿用单段 prompt
  const positive = layered ? composePositivePrompt({ style, subject }) : prompt.trim();

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
        negativePrompt: layered ? negative.trim() : undefined,
        signal: ac.signal,
      });
      if (ac.signal.aborted) return;
      setImg(url);
      addTempAsset(url);
      setKept(false);
      // 功能注释：仅显式 autoApply 时跳过结果页（旧调用兼容）；默认要玩家点「使用这张图」
      if (autoApply) {
        onPickRef.current(url);
        goPhase("done");
      } else {
        goPhase("done");
      }
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

  const [kept, setKept] = useState(false);
  const locked = phase === "busy";
  const showResult = phase === "done" && !!img;

  return (
    <div className={bare ? "space-y-3" : "space-y-3 rounded-xl border border-dashed border-coral/50 bg-coral/[0.04] p-2.5"}>
      {!bare && <p className="text-[11.5px] font-bold text-coral">AI 生成</p>}
      {!ok && (
        <p className="text-[11.5px] text-ink-soft">
          请先登录平台账号后再生图（使用运营后台「生图配置」的 epone / ggb）。未登录时也可在「设置 · AI 配置」填写个人生图模型兜底。
        </p>
      )}

      {ok && !locked && <AiRoutePicker capability="image" compact />}

      {showResult ? (
        <div className="space-y-3">
          {/* 功能注释：结果页只展示图与两个动作；「重新生成」直接再跑，避免先闪回编辑页 */}
          <p className="text-[11px] font-bold tracking-wide text-ink-soft">生成结果</p>
          <div className="relative overflow-hidden rounded-xl border border-line bg-paper-2">
            <img src={img || undefined} alt="生成结果" className="mx-auto max-h-[360px] w-full object-contain" />
            <span className="absolute bottom-2 right-2 rounded-full bg-ink/70 px-2 py-0.5 text-[10.5px] font-semibold text-paper">
              {sizeBadge(size)}
            </span>
          </div>
          {autoApply && (
            <p className="text-[11.5px] text-jade">已写入预览。可关掉弹窗，或点「重新生成」换一张。</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                void run();
              }}
              disabled={!ok || !positive}
              className="rounded-full border border-ink/20 bg-paper py-2.5 text-[13px] font-bold text-ink transition disabled:opacity-40"
            >
              重新生成
            </button>
            <button
              type="button"
              onClick={() => onPick(img)}
              className="rounded-full bg-ink py-2.5 text-[13px] font-bold text-paper transition"
            >
              使用这张图
            </button>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-xl bg-paper-2 px-3 py-2">
            <p className="min-w-0 text-[11px] leading-snug text-ink-soft">
              {kept || isAssetKept(img) ? "已收藏到素材库，长期保留。" : "已暂存到素材库，7 天内没用到会自动清除。"}
            </p>
            <button
              type="button"
              disabled={kept || isAssetKept(img)}
              onClick={() => { keepAsset(img); setKept(true); }}
              className="shrink-0 rounded-full border border-ink/20 bg-paper px-3 py-1 text-[11.5px] font-bold text-ink transition disabled:opacity-50"
            >
              {kept || isAssetKept(img) ? "已收藏" : "收藏到素材库"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div>
            <p className="mb-1.5 text-[11px] font-bold tracking-wide text-ink-soft">
              参考图（可选，最多 {MAX_REFS} 张{(initialRefs?.length ?? 0) > 0 ? " · 已默认带入当前图，可移除" : ""}）
            </p>
            <div className="flex flex-wrap gap-2">
              {refs.map((src, i) => (
                <div key={`${i}-${src.slice(0, 24)}`} className="relative h-16 w-16 overflow-hidden rounded-lg border border-line bg-paper-2">
                  <img src={src} alt={`参考图 ${i + 1}`} className="h-full w-full object-cover" />
                  {!locked && (
                    <button
                      type="button"
                      className="absolute inset-x-0 bottom-0 bg-ink/65 py-0.5 text-[10px] font-semibold text-paper"
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
                  className="flex h-16 min-w-[7.5rem] flex-1 items-center justify-center rounded-lg border border-dashed border-line bg-paper px-2 text-[12px] font-semibold text-ink-soft transition hover:border-coral hover:text-coral"
                >
                  + 上传参考图
                </button>
              )}
              {refs.length > 0 && locked && (
                <p className="self-center text-[11.5px] text-ink-soft">已上传 {refs.length} 张参考图</p>
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

          {layered ? (
            <div className="space-y-2.5">
              {/* 功能注释：三层提示词——画风（整部统一）/ 本张主体 / 负面词；开始生成前可逐项改 */}
              {(
                [
                  ["画风 · 整部作品统一", style, setStyle, 2, "选填：可写画风；留空则按主体与设定生成"],
                  ["本张主体 · 只写这一张", subject, setSubject, 4, placeholder ?? "这一张画什么：主体、构图……"],
                  ["负面词 · 不想出现的内容", negative, setNegative, 2, "如：文字，水印，畸形手指"],
                ] as const
              ).map(([title, val, setVal, rows, ph]) => (
                <div key={title}>
                  <p className="mb-1.5 text-[11px] font-bold tracking-wide text-ink-soft">
                    {locked ? `${title} · 生成中不可修改` : `${title} · 可编辑`}
                  </p>
                  <textarea
                    rows={rows}
                    value={val}
                    readOnly={locked}
                    onChange={(e) => setVal(e.target.value)}
                    placeholder={ph}
                    className={`w-full rounded-lg border border-line px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-coral ${
                      locked ? "cursor-not-allowed bg-paper-2 text-ink-soft" : "bg-paper"
                    }`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div>
              <p className="mb-1.5 text-[11px] font-bold tracking-wide text-ink-soft">
                {locked ? "提示词 · 生成中不可修改" : "提示词 · 可编辑"}
              </p>
              <textarea
                rows={4}
                value={prompt}
                readOnly={locked}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={placeholder ?? "描述画面：主体、场景、光线、风格……"}
                className={`w-full rounded-lg border border-line px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-coral ${
                  locked ? "cursor-not-allowed bg-paper-2 text-ink-soft" : "bg-paper"
                }`}
              />
            </div>
          )}

          {locked ? (
            <div className="space-y-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-line/60">
                <div className="h-full rounded-full bg-ink transition-[width] duration-300" style={{ width: `${progressPct}%` }} />
              </div>
              <button
                type="button"
                disabled
                className="w-full rounded-full bg-ink/15 py-2.5 text-[13px] font-bold text-ink-soft"
              >
                生成中… {elapsed}s
              </button>
              <button type="button" onClick={cancelBusy} className="w-full py-1 text-[12.5px] font-semibold text-ink-soft underline-offset-2 hover:text-danger hover:underline">
                取消生成
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                void run();
              }}
              disabled={!ok || !positive}
              className="w-full rounded-full bg-ink py-2.5 text-[13px] font-bold text-paper transition disabled:opacity-40"
            >
              开始生成
            </button>
          )}
        </>
      )}

      {err && <p className="text-[11.5px] text-danger">{err}</p>}
    </div>
  );
}
