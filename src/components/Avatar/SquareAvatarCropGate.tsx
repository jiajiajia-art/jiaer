/**
 * 头像库 1:1 裁剪门闸：静图导出垫底色 WebP；GIF 传裁剪框保留动画。
 * 支持按钮选图与 ref.openFile；批量「需裁切」可强制不可关闭。
 */
import { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
import toast from 'react-hot-toast';
import ImageCropModal, { type ImageCropPixelMeta } from '../CommonModal/ImageCropModal';
import { uploadCropPresets } from '../../utils/uploadImageCrop';
import { fileToDataUrl } from '../../utils/uploadImageCrop';
import {
  assertMinSide,
  describeSquareAvatarUploadHints,
  exportSquareStaticBlob,
  isAllowedAvatarUploadFile,
  isAnimatedGifFile,
  isApproxSquare,
  normalizeSquareCropRect,
  readImageNaturalSize,
  SQUARE_AVATAR_FILL,
  SQUARE_AVATAR_TARGET_SIDE,
  type SquareCropRect,
} from '../../lib/galgame/squareAvatarPrep';

export type SquareAvatarUploadPayload = {
  file: File;
  crop?: SquareCropRect | null;
  isGif: boolean;
  /**
   * 功能注释：1:1 静帧预览（批量看板替换原非方图用）。
   * 静图=成片 WebP；GIF=按裁切框导出的静帧，避免看板仍显示原竖图。
   */
  previewBlob?: Blob;
  previewSide?: number;
};

export type SquareAvatarOpenResult = 'ok' | 'reject';

export type SquareAvatarOpenOptions = {
  /** 强制进入裁切层（即使已近似正方形也不直传） */
  forceCrop?: boolean;
  /** 传给 ImageCropModal；false 时不可关闭，默认 true */
  allowClose?: boolean;
};

export type SquareAvatarCropGateHandle = {
  openFile: (file: File, options?: SquareAvatarOpenOptions) => Promise<SquareAvatarOpenResult>;
};

type Props = {
  disabled?: boolean;
  buttonDisabled?: boolean;
  buttonClassName?: string;
  buttonLabel?: string;
  hideButton?: boolean;
  onReady: (payload: SquareAvatarUploadPayload) => void | Promise<void>;
  onDismiss?: () => void;
};

const SquareAvatarCropGate = forwardRef<SquareAvatarCropGateHandle, Props>(function SquareAvatarCropGate(
  {
    disabled,
    buttonDisabled,
    buttonClassName,
    buttonLabel = '选择图片',
    hideButton,
    onReady,
    onDismiss,
  },
  ref,
) {
  const [pending, setPending] = useState<{
    file: File;
    imageSrc: string;
    isGif: boolean;
    allowClose: boolean;
  } | null>(null);

  const pickLocked = Boolean(disabled || buttonDisabled);

  const openFile = useCallback(async (
    file: File | undefined,
    options?: SquareAvatarOpenOptions,
  ): Promise<SquareAvatarOpenResult> => {
    // 功能注释：imperative openFile 绝不看 disabled，批量下一张不受 uploading 阻断
    if (!file) return 'reject';
    if (!isAllowedAvatarUploadFile(file)) {
      toast.error('仅支持 PNG、JPG、WebP、GIF');
      return 'reject';
    }
    const forceCrop = Boolean(options?.forceCrop);
    const allowClose = options?.allowClose !== false;
    try {
      const imageSrc = await fileToDataUrl(file);
      const size = await readImageNaturalSize(imageSrc);
      const minErr = assertMinSide(size.width, size.height);
      const isGif = isAnimatedGifFile(file);

      if (!forceCrop && isGif && isApproxSquare(size.width, size.height) && !minErr) {
        await onReady({
          file,
          crop: null,
          isGif: true,
          previewBlob: file,
          previewSide: Math.min(size.width, size.height),
        });
        return 'ok';
      }
      if (minErr && isApproxSquare(size.width, size.height)) {
        toast.error(minErr);
        return 'reject';
      }
      setPending({ file, imageSrc, isGif, allowClose: forceCrop ? false : allowClose });
      return 'ok';
    } catch (e) {
      toast.error((e as Error)?.message || '读取图片失败');
      return 'reject';
    }
  }, [onReady]);

  useImperativeHandle(ref, () => ({
    openFile: (file: File, options?: SquareAvatarOpenOptions) => openFile(file, options),
  }), [openFile]);

  const close = () => {
    if (pending && pending.allowClose === false) return;
    setPending(null);
    onDismiss?.();
  };

  const finishStatic = async (blob: Blob, side = SQUARE_AVATAR_TARGET_SIDE) => {
    if (!pending) return;
    const file = new File([blob], `${pending.file.name.replace(/\.[^.]+$/, '') || 'avatar'}.webp`, {
      type: blob.type || 'image/webp',
    });
    await onReady({
      file,
      crop: null,
      isGif: false,
      previewBlob: blob,
      previewSide: side,
    });
    setPending(null);
  };

  const finishGifMeta = async (meta: ImageCropPixelMeta) => {
    if (!pending) return;
    const size = await readImageNaturalSize(pending.imageSrc);
    const square = normalizeSquareCropRect(
      {
        left: meta.sx,
        top: meta.sy,
        width: meta.sourceWidth,
        height: meta.sourceHeight,
      },
      size.width,
      size.height,
    );
    const minErr = assertMinSide(square.width, square.height);
    if (minErr) {
      toast.error(minErr);
      return;
    }
    // 功能注释：GIF 入库仍传原片+crop；看板预览另导出 1:1 静帧，避免继续显示竖图
    const img = new Image();
    img.src = pending.imageSrc;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('图片加载失败'));
    });
    const previewBlob = await exportSquareStaticBlob(img, square, {
      targetSide: SQUARE_AVATAR_TARGET_SIDE,
      fill: SQUARE_AVATAR_FILL,
      mimeType: 'image/webp',
      quality: 0.9,
    });
    await onReady({
      file: pending.file,
      crop: square,
      isGif: true,
      previewBlob,
      previewSide: SQUARE_AVATAR_TARGET_SIDE,
    });
    setPending(null);
  };

  const finishStaticFromMeta = async (meta: ImageCropPixelMeta) => {
    if (!pending) return;
    const img = new Image();
    img.src = pending.imageSrc;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('图片加载失败'));
    });
    const square = normalizeSquareCropRect(
      {
        left: meta.sx,
        top: meta.sy,
        width: meta.sourceWidth,
        height: meta.sourceHeight,
      },
      img.naturalWidth || img.width,
      img.naturalHeight || img.height,
    );
    const minErr = assertMinSide(square.width, square.height);
    if (minErr) {
      toast.error(minErr);
      return;
    }
    const blob = await exportSquareStaticBlob(
      img,
      square,
      {
        targetSide: SQUARE_AVATAR_TARGET_SIDE,
        fill: SQUARE_AVATAR_FILL,
        mimeType: 'image/webp',
        quality: 0.95,
      },
    );
    await finishStatic(blob, SQUARE_AVATAR_TARGET_SIDE);
  };

  const preset = uploadCropPresets.avatar;

  return (
    <>
      {!hideButton ? (
        <label className={buttonClassName} style={{ cursor: pickLocked ? 'not-allowed' : 'pointer' }}>
          {buttonLabel}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            disabled={pickLocked}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              void openFile(f);
            }}
          />
        </label>
      ) : null}
      {pending ? (
        <ImageCropModal
          isOpen
          imageSrc={pending.imageSrc}
          title="裁剪头像 1:1"
          description={`${describeSquareAvatarUploadHints()}${pending.isGif ? ' GIF 将按裁剪框保留动画。' : ` 透明区域使用底色 ${SQUARE_AVATAR_FILL}。`}${pending.allowClose === false ? ' 请完成裁切后确认。' : ''}`}
          aspectRatio={1}
          aspectLabel="1:1"
          defaultCropScale={preset.defaultCropScale}
          mimeType={pending.isGif ? 'image/gif' : 'image/webp'}
          exportCropMetaOnly
          allowClose={pending.allowClose}
          onClose={close}
          onCropComplete={() => undefined}
          onCropMetaComplete={(meta) => {
            void (pending.isGif ? finishGifMeta(meta) : finishStaticFromMeta(meta));
          }}
        />
      ) : null}
    </>
  );
});

export default SquareAvatarCropGate;
