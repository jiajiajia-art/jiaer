import { useState } from "react";
import { useGame } from "../store/gameCtx";
import { generateImage, imageConfigured } from "../lib/ai";
import { IconSpark } from "../lib/icons";

/* AI 生图：写提示词 → 调用「AI 配置」里的生图模型 → 预览 → 采用 */
export default function AiImageGen({ onPick, placeholder, size }: { onPick: (src: string) => void; placeholder?: string; size?: string }) {
  const { cfg } = useGame();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [img, setImg] = useState("");
  const ok = imageConfigured(cfg);

  const run = async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true); setErr(""); setImg("");
    try { setImg(await generateImage(cfg, prompt.trim(), size)); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-coral/50 bg-coral/[0.04] p-2.5">
      <p className="text-[11.5px] font-bold text-coral">AI 生成</p>
      {!ok && <p className="text-[11.5px] text-ink-soft">还没配置生图模型：去「设置 · AI 配置」填写生图模型（URL / Key 可沿用文本模型）。</p>}
      <textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={placeholder ?? "描述画面：主体、场景、光线、风格……"}
        className="w-full rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-coral" />
      <button onClick={run} disabled={!ok || !prompt.trim() || busy} className="w-full rounded-full bg-coral py-1.5 text-[12.5px] font-bold text-white transition disabled:opacity-40">
        {busy ? "生成中…（可能需要几十秒）" : img ? "重新生成" : "生成图片"}
      </button>
      {err && <p className="text-[11.5px] text-danger">{err}</p>}
      {img && (
        <div className="space-y-1.5">
          <img src={(img) || undefined} alt="生成结果" className="max-h-[280px] w-full rounded-lg object-contain" />
          <button onClick={() => { onPick(img); setImg(""); }} className="w-full rounded-full border border-jade bg-jade/10 py-1.5 text-[12.5px] font-bold text-jade">采用这张</button>
        </div>
      )}
    </div>
  );
}
