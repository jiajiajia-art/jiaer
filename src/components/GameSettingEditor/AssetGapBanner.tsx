import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './AssetGapBanner.module.css';

interface AssetGapBannerProps {
  kind: 'text' | 'full';
  missingPortraits: number;
  missingScenes: number;
  missingCover: boolean;
  onGoCharacters: () => void;
  onGoScenes: () => void;
  onGoCover?: () => void;
  onDismiss: () => void;
}

/**
 * 功能注释：创作流程页顶部「素材待补齐」提醒，引导用户去生成立绘/背景。
 */
const AssetGapBanner: React.FC<AssetGapBannerProps> = ({
  kind,
  missingPortraits,
  missingScenes,
  missingCover,
  onGoCharacters,
  onGoScenes,
  onGoCover,
  onDismiss,
}) => {
  const { t } = useTranslation();
  const message = kind === 'full'
    ? t('createGame.assetGapBannerFull')
    : t('createGame.assetGapBannerText');

  return (
    <div className={styles.banner} role="status">
      <div className={styles.icon} aria-hidden>!</div>
      <div className={styles.body}>
        <p className={styles.title}>{t('createGame.assetGapBannerTitle')}</p>
        <p className={styles.message}>{message}</p>
        <div className={styles.meta}>
          {missingPortraits > 0 && (
            <span>{t('createGame.missingPortraitsCount', { count: missingPortraits })}</span>
          )}
          {missingScenes > 0 && (
            <span>{t('createGame.missingScenesCount', { count: missingScenes })}</span>
          )}
          {missingCover && <span>{t('createGame.missingCoverLabel')}</span>}
        </div>
        <div className={styles.actions}>
          {missingPortraits > 0 && (
            <button type="button" className={styles.linkBtn} onClick={onGoCharacters}>
              {t('createGame.goGeneratePortraits')}
            </button>
          )}
          {missingScenes > 0 && (
            <button type="button" className={styles.linkBtn} onClick={onGoScenes}>
              {t('createGame.goGenerateScenes')}
            </button>
          )}
          {missingCover && onGoCover && (
            <button type="button" className={styles.linkBtn} onClick={onGoCover}>
              {t('createGame.goUploadCover')}
            </button>
          )}
        </div>
      </div>
      <button
        type="button"
        className={styles.close}
        onClick={onDismiss}
        aria-label={t('common.close')}
      >
        ×
      </button>
    </div>
  );
};

export default AssetGapBanner;
