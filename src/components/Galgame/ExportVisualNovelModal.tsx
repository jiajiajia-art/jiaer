import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import styles from './ShareReplayModal.module.css';
import { stripReplayMarkerFromTitle } from '../../utils/novelGame';
import replayApi from '../../api/galgame/replay';
import type { AxiosError } from 'axios';
import {
  applyEditedChapterTitles,
  normalizeNovelChapterIndex,
  NOVEL_CHAPTER_TITLE_MAX_LENGTH,
  type NovelChapterIndexItem,
} from '../../lib/galgame/novelChapters';

interface Props {
  isOpen: boolean;
  defaultTitle?: string;
  sessionId?: string | null;
  fileId?: string | null;
  onSubmit: (payload: {
    title: string;
    description?: string;
    chapters?: NovelChapterIndexItem[];
  }) => Promise<void> | void;
  onClose: () => void;
}

const MAX_TITLE_LENGTH = 20;
const MAX_DESCRIPTION_LENGTH = 300;

const clampTitle = (value: string) => value.slice(0, MAX_TITLE_LENGTH);

/** 历史导出视觉小说弹窗：标题 + 简介 + AI 章节名（可改），创建后进草稿箱 */
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
  const [chapters, setChapters] = useState<NovelChapterIndexItem[]>([]);
  const [chapterTitles, setChapterTitles] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [generatingChapters, setGeneratingChapters] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const initialTitle = stripReplayMarkerFromTitle(defaultTitle || '') || t('galgame.exportVisualNovelDefaultTitle');
    setTitle(clampTitle(initialTitle));
    setDescription('');
    setChapters([]);
    setChapterTitles([]);
    setGeneratingDescription(false);
    setGeneratingChapters(false);
  }, [defaultTitle, isOpen, t]);

  // 打开弹窗后自动生成章节目录（可改名）
  useEffect(() => {
    if (!isOpen || !sessionId || !fileId) return;
    let cancelled = false;
    const requestTitle =
      stripReplayMarkerFromTitle(defaultTitle || '') || t('galgame.exportVisualNovelDefaultTitle');

    const run = async () => {
      try {
        setGeneratingChapters(true);
        const response = await replayApi.generateNovelChaptersFromSession({
          sessionId,
          fileId,
          title: requestTitle,
        });
        if (cancelled) return;
        const next = normalizeNovelChapterIndex(
          response.data?.data?.chapters,
          Number(response.data?.data?.stepCount) || 0,
        );
        if (!response.data?.success || next.length === 0) {
          toast.error(response.data?.message || t('galgame.exportVisualNovelChaptersFailed'));
          return;
        }
        setChapters(next);
        setChapterTitles(next.map((item) => item.title));
        if (response.data?.data?.usedFallback) {
          toast(t('galgame.exportVisualNovelChaptersFallback'));
        }
      } catch (error) {
        if (cancelled) return;
        const axiosError = error as AxiosError<{ message?: string }>;
        console.error('导出弹窗 AI 生成章节失败:', error);
        toast.error(axiosError.response?.data?.message || t('galgame.exportVisualNovelChaptersFailed'));
      } finally {
        if (!cancelled) setGeneratingChapters(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [isOpen, sessionId, fileId, defaultTitle, t]);

  const canSubmit = useMemo(
    () =>
      title.trim().length > 0
      && chapters.length > 0
      && !submitting
      && !generatingDescription
      && !generatingChapters,
    [title, chapters.length, submitting, generatingDescription, generatingChapters],
  );

  const canGenerateDescription = useMemo(
    () => Boolean(sessionId && fileId && title.trim() && !generatingDescription && !submitting && !generatingChapters),
    [sessionId, fileId, title, generatingDescription, submitting, generatingChapters],
  );

  const canRegenerateChapters = useMemo(
    () => Boolean(sessionId && fileId && title.trim() && !generatingChapters && !submitting && !generatingDescription),
    [sessionId, fileId, title, generatingChapters, submitting, generatingDescription],
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

  const handleRegenerateChapters = async () => {
    if (!canRegenerateChapters || !sessionId || !fileId) return;
    try {
      setGeneratingChapters(true);
      const response = await replayApi.generateNovelChaptersFromSession({
        sessionId,
        fileId,
        title: stripReplayMarkerFromTitle(title.trim()) || title.trim(),
      });
      const next = normalizeNovelChapterIndex(
        response.data?.data?.chapters,
        Number(response.data?.data?.stepCount) || 0,
      );
      if (!response.data?.success || next.length === 0) {
        toast.error(response.data?.message || t('galgame.exportVisualNovelChaptersFailed'));
        return;
      }
      setChapters(next);
      setChapterTitles(next.map((item) => item.title));
      toast.success(t('galgame.exportVisualNovelChaptersReady'));
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      console.error('导出弹窗重新生成章节失败:', error);
      toast.error(axiosError.response?.data?.message || t('galgame.exportVisualNovelChaptersFailed'));
    } finally {
      setGeneratingChapters(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      const finalChapters = applyEditedChapterTitles(chapters, chapterTitles);
      await onSubmit({
        title: stripReplayMarkerFromTitle(title.trim()) || title.trim(),
        description: description.trim() || undefined,
        chapters: finalChapters,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const busy = generatingDescription || generatingChapters || submitting;

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

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label className={styles.labelInline}>{t('galgame.exportVisualNovelChapters')}</label>
              <button
                type="button"
                className={styles.aiGenerateBtn}
                onClick={handleRegenerateChapters}
                disabled={!canRegenerateChapters}
              >
                {generatingChapters
                  ? t('common.publishSettings.aiGenerating')
                  : t('galgame.exportVisualNovelChaptersRegen')}
              </button>
            </div>
            {generatingChapters && chapters.length === 0 ? (
              <div className={styles.helperText} style={{ textAlign: 'left' }}>
                {t('galgame.exportVisualNovelChaptersLoading')}
              </div>
            ) : null}
            {chapters.map((chapter, index) => (
              <div key={chapter.id} style={{ marginBottom: 8 }}>
                <input
                  className={styles.input}
                  value={chapterTitles[index] ?? chapter.title}
                  maxLength={NOVEL_CHAPTER_TITLE_MAX_LENGTH}
                  onChange={(event) => {
                    const next = [...chapterTitles];
                    next[index] = event.target.value.slice(0, NOVEL_CHAPTER_TITLE_MAX_LENGTH);
                    setChapterTitles(next);
                  }}
                  placeholder={t('galgame.exportVisualNovelChapterTitlePlaceholder')}
                  disabled={busy}
                />
              </div>
            ))}
            {chapters.length === 0 && !generatingChapters ? (
              <div className={styles.helperText} style={{ textAlign: 'left' }}>
                {t('galgame.exportVisualNovelChaptersRequired')}
              </div>
            ) : null}
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
