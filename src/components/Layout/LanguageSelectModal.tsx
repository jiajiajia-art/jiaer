import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  APP_LANGUAGE_OPTIONS,
  type AppLanguageCode,
} from '../../utils/appLanguage';
import styles from './LanguageSelectModal.module.css';

type LanguageSelectModalProps = {
  isOpen: boolean;
  activeLanguage: AppLanguageCode;
  onClose: () => void;
  onSelect: (code: AppLanguageCode) => void;
  /** 功能注释：桌面端按触发按钮位置锚定为下拉菜单；缺省时退回居中/底部弹层 */
  anchorRect?: DOMRect | null;
};

/** 功能注释：语言切换弹窗——墨黑片选当前语，避免塞进头像菜单挤成三行列表 */
const LanguageSelectModal: React.FC<LanguageSelectModalProps> = ({
  isOpen,
  activeLanguage,
  onClose,
  onSelect,
  anchorRect,
}) => {
  const { t } = useTranslation();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onClose);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const anchored = Boolean(anchorRect) && window.innerWidth > 768;
  const popoverStyle: React.CSSProperties | undefined = anchored && anchorRect
    ? { top: anchorRect.bottom + 8, right: Math.max(12, window.innerWidth - anchorRect.right) }
    : undefined;

  return (
    <div
      className={`${styles.overlay} ${anchored ? styles.overlayAnchored : ''}`}
      role="presentation"
      onClick={onClose}
    >
      <div
        className={`${styles.sheet} ${anchored ? styles.popover : ''}`}
        style={popoverStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="language-select-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="language-select-title" className={styles.title}>
            {t('nav.chooseLanguage')}
          </h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={t('common.cancel')}
          >
            ×
          </button>
        </div>
        <div className={styles.options} role="listbox" aria-label={t('nav.language')}>
          {APP_LANGUAGE_OPTIONS.map((option) => {
            const active = option.code === activeLanguage;
            return (
              <button
                key={option.code}
                type="button"
                role="option"
                aria-selected={active}
                className={`${styles.option} ${active ? styles.optionActive : ''}`}
                onClick={() => {
                  onSelect(option.code);
                  onClose();
                }}
              >
                <span className={styles.optionLabel}>{option.label}</span>
                {active ? (
                  <span className={styles.check} aria-hidden="true">
                    ✓
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LanguageSelectModal;
