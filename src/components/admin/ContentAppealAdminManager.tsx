import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import adminAppealApi from '../../api/admin/adminAppealApi';
import type {
  AdminAppealDetail,
  AdminAppealListItem,
  AdminAppealStatus,
} from '../../api/appeal/appeal.type';
import ConfirmModal from '../CommonModal/ConfirmModal';
import { useAuthStore } from '../../store/useAuthStore';
import { isAdminRole } from '../../utils/userRoles';
import { getApiErrorMessage } from '../../utils/error';
import { getImageUrl } from '../../utils/constants';
import styles from './CommentAdminManager.module.css';
import local from './ContentReportAdminManager.module.css';

function resolveEvidenceImageUrl(keyOrUrl: string): string {
  const raw = String(keyOrUrl || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/public/') || raw.startsWith('public/')) return getImageUrl(raw);
  return getImageUrl(`public/${raw.replace(/^\//, '')}`);
}

const RECORD_TYPE_LABEL: Record<string, string> = {
  warning: '警告',
  penalty: '处罚',
  appeal: '申诉',
};

const STATUS_WORD: Record<string, string> = {
  pending: '待复核',
  approved: '已通过',
  rejected: '已驳回',
  revoked: '已撤销',
  active: '生效中',
  consumed: '已计入处罚',
  finished: '已结束',
};

const LEVEL_LABEL = ['', '一', '二', '三', '四'];

function formatRecordTitle(recordType?: string | null, level?: number | null): string {
  const name = RECORD_TYPE_LABEL[recordType || ''] || recordType || '处罚记录';
  if (recordType === 'penalty' && level != null && level >= 1 && level <= 4) {
    return `${LEVEL_LABEL[level]}级处罚`;
  }
  return name;
}

const PAGE_SIZE = 20;

const statusLabel: Record<string, string> = {
  pending: '待复核',
  approved: '已通过',
  rejected: '已驳回',
};

const formatTime = (value: string | null | undefined): string => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
};

const truncate = (value: string | null | undefined, max = 40): string => {
  if (!value) return '—';
  return value.length > max ? `${value.slice(0, max)}…` : value;
};

