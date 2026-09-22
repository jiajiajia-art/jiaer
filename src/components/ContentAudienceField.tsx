import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  CONTENT_AUDIENCE_OPTIONS,
  type ContentAudience,
} from '../utils/contentAudience';
import styles from './ContentAudienceField.module.css';

interface ContentAudienceFieldProps {
  value: ContentAudience | null;
  onChange: (value: ContentAudience) => void;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * 发布前必选的作品分类：男性向 / 女性向 / 全性向，只能选一项
 */
const ContentAudienceField: React.FC<ContentAudienceFieldProps> = ({
  value,
  onChange,
  required = true,
  error,
  disabled = false,
  className,
}) => {
  const { t } = useTranslation();

  return (
    <div className={`${styles.panel} ${className || ''}`.trim()}>
      <div className={styles.header}>
        <span className={styles.label}>
          {t('createGame.contentAudience')}
          {required ? <span className={styles.requiredMark}>*</span> : null}
        </span>
        <span className={styles.hint}>{t('createGame.contentAudienceHint')}</span>
      </div>
      <div className={styles.wrap} role="radiogroup" aria-label={t('createGame.contentAudience')}>
        {CONTENT_AUDIENCE_OPTIONS.map((option) => {
          const active = value === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              className={`${styles.chip} ${active ? styles.chipActive : ''}`}
              disabled={disabled}
              onClick={() => onChange(option)}
            >
              {t(`createGame.contentAudience_${option}`)}
            </button>
          );
        })}
      </div>
      {error ? <div className={styles.error}>{error}</div> : null}
    </div>
  );
};

export default ContentAudienceField;
