/**
 * 游玩端本地头像：选图 → 1:1 裁切（非方图不可关闭）→ 预览确认 → 回传 dataUrl。
 * 不依赖 react-image-crop，用正方形视口 + 拖拽/缩放实现。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { romancePortalRoot } from "../lib/romancePortalRoot";
import {
  assertMinSide,
  exportSquareDataUrl,
  fileToDataUrl,
  isApproxSquare,
  LOCAL_AVATAR_MIN_SIDE,
  readImageNaturalSize,
} from "../lib/squareAvatarLocal";

type Stage = "crop" | "preview";

type Props = {
  file: File;
  onDone: (dataUrl: string) => void;
  onCancel: () => void;
};

const VIEW = 280;

export default function LocalAvatarCropFlow({ file, onDone, onCancel }: Props) {
  const [stage, setStage] = useState<Stage>("crop");
  const [imageSrc, setImageSrc] = useState("");
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [allowClose, setAllowClose] = useState(true);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const src = await fileToDataUrl(file);
        const size = await readImageNaturalSize(src);
        if (cancelled) return;
        setImageSrc(src);
        setNatural({ w: size.width, h: size.height });
        const square = isApproxSquare(size.width, size.height);
        const minErr = assertMinSide(size.width, size.height);
        if (minErr && square) {
          setError(minErr);
          return;
        }
        if (Math.min(size.width, size.height) < LOCAL_AVATAR_MIN_SIDE) {
          setError(`最短边不足 ${LOCAL_AVATAR_MIN_SIDE}px，无法裁切出合格头像`);
          return;
        }
        // 非 1:1 必须裁切，禁止关闭
        setAllowClose(square);
        // 初始缩放：cover 正方形视口
        const cover = Math.max(VIEW / size.width, VIEW / size.height);
        setScale(cover);
        setOffset({ x: 0, y: 0 });
      } catch (e) {
        if (!cancelled) setError((e as Error)?.message || "读取图片失败");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  const clampOffset = useCallback((ox: number, oy: number, sc: number) => {
    const dispW = natural.w * sc;
    const dispH = natural.h * sc;
    const maxX = Math.max(0, (dispW - VIEW) / 2);
    const maxY = Math.max(0, (dispH - VIEW) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, ox)),
      y: Math.min(maxY, Math.max(-maxY, oy)),
    };
  }, [natural.h, natural.w]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setOffset(clampOffset(dragRef.current.ox + dx, dragRef.current.oy + dy, scale));
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const exportPreview = async () => {
    const img = imgRef.current;
    if (!img || !natural.w) return;
    setBusy(true);
    setError("");
    try {
      // 视口相对图片显示坐标：图片以 center + offset 布局
      const dispW = natural.w * scale;
      const dispH = natural.h * scale;
      const left = (VIEW - dispW) / 2 + offset.x;
      const top = (VIEW - dispH) / 2 + offset.y;
      const crop = {
        x: -left,
        y: -top,
        width: VIEW,
        height: VIEW,
      };
      const dataUrl = await exportSquareDataUrl(img, crop, dispW, dispH);
      setPreviewUrl(dataUrl);
      setStage("preview");
    } catch (e) {
      setError((e as Error)?.message || "裁切失败");
    } finally {
      setBusy(false);
    }
  };

  const tryClose = () => {
    if (!allowClose || busy) return;
    onCancel();
  };

  // 功能注释：与 Modal 同挂载点，平台创作壳内裁切弹窗也吃暗红 token
  const portalRoot = romancePortalRoot();
  if (!portalRoot) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[3px]"
      role="presentation"
      onClick={tryClose}
    >
      <div
        className="w-full max-w-[360px] overflow-hidden rounded-2xl border border-line bg-paper shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="local-avatar-crop-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h3 id="local-avatar-crop-title" className="text-[15px] font-bold text-ink">
            {stage === "crop" ? "裁切头像 1:1" : "预览头像"}
          </h3>
          {allowClose ? (
            <button type="button" className="rounded-full px-2 text-[18px] text-ink-soft hover:text-ink" onClick={tryClose} aria-label="关闭">
              ×
            </button>
          ) : (
            <span className="text-[11px] font-semibold text-coral">须完成裁切</span>
          )}
        </header>

        <div className="space-y-3 px-4 py-4">
          {error ? (
            <p className="rounded-xl border border-dashed border-coral/40 bg-coral/5 px-3 py-6 text-center text-[12.5px] text-coral">
              {error}
            </p>
          ) : null}

          {!error && stage === "crop" && imageSrc ? (
            <>
              <p className="text-[12px] leading-relaxed text-ink-soft">
                拖动调整取景；非 1:1 图片必须裁切后才能使用。
              </p>
              <div
                className="relative mx-auto overflow-hidden rounded-2xl border border-line bg-paper-2 touch-none"
                style={{ width: VIEW, height: VIEW }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                <img
                  ref={imgRef}
                  src={imageSrc}
                  alt=""
                  draggable={false}
                  className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                  style={{
                    width: natural.w * scale,
                    height: natural.h * scale,
                    transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                  }}
                />
                <div className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-inset ring-jade/70" />
              </div>
              <label className="flex items-center gap-2 text-[12px] text-ink-soft">
                缩放
                <input
                  type="range"
                  min={Math.max(VIEW / Math.max(natural.w, natural.h), 0.15)}
                  max={Math.max(VIEW / Math.min(natural.w, natural.h), 1) * 3}
                  step={0.01}
                  value={scale}
                  className="flex-1"
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setScale(next);
                    setOffset((o) => clampOffset(o.x, o.y, next));
                  }}
                />
              </label>
            </>
          ) : null}

          {!error && stage === "preview" && previewUrl ? (
            <>
              <p className="text-[12px] leading-relaxed text-ink-soft">确认后将使用这张 1:1 头像。</p>
              <div className="mx-auto overflow-hidden rounded-2xl border border-line bg-paper-2" style={{ width: VIEW, height: VIEW }}>
                <img src={previewUrl} alt="预览" className="h-full w-full object-cover object-center" />
              </div>
            </>
          ) : null}
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3">
          {stage === "crop" ? (
            <>
              {allowClose ? (
                <button type="button" className="rounded-full border border-line px-4 py-2 text-[12.5px] font-semibold text-ink-soft" disabled={busy} onClick={tryClose}>
                  取消
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-full bg-jade px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-50"
                disabled={busy || !!error || !imageSrc}
                onClick={() => void exportPreview()}
              >
                {busy ? "处理中…" : "裁切并预览"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="rounded-full border border-line px-4 py-2 text-[12.5px] font-semibold text-ink-soft"
                disabled={busy}
                onClick={() => setStage("crop")}
              >
                重新裁切
              </button>
              <button
                type="button"
                className="rounded-full bg-jade px-4 py-2 text-[12.5px] font-bold text-white"
                disabled={busy || !previewUrl}
                onClick={() => onDone(previewUrl)}
              >
                使用此头像
              </button>
            </>
          )}
        </footer>
      </div>
    </div>,
    portalRoot,
  );
}