const ContentAppealAdminManager: React.FC = () => {
  const role = useAuthStore((s) => s.user?.user?.role);
  const isAdmin = isAdminRole(role);

  const [status, setStatus] = useState<AdminAppealStatus | ''>('pending');
  const [list, setList] = useState<AdminAppealListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [detail, setDetail] = useState<AdminAppealDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [confirmDecision, setConfirmDecision] = useState<'approve' | 'reject' | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadList = useCallback(async () => {
    try {
      setLoading(true);
      const response = await adminAppealApi.listAppeals({
        status: status || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || '申诉列表加载失败');
      }
      setList(response.data.data.list || []);
      setTotal(response.data.data.total || 0);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, '申诉列表加载失败'));
      setList([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const openDetail = async (id: number) => {
    setDetailLoading(true);
    setDetail(null);
    setReviewNote('');
    try {
      const response = await adminAppealApi.getAppeal(id);
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || '加载详情失败');
      }
      setDetail(response.data.data);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, '加载详情失败'));
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    if (reviewing) return;
    setDetail(null);
    setConfirmDecision(null);
  };

  const handleConfirmReview = async () => {
    if (!detail || !confirmDecision) return;
    setReviewing(true);
    try {
      const response = await adminAppealApi.reviewAppeal(detail.id, {
        decision: confirmDecision,
        reviewNote: reviewNote.trim() || undefined,
      });
      if (!response.data.success) {
        throw new Error(response.data.message || '复核失败');
      }
      toast.success(
        response.data.message
          || (confirmDecision === 'approve' ? '已通过申诉' : '已驳回申诉'),
      );
      setConfirmDecision(null);
      setDetail(null);
      void loadList();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, '复核失败'));
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div className={styles.panelStack}>
      <div className={styles.heroCard}>
        <div>
          <span className={styles.sectionBadge}>内容安全</span>
          <h2 className={styles.heroTitle}>申诉复核</h2>
          <p className={styles.heroDesc}>
            通过将撤销目标警告/处罚、清理处罚热状态，并在适用时解锁游戏下架。四级解除仅 admin。
          </p>
        </div>
        <div className={styles.heroMetric}>
          <span className={styles.heroMetricLabel}>{status === 'pending' ? '待复核' : '当前筛选'}</span>
          <span className={styles.heroMetricValue}>{total}</span>
        </div>
      </div>

      <div className={`${styles.card} ${local.filterCard}`}>
        <label className={local.field}>
          <span className={local.fieldLabel}>状态</span>
          <select
            className={local.control}
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as AdminAppealStatus | '');
            }}
          >
            <option value="pending">待复核</option>
            <option value="approved">已通过</option>
            <option value="rejected">已驳回</option>
            <option value="">全部</option>
          </select>
        </label>
        <button type="button" className={local.toolbarBtn} onClick={() => void loadList()}>
          刷新
          <svg className={local.toolbarIcon} viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.75 10h-2.1A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
            />
          </svg>
        </button>
      </div>

      <div className={styles.card}>
        {loading ? (
          <p className={styles.emptyState}>加载中…</p>
        ) : list.length === 0 ? (
          <p className={styles.emptyState}>暂无申诉</p>
        ) : (
          <div className={local.tableWrap}>
            <table className={local.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>用户</th>
                  <th>目标</th>
                  <th>状态</th>
                  <th>理由</th>
                  <th>时间</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td title={row.userId}>{truncate(row.userId, 12)}</td>
                    <td>
                      {row.targetRecordType
                        ? formatRecordTitle(row.targetRecordType, row.targetLevel)
                        : `#${row.relatedId}`}
                    </td>
                    <td>{statusLabel[row.status] || row.status}</td>
                    <td title={row.reason || ''}>{truncate(row.reason, 24)}</td>
                    <td>{formatTime(row.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.detailButton}
                        onClick={() => void openDetail(row.id)}
                      >
                        详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.pageButton}
            disabled={page <= 1}
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
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </button>
        </div>
      </div>

      {(detail || detailLoading) && (
        <div className={local.drawerBackdrop} onClick={closeDetail} role="presentation">
          <aside
            className={local.drawer}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="申诉详情"
          >
            <div className={local.drawerHead}>
              <h3 className={local.drawerTitle}>申诉详情</h3>
              <button type="button" className={styles.detailButton} onClick={closeDetail}>关闭</button>
            </div>
            {detailLoading || !detail ? (
              <p className={styles.emptyState}>加载中…</p>
            ) : (
              <>
                <div className={local.chipRow}>
                  <span className={local.chip}>#{detail.id}</span>
                  <span className={local.chip}>{statusLabel[detail.status] || detail.status}</span>
                </div>
                <div className={local.factGrid}>
                  <div>
                    <span className={local.factLabel}>申诉人</span>
                    <p className={local.factValue}>{detail.userId}</p>
                  </div>
                  <div>
                    <span className={local.factLabel}>提交时间</span>
                    <p className={local.factValue}>{formatTime(detail.createdAt)}</p>
                  </div>
                  <div className={local.factWide}>
                    <span className={local.factLabel}>申诉理由</span>
                    <p className={local.factValue}>{detail.reason || '—'}</p>
                  </div>
                  <div className={local.factWide}>
                    <span className={local.factLabel}>申诉的处罚</span>
                    <p className={local.factValue}>
                      {formatRecordTitle(
                        detail.target?.recordType || detail.targetRecordType,
                        detail.target?.level ?? detail.targetLevel,
                      )}
                    </p>
                    <p className={local.factSub}>
                      {STATUS_WORD[detail.target?.status || ''] || detail.target?.status || '—'}
                    </p>
                  </div>
                  {detail.evidenceUrls?.length ? (
                    <div className={local.factWide}>
                      <span className={local.factLabel}>证据</span>
                      <div className={local.evidenceGrid}>
                        {detail.evidenceUrls.map((url) => {
                          const src = resolveEvidenceImageUrl(url);
                          return (
                            <a
                              key={url}
                              className={local.evidenceThumb}
                              href={src}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={url}
                            >
                              <img src={src} alt="申诉证据" />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>

                {detail.status === 'pending' ? (
                  <div className={local.reviewBlock}>
                    <label className={local.field}>
                      <span className={local.fieldLabel}>复核备注</span>
                      <textarea
                        className={local.note}
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        rows={3}
                      />
                    </label>
                    <p className={styles.cardDesc} style={{ margin: 0 }}>
                      通过后会撤销这条警告或处罚。四级处罚只有管理员能通过。
                    </p>
                    {(() => {
                      const targetLevel = detail.target?.level ?? detail.targetLevel ?? null;
                      const isLevel4 = Number(targetLevel) === 4;
                      const canApprove = isAdmin || !isLevel4;
                      return (
                        <>
                          {isLevel4 && !isAdmin ? (
                            <p className={styles.cardDesc} style={{ margin: 0, color: '#b73a3a' }}>
                              这是四级处罚，只有管理员能通过。你可以驳回。
                            </p>
                          ) : null}
                          <div className={local.decisionRow}>
                            <button
                              type="button"
                              className={styles.rejectButton}
                              disabled={reviewing}
                              onClick={() => setConfirmDecision('reject')}
                            >
                              驳回
                            </button>
                            {canApprove ? (
                              <button
                                type="button"
                                className={styles.approveButton}
                                disabled={reviewing}
                                onClick={() => setConfirmDecision('approve')}
                              >
                                通过
                              </button>
                            ) : null}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div className={local.factGrid}>
                    <div className={local.factWide}>
                      <span className={local.factLabel}>复核备注</span>
                      <p className={local.factValue}>{detail.reviewNote || '—'}</p>
                    </div>
                    <div>
                      <span className={local.factLabel}>复核时间</span>
                      <p className={local.factValue}>{formatTime(detail.reviewedAt)}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </aside>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(confirmDecision)}
        tone="admin"
        title={confirmDecision === 'approve' ? '确认通过该申诉？' : '确认驳回该申诉？'}
        message={
          confirmDecision === 'approve'
            ? '将撤销目标处罚/警告并清理热状态；若为游戏下架会解锁。四级解除需要 admin。'
            : '驳回后用户将收到申诉结果通知。'
        }
        confirmButtonText={reviewing ? '处理中…' : '确认'}
        cancelButtonText="取消"
        onCancel={() => {
          if (!reviewing) setConfirmDecision(null);
        }}
        onConfirm={() => {
          void handleConfirmReview();
        }}
      />
    </div>
  );
};

export default ContentAppealAdminManager;
