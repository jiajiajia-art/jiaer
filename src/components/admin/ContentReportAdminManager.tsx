import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import adminAppealApi from '../../api/admin/adminAppealApi';
import adminReportApi, {
  type AdminModerationDetail,
  type AdminModerationHistoryItem,
  type AdminPenaltyListItem,
  type AdminReportDetail,
  type AdminReportListItem,
  type AdminReportStatus,
  type AdminReportTargetType,
} from '../../api/admin/adminReportApi';
import type { AdminAppealDetail } from '../../api/appeal/appeal.type';
import ConfirmModal from '../CommonModal/ConfirmModal';
import { getApiErrorMessage } from '../../utils/error';
import reportApi from '../../api/report/reportApi';
import type { ReportReasonItem } from '../../api/report/report.type';
import { resolveEvidenceImageUrl } from '../../utils/evidenceImageUrl';
import { useAuthStore } from '../../store/useAuthStore';
import { isAdminRole } from '../../utils/userRoles';
import styles from './CommentAdminManager.module.css';
import local from './ContentReportAdminManager.module.css';

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
  publish_review: '发布审核',
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
const ALL_PENALTY_LEVELS = [1, 2, 3, 4] as const;

/** 功能注释：直达处罚只能选高于当前生效等级的档位 */
const selectablePenaltyLevels = (
  activeLevel?: number | null,
): Array<1 | 2 | 3 | 4> => {
  const current = Number(activeLevel) || 0;
  return ALL_PENALTY_LEVELS.filter((level) => level > current);
};

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

type PersonFilter = {
  role: 'target' | 'reporter';
  userId: string;
  name: string;
};

