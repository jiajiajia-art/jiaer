import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import replayApi, { buildReplayRoutePath, buildReplayShareUrl } from '../../api/galgame/replay';
import type { ReplaySummary, ReplayVisibility } from '../../api/galgame/replay';
import type { AxiosError } from 'axios';
import ConfirmModal from '../CommonModal/ConfirmModal';
import styles from './ReplayList.module.css';
import { useTranslation } from 'react-i18next';
import { copyTextToClipboard } from '../../utils/clipboard';

interface Props {
  fileId: string;
  includeUnlisted?: boolean;
  showVisibility?: boolean;
  visibility?: ReplayVisibility;
  currentUserId?: string;
}

const getVisibilityLabel = (vis: ReplaySummary['visibility'], t: (key: string) => string) => {
  switch (vis) {
    case 'private':
      return t('createGame.replayVisibilityPrivate');
    case 'unlisted':
      return t('createGame.replayVisibilityUnlisted');
    case 'public':
    default:
      return t('createGame.replayVisibilityPublic');
  }
};

const getVisibilityStyle = (visibility: ReplaySummary['visibility']) => {
  switch (visibility) {
    case 'private':
      return { background: 'color-mix(in srgb, var(--color-text) 8%, transparent)', color: 'var(--color-text)' };
    case 'unlisted':
      return { background: 'color-mix(in srgb, var(--color-highlight) 14%, transparent)', color: 'var(--color-highlight)' };
    case 'public':
    default:
      return { background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', color: 'var(--color-primary)' };
  }
};

const ReplayList: React.FC<Props> = ({
  fileId,
  includeUnlisted = false,
  showVisibility = false,
  visibility,
  currentUserId,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [items, setItems] = useState<ReplaySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [expandedReplayId, setExpandedReplayId] = useState<string | null>(null);
  const [pendingDeleteReplayId, setPendingDeleteReplayId] = useState<string | null>(null);
  const [deletingReplayId, setDeletingReplayId] = useState<string | null>(null);
  const limit = 20;
  const shouldIncludeUnlisted = visibility === 'unlisted' ? true : includeUnlisted;
  const canManageOwnReplays = Boolean(currentUserId);
  const pendingDeleteReplay = useMemo(
    () => items.find((item) => item.replayId === pendingDeleteReplayId) || null,
    [items, pendingDeleteReplayId],
  );

  useEffect(() => {
    setOffset(0);
    setItems([]);
    setTotal(0);
    setExpandedReplayId(null);
  }, [fileId, shouldIncludeUnlisted, visibility]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const resp = await replayApi.listByFileId({
          fileId,
          offset,
          limit,
          sort: 'createdAt',
          includeUnlisted: shouldIncludeUnlisted,
          visibility,
        });
        if (!cancelled) {
          const nextItems = resp.data?.items || [];
          setItems((prev) => (offset === 0 ? nextItems : [...prev, ...nextItems]));
          setTotal(resp.data?.total || 0);
        }
      } catch {
        if (!cancelled) setError(t('createGame.loadReplayFailed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [fileId, offset, shouldIncludeUnlisted, visibility]);

  useEffect(() => {
    if (!expandedReplayId) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const activeCard = cardRefs.current[expandedReplayId];
      const target = event.target;

      if (!activeCard || !(target instanceof Node)) return;
      if (!activeCard.contains(target)) {
        setExpandedReplayId(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [expandedReplayId]);

  const handleToggleReplay = (replayId: string) => {
    setExpandedReplayId((prev) => (prev === replayId ? null : replayId));
  };

  const handleReplayKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    replayId: string,
  ) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handleToggleReplay(replayId);
  };

  const handlePlay = (replayId: string) => {
    navigate(buildReplayRoutePath(replayId));
  };

  const copyReplayLink = async (replayId: string) => {
    const shareUrl = buildReplayShareUrl(replayId);
    try {
      await copyTextToClipboard(shareUrl);
      return true;
    } catch (copyError) {
      console.warn('[ReplayList] Failed to copy replay link:', copyError);
      return false;
    }
  };

  const handleCopyLink = async (item: ReplaySummary) => {
    const copied = await copyReplayLink(item.replayId);
    if (!copied) {
      toast.error(t('createGame.copyReplayLinkFailed'));
      return;
    }

    if (item.visibility === 'unlisted') {
      toast.success(t('createGame.replayLinkCopied'));
      return;
    }

    toast.success(t('createGame.publicReplayLinkCopied'));
  };

  const handleRequestDelete = (item: ReplaySummary) => {
    setPendingDeleteReplayId(item.replayId);
  };

  const handleDeleteReplay = async () => {
    if (!pendingDeleteReplay) {
      setPendingDeleteReplayId(null);
      return;
    }

    setDeletingReplayId(pendingDeleteReplay.replayId);
    try {
      await replayApi.deleteReplay(pendingDeleteReplay.replayId);
      setItems((prev) => prev.filter((item) => item.replayId !== pendingDeleteReplay.replayId));
      setTotal((prev) => Math.max(prev - 1, 0));
      setExpandedReplayId((prev) =>
        prev === pendingDeleteReplay.replayId ? null : prev,
      );
      toast.success(t('createGame.replayDeleted'));
    } catch (deleteError) {
      const axiosError = deleteError as AxiosError<{ message?: string }>;
      const status = axiosError.response?.status;

      if (status === 403) {
        toast.error(t('createGame.canOnlyDeleteOwnReplay'));
      } else if (status === 404) {
        setItems((prev) => prev.filter((item) => item.replayId !== pendingDeleteReplay.replayId));
        setTotal((prev) => Math.max(prev - 1, 0));
        setExpandedReplayId((prev) =>
          prev === pendingDeleteReplay.replayId ? null : prev,
        );
        toast.error(t('createGame.replayNotExist'));
      } else {
        toast.error(t('createGame.deleteReplayFailed'));
      }
    } finally {
      setDeletingReplayId(null);
      setPendingDeleteReplayId(null);
    }
  };

  if (loading) {
    return <div className={styles.statusMessage}>{t('createGame.loadingReplay')}</div>;
  }

  if (error) {
    return <div className={`${styles.statusMessage} ${styles.errorMessage}`}>{error}</div>;
  }

  if (!items.length) {
    return <div className={styles.statusMessage}>{t('createGame.noReplay')}</div>;
  }

  return (
    <div className={styles.replayList}>
      {items.map((item, index) => {
        const replayDescription = typeof item.description === 'string' ? item.description.trim() : '';
        const isDeleting = deletingReplayId === item.replayId;
        const isExpanded = expandedReplayId === item.replayId;
        const isOwnReplay =
          canManageOwnReplays && String(item.ownerId || '') === String(currentUserId || '');

        return (
          <div
            key={item.replayId}
            ref={(node) => {
              cardRefs.current[item.replayId] = node;
            }}
            className={`${styles.replayCard} ${isExpanded ? styles.replayCardExpanded : ''} ${
              index === items.length - 1 ? styles.replayCardLast : ''
            }`}
          >
            <div
              className={styles.replayCardMain}
              role="button"
              tabIndex={0}
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? t('createGame.collapse') : t('createGame.expand')}${t('createGame.replayOperation')}：${item.title}`}
              onClick={() => handleToggleReplay(item.replayId)}
              onKeyDown={(event) => handleReplayKeyDown(event, item.replayId)}
            >
              <div className={styles.replayContent}>
                <div className={styles.replayTitleRow}>
                  <div className={styles.replayTitle}>{item.title}</div>
                  {showVisibility && (
                    <div className={styles.tagGroup}>
                      <span
                        className={styles.visibilityTag}
                        style={{
                          ...getVisibilityStyle(item.visibility),
                        }}
                      >
                        {getVisibilityLabel(item.visibility, t)}
                      </span>
                      {isOwnReplay && <span className={styles.mineTag}>{t('createGame.mine')}</span>}
                    </div>
                  )}
                </div>
                <div className={styles.replayMeta}>
                  <span>{item.ownerName}</span>
                  <span className={styles.replayMetaSeparator}>|</span>
                  <span>{new Date(item.createdAt).toLocaleString()}</span>
                  {typeof item.stepsCount === 'number' && (
                    <>
                      <span className={styles.replayMetaSeparator}>|</span>
                      <span>{item.stepsCount} {t('createGame.steps')}</span>
                    </>
                  )}
                </div>
                {replayDescription && (
                  <div className={styles.replayPreview}>{replayDescription}</div>
                )}
              </div>
              <span
                className={`${styles.replayExpandIcon} ${
                  isExpanded ? styles.replayExpandIconExpanded : ''
                }`}
                aria-hidden="true"
              />
            </div>
            {isExpanded && (
              <div className={styles.actionOverlay} onClick={(event) => event.stopPropagation()}>
                <div className={styles.actionGroup}>
                  <button
                    type="button"
                    onClick={() => handlePlay(item.replayId)}
                    className={styles.playButton}
                    disabled={isDeleting}
                  >
                    {t('createGame.play')}
                  </button>
                  {item.visibility !== 'private' && (
                    <button
                      type="button"
                      onClick={() => {
                        void handleCopyLink(item);
                      }}
                      className={styles.copyButton}
                      disabled={isDeleting}
                    >
                      {t('createGame.copyLink')}
                    </button>
                  )}
                  {isOwnReplay && (
                    <button
                      type="button"
                      onClick={() => handleRequestDelete(item)}
                      className={styles.deleteButton}
                      disabled={isDeleting}
                    >
                      {isDeleting ? t('createGame.deleting') : t('createGame.delete')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {items.length < total && (
        <div className={styles.loadMoreWrap}>
          <button
            type="button"
            onClick={() => setOffset((prev) => prev + limit)}
            className={styles.loadMoreButton}
          >
            {t('createGame.loadMore')}
          </button>
        </div>
      )}
      <ConfirmModal
        isOpen={!!pendingDeleteReplay}
        onConfirm={handleDeleteReplay}
        onCancel={() => setPendingDeleteReplayId(null)}
        title={t('createGame.deleteReplay')}
        message={t('createGame.confirmDeleteReplay')}
        confirmButtonText={t('createGame.confirmDelete')}
        cancelButtonText={t('createGame.cancel')}
      />
    </div>
  );
};

export default ReplayList;
