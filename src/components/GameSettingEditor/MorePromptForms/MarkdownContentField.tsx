import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import styles from './MarkdownContentField.module.css';

interface MarkdownContentFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * 内容区：默认 Markdown 渲染；点击进入 textarea 编辑（单区域、不分栏）
 */
const MarkdownContentField: React.FC<MarkdownContentFieldProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleStartEdit = useCallback(() => {
    if (disabled) return;
    setIsEditing(true);
  }, [disabled]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
  }, []);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const trimmed = value.trim();

  return (
    <div className={styles.wrapper}>
      {isEditing ? (
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={handleBlur}
          disabled={disabled}
          rows={12}
          placeholder={t('createGame.morePrompt.contentPlaceholder')}
        />
      ) : (
        <button
          type="button"
          className={`${styles.preview} ${!trimmed ? styles.previewEmpty : ''}`}
          onClick={handleStartEdit}
          disabled={disabled}
        >
          {trimmed ? (
            <div className={styles.markdownBody}>
              <ReactMarkdown>{value}</ReactMarkdown>
            </div>
          ) : (
            <span className={styles.placeholder}>{t('createGame.morePrompt.contentPlaceholder')}</span>
          )}
        </button>
      )}
    </div>
  );
};

export default MarkdownContentField;
