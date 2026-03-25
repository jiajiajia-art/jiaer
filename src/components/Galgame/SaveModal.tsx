import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './SaveModal.module.css';
import { streamSaveSummary, savesApi } from '../../api/galgame/saves';
import toast from 'react-hot-toast';

interface SaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
  fileId: string | null;
}

const SaveModal: React.FC<SaveModalProps> = ({ isOpen, onClose, sessionId, fileId }) => {
  const [summary, setSummary] = useState('');
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setCharCount(summary.trim().length);
  }, [summary]);

  useEffect(() => {
    if (!isOpen) {
      // reset state when closed
      setSummary('');
      setCandidateId(null);
      setIsStreaming(false);
      setIsSaving(false);
      abortRef.current?.abort();
      abortRef.current = null;
    }
  }, [isOpen]);

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

      await streamSaveSummary(sessionId, {
        onStart: (evt) => {
          if (evt && evt.candidateId) setCandidateId(evt.candidateId);
        },
        onChunk: (text) => {
          setSummary((prev) => prev + text);
          // scroll to bottom after microtask
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
      }, ctrl.signal);
    } catch (e: any) {
      toast.error(e?.message || '生成失败');
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [sessionId]);

  const handleSave = useCallback(async () => {
    if (!canSave || !sessionId || !fileId) return;
    try {
      setIsSaving(true);
      const resp = await savesApi.create({
        fileId,
        sessionId,
        summaryText: summary,
        candidateId: candidateId || undefined,
      });
      if ((resp as any).data?.saveId || (resp as any).data?.createdAt !== undefined) {
        toast.success('存档已保存');
        onClose();
      } else {
        toast.success('存档已保存');
        onClose();
      }
    } catch (e: any) {
      const msg = e?.response?.data?.code === 'MAX_SAVES_REACHED'
        ? '最多 5 个存档，请删除后再试'
        : (e?.response?.data?.message || e?.message || '保存失败');
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  }, [canSave, sessionId, fileId, summary, candidateId, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={() => !isStreaming && onClose()}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>存档</div>
          <button className={styles.closeBtn} onClick={() => !isStreaming && onClose()} disabled={isStreaming}>×</button>
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
          <button className={styles.btn} onClick={handleStart} disabled={isStreaming || !sessionId}>开始存档</button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave} disabled={!canSave}>
            保存存档
          </button>
        </div>
      </div>

      {isStreaming && (
        <div className={styles.blockingMask}>
          <div className={styles.spinner} />
        </div>
      )}
    </div>
  );
};

export default SaveModal;

