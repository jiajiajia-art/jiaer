import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import adminReportApi, {
  type AdminModerationHistoryItem,
  type AdminPenaltyListItem,
  type AdminReportDetail,
  type AdminReportListItem,
  type AdminReportStatus,
  type AdminReportTargetType,
} from '../../api/admin/adminReportApi';
import ConfirmModal from '../CommonModal/ConfirmModal';
import { useAuthStore } from '../../store/useAuthStore';
import { isAdminRole } from '../../utils/userRoles';
import { getApiErrorMessage } from '../../utils/error';
import reportApi from '../../api/report/reportApi';
import type { ReportReasonItem } from '../../api/report/report.type';
import { getImageUrl } from '../../utils/constants';
import styles from './CommentAdminManager.module.css';
import local from './ContentReportAdminManager.module.css';

/** 功能注释：举报证据存的是 R2 key，读图走 /public 代理 */
function resolveEvidenceImageUrl(keyOrUrl: string): string {
  const raw = String(keyOrUrl || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/public/') || raw.startsWith('public/')) return getImageUrl(raw);
  return getImageUrl(`public/${raw.replace(/^\//, '')}`);
}

const PAGE_SIZE = 20;

type InnerTab = 'reports' | 'penalties';

const statusLabel: Record<AdminReportStatus, string> = {
  pending: '待审核',
  rejected: '已驳回',
  upheld: '已成立',
};

const targetLabel: Record<AdminReportTargetType, string> = {
  game: '游戏',
  user: '账号',
  post: '帖子',
};

const RECORD_TYPE_LABEL: Record<string, string> = {
  warning: '警告',
  penalty: '处罚',
  appeal: '申诉',
};

const HISTORY_STATUS_LABEL: Record<string, string> = {
  pending: '待复核',
  approved: '已通过',
  rejected: '已驳回',
  revoked: '已撤销',
  active: '有效',
  consumed: '已计入处罚',
  finished: '已结束',
};

const LEVEL_LABEL = ['', '一', '二', '三', '四'];

const formatHistoryTitle = (recordType: string, level?: number | null): string => {
  const name = RECORD_TYPE_LABEL[recordType] || recordType;
  if (recordType === 'penalty' && level != null && level >= 1 && level <= 4) {
    return `${LEVEL_LABEL[level]}级处罚`;
  }
  return name;
};

const formatHistoryStatus = (status?: string | null): string => {
  if (!status) return '';
  return HISTORY_STATUS_LABEL[status] || status;
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

const displayNickname = (name: string | null | undefined): string => {
  const trimmed = name?.trim();
  return trimmed || '未设置昵称';
};

const listObjectLabel = (row: AdminReportListItem): string => {
  if (row.targetType === 'game') {
    return row.gameTitle?.trim() || '作品已不存在';
  }
  if (row.targetType === 'user') {
    return displayNickname(row.targetOwnerNickname);
  }
  return row.targetTitle?.trim() || row.targetId;
};

const ContentReportAdminManager: React.FC = () => {
  const role = useAuthStore((s) => s.user?.user?.role);
  const isAdmin = isAdminRole(role);

  const [innerTab, setInnerTab] = useState<InnerTab>('reports');

  const [status, setStatus] = useState<AdminReportStatus | ''>('pending');
  const [targetType, setTargetType] = useState<AdminReportTargetType | ''>('');
  const [keyword, setKeyword] = useState('');
  const [keywordInput, setKeywordInput] = useState('');

  const [list, setList] = useState<AdminReportListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [detail, setDetail] = useState<AdminReportDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [resetAvatar, setResetAvatar] = useState(false);
  const [resetNickname, setResetNickname] = useState(false);
  const [resetBio, setResetBio] = useState(false);
  /** P0.5：严重直达，跳过凑满 3 次警告 */
  const [severeMode, setSevereMode] = useState(false);
  const [penaltyLevel, setPenaltyLevel] = useState<1 | 2 | 3 | 4>(1);

  const [confirmDecision, setConfirmDecision] = useState<'reject' | 'uphold' | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const [penalties, setPenalties] = useState<AdminPenaltyListItem[]>([]);
  const [penaltyTotal, setPenaltyTotal] = useState(0);
  const [penaltyPage, setPenaltyPage] = useState(1);
  const [penaltyLoading, setPenaltyLoading] = useState(false);

  const [restoreFileId, setRestoreFileId] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [reasonByCode, setReasonByCode] = useState<Record<string, ReportReasonItem>>({});
  const [historyPreview, setHistoryPreview] = useState<AdminModerationHistoryItem | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const penaltyTotalPages = Math.max(1, Math.ceil(penaltyTotal / PAGE_SIZE));

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      const response = await adminReportApi.listReports({
        status: status || undefined,
        targetType: targetType || undefined,
        keyword: keyword.trim() || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      const data = response.data.data;
      setList(data?.list || []);
      setTotal(data?.total || 0);
    } catch (error) {
      toast.error(getApiErrorMessage(error, '举报列表加载失败'));
    } finally {
      setLoading(false);
    }
  }, [keyword, page, status, targetType]);

  const loadPenalties = useCallback(async () => {
    try {
      setPenaltyLoading(true);
      const response = await adminReportApi.listPenalties({
        page: penaltyPage,
        pageSize: PAGE_SIZE,
      });
      const data = response.data.data;
      setPenalties(data?.list || []);
      setPenaltyTotal(data?.total || 0);
    } catch (error) {
      toast.error(getApiErrorMessage(error, '处罚记录加载失败'));
    } finally {
      setPenaltyLoading(false);
    }
  }, [penaltyPage]);

  useEffect(() => {
    if (innerTab === 'reports') void loadReports();
  }, [innerTab, loadReports]);

  useEffect(() => {
    if (innerTab === 'penalties') void loadPenalties();
  }, [innerTab, loadPenalties]);

  const openDetail = async (id: number) => {
    setDetailLoading(true);
    setHistoryPreview(null);
    setReviewNote('');
    setResetAvatar(false);
    setResetNickname(false);
    setResetBio(false);
    setSevereMode(false);
    setPenaltyLevel(1);
    try {
      const response = await adminReportApi.getReport(id);
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || '加载详情失败');
      }
      const next = response.data.data;
      setDetail(next);
      if (next?.targetType && next.reasonCode && !reasonByCode[next.reasonCode]) {
        try {
          const reasons = await reportApi.getReasons(next.targetType);
          const list = reasons.data.data?.list || [];
          setReasonByCode((prev) => {
            const merged = { ...prev };
            list.forEach((item) => {
              merged[item.code] = item;
            });
            return merged;
          });
        } catch {
          /* 目录拉取失败时仍展示快照标题 */
        }
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, '加载详情失败'));
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    if (reviewing) return;
    setDetail(null);
    setHistoryPreview(null);
    setConfirmDecision(null);
    setSevereMode(false);
    setPenaltyLevel(1);
  };

  const handleConfirmReview = async () => {
    if (!detail || !confirmDecision) return;
    if (confirmDecision === 'uphold' && severeMode && penaltyLevel === 4 && !isAdmin) {
      toast.error('四级处罚仅管理员可施加');
      setConfirmDecision(null);
      return;
    }
    setReviewing(true);
    try {
      const resetFields: Array<'avatar' | 'nickname' | 'bio'> = [];
      if (detail.targetType === 'user') {
        if (resetAvatar) resetFields.push('avatar');
        if (resetNickname) resetFields.push('nickname');
        if (resetBio) resetFields.push('bio');
      }

      const payload = {
        decision: confirmDecision,
        reviewNote: reviewNote.trim() || undefined,
        ...(confirmDecision === 'uphold' && severeMode
          ? { penaltyLevel }
          : {}),
        ...(confirmDecision === 'uphold' && resetFields.length > 0
          ? {
              actions: ['uphold_warn', 'uphold_reset_profile'] as string[],
              resetFields,
            }
          : {}),
      };

      const response = await adminReportApi.reviewReport(detail.id, payload);
      toast.success(
        response.data.message
          || (confirmDecision === 'uphold' ? '已成立并处理' : '已驳回'),
      );
      setConfirmDecision(null);
      setDetail(null);
      setSevereMode(false);
      setPenaltyLevel(1);
      void loadReports();
    } catch (error) {
      toast.error(getApiErrorMessage(error, '审核失败'));
    } finally {
      setReviewing(false);
    }
  };

  const handleRestoreGame = async () => {
    const fileId = restoreFileId.trim();
    if (!fileId || restoring) return;
    setRestoring(true);
    try {
      const response = await adminReportApi.restoreGame(fileId);
      toast.success(response.data.message || '已撤销下架锁');
      setRestoreFileId('');
    } catch (error) {
      toast.error(getApiErrorMessage(error, '撤销下架失败'));
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className={styles.panelStack}>
      <div className={styles.heroCard}>
        <div>
          <span className={styles.sectionBadge}>内容安全</span>
          <h2 className={styles.heroTitle}>内容举报</h2>
          <p className={styles.heroDesc}>
            审核用户举报；成立时游戏默认下架+警告，账号默认记警告。处罚记录只读。
          </p>
        </div>
        <div className={styles.heroMetric}>
          <span className={styles.heroMetricLabel}>
            {innerTab === 'reports' ? '举报总数' : '处罚条数'}
          </span>
          <span className={styles.heroMetricValue}>
            {innerTab === 'reports' ? total : penaltyTotal}
          </span>
        </div>
      </div>

      <div className={`${styles.card} ${local.tabCard}`}>
        <div className={local.tabBar} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={innerTab === 'reports'}
            className={innerTab === 'reports' ? local.tabActive : local.tab}
            onClick={() => setInnerTab('reports')}
          >
            举报审核
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={innerTab === 'penalties'}
            className={innerTab === 'penalties' ? local.tabActive : local.tab}
            onClick={() => setInnerTab('penalties')}
          >
            处罚记录
          </button>
        </div>
      </div>

      {innerTab === 'reports' ? (
        <>
          <div className={`${styles.card} ${local.filterCard}`}>
            <label className={local.field}>
              <span className={local.fieldLabel}>状态</span>
              <select
                className={local.control}
                value={status}
                onChange={(e) => {
                  setPage(1);
                  setStatus(e.target.value as AdminReportStatus | '');
                }}
              >
                <option value="">全部状态</option>
                <option value="pending">待审核</option>
                <option value="upheld">已成立</option>
                <option value="rejected">已驳回</option>
              </select>
            </label>
            <label className={local.field}>
              <span className={local.fieldLabel}>类型</span>
              <select
                className={local.control}
                value={targetType}
                onChange={(e) => {
                  setPage(1);
                  setTargetType(e.target.value as AdminReportTargetType | '');
                }}
              >
                <option value="">全部类型</option>
                <option value="game">游戏</option>
                <option value="user">账号</option>
                <option value="post">帖子</option>
              </select>
            </label>
            <label className={`${local.field} ${local.fieldGrow}`}>
              <span className={local.fieldLabel}>关键词</span>
              <input
                className={local.control}
                value={keywordInput}
                placeholder="id、标题或举报人"
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
            <button type="button" className={local.toolbarBtn} onClick={() => void loadReports()}>
              刷新
              <svg className={local.toolbarIcon} viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.75 10h-2.1A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
                />
              </svg>
            </button>
          </div>

          <div className={`${styles.card} ${local.restoreCard}`}>
            <label className={`${local.field} ${local.fieldGrow}`}>
              <span className={local.fieldLabel}>撤销下架</span>
              <input
                className={local.control}
                value={restoreFileId}
                placeholder="输入作品 fileId"
                onChange={(e) => setRestoreFileId(e.target.value)}
              />
            </label>
            <button
              type="button"
              className={styles.detailButton}
              disabled={!restoreFileId.trim() || restoring}
              onClick={() => void handleRestoreGame()}
            >
              {restoring ? '处理中…' : '撤销下架锁'}
            </button>
          </div>

          <div className={styles.card}>
            {loading ? (
              <p className={styles.emptyState}>加载中…</p>
            ) : list.length === 0 ? (
              <p className={styles.emptyState}>暂无举报</p>
            ) : (
              <div className={local.tableWrap}>
                <table className={local.table}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>类型</th>
                      <th>对象</th>
                      <th>理由</th>
                      <th>举报人</th>
                      <th>时间</th>
                      <th>状态</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((row) => (
                      <tr key={row.id}>
                        <td>{row.id}</td>
                        <td>{targetLabel[row.targetType] || row.targetType}</td>
                        <td title={row.targetType === 'game' ? row.targetId : row.targetOwnerUserId}>
                          {truncate(listObjectLabel(row), 24)}
                        </td>
                        <td>{truncate(row.reasonTitle, 16)}</td>
                        <td title={row.reporterUserId}>
                          {truncate(displayNickname(row.reporterNickname), 12)}
                        </td>
                        <td>{formatTime(row.createdAt)}</td>
                        <td>{statusLabel[row.status] || row.status}</td>
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
        </>
      ) : (
        <div className={styles.card}>
          {penaltyLoading ? (
            <p className={styles.emptyState}>加载中…</p>
          ) : penalties.length === 0 ? (
            <p className={styles.emptyState}>暂无处罚记录</p>
          ) : (
            <div className={local.tableWrap}>
              <table className={local.table}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>用户</th>
                    <th>类型</th>
                    <th>等级</th>
                    <th>状态</th>
                    <th>起止</th>
                    <th>说明</th>
                  </tr>
                </thead>
                <tbody>
                  {penalties.map((row) => (
                    <tr key={row.id}>
                      <td>{row.id}</td>
                      <td title={row.userId}>{truncate(row.userId, 12)}</td>
                      <td>{row.recordType}</td>
                      <td>{row.level ?? '—'}</td>
                      <td>{row.status ?? '—'}</td>
                      <td>
                        {formatTime(row.startsAt)} ~ {formatTime(row.endsAt)}
                      </td>
                      <td title={row.notifyBody || ''}>
                        {truncate(row.notifyBody, 28)}
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
              disabled={penaltyPage <= 1}
              onClick={() => setPenaltyPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </button>
            <span className={styles.pageInfo}>
              第 {penaltyPage} / {penaltyTotalPages} 页，共 {penaltyTotal} 条
            </span>
            <button
              type="button"
              className={styles.pageButton}
              disabled={penaltyPage >= penaltyTotalPages}
              onClick={() => setPenaltyPage((p) => p + 1)}
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {(detail || detailLoading) && (
        <div className={local.drawerBackdrop} onClick={closeDetail} role="presentation">
          <aside
            className={local.drawer}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="举报详情"
          >
            <div className={local.drawerHead}>
              <h3 className={local.drawerTitle}>举报详情</h3>
              <button type="button" className={styles.detailButton} onClick={closeDetail}>关闭</button>
            </div>
            {detailLoading || !detail ? (
              <p className={styles.emptyState}>加载中…</p>
            ) : (
              <>
                <p className={local.metaLine}>
                  <span>
                    {targetLabel[detail.targetType]}
                    {' · '}
                    {statusLabel[detail.status]}
                  </span>
                  <span>{formatTime(detail.createdAt)}</span>
                </p>

                <div className={local.caseBlock}>
                  {detail.targetType === 'user' ? (
                    <div>
                      <span className={local.factLabel}>被举报人</span>
                      {detail.targetOwnerUserCode ? (
                        <Link
                          className={local.subjectLink}
                          to={`/account/${encodeURIComponent(detail.targetOwnerUserCode)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {displayNickname(detail.targetOwnerNickname)}
                        </Link>
                      ) : (
                        <p className={local.subjectName}>{displayNickname(detail.targetOwnerNickname)}</p>
                      )}
                      <p className={local.factLine}>
                        <span className={local.factLineName}>ID</span>
                        <span className={local.factValue}>{detail.targetOwnerUserId}</span>
                      </p>
                    </div>
                  ) : (
                    <div>
                      <span className={local.factLabel}>对象</span>
                      {detail.targetType === 'game' ? (
                        <Link
                          className={local.subjectLink}
                          to={`/game/${encodeURIComponent(detail.targetId)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {detail.gameTitle?.trim() || '作品已不存在'}
                        </Link>
                      ) : (
                        <p className={local.subjectName}>{detail.targetTitle?.trim() || '未填写标题'}</p>
                      )}
                      <p className={local.factLine}>
                        <span className={local.factLineName}>ID</span>
                        <span className={local.factValue}>{detail.targetId}</span>
                      </p>
                    </div>
                  )}

                  <div>
                    <span className={local.factLabel}>
                      {reasonByCode[detail.reasonCode]?.category || '理由'}
                    </span>
                    <p className={local.reasonTitle}>
                      {reasonByCode[detail.reasonCode]?.title || detail.reasonTitle}
                      {reasonByCode[detail.reasonCode]?.description ? (
                        <span className={local.reasonExplain}>
                          （{reasonByCode[detail.reasonCode]?.description}）
                        </span>
                      ) : null}
                    </p>
                  </div>

                  {detail.detail?.trim() ? (
                    <div>
                      <span className={local.factLabel}>说明</span>
                      <p className={local.factValue}>{detail.detail}</p>
                    </div>
                  ) : null}

                  {detail.evidenceUrls?.length ? (
                    <div>
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
                              <img src={src} alt="举报证据" />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className={local.ledger}>
                  {detail.targetType === 'user' ? null : (
                    <div>
                      <span className={local.factLabel}>被举报人</span>
                      <p className={local.factLine}>
                        <span className={local.factLineName}>昵称</span>
                        {detail.targetOwnerUserCode ? (
                          <Link
                            className={local.factLink}
                            to={`/account/${encodeURIComponent(detail.targetOwnerUserCode)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {displayNickname(detail.targetOwnerNickname)}
                          </Link>
                        ) : (
                          <span className={local.factValue}>{displayNickname(detail.targetOwnerNickname)}</span>
                        )}
                      </p>
                      <p className={local.factLine}>
                        <span className={local.factLineName}>ID</span>
                        <span className={local.factValue}>{detail.targetOwnerUserId}</span>
                      </p>
                    </div>
                  )}
                  <div className={local.statPair}>
                    <div>
                      <span className={local.factLabel}>有效警告</span>
                      <p className={local.factValue}>{detail.ownerWarningCount ?? '—'}</p>
                    </div>
                    <div>
                      <span className={local.factLabel}>当前处罚</span>
                      {detail.ownerPunishment ? (
                        <p className={local.factValue}>
                          禁发至 {formatTime(detail.ownerPunishment.publishBanUntil)}
                          ，等级 {detail.ownerPunishment.activePenaltyLevel ?? 0}
                          {detail.ownerPunishment.homepageHidden ? '，主页已隐藏' : ''}
                        </p>
                      ) : (
                        <p className={local.factValue}>无</p>
                      )}
                    </div>
                  </div>
                  {detail.ownerModerationHistory?.length ? (
                    <div>
                      <span className={local.factLabel}>近期记录</span>
                      <ul className={local.historyList}>
                        {detail.ownerModerationHistory.slice(0, 8).map((item) => {
                          const statusText = formatHistoryStatus(item.status);
                          const revoked = item.status === 'revoked';
                          return (
                            <li key={item.id}>
                              <button
                                type="button"
                                className={`${local.historyItem}${revoked ? ` ${local.historyItemMuted}` : ''}`}
                                onClick={() => setHistoryPreview(item)}
                              >
                                <div className={local.historyMain}>
                                  <span className={local.historyType}>
                                    {formatHistoryTitle(item.recordType, item.level)}
                                  </span>
                                  {statusText ? (
                                    <span
                                      className={`${local.historyStatus}${revoked ? ` ${local.historyStatusRevoked}` : ''}`}
                                    >
                                      {statusText}
                                    </span>
                                  ) : null}
                                </div>
                                <time className={local.historyTime} dateTime={item.createdAt || undefined}>
                                  {formatTime(item.createdAt)}
                                </time>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                  <div>
                    <span className={local.factLabel}>举报人</span>
                    <p className={local.factLine}>
                      <span className={local.factLineName}>昵称</span>
                      <span className={local.factValue}>{displayNickname(detail.reporterNickname)}</span>
                    </p>
                    <p className={local.factLine}>
                      <span className={local.factLineName}>ID</span>
                      <span className={local.factValue}>{detail.reporterUserId}</span>
                    </p>
                  </div>
                </div>

                {detail.status === 'pending' ? (
                  <div className={local.reviewBlock}>
                    <label className={local.field}>
                      <span className={local.fieldLabel}>审核备注</span>
                      <textarea
                        className={local.note}
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        rows={3}
                      />
                    </label>
                    {detail.targetType === 'user' ? (
                      <div className={local.checkList}>
                        <span className={local.fieldLabel}>成立时重置资料（可选）</span>
                        <label className={local.check}>
                          <input type="checkbox" checked={resetAvatar} onChange={(e) => setResetAvatar(e.target.checked)} />
                          重置头像
                        </label>
                        <label className={local.check}>
                          <input type="checkbox" checked={resetNickname} onChange={(e) => setResetNickname(e.target.checked)} />
                          重置昵称
                        </label>
                        <label className={local.check}>
                          <input type="checkbox" checked={resetBio} onChange={(e) => setResetBio(e.target.checked)} />
                          清空简介
                        </label>
                      </div>
                    ) : (
                      <p className={styles.cardDesc} style={{ margin: 0 }}>
                        游戏成立后会下架，并记一次警告。
                      </p>
                    )}

                    <label className={local.check}>
                      <input
                        type="checkbox"
                        checked={severeMode}
                        onChange={(e) => {
                          const on = e.target.checked;
                          setSevereMode(on);
                          if (on && penaltyLevel === 4 && !isAdmin) setPenaltyLevel(1);
                        }}
                      />
                      <span>严重直达，跳过凑满 3 次警告</span>
                    </label>
                    {severeMode ? (
                      <>
                        <label className={local.field}>
                          <span className={local.fieldLabel}>处罚等级</span>
                          <select
                            className={local.control}
                            value={penaltyLevel}
                            onChange={(e) => setPenaltyLevel(Number(e.target.value) as 1 | 2 | 3 | 4)}
                          >
                            <option value={1}>一级</option>
                            <option value={2}>二级</option>
                            <option value={3}>三级</option>
                            {isAdmin ? <option value={4}>四级（仅管理员）</option> : null}
                          </select>
                        </label>
                        <p className={styles.cardDesc} style={{ margin: 0 }}>
                          成立后直接按这个等级处罚。
                          {!isAdmin ? '四级仅管理员可选。' : ''}
                        </p>
                      </>
                    ) : null}

                    <div className={local.decisionRow}>
                      <button
                        type="button"
                        className={`${local.decisionBtn} ${local.decisionReject}`}
                        disabled={reviewing}
                        onClick={() => setConfirmDecision('reject')}
                      >
                        驳回
                      </button>
                      <button
                        type="button"
                        className={`${local.decisionBtn} ${local.decisionApprove}`}
                        disabled={reviewing}
                        onClick={() => setConfirmDecision('uphold')}
                      >
                        成立
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={local.factGrid}>
                    <div className={local.factWide}>
                      <span className={local.factLabel}>审核备注</span>
                      <p className={local.factValue}>{detail.reviewNote || '—'}</p>
                    </div>
                    <div>
                      <span className={local.factLabel}>审核时间</span>
                      <p className={local.factValue}>{formatTime(detail.reviewedAt)}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </aside>
        </div>
      )}

      {historyPreview ? (
        <div
          className={local.historySheetBackdrop}
          onClick={() => setHistoryPreview(null)}
          role="presentation"
        >
          <div
            className={local.historySheet}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="记录摘要"
          >
            <div className={local.historySheetHead}>
              <h4 className={local.historySheetTitle}>记录摘要</h4>
              <button
                type="button"
                className={styles.detailButton}
                onClick={() => setHistoryPreview(null)}
              >
                关闭
              </button>
            </div>
            <div className={local.historySheetBody}>
              <div>
                <span className={local.factLabel}>类型</span>
                <p className={local.factValue}>
                  {formatHistoryTitle(historyPreview.recordType, historyPreview.level)}
                </p>
              </div>
              <div>
                <span className={local.factLabel}>状态</span>
                <p className={local.factValue}>
                  {formatHistoryStatus(historyPreview.status) || '—'}
                </p>
              </div>
              <div>
                <span className={local.factLabel}>时间</span>
                <p className={local.factValue}>{formatTime(historyPreview.createdAt)}</p>
              </div>
              {historyPreview.startsAt || historyPreview.endsAt ? (
                <div>
                  <span className={local.factLabel}>起止</span>
                  <p className={local.factValue}>
                    {formatTime(historyPreview.startsAt)}
                    {' ~ '}
                    {formatTime(historyPreview.endsAt)}
                  </p>
                </div>
              ) : null}
              <div>
                <span className={local.factLabel}>通知正文</span>
                <p className={local.factValue}>{historyPreview.body?.trim() || '—'}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        isOpen={Boolean(confirmDecision)}
        tone="admin"
        title={confirmDecision === 'uphold' ? '确认成立该举报？' : '确认驳回该举报？'}
        message={
          confirmDecision === 'uphold'
            ? (severeMode
              ? `严重直达：将直接施加 ${penaltyLevel} 级处罚（跳过凑满 3 次警告）。${penaltyLevel === 4 ? '四级可能导致禁登录。' : ''}`
              : '将按默认处置执行（游戏：下架+警告；账号：警告）。满 3 次有效警告会自动触发一级处罚。')
            : '驳回后举报人需等待 7 天冷却才可再报同一对象。'
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

export default ContentReportAdminManager;
