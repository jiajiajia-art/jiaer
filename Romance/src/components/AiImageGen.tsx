import { useEffect, useRef, useState } from "react";
import { useGame } from "../store/gameCtx";
import { generatePlatformImage, platformImageConfigured } from "../lib/platformImageGen";

/* AI 生图：写提示词 → 调用平台既有生图入口（AI 配置 · 生图模型）→ 预览 → 采用。
 * bare：嵌在 Modal 里时去掉外框与「AI 生成」标题，避免和弹窗标题重复。
 * initialPrompt：地点/人物/封面等可把当前项已有文字预填进提示词。
 * autoRun：打开时若有预填提示词则自动开跑（点「生图」即用现有文字生成）。
 * autoApply：生成成功后立刻 onPick，预览马上换图，仍可再上传替换。 */
export default function AiImageGen({
  onPick,
  placeholder,
  size,
  bare = false,
  initialPrompt,
  autoRun = false,
  autoApply = false,
}: {
  onPick: (src: string) => void;
  placeholder?: string;
  size?: string;
  bare?: boolean;
  initialPrompt?: string;
  autoRun?: boolean;
  autoApply?: boolean;
}) {
  const { cfg } = useGame();
  const [prompt, setPrompt] = useState(initialPrompt ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [img, setImg] = useState("");
  const ok = platformImageConfigured(cfg);
  const busyRef = useRef(false);
  const ranRef = useRef(false);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    if (initialPrompt != null && initialPrompt !== "") setPrompt(initialPrompt);
  }, [initialPrompt]);

  const run = async (text?: string) => {
    const p = (text ?? prompt).trim();
    if (!p || busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setErr(""); setImg("");
    try {
      const url = await generatePlatformImage(cfg, p, size);
      setImg(url);
      // 功能注释：编辑器四处生图要「生成完立刻进预览」，成功后直接采用
      if (autoApply) onPickRef.current(url);
    } catch (e) { setErr((e as Error).message); }
    finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!autoRun || ranRef.current || !ok) return;
    const p = String(initialPrompt ?? "").trim();
    if (!p) return;
    ranRef.current = true;
    void run(p);
  }, [autoRun, ok, initialPrompt, cfg, size, autoApply]);

  return (
    <div className={bare ? "space-y-2" : "space-y-2 rounded-xl border border-dashed border-coral/50 bg-coral/[0.04] p-2.5"}>
      {!bare && <p className="text-[11.5px] font-bold text-coral">AI 生成</p>}
      {!ok && <p className="text-[11.5px] text-ink-soft">还没配置生图模型：去「设置 · AI 配置」填写生图模型（URL / Key 可沿用文本模型；平台生图网关默认 epone / ggb）。</p>}
      <textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={placeholder ?? "描述画面：主体、场景、光线、风格……"}
        className="w-full rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-coral" />
      <button type="button" onClick={() => { void run(); }} disabled={!ok || !prompt.trim() || busy} className="w-full rounded-full bg-coral py-1.5 text-[12.5px] font-bold text-white transition disabled:opacity-40">
        {busy ? "生成中…（可能需要几十秒）" : img ? "重新生成" : "生成图片"}
      </button>
      {err && <p className="text-[11.5px] text-danger">{err}</p>}
      {img && !autoApply && (
        <div className="space-y-1.5">
          <img src={img || undefined} alt="生成结果" className="max-h-[280px] w-full rounded-lg object-contain" />
          <button type="button" onClick={() => { onPick(img); setImg(""); }} className="w-full rounded-full border border-jade bg-jade/10 py-1.5 text-[12.5px] font-bold text-jade">采用这张</button>
        </div>
      )}
      {img && autoApply && (
        <p className="text-[11.5px] text-jade">已写入预览。可关掉弹窗，或点「重新生成」换一张。</p>
      )}
    </div>
  );
}
