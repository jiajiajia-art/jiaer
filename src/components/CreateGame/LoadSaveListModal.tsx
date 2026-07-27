import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './LoadSaveListModal.module.css';
import { savesApi, type SaveSummaryItem } from '../../api/galgame/saves';
import { normalizeSaveListItems } from '../../lib/galgame/normalizeSaveListItems';
import toast from 'react-hot-toast';
import ConfirmModal from '../CommonModal/ConfirmModal';

interface LoadSaveListModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string | null;
  onPreview: (item: SaveSummaryItem) => void;
  // 是否允许新增存档入口（仅游戏内允许，详情页读取时不允许）
  allowCreateSlot?: boolean;
  onCreateSlotClick?: () => void;
}

const LoadSaveListModal: React.FC<LoadSaveListModalProps> = ({ isOpen, onClose, fileId, onPreview, allowCreateSlot, onCreateSlotClick }) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<SaveSummaryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetToDelete, setTargetToDelete] = useState<SaveSummaryItem | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (!fileId) { toast.error(t('createGame.loadSaveList.missingFileId')); return; }
    setLoading(true);
    savesApi.listByFileId(fileId)
      .then((resp) => setItems(normalizeSaveListItems(resp.data?.items) as SaveSummaryItem[]))
      .catch((e) => toast.error(e?.message || t('createGame.loadSaveList.loadFailed')))
      .finally(() => setLoading(false));
  }, [isOpen, fileId, t]);

  if (!isOpen) return null;

  return (
    <>
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>{t('createGame.loadSaveList.title')}</div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div className={styles.body}>
          {loading ? (
            <div className={styles.empty}>{t('createGame.loadSaveList.loading')}</div>
          ) : (
            <div className={styles.list}>
              {items.map((it) => (
                <div key={it.saveId} className={styles.item}>
                  <div>
                    <div className={styles.summary}>{it.summaryText}</div>
                    <div className={styles.meta}>{new Date(it.createdAt).toLocaleString()}</div>
                  </div>
                  <div className={styles.actions}>
                    <button
                      className={styles.btn}
                      onClick={() => { setTargetToDelete(it); setConfirmOpen(true); }}
                    >{t('createGame.loadSaveList.delete')}</button>
                    <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => onPreview(it)}>{t('createGame.loadSaveList.load')}</button>
                  </div>
                </div>
              ))}

              {/* 补齐空位到 5 个，允许游戏内新增 */}
              {allowCreateSlot && items.length < 5 && (
                Array.from({ length: 5 - items.length }).map((_, idx) => (
                  <div key={`slot-${idx}`} className={styles.slotEmpty} onClick={onCreateSlotClick}>
                    + {t('createGame.loadSaveList.newSave')}
                  </div>
                ))
              )}
              {!allowCreateSlot && items.length === 0 && (
                <div className={styles.empty}>{t('createGame.loadSaveList.noSaves')}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    <ConfirmModal
      isOpen={confirmOpen}
      title={t('createGame.loadSaveList.deleteTitle')}
      message={t('createGame.loadSaveList.deleteConfirm')}
      confirmButtonText={t('createGame.loadSaveList.delete')}
      cancelButtonText={t('common.cancel')}
      onConfirm={async () => {
        if (!targetToDelete) { setConfirmOpen(false); return; }
        try {
          if (!fileId) { toast.error(t('createGame.loadSaveList.missingFileId')); setConfirmOpen(false); return; }
          await savesApi.remove(targetToDelete.saveId, fileId);
          setItems((prev) => prev.filter(x => x.saveId !== targetToDelete.saveId));
          setConfirmOpen(false);
          setTargetToDelete(null);
        } catch (e: any) {
          toast.error(e?.response?.data?.message || e?.message || t('createGame.loadSaveList.deleteFailed'));
          setConfirmOpen(false);
          setTargetToDelete(null);
        }
      }}
      onCancel={() => { setConfirmOpen(false); setTargetToDelete(null); }}
    />
    </>
  );
};

export default LoadSaveListModal;
