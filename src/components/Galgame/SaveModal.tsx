import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './SaveModal.module.css';
import { streamSaveSummary, savesApi } from '../../api/galgame/saves';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface SaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
  fileId: string | null;
  onSaveSuccess?: () => void;
  /** 默认保存模式：'create' 新建, 'overwrite' 覆盖, undefined 需要用户选择 */
  defaultSaveMode?: 'create' | 'overwrite';
}

const SaveModal: React.FC<SaveModalProps> = ({
  isOpen,
  onClose,
  sessionId,
  fileId,
  onSaveSuccess,
  defaultSaveMode,
}) => {
  const { t } = useTranslation();
  const [summary, setSummary] = useState('');
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [saveList, setSaveList] = useState<{ saveId: string; summaryText: string; createdAt: number }[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setCharCount(summary.trim().length);
  }, [summary]);

  useEffect(() => {
    if (!isOpen) {
      setSummary('');
      setCandidateId(null);
      setIsStreaming(false);
      setIsSaving(false);
      setShowConfirm(false);
      abortRef.current?.abort();
      abortRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    const loadSaves = async () => {
      if (isOpen && fileId) {
        try {
          const resp = await savesApi.listByFileId(fileId);
          const data = resp as any;
          if (data?.data?.items) {
            setSaveList(data.data.items);
          }
        } catch (e) {
          console.error('Failed to load saves:', e);
        }
      }
    };
    void loadSaves();
  }, [isOpen, fileId]);

  const canSave = useMemo(() => {
    return !isStreaming && !isSaving && summary.trim().length >= 10 && !!sessionId && !!fileId;
  }, [isStreaming, isSaving, summary, sessionId, fileId]);

  const handleStart = useCallback(async () => {
    if (!sessionId) {
      toast.error(t('saveModal.startFirst'));
      return;
    }

    try {
      setIsStreaming(true);
      setSummary('');
      setCandidateId(null);
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      await streamSaveSummary(
        sessionId,
        {
          onStart: (evt) => {
            if (evt && evt.candidateId) setCandidateId(evt.candidateId);
          },
          onChunk: (text) => {
            setSummary((prev) => prev + text);
            queueMicrotask(() => {
              const el = textRef.current;
              if (el) {
                el.scrollTop = el.scrollHeight;
              }
            });
          },
          onError: (msg) => {
            toast.error(msg || t('saveModal.generationFailed'));
          },
          onDone: () => {
            toast.success(t('saveModal.summaryGenerated'));
          },
        },
        ctrl.signal,
      );
    } catch (e: any) {
      toast.error(e?.message || t('saveModal.generationFailed'));
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [sessionId, t]);

  const executeSave = useCallback(
    async (saveAction: 'create' | 'overwrite', targetSaveId?: string) => {
      if (!canSave || !sessionId || !fileId) return;

      try {
        setIsSaving(true);
        const isOverwrite = saveAction === 'overwrite';

        const resp = await savesApi.create({
          fileId,
          sessionId,
          summaryText: summary,
          candidateId: candidateId || undefined,
          saveAction: isOverwrite ? 'overwrite' : undefined,
          targetSaveId: isOverwrite ? targetSaveId || undefined : undefined,
        });

        if ((resp as any).data?.saveId || (resp as any).data?.createdAt !== undefined) {
          const mode = (resp as any).data?.mode || 'create';
          const overwritten = (resp as any).data?.overwritten;
          if (mode === 'overwrite' && overwritten) {
            toast.success(t('saveModal.saveOverwritten'));
          } else {
            toast.success(t('saveModal.saveSuccess'));
          }
          setShowConfirm(false);
          onClose();
          onSaveSuccess?.();
        } else {
          toast.success(t('saveModal.saveSuccess'));
          setShowConfirm(false);
          onClose();
          onSaveSuccess?.();
        }
      } catch (e: any) {
        const code = e?.response?.data?.code;
        const msg =
          code === 'MAX_SAVES_REACHED'
            ? t('saveModal.maxSavesReached')
            : code === 'TARGET_SAVE_NOT_FOUND'
              ? t('saveModal.targetSaveNotFound')
              : code === 'INVALID_SAVE_ACTION'
                ? t('saveModal.invalidSaveAction')
                : e?.response?.data?.message || e?.message || t('saveModal.saveFailed');
        toast.error(msg);
      } finally {
        setIsSaving(false);
      }
    },
    [canSave, sessionId, fileId, summary, candidateId, onClose, onSaveSuccess, t],
  );

  const handleSave = useCallback(() => {
    if (!canSave || !sessionId || !fileId) return;

    // 有默认模式则直接执行（外部直接传 defaultSaveMode 即可）
    if (defaultSaveMode) {
      if (defaultSaveMode === 'overwrite') {
        const firstSaveId = saveList[0]?.saveId;
        if (!firstSaveId) {
          toast.error(t('saveModal.noSaveToOverwrite'));
          return;
        }
        void executeSave('overwrite', firstSaveId);
        return;
      }

      void executeSave('create');
      return;
    }

    // 无默认模式则让用户在弹窗中选择
    setShowConfirm(true);
  }, [canSave, sessionId, fileId, defaultSaveMode, saveList, executeSave, t]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={() => !isStreaming && onClose()}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>{t('saveModal.title')}</div>
          <button className={styles.closeBtn} onClick={() => !isStreaming && onClose()} disabled={isStreaming}>
            ×
          </button>
        </div>
        <div className={styles.body}>
          <textarea
            ref={textRef}
            className={styles.textarea}
            placeholder={t('saveModal.placeholder')}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            disabled={isStreaming || isSaving}
          />
          <div className={styles.hintRow}>
            <span>{t('saveModal.minCharsRequired')}</span>
            <span>{t('saveModal.chars', { count: charCount })}</span>
          </div>
        </div>
        <div className={styles.footer}>
          <button className={styles.btn} onClick={handleStart} disabled={isStreaming || !sessionId}>
            {t('saveModal.startSave')}
          </button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave} disabled={!canSave}>
            {isSaving ? t('saveModal.saving') : t('saveModal.saveGame')}
          </button>
        </div>
      </div>

      {/* 保存确认弹窗 */}
      {showConfirm && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmModal}>
            <div className={styles.confirmHeader}>{t('saveModal.selectSaveMethod')}</div>
            <div className={styles.confirmBody}>
              <button
                className={`${styles.confirmBtn} ${styles.confirmBtnCreate}`}
                onClick={() => {
                  void executeSave('create');
                }}
                disabled={isSaving}
              >
                <span className={styles.confirmBtnTitle}>{t('saveModal.newSave')}</span>
                <span className={styles.confirmBtnDesc}>{t('saveModal.newSaveDesc')}</span>
              </button>
              {saveList.length > 0 && (
                <button
                  className={`${styles.confirmBtn} ${styles.confirmBtnOverwrite}`}
                  onClick={() => {
                    const firstSaveId = saveList[0]?.saveId;
                    if (firstSaveId) {
                      void executeSave('overwrite', firstSaveId);
                    }
                  }}
                  disabled={isSaving}
                >
                  <span className={styles.confirmBtnTitle}>{t('saveModal.overwriteSave')}</span>
                  <span className={styles.confirmBtnDesc}>{t('saveModal.overwriteDesc')}</span>
                </button>
              )}
            </div>
            <div className={styles.confirmFooter}>
              <button className={styles.confirmCancelBtn} onClick={() => setShowConfirm(false)} disabled={isSaving}>
                {t('saveModal.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {isStreaming && (
        <div className={styles.blockingMask}>
          <div className={styles.spinner} />
        </div>
      )}
    </div>
  );
};

export default SaveModal;
