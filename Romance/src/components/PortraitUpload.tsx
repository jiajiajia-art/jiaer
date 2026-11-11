/* 人物立绘上传：每位人物单独一张抠图（透明底 PNG 最佳），立绘模式下 TA 说话时站在对话框旁 */
import { useRef, useState } from "react";
import { compressImage, loadHost, uploadToHost } from "../lib/freeStyle";

// 配置了图床走图床（原图直链），否则本地压缩；PNG 转 WebP 保留透明通道
const toPortraitUrl = (f: File) => {
  const h = loadHost();
  return h.kind === "imgbb" && h.key ? uploadToHost(f, h) : compressImage(f, 1200, 0.9);
};

const CHECKER = "repeating-conic-gradient(color-mix(in srgb, var(--ink-soft) 14%, transparent) 0 25%, transparent 0 50%) 0 0 / 12px 12px";

export default function PortraitUpload({ name, src, onChange, disabled }: { name: string; src?: string; onChange: (url: string) => void; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const pick = async (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return setErr("请选择图片文件");
    setBusy(true); setErr("");
    try { onChange(await toPortraitUrl(f)); }
    catch (e) { setErr(e instanceof Error ? e.message : "上传失败，请换一张试试"); }
    finally { setBusy(false); }
  };
  return (
    <div className="flex items-stretch gap-3 py-2.5">
      <button type="button" disabled={disabled || busy} onClick={() => ref.current?.click()} aria-label={src ? `更换${name}的立绘` : `上传${name}的立绘`}
        className="group relative flex h-[120px] w-[80px] shrink-0 items-end justify-center overflow-hidden rounded-xl border border-line transition hover:border-jade/60 disabled:cursor-not-allowed disabled:opacity-60"
        style={{ background: CHECKER }}>
        {src ? (
          <img src={src} alt={`${name}的立绘`} className="h-full w-full object-contain object-bottom" />
        ) : (
          <span className="m-auto flex flex-col items-center gap-1 text-ink-soft">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
              <circle cx="12" cy="7" r="3.2" /><path d="M5.5 21c.4-4.4 3-7 6.5-7s6.1 2.6 6.5 7" /><path d="M19 3v4M17 5h4" />
            </svg>
            <span className="text-[11px]">上传立绘</span>
          </span>
        )}
        {busy && <span className="absolute inset-0 grid place-items-center bg-paper-2/70 text-[11px] font-bold text-jade">处理中…</span>}
      </button>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-[13px] font-bold text-ink">{src ? "已设置立绘" : "还没有立绘"}</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-soft">
          用于「立绘模式」：{name}说话时站在对话框旁。建议用抠好背景的透明 PNG（半身或全身，竖图）。没有立绘时只显示小头像。
        </p>
        {err && <p className="mt-1 text-[11.5px] text-coral">{err}</p>}
        <div className="mt-auto flex gap-2 pt-2">
          <button type="button" disabled={disabled || busy} onClick={() => ref.current?.click()} className="ui-btn ui-btn-sm ui-btn-soft">{src ? "更换" : "上传"}</button>
          {src && <button type="button" disabled={disabled || busy} onClick={() => onChange("")} className="ui-btn ui-btn-sm ui-btn-ghost">移除</button>}
        </div>
      </div>
      <input ref={ref} type="file" accept="image/png,image/webp,image/gif,image/jpeg" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}
