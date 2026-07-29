import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import styles from './ShareReplayModal.module.css';
import { buildExportVisualNovelDefaultTitle, stripReplayMarkerFromTitle } from '../../utils/novelGame';
import replayApi from '../../api/galgame/replay';
import type { AxiosError } from 'axios';

interface Props {
  isOpen: boolean;
  defaultTitle?: string;
  sessionId?: string | null;
  fileId?: string | null;
  onSubmit: (payload: {
    title: string;
    description?: string;
  }) => Promise<void> | void;
  onClose: () => void;
}

const MAX_TITLE_LENGTH = 20;
const MAX_DESCRIPTION_LENGTH = 300;

const clampTitle = (value: string) => value.slice(0, MAX_TITLE_LENGTH);

/** 历史导出视觉小说弹窗：标题 + 简介，创建后进草稿箱（章节由服务端自动生成） */
const ExportVisualNovelModal: React.FC<Props> = ({
  isOpen,
  defaultTitle,
  sessionId,
  fileId,
  onSubmit,
  onClose,
}) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const initialTitle = buildExportVisualNovelDefaultTitle(
      defaultTitle || '',
      t('galgame.exportVisualNovelDefaultTitle'),
      MAX_TITLE_LENGTH,
    );
    setTitle(clampTitle(initialTitle));
    setDescription('');
    setGeneratingDescription(false);
  }, [defaultTitle, isOpen, t]);

  const canSubmit = useMemo(
    () => title.trim().length > 0 && !submitting && !generatingDescription,
    [title, submitting, generatingDescription],
  );

  const canGenerateDescription = useMemo(
    () => Boolean(sessionId && fileId && title.trim() && !generatingDescription && !submitting),
    [sessionId, fileId, title, generatingDescription, submitting],
  );

  if (!isOpen) return null;

  const handleGenerateDescription = async () => {
    if (!canGenerateDescription || !sessionId || !fileId) return;
    if (!title.trim()) {
      toast.error(t('common.publishSettings.titleRequired'));
      return;
    }

    try {
      setGeneratingDescription(true);
      const response = await replayApi.generateNovelDescriptionFromSession({
        sessionId,
        fileId,
        title: stripReplayMarkerFromTitle(title.trim()) || title.trim(),
      });
      const nextDescription = response.data?.data?.description || '';
      if (!response.data?.success || !nextDescription) {
        toast.error(response.data?.message || t('common.publishSettings.aiGenerateFailed'));
        return;
      }
      setDescription(nextDescription.slice(0, MAX_DESCRIPTION_LENGTH));
      toast.success(t('common.publishSettings.aiGenerateSuccess'));
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      console.error('导出弹窗 AI 生成简介失败:', error);
      toast.error(axiosError.response?.data?.message || t('common.publishSettings.aiGenerateFailed'));
    } finally {
      setGeneratingDescription(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      await onSubmit({
        title: stripReplayMarkerFromTitle(title.trim()) || title.trim(),
        description: description.trim() || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const busy = generatingDescription || submitting;

  return (
    <div className={styles.overlay} style={{ zIndex: 3400 }} onClick={onClose}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.titleWrap}>
              <img
                className={styles.titleIcon}
                src={`${import.meta.env.BASE_URL}data/assets/create/弹框左上角图案.png`}
                alt=""
              />
              <div className={styles.title}>{t('galgame.exportVisualNovel')}</div>
            </div>
            <button className={styles.closeBtn} onClick={onClose} aria-label={t('createGame.close')}>
              <img
                className={styles.closeImg}
                src={`${import.meta.env.BASE_URL}data/assets/gameDetail/关闭.png`}
                alt={t('createGame.close')}
              />
            </button>
          </div>
        </div>
        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.label}>{t('createGame.titleLabel')}</label>
            <input
              className={styles.input}
              value={title}
              maxLength={MAX_TITLE_LENGTH}
              onChange={(event) => setTitle(clampTitle(event.target.value))}
              placeholder={t('createGame.titlePlaceholder')}
              disabled={busy}
            />
            <div className={styles.helperText}>
              {title.length}/{MAX_TITLE_LENGTH}
            </div>
          </div>
          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label className={styles.labelInline}>{t('galgame.exportVisualNovelDescOptional')}</label>
              <button
                type="button"
                className={styles.aiGenerateBtn}
                onClick={handleGenerateDescription}
                disabled={!canGenerateDescription}
              >
                {generatingDescription
                  ? t('common.publishSettings.aiGenerating')
                  : t('createGame.aiGenerate')}
              </button>
            </div>
            <textarea
              className={styles.textarea}
              value={description}
              maxLength={MAX_DESCRIPTION_LENGTH}
              onChange={(event) => setDescription(event.target.value.slice(0, MAX_DESCRIPTION_LENGTH))}
              placeholder={t('galgame.exportVisualNovelDescPlaceholder')}
              disabled={busy}
            />
            <div className={styles.helperText}>
              {description.length}/{MAX_DESCRIPTION_LENGTH}
            </div>
          </div>

          <div className={styles.helperText} style={{ textAlign: 'left' }}>
            {t('galgame.exportVisualNovelHint')}
          </div>
        </div>
        <div className={styles.footer}>
          <button
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={onClose}
            disabled={busy}
          >
            {t('createGame.cancel')}
          </button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? t('createGame.creating') : t('galgame.exportVisualNovelCreate')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportVisualNovelModal;
