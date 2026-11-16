import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import TrimmedTransparentImg from '../../components/TrimmedTransparentImg';
import { playerCharacterCardsApi } from '../../api/galgame/playerCharacterCards';
import {
  PLAYER_UPLOAD_AVATAR_ACCEPT,
  PLAYER_UPLOAD_AVATAR_MAX_BYTES,
  compressImageFileToWebpUnderMaxBytes,
} from '../../lib/galgame/compressImageToWebp';
import { useAuthStore } from '../../store/useAuthStore';
import { getImageUrl } from '../../utils/constants';
import { useImageBusinessPrice } from '../../hooks/useImageBusinessPrice';
import { MdOutlineFileUpload } from 'react-icons/md';
import panel from './WarehousePanel.module.css';

type Props = {
  name: string;
  avatarUrl: string;
  generating: boolean;
  disabled?: boolean;
  onGenerate: () => void;
  /** 上传成功后写回草稿 / 列表预览 */
  onAvatarUrl: (url: string) => void;
  /** 编辑已有卡时传入，便于服务端同步 avatarUrl */
  cardId?: string | null;
  fallbackChar?: string;
  /** 头像右侧：姓名、性别等表单项 */
  children?: React.ReactNode;
};

/**
 * 左立绘画布；右侧先「上传图片」再「AI 生成」。
 * 上传：客户端 WebP 质量 100，超 1MB 等比缩边；不抠图、不扣积分。
 */
const WarehouseCardAvatarField: React.FC<Props> = ({
  name,
  avatarUrl,
  generating,
  disabled,
  onGenerate,
  onAvatarUrl,
  cardId = null,
  fallbackChar,
  children,
}) => {
  const { t } = useTranslation();
  const resolvedFallback = fallbackChar ?? t('warehouse.cards.avatarFallbackMe');
  const pointsUnit = t('common.points');
  const { estimatedPoints } = useImageBusinessPrice('warehouse_card');
  const priceLabel = estimatedPoints == null ? '—' : String(estimatedPoints);
  const token = useAuthStore((s) => s.user?.token);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const preview = avatarUrl ? getImageUrl(avatarUrl) : '';
  const label = (name || resolvedFallback).trim().slice(0, 1)
    || t('warehouse.cards.avatarFallbackNpc').slice(0, 1);
  const busy = Boolean(generating);
  // 功能注释：生图/上传互斥；姓名性别仍可改
  const locked = Boolean(disabled || generating || uploading || estimatedPoints == null);

  /** 功能注释：立绘写入后滚回预览区，避免手机端头顶被挡在弹窗外。 */
  useEffect(() => {
    if (!preview || !previewRef.current) return;
    previewRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [preview]);

  const requestUpload = () => {
    if (!token) {
      toast.error(t('warehouse.cards.loginRequired'));
      return;
    }
    if (locked) return;
    fileRef.current?.click();
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!token) {
      toast.error(t('warehouse.cards.loginRequired'));
      return;
    }
    if (uploading || generating) return;
    setUploading(true);
    try {
      const compressed = await compressImageFileToWebpUnderMaxBytes(file, {
        maxBytes: PLAYER_UPLOAD_AVATAR_MAX_BYTES,
      });
      const res = await playerCharacterCardsApi.uploadAvatar(token, compressed.file, {
        fileName: compressed.file.name,
        cardId,
      });
      if (!res?.success || !res.data?.avatarUrl) {
        toast.error(res?.message || t('warehouse.cards.avatarUploadFailed'));
        return;
      }
      onAvatarUrl(res.data.avatarUrl);
      toast.success(t('warehouse.cards.avatarUploadOk'));
    } catch (err) {
      toast.error((err as Error)?.message || t('warehouse.cards.avatarUploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const genBtnLabel = busy
    ? t('warehouse.cards.avatarGeneratingBackground')
    : avatarUrl
      ? t('warehouse.cards.avatarRegenerate', { cost: priceLabel, pointsUnit })
      : t('warehouse.cards.avatarAiGenerate', { cost: priceLabel, pointsUnit });

  return (
    <section className={panel.avatarField} aria-label={t('warehouse.cards.avatarSectionAria')}>
      <div className={panel.avatarIdentityRow}>
        <div
          ref={previewRef}
          className={`${panel.avatarPreview}${preview ? ` ${panel.avatarPreviewHasImage}` : ''}`}
          aria-busy={busy || uploading}
        >
          {preview ? (
            <TrimmedTransparentImg src={preview} className={panel.avatarPreviewImg} variant="full" />
          ) : (
            <span className={panel.avatarPreviewFallback} aria-hidden>
              {label}
            </span>
          )}
        </div>

        <div className={panel.avatarAside}>
          <div className={panel.avatarActionStack}>
            <button
              type="button"
              className={panel.avatarUploadBtn}
              disabled={locked || !token}
              onClick={requestUpload}
            >
              <MdOutlineFileUpload className={panel.avatarUploadBtnIcon} aria-hidden />
              {uploading ? t('warehouse.cards.avatarUploading') : t('warehouse.cards.avatarUploadImage')}
            </button>
            <button
              type="button"
              className={`${panel.primaryBtn} ${panel.avatarGenBtn}`}
              disabled={locked}
              onClick={onGenerate}
            >
              {genBtnLabel}
            </button>
            <p className={panel.avatarUploadHint}>
              {t('warehouse.cards.avatarUploadHint')}
            </p>
          </div>
          {children}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={PLAYER_UPLOAD_AVATAR_ACCEPT}
        className={panel.avatarFileInput}
        aria-hidden
        tabIndex={-1}
        onChange={(ev) => {
          void onFileSelected(ev);
        }}
      />
    </section>
  );
};

export default WarehouseCardAvatarField;
