import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './CharactersPanel.module.css';

interface PortraitLightboxProps {
  open: boolean;
  src: string | null;
  title?: string;
  onClose: () => void;
  /** 封面海报式预览：带暗角、血边、叠加大标题 */
  posterMode?: boolean;
  subtitle?: string;
}

/**
 * 功能注释：角色立绘点击放大预览（挂 body）。
 * 遮罩 / Esc / 关闭钮均可关；禁止原生 alert。
 * posterMode=true 时为游戏封面海报风预览（16:9 + 血边 + 标题遮罩）。
 */
const PortraitLightbox: React.FC<PortraitLightboxProps> = ({
  open,
  src,
  title,
  onClose,
  posterMode = false,
  subtitle,
}) => {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || !src) return null;

  const modal = (
    <div
      className={styles.portraitLightboxOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : '立绘预览'}
      onClick={onClose}
      data-testid="portrait-lightbox"
    >
      <div className={styles.portraitLightboxStage} onClick={(e) => e.stopPropagation()}>
        <button
          ref={closeRef}
          type="button"
          className={styles.portraitLightboxClose}
          onClick={onClose}
          aria-label="关闭预览"
        >
          ×
        </button>
        {posterMode ? (
          <div className={styles.coverPosterLightboxFrame}>
            <img className={styles.coverPosterLightboxImg} src={src} alt={title || '游戏封面'} />
            {title ? (
              <div className={styles.coverPosterLightboxTitleBlock}>
                {subtitle ? (
                  <p className={styles.coverPosterLightboxSubtitle}>{subtitle}</p>
                ) : null}
                <p id={titleId} className={styles.coverPosterLightboxTitle}>{title}</p>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <div className={styles.portraitLightboxFrame}>
              <img className={styles.portraitLightboxImg} src={src} alt={title || '角色立绘'} />
            </div>
            {title ? (
              <p id={titleId} className={styles.portraitLightboxTitle}>
                {title}
              </p>
            ) : null}
          </>
        )}
        <p className={styles.portraitLightboxHint}>点击空白处关闭</p>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default PortraitLightbox;
