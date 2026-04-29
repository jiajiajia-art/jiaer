import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import replayApi, { buildReplayRoutePath, buildReplayShareUrl } from '../../api/galgame/replay';
import type { ReplaySummary, ReplayVisibility } from '../../api/galgame/replay';
import type { AxiosError } from 'axios';
import ConfirmModal from '../CommonModal/ConfirmModal';
import styles from './ReplayList.module.css';

interface Props {
  fileId: string;
  includeUnlisted?: boolean;
  showVisibility?: boolean;
  visibility?: ReplayVisibility;
  currentUserId?: string;
}

const getVisibilityLabel = (visibility: ReplaySummary['visibility']) => {
  switch (visibility) {
    case 'private':
      return '私密';
    case 'unlisted':
      return '仅链接可见';
    case 'public':
    default:
      return '公开';
  }
};

const getVisibilityStyle = (visibility: ReplaySummary['visibility']) => {
  switch (visibility) {
    case 'private':
      return { background: 'rgba(26, 26, 26, 0.08)', color: '#1a1a1a' };
    case 'unlisted':
      return { background: 'rgba(255, 153, 0, 0.14)', color: '#a56200' };
    case 'public':
    default:
      return { background: 'rgba(224, 61, 75, 0.12)', color: '#E03D4B' };
  }
};

const ReplayList: React.FC<Props> = ({
  fileId,
  includeUnlisted = false,
  showVisibility = false,
  visibility,
  currentUserId,
}) => {
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
        if (!cancelled) setError('加载回放失败');
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

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        return true;
      } catch (copyError) {
        console.warn('[ReplayList] Failed to copy replay link with clipboard API:', copyError);
      }
    }

    if (typeof document === 'undefined') {
      return false;
    }

    const textArea = document.createElement('textarea');
    textArea.value = shareUrl;
    textArea.setAttribute('readonly', 'true');
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    textArea.style.pointerEvents = 'none';
    document.body.appendChild(textArea);
    textArea.select();

    try {
      return document.execCommand('copy');
    } catch (copyError) {
      console.warn('[ReplayList] Failed to copy replay link with fallback:', copyError);
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  };

  const handleCopyLink = async (item: ReplaySummary) => {
    const copied = await copyReplayLink(item.replayId);
    if (!copied) {
      toast.error('复制回放链接失败');
      return;
    }

    if (item.visibility === 'unlisted') {
      toast.success('回放链接已复制，仅持链接者可查看');
      return;
    }

    toast.success('公开回放链接已复制');
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
      toast.success('回放已删除');
    } catch (deleteError) {
      const axiosError = deleteError as AxiosError<{ message?: string }>;
      const status = axiosError.response?.status;

      if (status === 403) {
        toast.error('只能删除自己创建的回放');
      } else if (status === 404) {
        setItems((prev) => prev.filter((item) => item.replayId !== pendingDeleteReplay.replayId));
        setTotal((prev) => Math.max(prev - 1, 0));
        setExpandedReplayId((prev) =>
          prev === pendingDeleteReplay.replayId ? null : prev,
        );
        toast.error('回放不存在或已删除');
      } else {
        toast.error('删除回放失败，请稍后重试');
      }
    } finally {
      setDeletingReplayId(null);
      setPendingDeleteReplayId(null);
    }
  };

  if (loading) {
    return <div className={styles.statusMessage}>正在加载回放...</div>;
  }

  if (error) {
    return <div className={`${styles.statusMessage} ${styles.errorMessage}`}>{error}</div>;
  }

  if (!items.length) {
    return <div className={styles.statusMessage}>暂无回放</div>;
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
              aria-label={`${isExpanded ? '收起' : '展开'}回放操作：${item.title}`}
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
                        {getVisibilityLabel(item.visibility)}
                      </span>
                      {isOwnReplay && <span className={styles.mineTag}>我的</span>}
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
                      <span>{item.stepsCount} 步</span>
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
                    播放
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
                      复制链接
                    </button>
                  )}
                  {isOwnReplay && (
                    <button
                      type="button"
                      onClick={() => handleRequestDelete(item)}
                      className={styles.deleteButton}
                      disabled={isDeleting}
                    >
                      {isDeleting ? '删除中...' : '删除'}
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
            加载更多
          </button>
        </div>
      )}
      <ConfirmModal
        isOpen={!!pendingDeleteReplay}
        onConfirm={handleDeleteReplay}
        onCancel={() => setPendingDeleteReplayId(null)}
        title="删除回放"
        message="确认删除该回放？删除后不可恢复。"
        confirmButtonText="确认删除"
        cancelButtonText="取消"
      />
    </div>
  );
};

export default ReplayList;
