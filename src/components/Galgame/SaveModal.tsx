import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './SaveModal.module.css';
import { streamSaveSummary, savesApi } from '../../api/galgame/saves';
import toast from 'react-hot-toast';

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
      toast.error('请先开始游戏');
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
            toast.error(msg || '生成失败');
          },
          onDone: () => {
            toast.success('摘要已生成');
          },
        },
        ctrl.signal,
      );
    } catch (e: any) {
      toast.error(e?.message || '生成失败');
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [sessionId]);

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
            toast.success('存档已覆盖');
          } else {
            toast.success('存档已保存');
          }
          setShowConfirm(false);
          onClose();
          onSaveSuccess?.();
        } else {
          toast.success('存档已保存');
          setShowConfirm(false);
          onClose();
          onSaveSuccess?.();
        }
      } catch (e: any) {
        const code = e?.response?.data?.code;
        const msg =
          code === 'MAX_SAVES_REACHED'
            ? '最多 5 个存档，请删除后再试'
            : code === 'TARGET_SAVE_NOT_FOUND'
              ? '目标存档不存在'
              : code === 'INVALID_SAVE_ACTION'
                ? '操作类型错误'
                : e?.response?.data?.message || e?.message || '保存失败';
        toast.error(msg);
      } finally {
        setIsSaving(false);
      }
    },
    [canSave, sessionId, fileId, summary, candidateId, onClose, onSaveSuccess],
  );

  const handleSave = useCallback(() => {
    if (!canSave || !sessionId || !fileId) return;

    // 有默认模式则直接执行（外部直接传 defaultSaveMode 即可）
    if (defaultSaveMode) {
      if (defaultSaveMode === 'overwrite') {
        const firstSaveId = saveList[0]?.saveId;
        if (!firstSaveId) {
          toast.error('暂无可覆盖的存档');
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
  }, [canSave, sessionId, fileId, defaultSaveMode, saveList, executeSave]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={() => !isStreaming && onClose()}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>存档</div>
          <button className={styles.closeBtn} onClick={() => !isStreaming && onClose()} disabled={isStreaming}>
            ×
          </button>
        </div>
        <div className={styles.body}>
          <textarea
            ref={textRef}
            className={styles.textarea}
            placeholder={'请点击“开始存档”，或自行输入摘要…'}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            disabled={isStreaming || isSaving}
          />
          <div className={styles.hintRow}>
            <span>至少 10 个字后可保存</span>
            <span>{charCount} 字</span>
          </div>
        </div>
        <div className={styles.footer}>
          <button className={styles.btn} onClick={handleStart} disabled={isStreaming || !sessionId}>
            开始存档
          </button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave} disabled={!canSave}>
            {isSaving ? '保存中...' : '保存存档'}
          </button>
        </div>
      </div>

      {/* 保存确认弹窗 */}
      {showConfirm && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmModal}>
            <div className={styles.confirmHeader}>选择存档方式</div>
            <div className={styles.confirmBody}>
              <button
                className={`${styles.confirmBtn} ${styles.confirmBtnCreate}`}
                onClick={() => {
                  void executeSave('create');
                }}
                disabled={isSaving}
              >
                <span className={styles.confirmBtnTitle}>新建存档</span>
                <span className={styles.confirmBtnDesc}>创建新的存档槽位（最多 5 个）</span>
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
                  <span className={styles.confirmBtnTitle}>覆盖存档</span>
                  <span className={styles.confirmBtnDesc}>覆盖已有存档（不占用新槽位）</span>
                </button>
              )}
            </div>
            <div className={styles.confirmFooter}>
              <button className={styles.confirmCancelBtn} onClick={() => setShowConfirm(false)} disabled={isSaving}>
                取消
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
