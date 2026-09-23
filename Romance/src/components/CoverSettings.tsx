import { useEffect, useRef, useState } from "react";
import defaultCover from "../imports/opening-cover.png";
import { clearCoverMedia, getCoverFit, getCoverMedia, setCoverFit, setCoverMedia, type CoverFit } from "../lib/coverMedia";

export default function CoverSettings() {
  const input = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState(defaultCover);
  const [fit, setFitState] = useState<CoverFit>(getCoverFit);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let url = "";
    void getCoverMedia().then((blob) => { if (blob) { url = URL.createObjectURL(blob); setSrc(url); } });
    return () => { if (url) URL.revokeObjectURL(url); };
  }, []);

  const pick = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setMessage("请选择图片或 GIF 动图。"); return; }
    if (file.size > 30 * 1024 * 1024) { setMessage("封面文件请控制在 30MB 以内。"); return; }
    await setCoverMedia(file);
    setSrc(URL.createObjectURL(file));
    setMessage(file.type === "image/gif" ? "GIF 动态封面已保存。" : "封面已保存。");
  };

  const changeFit = (next: CoverFit) => { setFitState(next); setCoverFit(next); };
  return <div className="space-y-4 text-sm text-ink">
    <div className="rounded-xl border border-jade/30 bg-jade/5 p-3 text-xs leading-relaxed text-ink-soft">这里配置玩家打开游戏时唯一出现的封面。支持 PNG、JPG、WebP 与 GIF 动图，素材保存在浏览器本地，不占用游戏存档。</div>
    <div className="mx-auto aspect-[660/984] w-full max-w-[280px] overflow-hidden rounded-2xl border border-line bg-[#100b15] shadow-xl">
      <img src={src} alt="当前游戏封面预览" className={`h-full w-full ${fit === "cover" ? "object-cover" : "object-contain"}`} />
    </div>
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
    <button onClick={() => input.current?.click()} className="w-full rounded-xl bg-jade py-3 font-semibold text-paper-2 transition hover:brightness-110">上传封面图片 / GIF 动图</button>
    <div>
      <p className="mb-2 text-xs font-semibold text-ink-soft">封面适配方式</p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => changeFit("contain")} className={`rounded-lg border px-3 py-2 ${fit === "contain" ? "border-jade bg-jade/10 text-jade" : "border-line text-ink-soft"}`}>完整显示</button>
        <button onClick={() => changeFit("cover")} className={`rounded-lg border px-3 py-2 ${fit === "cover" ? "border-jade bg-jade/10 text-jade" : "border-line text-ink-soft"}`}>铺满裁切</button>
      </div>
    </div>
    {message && <p className="text-center text-xs text-jade">{message}</p>}
    <button onClick={() => void clearCoverMedia().then(() => { setSrc(defaultCover); setFitState("contain"); setMessage("已恢复默认封面。"); })} className="w-full rounded-lg border border-line py-2 text-xs text-ink-soft">恢复默认封面</button>
  </div>;
}
