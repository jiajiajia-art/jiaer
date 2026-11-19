import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import styles from './Bookshelf.module.css';
import ConfirmModal from '../CommonModal/ConfirmModal';
import bookshelfApi from '../../api/bookshelf/bookshelfApi';
import { savesApi } from '../../api/galgame/saves';
import {
  formatShelfSaveTime,
  shelfSaveProgressLabel,
  type ShelfItem,
  type ShelfSaveEntry,
} from '../../lib/bookshelf';

interface ShelfSaveManagerProps {
  isOpen: boolean;
  /** 有游玩记录且支持多存档的剧本 */
  games: ShelfItem[];
  onClose: () => void;
}

type SavesState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; items: ShelfSaveEntry[] };

/**
 * 存档管理：独立于书架清理。先选剧本，再逐个删除存档；每次删除前二次确认，删除不可恢复。
 * 损坏 / 不兼容存档也在这里展示原因，由玩家决定是否删除。
 */
const ShelfSaveManager: React.FC<ShelfSaveManagerProps> = ({ isOpen, games, onClose }) => {
  const { t } = useTranslation();
  const [activeGame, setActiveGame] = useState<ShelfItem | null>(null);
  const [saves, setSaves] = useState<SavesState>({ status: 'idle' });
  const [pendingDelete, setPendingDelete] = useState<ShelfSaveEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setActiveGame(null);
      setSaves({ status: 'idle' });
      setPendingDelete(null);
    }
  }, [isOpen]);

  const loadSaves = useCallback(async (game: ShelfItem) => {
    setSaves({ status: 'loading' });
    try {
      const resp = await bookshelfApi.listSaves(game.fileId);
      setSaves({ status: 'ready', items: Array.isArray(resp.data?.items) ? resp.data.items : [] });
    } catch (error) {
      console.error('[ShelfSaveManager] list saves failed:', error);
      setSaves({ status: 'error' });
    }
  }, []);

  const openGame = (game: ShelfItem) => {
    setActiveGame(game);
    void loadSaves(game);
  };

  const confirmDelete = async () => {
    if (!pendingDelete || !activeGame || deleting) return;
    setDeleting(true);
    try {
      await savesApi.remove(pendingDelete.saveId, activeGame.fileId);
      setSaves((prev) => (prev.status === 'ready'
        ? { status: 'ready', items: prev.items.filter((s) => s.saveId !== pendingDelete.saveId) }
        : prev));
      toast.success(t('bookshelfUi.saveManager.deletedOk'));
      setPendingDelete(null);
    } catch (error) {
      console.error('[ShelfSaveManager] delete save failed:', error);
      toast.error(t('bookshelfUi.saveManager.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className={styles.sheetOverlay} onClick={onClose}>
        <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={t('bookshelfUi.saveManager.dialogAria')} onClick={(e) => e.stopPropagation()}>
          <div className={styles.sheetHeader}>
            {activeGame && (
              <button type="button" className={styles.sheetClose} onClick={() => setActiveGame(null)} aria-label={t('bookshelfUi.saveManager.backToGamesAria')}>‹</button>
            )}
            <div className={styles.sheetHeading}>
              <h3 className={styles.sheetTitle}>{t('bookshelfUi.saveManager.title')}</h3>
              <p className={styles.sheetSub}>{activeGame ? activeGame.title : t('bookshelfUi.saveManager.subtitleDefault')}</p>
            </div>
            <button type="button" className={styles.sheetClose} onClick={onClose} aria-label={t('bookshelfUi.saveManager.closeAria')}>×</button>
          </div>
          <div className={styles.sheetBody}>
            {!activeGame && games.length === 0 && (
              <div className={styles.sheetHint}>{t('bookshelfUi.saveManager.noGames')}</div>
            )}
            {!activeGame && games.map((game) => (
              <button key={game.fileId} type="button" className={styles.saveRow} onClick={() => openGame(game)}>
                <span className={styles.saveRowMain}>
                  <span className={styles.saveRowTitle}>{game.title || t('bookshelfUi.saveManager.unnamedGame')}</span>
                  <span className={styles.saveRowMeta}>{game.author}</span>
                </span>
                <span className={styles.saveRowMeta}>›</span>
              </button>
            ))}
            {activeGame && saves.status === 'loading' && <div className={styles.sheetHint}>{t('bookshelfUi.saveManager.loadingSaves')}</div>}
            {activeGame && saves.status === 'error' && (
              <div className={styles.sheetHint}>
                {t('bookshelfUi.saveManager.loadFailed')}
                <div className={styles.listFooter}>
                  <button type="button" onClick={() => void loadSaves(activeGame)}>{t('bookshelfUi.saveManager.retry')}</button>
                </div>
              </div>
            )}
            {activeGame && saves.status === 'ready' && saves.items.length === 0 && (
              <div className={styles.sheetHint}>{t('bookshelfUi.saveManager.noManualSaves')}</div>
            )}
            {activeGame && saves.status === 'ready' && saves.items.map((entry) => {
              const meta = [shelfSaveProgressLabel(entry), formatShelfSaveTime(entry.updatedAt || entry.createdAt)]
                .filter(Boolean).join(' · ');
              return (
                <div key={entry.saveId} className={`${styles.saveRow} ${entry.status !== 'ok' ? styles.saveRowInvalid : ''}`}>
                  <span className={styles.saveRowMain}>
                    <span className={styles.saveRowTitle}>{entry.playerName || t('bookshelfUi.saveManager.saveFallback')}</span>
                    {meta && <span className={styles.saveRowMeta}>{meta}</span>}
                    {entry.summaryPreview && <span className={styles.saveRowSummary}>{entry.summaryPreview}</span>}
                    {entry.status !== 'ok' && <span className={styles.saveRowReason}>{entry.reason || t('bookshelfUi.saveManager.unreadable')}</span>}
                  </span>
                  <button type="button" className={styles.saveRowDelete} onClick={() => setPendingDelete(entry)}>{t('bookshelfUi.saveManager.delete')}</button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <ConfirmModal
        isOpen={Boolean(pendingDelete)}
        tone="dark"
        title={t('bookshelfUi.saveManager.confirmTitle')}
        message={t('bookshelfUi.saveManager.confirmMessage')}
        confirmButtonText={deleting ? t('bookshelfUi.saveManager.confirmDeleting') : t('bookshelfUi.saveManager.delete')}
        cancelButtonText={t('bookshelfUi.saveManager.cancel')}
        onConfirm={() => void confirmDelete()}
        onCancel={() => { if (!deleting) setPendingDelete(null); }}
      />
    </>,
    document.body,
  );
};

export default ShelfSaveManager;
