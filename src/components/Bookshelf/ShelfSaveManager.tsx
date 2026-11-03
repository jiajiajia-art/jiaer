import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
      toast.success('存档已删除');
      setPendingDelete(null);
    } catch (error) {
      console.error('[ShelfSaveManager] delete save failed:', error);
      toast.error('删除失败，请稍后重试');
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className={styles.sheetOverlay} onClick={onClose}>
        <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="存档管理" onClick={(e) => e.stopPropagation()}>
          <div className={styles.sheetHeader}>
            {activeGame && (
              <button type="button" className={styles.sheetClose} onClick={() => setActiveGame(null)} aria-label="返回剧本列表">‹</button>
            )}
            <div className={styles.sheetHeading}>
              <h3 className={styles.sheetTitle}>存档管理</h3>
              <p className={styles.sheetSub}>{activeGame ? activeGame.title : '删除存档不会影响书架记录、收藏与购买'}</p>
            </div>
            <button type="button" className={styles.sheetClose} onClick={onClose} aria-label="关闭">×</button>
          </div>
          <div className={styles.sheetBody}>
            {!activeGame && games.length === 0 && (
              <div className={styles.sheetHint}>当前列表里没有可管理存档的剧本</div>
            )}
            {!activeGame && games.map((game) => (
              <button key={game.fileId} type="button" className={styles.saveRow} onClick={() => openGame(game)}>
                <span className={styles.saveRowMain}>
                  <span className={styles.saveRowTitle}>{game.title || '未命名剧本'}</span>
                  <span className={styles.saveRowMeta}>{game.author}</span>
                </span>
                <span className={styles.saveRowMeta}>›</span>
              </button>
            ))}
            {activeGame && saves.status === 'loading' && <div className={styles.sheetHint}>正在读取存档…</div>}
            {activeGame && saves.status === 'error' && (
              <div className={styles.sheetHint}>
                读取存档失败
                <div className={styles.listFooter}>
                  <button type="button" onClick={() => void loadSaves(activeGame)}>重试</button>
                </div>
              </div>
            )}
            {activeGame && saves.status === 'ready' && saves.items.length === 0 && (
              <div className={styles.sheetHint}>这个剧本还没有手动存档</div>
            )}
            {activeGame && saves.status === 'ready' && saves.items.map((entry) => {
              const meta = [shelfSaveProgressLabel(entry), formatShelfSaveTime(entry.updatedAt || entry.createdAt)]
                .filter(Boolean).join(' · ');
              return (
                <div key={entry.saveId} className={`${styles.saveRow} ${entry.status !== 'ok' ? styles.saveRowInvalid : ''}`}>
                  <span className={styles.saveRowMain}>
                    <span className={styles.saveRowTitle}>{entry.playerName || '存档'}</span>
                    {meta && <span className={styles.saveRowMeta}>{meta}</span>}
                    {entry.summaryPreview && <span className={styles.saveRowSummary}>{entry.summaryPreview}</span>}
                    {entry.status !== 'ok' && <span className={styles.saveRowReason}>{entry.reason || '存档无法读取'}</span>}
                  </span>
                  <button type="button" className={styles.saveRowDelete} onClick={() => setPendingDelete(entry)}>删除</button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <ConfirmModal
        isOpen={Boolean(pendingDelete)}
        tone="dark"
        title="删除存档"
        message="删除后该存档无法恢复，书架记录、收藏与购买不受影响。确定删除吗？"
        confirmButtonText={deleting ? '删除中…' : '删除'}
        cancelButtonText="取消"
        onConfirm={() => void confirmDelete()}
        onCancel={() => { if (!deleting) setPendingDelete(null); }}
      />
    </>,
    document.body,
  );
};

export default ShelfSaveManager;
