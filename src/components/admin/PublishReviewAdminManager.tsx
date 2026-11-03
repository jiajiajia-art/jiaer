import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import adminReportApi, {
  type AdminPublishQueueItem,
} from '../../api/admin/adminReportApi';
import ConfirmModal from '../CommonModal/ConfirmModal';
import { getApiErrorMessage } from '../../utils/error';
import { getImageUrl } from '../../utils/constants';
import styles from './CommentAdminManager.module.css';
import local from './ContentReportAdminManager.module.css';

const PAGE_SIZE = 20;

const formatTime = (value: string | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
};

const displayNickname = (name: string | null | undefined): string => {
  const trimmed = name?.trim();
  return trimmed || '未设置昵称';
};

type ConfirmAction =
  | { kind: 'approve'; item: AdminPublishQueueItem }
  | { kind: 'reject'; item: AdminPublishQueueItem }
  | { kind: 'clearNeedReview'; item: AdminPublishQueueItem };

/** 功能注释：运营「发布审核」— 过/驳单本 + 账号级关闭先审 */
const PublishReviewAdminManager: React.FC = () => {
  const [list, setList] = useState<AdminPublishQueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminReportApi.listPublishQueue({
        page,
        pageSize: PAGE_SIZE,
        keyword: keyword || undefined,
      });
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || '加载发布审核列表失败');
      }
      setList(response.data.data.list || []);
      setTotal(response.data.data.total || 0);
    } catch (error) {
      toast.error(getApiErrorMessage(error, '加载发布审核列表失败'));
      setList([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, keyword]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const handleConfirm = async () => {
    if (!confirm) return;
    const fileId = confirm.item.fileId;
    const userId = confirm.item.creatorUserId;
    setBusyKey(confirm.kind === 'clearNeedReview' ? `user:${userId}` : `file:${fileId}`);
    try {
      if (confirm.kind === 'approve') {
        const response = await adminReportApi.approvePublishQueue(fileId);
        toast.success(response.data.message || '已通过，作品已公开');
      } else if (confirm.kind === 'reject') {
        const response = await adminReportApi.rejectPublishQueue(fileId, rejectNote);
        toast.success(response.data.message || '已驳回，作品保持私密');
      } else {
        if (!userId) throw new Error('缺少创作者 userId');
        const response = await adminReportApi.clearPublishNeedReview(userId);
        toast.success(response.data.message || '已关闭先审，之后可直发');
      }
      setConfirm(null);
      setRejectNote('');
      void loadQueue();
    } catch (error) {
      const fallback =
        confirm.kind === 'approve'
          ? '通过失败'
          : confirm.kind === 'reject'
            ? '驳回失败'
            : '关闭先审失败';
      toast.error(getApiErrorMessage(error, fallback));
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className={local.panelStack}>
      <div className={`${styles.card} ${local.filterCard}`}>
        <label className={`${local.field} ${local.fieldGrow}`}>
          <span className={local.fieldLabel}>关键词</span>
          <input
            className={local.control}
            value={keywordInput}
            placeholder="作品 id、标题或创作者"
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1);
                setKeyword(keywordInput.trim());
              }
            }}
          />
        </label>
        <button
          type="button"
          className={local.toolbarBtn}
          onClick={() => {
            setPage(1);
            setKeyword(keywordInput.trim());
          }}
        >
          搜索
        </button>
        <button
          type="button"
          className={local.toolbarBtn}
          onClick={() => void loadQueue()}
          disabled={loading}
        >
          刷新
        </button>
      </div>

      <div className={styles.card}>
        {loading ? (
          <p className={styles.emptyState}>加载中…</p>
        ) : list.length === 0 ? (
          <p className={styles.emptyState}>暂无待审作品</p>
        ) : (
          <div className={local.tableWrap}>
            <table className={local.table}>
              <thead>
                <tr>
                  <th>作品</th>
                  <th>创作者</th>
                  <th>提交时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => {
                  const cover = row.coverUrl ? getImageUrl(row.coverUrl) : '';
                  const submitted = row.submittedAt || row.createdAt;
                  return (
                    <tr key={row.fileId}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {cover ? (
                            <img
                              src={cover}
                              alt=""
                              width={40}
                              height={40}
                              style={{ borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                            />
                          ) : null}
                          <div>
                            <div>
                              {row.title?.trim() || '未命名作品'}
                              {' '}
                              <strong>{row.reviewKind === 'update' ? '【更新】' : '【新作品】'}</strong>
                            </div>
                            {row.reviewKind === 'update' ? (
                              <div className={styles.cardDesc} style={{ margin: 0, fontSize: 12 }}>
                                当前公开版本 v{row.publishedVersion || 1}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td>
                        {row.creatorUserCode ? (
                          <Link
                            className={local.factLink}
                            to={`/account/${encodeURIComponent(row.creatorUserCode)}`}
                            state={{ from: '/operator/publish-queue' }}
                          >
                            {displayNickname(row.creatorNickname || row.authorName)}
                          </Link>
                        ) : (
                          displayNickname(row.creatorNickname || row.authorName)
                        )}
                        <div className={styles.cardDesc} style={{ margin: 0, fontSize: 12 }}>
                          {row.creatorUserId}
                        </div>
                      </td>
                      <td>{formatTime(submitted)}</td>
                      <td>
                        <div className={local.decisionRow} style={{ marginTop: 0, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className={`${local.decisionBtn} ${local.decisionApprove}`}
                            disabled={Boolean(busyKey)}
                            onClick={() => setConfirm({ kind: 'approve', item: row })}
                          >
                            通过
                          </button>
                          <button
                            type="button"
                            className={`${local.decisionBtn} ${local.decisionReject}`}
                            disabled={Boolean(busyKey)}
                            onClick={() => {
                              setRejectNote('');
                              setConfirm({ kind: 'reject', item: row });
                            }}
                          >
                            驳回
                          </button>
                          <button
                            type="button"
                            className={local.decisionBtn}
                            style={{
                              background: '#fffdfb',
                              color: '#5e3f2a',
                              borderColor: 'rgba(165, 96, 47, 0.45)',
                            }}
                            disabled={Boolean(busyKey) || !row.creatorUserId}
                            onClick={() => setConfirm({ kind: 'clearNeedReview', item: row })}
                          >
                            关闭先审
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.pageButton}
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </button>
          <span className={styles.pageInfo}>
            第 {page} / {totalPages} 页，共 {total} 条
          </span>
          <button
            type="button"
            className={styles.pageButton}
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(confirm)}
        tone="admin"
        title={
          confirm?.kind === 'approve'
            ? '确认通过公开？'
            : confirm?.kind === 'reject'
              ? '确认驳回公开？'
              : '确认关闭该账号先审？'
        }
        message={
          confirm?.kind === 'approve' ? (
            `通过后「${confirm.item.title?.trim() || confirm.item.fileId}」将对访客公开。`
          ) : confirm?.kind === 'reject' ? (
            <div>
              <p style={{ margin: '0 0 10px' }}>
                驳回后作品保持私密，创作者可修改后再提交。
              </p>
              <label className={local.field}>
                <span className={local.fieldLabel}>驳回备注（可选）</span>
                <textarea
                  className={local.note}
                  rows={3}
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  disabled={Boolean(busyKey)}
                />
              </label>
            </div>
          ) : (
            `关闭后，${displayNickname(confirm?.item.creatorNickname || confirm?.item.authorName)}（${confirm?.item.creatorUserId || '—'}）之后发布可直发，不必再进队。本条作品仍须单独通过/驳回。`
          )
        }
        confirmButtonText={busyKey ? '处理中…' : '确认'}
        cancelButtonText="取消"
        onCancel={() => {
          if (!busyKey) {
            setConfirm(null);
            setRejectNote('');
          }
        }}
        onConfirm={() => {
          void handleConfirm();
        }}
      />
    </div>
  );
};

export default PublishReviewAdminManager;