type HistoryExtra =
  | { kind: 'moderation'; data: AdminModerationDetail }
  | { kind: 'appeal'; data: AdminAppealDetail };

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
  const viewerRole = useAuthStore((s) => s.user?.user?.role);
  const canBanLogin = isAdminRole(viewerRole);

  const [innerTab, setInnerTab] = useState<InnerTab>('reports');

  const [status, setStatus] = useState<AdminReportStatus | ''>('pending');
  const [targetType, setTargetType] = useState<AdminReportTargetType | ''>('');
  const [keyword, setKeyword] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [personFilter, setPersonFilter] = useState<PersonFilter | null>(null);
  const [objectNickname, setObjectNickname] = useState('');
  const [objectNicknameDraft, setObjectNicknameDraft] = useState('');
  const [objectFilterOpen, setObjectFilterOpen] = useState(false);

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
  /** P0.5：勾选严重直达（未满 2 次有效警告时才显示） */
  const [severeMode, setSevereMode] = useState(false);
  const [penaltyLevel, setPenaltyLevel] = useState<1 | 2 | 3 | 4>(1);
  /** 仅 admin：四级成立时可勾禁登录 */
  const [banLogin, setBanLogin] = useState(false);
  const [punishmentActionBusy, setPunishmentActionBusy] = useState(false);

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
  const [historyExtra, setHistoryExtra] = useState<HistoryExtra | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const objectFilterRef = useRef<HTMLTableCellElement | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const penaltyTotalPages = Math.max(1, Math.ceil(penaltyTotal / PAGE_SIZE));

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      const response = await adminReportApi.listReports({
        status: status || undefined,
        targetType: targetType || undefined,
        keyword: keyword.trim() || undefined,
        targetOwnerUserId: personFilter?.role === 'target' ? personFilter.userId : undefined,
        targetOwnerNickname: objectNickname.trim() || undefined,
        reporterUserId: personFilter?.role === 'reporter' ? personFilter.userId : undefined,
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
  }, [keyword, objectNickname, page, personFilter, status, targetType]);

  useEffect(() => {
    if (!objectFilterOpen) return;
    const onDoc = (event: MouseEvent) => {
      if (!objectFilterRef.current?.contains(event.target as Node)) {
        setObjectFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [objectFilterOpen]);

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

  // 功能注释：当前处罚变化后，直达等级不得低于/等于已生效档
  useEffect(() => {
    if (!detail) return;
    const levels = selectablePenaltyLevels(detail.ownerPunishment?.activePenaltyLevel);
    if (levels.length === 0) return;
    if (!levels.includes(penaltyLevel)) {
      setPenaltyLevel(levels[0]);
    }
  }, [detail, penaltyLevel]);

  const openDetail = async (id: number) => {
    setDetailLoading(true);
    setHistoryPreview(null);
    setReviewNote('');
    setResetAvatar(false);
    setResetNickname(false);
    setResetBio(false);
    setSevereMode(false);
    setPenaltyLevel(1);
    setBanLogin(false);
    try {
      const response = await adminReportApi.getReport(id);
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || '加载详情失败');
      }
      const next = response.data.data;
      setDetail(next);
      const nextLevels = selectablePenaltyLevels(next.ownerPunishment?.activePenaltyLevel);
      if (nextLevels.length > 0) {
        setPenaltyLevel(nextLevels[0]);
      }
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
    setHistoryExtra(null);
    setConfirmDecision(null);
    setSevereMode(false);
    setPenaltyLevel(1);
    setBanLogin(false);
  };

  const applyPersonFilter = (role: PersonFilter['role'], userId: string, name: string) => {
    const id = userId.trim();
    if (!id) return;
    setPage(1);
    setStatus('');
    setObjectNickname('');
    setObjectNicknameDraft('');
    setObjectFilterOpen(false);
    setPersonFilter({ role, userId: id, name: name.trim() || id });
    setDetail(null);
  };

  const applyObjectNicknameFilter = () => {
    const nick = objectNicknameDraft.trim();
    setPage(1);
    setStatus('');
    setPersonFilter((prev) => (prev?.role === 'target' ? null : prev));
    setObjectNickname(nick);
    setObjectFilterOpen(false);
    setDetail(null);
  };

  const openHistory = async (item: AdminModerationHistoryItem) => {
    setHistoryPreview(item);
    setHistoryExtra(null);
    setHistoryLoading(true);
    try {
      const publicId = String(item.id || '').trim();
      if (!publicId) {
        throw new Error('记录缺少对外编号');
      }
      if (item.recordType === 'appeal') {
        const response = await adminAppealApi.getAppeal(publicId);
        if (!response.data.success || !response.data.data) {
          throw new Error(response.data.message || '加载申诉详情失败');
        }
        setHistoryExtra({ kind: 'appeal', data: response.data.data });
      } else {
        const response = await adminReportApi.getModeration(publicId);
        if (!response.data.success || !response.data.data) {
          throw new Error(response.data.message || '加载记录详情失败');
        }
        setHistoryExtra({ kind: 'moderation', data: response.data.data });
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, '加载记录详情失败'));
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleConfirmReview = async () => {
    if (!detail || !confirmDecision) return;
    setReviewing(true);
    try {
      const resetFields: Array<'avatar' | 'nickname' | 'bio'> = [];
      if (detail.targetType === 'user') {
        if (resetAvatar) resetFields.push('avatar');
        if (resetNickname) resetFields.push('nickname');
        if (resetBio) resetFields.push('bio');
      }

      // 功能注释：有效警告≥2 时与严重直达相同——只写处罚、不记警告
      const directPenalty = (detail.ownerWarningCount ?? 0) >= 2 || severeMode;

      const actions: string[] = [];
      if (confirmDecision === 'uphold') {
        if (directPenalty) {
          // 功能注释：直达处罚不带 uphold_warn，避免叠警告通知
          if (detail.targetType === 'game' || detail.targetType === 'post') {
            actions.push('uphold_takedown');
          }
          if (resetFields.length > 0) {
            actions.push('uphold_reset_profile');
          }
          if (canBanLogin && banLogin && penaltyLevel === 4) {
            actions.push('uphold_ban_login');
          }
        } else if (resetFields.length > 0) {
          actions.push('uphold_warn', 'uphold_reset_profile');
        }
      }

      const payload = {
        decision: confirmDecision,
        reviewNote: reviewNote.trim() || undefined,
        ...(confirmDecision === 'uphold' && directPenalty
          ? { penaltyLevel }
          : {}),
        ...(confirmDecision === 'uphold' && actions.length > 0
          ? { actions }
          : {}),
        ...(confirmDecision === 'uphold' && resetFields.length > 0
          ? { resetFields }
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
      setBanLogin(false);
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
            {personFilter || objectNickname.trim() ? (
              <div className={local.personFilter}>
                <span>
                  {personFilter
                    ? `${personFilter.role === 'target' ? '被举报人' : '举报人'} ${personFilter.name}`
                    : `对象昵称 ${objectNickname.trim()}`}
                </span>
                <button
                  type="button"
                  className={local.toolbarBtn}
                  onClick={() => {
                    setPage(1);
                    setPersonFilter(null);
                    setObjectNickname('');
                    setObjectNicknameDraft('');
                  }}
                >
                  清除
                </button>
              </div>
            ) : null}
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
                      <th ref={objectFilterRef} className={local.thFilter}>
                        <span className={local.thFilterLabel}>
                          对象
                          <button
                            type="button"
                            className={`${local.thFilterBtn}${objectNickname.trim() || objectFilterOpen ? ` ${local.thFilterBtnActive}` : ''}`}
                            aria-label="按昵称筛选对象"
                            aria-expanded={objectFilterOpen}
                            onClick={() => {
                              setObjectNicknameDraft(objectNickname);
                              setObjectFilterOpen((open) => !open);
                            }}
                          >
                            <img
                              className={local.thFilterIcon}
                              src={`${import.meta.env.BASE_URL}data/assetsv2/common/select.svg`}
                              alt=""
                            />
                          </button>
                        </span>
                        {objectFilterOpen ? (
                          <div className={local.thFilterPop} onClick={(e) => e.stopPropagation()}>
                            <input
                              className={local.thFilterInput}
                              value={objectNicknameDraft}
                              placeholder="输入昵称"
                              autoFocus
                              onChange={(e) => setObjectNicknameDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') applyObjectNicknameFilter();
                                if (e.key === 'Escape') setObjectFilterOpen(false);
                              }}
                            />
                            <div className={local.thFilterActions}>
                              <button
                                type="button"
                                className={local.toolbarBtn}
                                onClick={() => {
                                  setObjectNicknameDraft('');
                                  setObjectNickname('');
                                  setPage(1);
                                  setObjectFilterOpen(false);
                                }}
                              >
                                清空
                              </button>
                              <button
                                type="button"
                                className={styles.detailButton}
                                onClick={applyObjectNicknameFilter}
                              >
                                筛选
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </th>
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
                        <td title={row.targetOwnerUserId}>
                          {truncate(listObjectLabel(row), 24)}
                        </td>
                        <td>{truncate(row.reasonTitle, 16)}</td>
                        <td title={row.reporterUserId}>
                          <button
                            type="button"
                            className={local.nameFilter}
                            title="只看此人举报"
                            onClick={() => applyPersonFilter(
                              'reporter',
                              row.reporterUserId,
                              displayNickname(row.reporterNickname),
                            )}
                          >
                            {truncate(displayNickname(row.reporterNickname), 12)}
                          </button>
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
                          state={{ from: '/operator/content-reports' }}
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
                          state={{ from: '/operator/content-reports' }}
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
                            state={{ from: '/operator/content-reports' }}
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
                        <>
                          <p className={local.factValue}>
                            禁发至 {formatTime(detail.ownerPunishment.publishBanUntil)}
                            ，等级 {detail.ownerPunishment.activePenaltyLevel ?? 0}
                            {detail.ownerPunishment.homepageHidden ? '，主页已隐藏' : ''}
                            {detail.ownerPunishment.creatorFrozen ? '，创作者已冻结' : ''}
                            {detail.ownerPunishment.publishNeedReview ? '，先审后发' : ''}
                            {detail.ownerPunishment.loginBanned ? '，已禁登录' : ''}
                            {detail.ownerPunishment.observationUntil
                              ? `，观察期至 ${formatTime(detail.ownerPunishment.observationUntil)}`
                              : ''}
                          </p>
                          {/* 功能注释：解禁入口对 admin/operator 开放；施加禁登录仍仅 admin */}
                          {detail.ownerPunishment.loginBanned ? (
                            <div className={local.decisionRow} style={{ marginTop: 8 }}>
                              <button
                                type="button"
                                className={`${local.decisionBtn} ${local.decisionReject}`}
                                disabled={punishmentActionBusy || !detail.targetOwnerUserId}
                                onClick={() => {
                                  void (async () => {
                                    if (!detail.targetOwnerUserId) return;
                                    setPunishmentActionBusy(true);
                                    try {
                                      const response = await adminReportApi.clearLoginBan(
                                        detail.targetOwnerUserId,
                                      );
                                      toast.success(response.data.message || '已解除禁登录');
                                      const refreshed = await adminReportApi.getReport(detail.id);
                                      if (refreshed.data.success && refreshed.data.data) {
                                        setDetail(refreshed.data.data);
                                      }
                                    } catch (error) {
                                      toast.error(getApiErrorMessage(error, '解禁登录失败'));
                                    } finally {
                                      setPunishmentActionBusy(false);
                                    }
                                  })();
                                }}
                              >
                                解除禁登录
                              </button>
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <p className={local.factValue}>无</p>
                      )}
                    </div>
                  </div>
                  {detail.ownerModerationHistory?.length ? (
                    <div>
                      <span className={local.factLabel}>近期记录</span>
                      <ul className={local.historyList}>
                        {detail.ownerModerationHistory.slice(0, 8).map((item, index) => {
                          const statusText = formatHistoryStatus(item.status);
                          const revoked = item.status === 'revoked';
                          return (
                            <li key={item.id || `history-${index}`}>
                              <button
                                type="button"
                                className={`${local.historyItem}${revoked ? ` ${local.historyItemMuted}` : ''}`}
                                onClick={() => void openHistory(item)}
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
                        {(detail.ownerWarningCount ?? 0) >= 2 || severeMode
                          ? '游戏成立后会下架，并直接按所选等级处罚（不记警告）。'
                          : '游戏成立后会下架，并记一次警告。'}
                      </p>
                    )}

                    {/* 功能注释：即将满 3 次 → 只出示等级；否则保留「严重直达」勾选 */}
                    {(detail.ownerWarningCount ?? 0) >= 2 ? (
                      <p className={styles.cardDesc} style={{ margin: 0, fontSize: 12 }}>
                        {(detail.ownerPunishment?.activePenaltyLevel ?? 0) >= 1
                          ? '请直接选择处罚等级（不记警告）'
                          : `有效警告已 ${detail.ownerWarningCount} 次，请直接选择处罚等级（不记警告）`}
                      </p>
                    ) : (
                      <label className={local.check}>
                        <input
                          type="checkbox"
                          checked={severeMode}
                          onChange={(e) => {
                            const on = e.target.checked;
                            setSevereMode(on);
                            if (on) {
                              const levels = selectablePenaltyLevels(
                                detail.ownerPunishment?.activePenaltyLevel,
                              );
                              if (levels.length > 0) setPenaltyLevel(levels[0]);
                            }
                          }}
                        />
                        <span>严重直达，跳过凑满 3 次警告</span>
                      </label>
                    )}
                    {(detail.ownerWarningCount ?? 0) >= 2 || severeMode ? (
                      (() => {
                        const levels = selectablePenaltyLevels(
                          detail.ownerPunishment?.activePenaltyLevel,
                        );
                        return (
                          <>
                            <label className={local.field}>
                              <span className={local.fieldLabel}>处罚等级</span>
                              {levels.length > 0 ? (
                                <select
                                  className={local.control}
                                  value={penaltyLevel}
                                  onChange={(e) => {
                                    const next = Number(e.target.value) as 1 | 2 | 3 | 4;
                                    setPenaltyLevel(next);
                                    if (next !== 4) setBanLogin(false);
                                  }}
                                >
                                  {levels.map((level) => (
                                    <option key={level} value={level}>
                                      {LEVEL_LABEL[level]}级
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <p className={styles.cardDesc} style={{ margin: 0, fontSize: 12 }}>
                                  已是最高档处罚，无法再升档
                                </p>
                              )}
                            </label>
                            {levels.length > 0 ? (
                              <p className={styles.cardDesc} style={{ margin: 0 }}>
                                成立后直接按这个等级处罚。
                              </p>
                            ) : null}
                            {canBanLogin && levels.includes(4) && penaltyLevel === 4 ? (
                              <label className={local.check}>
                                <input
                                  type="checkbox"
                                  checked={banLogin}
                                  onChange={(e) => setBanLogin(e.target.checked)}
                                />
                                <span>同时禁登录（仅 admin，不可逆请谨慎）</span>
                              </label>
                            ) : null}
                          </>
                        );
                      })()
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
                        disabled={
                          reviewing
                          || (
                            ((detail.ownerWarningCount ?? 0) >= 2 || severeMode)
                            && selectablePenaltyLevels(detail.ownerPunishment?.activePenaltyLevel).length === 0
                          )
                        }
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
                onClick={() => {
                  setHistoryPreview(null);
                  setHistoryExtra(null);
                }}
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
                onClick={() => {
              setHistoryPreview(null);
              setHistoryExtra(null);
            }}
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
              {historyLoading ? (
                <p className={local.factValue}>加载中…</p>
              ) : historyExtra?.kind === 'moderation' ? (
                <>
                  <div>
                    <span className={local.factLabel}>举报理由</span>
                    <p className={local.factValue}>{historyExtra.data.reasonTitle?.trim() || '—'}</p>
                  </div>
                  {historyExtra.data.reportDetail?.trim() ? (
                    <div>
                      <span className={local.factLabel}>审核备注</span>
                      <p className={local.factValue}>{historyExtra.data.reportDetail.trim()}</p>
                    </div>
                  ) : null}
                  <div>
                    <span className={local.factLabel}>通知正文</span>
                    <p className={local.factValue}>{historyExtra.data.notifyBody?.trim() || '—'}</p>
                  </div>
                </>
              ) : historyExtra?.kind === 'appeal' ? (
                <>
                  <div>
                    <span className={local.factLabel}>申诉内容</span>
                    <p className={local.factValue}>{historyExtra.data.reason?.trim() || '—'}</p>
                  </div>
                  <div>
                    <span className={local.factLabel}>申诉图片</span>
                    {historyExtra.data.evidenceUrls?.length ? (
                      <div className={local.evidenceGrid}>
                        {historyExtra.data.evidenceUrls.map((url) => {
                          const src = resolveEvidenceImageUrl(url);
                          return (
                            <a
                              key={url}
                              className={local.evidenceThumb}
                              href={src}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <img src={src} alt="申诉证据" />
                            </a>
                          );
                        })}
                      </div>
                    ) : (
                      <p className={local.factValue}>—</p>
                    )}
                  </div>
                </>
              ) : (
                <div>
                  <span className={local.factLabel}>通知正文</span>
                  <p className={local.factValue}>{historyPreview.body?.trim() || '—'}</p>
                </div>
              )}
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
            ? (((detail?.ownerWarningCount ?? 0) >= 2 || severeMode)
              ? `将直接施加 ${penaltyLevel} 级处罚，不记警告。${
                canBanLogin && banLogin && penaltyLevel === 4
                  ? '并禁登录该账号。'
                  : ''
              }`
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
