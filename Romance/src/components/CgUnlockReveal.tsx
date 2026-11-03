import { useEffect } from "react";
import type { CgDef } from "../lib/types";
import { useCgImageSrc } from "../game/cgImageStore";

export default function CgUnlockReveal({
  cg,
  extraCount,
  reduced,
  onClose,
}: {
  cg: CgDef;
  extraCount: number;
  reduced: boolean;
  onClose: () => void;
}) {
  const src = useCgImageSrc(cg);
  useEffect(() => {
    const timer = window.setTimeout(onClose, 2000);
    return () => window.clearTimeout(timer);
  }, [onClose]);

  return (
    <button type="button" className="cg-unlock-overlay" onClick={onClose} aria-label="关闭 CG 解锁画面">
      {reduced ? (
        <span className="rounded-full bg-black/60 px-5 py-2.5 text-[14px] font-bold text-white">已收入图鉴</span>
      ) : (
        <span className="cg-unlock-stage">
          {src && <img src={src} alt={cg.title} className="cg-unlock-image" />}
          <span className="cg-unlock-glow" />
          <span className="cg-unlock-title">{cg.title || "未命名 CG"}</span>
          {extraCount > 0 && <span className="cg-unlock-more">另有 {extraCount} 张 CG 同时收入图鉴</span>}
        </span>
      )}
    </button>
  );
}
