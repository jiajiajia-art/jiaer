import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import adminWithdrawApi, {
  type AdminWithdrawItem,
  type CreatorVerifyItem,
  type DiamondTimelineItem,
} from '../api/withdraw/adminWithdrawApi';
import { getApiErrorMessage } from '../utils/error';
import {
  formatDiamondTimelineLog,
  formatDiamondTimelineTime,
} from '../utils/diamondTimelineLog';
import MetricTitleTip from './stats/MetricTitleTip';
import styles from './WithdrawAdminManager.module.css';

type TabKey = 'withdraw' | 'verify';

const statusLabel = (status: string) => {
  if (status === 'pending') return '待审核';
  if (status === 'approved') return '已通过';
  if (status === 'rejected') return '已驳回';
  return status;
};

/** 列表/详情按审核状态着色，便于一眼区分通过/驳回/待审 */
const statusClassName = (status: string) => {
  if (status === 'pending') return styles.statusPending;
  if (status === 'approved') return styles.statusApproved;
  if (status === 'rejected') return styles.statusRejected;
  return '';
};

const WithdrawAdminManager: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('withdraw');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [withdrawList, setWithdrawList] = useState<AdminWithdrawItem[]>([]);
  const [withdrawTotal, setWithdrawTotal] = useState(0);
  const [verifyList, setVerifyList] = useState<CreatorVerifyItem[]>([]);
  const [verifyTotal, setVerifyTotal] = useState(0);

  const [detail, setDetail] = useState<AdminWithdrawItem | null>(null);
  const [timeline, setTimeline] = useState<DiamondTimelineItem[]>([]);
  const [rejectRemark, setRejectRemark] = useState('');
  const [actionId, setActionId] = useState<number | null>(null);
  /** 认证升级拒绝弹窗：替代 window.prompt，与后台暖色体系一致 */
  const [verifyRejectId, setVerifyRejectId] = useState<number | null>(null);
  const [verifyRejectRemark, setVerifyRejectRemark] = useState('');
  const [verifyRejectSubmitting, setVerifyRejectSubmitting] = useState(false);

  const loadWithdraw = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await adminWithdrawApi.list({
        page,
        pageSize,
        keyword: keyword || undefined,
        status: status || undefined,
      });
      if (resp.data.success) {
        setWithdrawList(resp.data.data?.list || []);
        setWithdrawTotal(resp.data.data?.pagination?.total || 0);
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, '加载提现列表失败'));
    } finally {
      setLoading(false);
    }
  }, [keyword, page, pageSize, status]);

  const loadVerify = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await adminWithdrawApi.listVerify({
        page,
        pageSize,
        keyword: keyword || undefined,
        status: status || undefined,
      });
      if (resp.data.success) {
        setVerifyList(resp.data.data?.list || []);
        setVerifyTotal(resp.data.data?.pagination?.total || 0);
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, '加载升级申请失败'));
    } finally {
      setLoading(false);
    }
  }, [keyword, page, pageSize, status]);

  useEffect(() => {
    if (tab === 'withdraw') void loadWithdraw();
    else void loadVerify();
  }, [tab, loadWithdraw, loadVerify]);

  const openDetail = async (id: number) => {
    try {
      const resp = await adminWithdrawApi.diamondTimeline(id, { pageSize: 200 });
      if (!resp.data.success || !resp.data.data) {
        toast.error(resp.data.message || '加载详情失败');
        return;
      }
      setDetail(resp.data.data.withdraw);
      setTimeline(resp.data.data.timeline?.list || []);
      setRejectRemark('');
      setActionId(id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, '加载详情失败'));
    }
  };

  const handleApproveWithdraw = async (id: number) => {
    try {
      const resp = await adminWithdrawApi.approve(id, rejectRemark);
      if (!resp.data.success) {
        toast.error(resp.data.message || '审核失败');
        return;
      }
      toast.success('已审核通过');
      setDetail(null);
      await loadWithdraw();
    } catch (error) {
      toast.error(getApiErrorMessage(error, '审核失败'));
    }
  };

  const handleRejectWithdraw = async (id: number) => {
    if (!rejectRemark.trim()) {
      toast.error('驳回必须填写说明');
      return;
    }
    try {
      const resp = await adminWithdrawApi.reject(id, rejectRemark.trim());
      if (!resp.data.success) {
        toast.error(resp.data.message || '驳回失败');
        return;
      }
      toast.success('已驳回并退回KK币');
      setDetail(null);
      await loadWithdraw();
    } catch (error) {
      toast.error(getApiErrorMessage(error, '驳回失败'));
    }
  };

  const handleExport = async () => {
    try {
      const resp = await adminWithdrawApi.exportCsv({
        keyword: keyword || undefined,
      });
      const blob = new Blob([resp.data], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = String(resp.headers?.['content-disposition'] || '');
      const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
      const serverName = utfMatch?.[1]
        ? decodeURIComponent(utfMatch[1])
        : plainMatch?.[1];
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      a.download = serverName || `Funloom提现${today}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('已导出审核通过的提现记录');
    } catch (error) {
      toast.error(getApiErrorMessage(error, '导出失败'));
    }
  };

  const handleApproveVerify = async (id: number) => {
    try {
      const resp = await adminWithdrawApi.approveVerify(id);
      if (!resp.data.success) {
        toast.error(resp.data.message || '升级失败');
        return;
      }
      toast.success('已升级为官方认证');
      await loadVerify();
    } catch (error) {
      toast.error(getApiErrorMessage(error, '升级失败'));
    }
  };

  const openVerifyReject = (id: number) => {
    setVerifyRejectId(id);
    setVerifyRejectRemark('');
  };

  const closeVerifyReject = () => {
    if (verifyRejectSubmitting) return;
    setVerifyRejectId(null);
    setVerifyRejectRemark('');
  };

  const handleRejectVerify = async () => {
    if (verifyRejectId == null) return;
    if (!verifyRejectRemark.trim()) {
      toast.error('拒绝说明不能为空');
      return;
    }
    setVerifyRejectSubmitting(true);
    try {
      const resp = await adminWithdrawApi.rejectVerify(verifyRejectId, verifyRejectRemark.trim());
      if (!resp.data.success) {
        toast.error(resp.data.message || '拒绝失败');
        return;
      }
      toast.success('已拒绝升级申请');
      setVerifyRejectId(null);
      setVerifyRejectRemark('');
      await loadVerify();
    } catch (error) {
      toast.error(getApiErrorMessage(error, '拒绝失败'));
    } finally {
      setVerifyRejectSubmitting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil((tab === 'withdraw' ? withdrawTotal : verifyTotal) / pageSize));

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <MetricTitleTip
            className={styles.titleTip}
            title={<h2 className={styles.title}>提现管理</h2>}
            tip="审核KK币提现与创作者官方认证升级；导出含明文收款信息用于打款。"
          />
        </div>
        <div className={styles.headerActions}>
          {tab === 'withdraw' ? (
            <button type="button" className={styles.secondaryButton} onClick={() => void handleExport()}>
              导出已通过(CSV)
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'withdraw' ? styles.tabActive : ''}`}
          onClick={() => { setTab('withdraw'); setPage(1); }}
        >
          提现申请
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'verify' ? styles.tabActive : ''}`}
          onClick={() => { setTab('verify'); setPage(1); }}
        >
          认证升级
        </button>
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.input}
          placeholder="搜索用户名 / 手机号 / 单号"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <select className={styles.select} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">全部状态</option>
          <option value="pending">待审核</option>
          <option value="approved">已通过</option>
          <option value="rejected">已驳回</option>
        </select>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => {
            setPage(1);
            if (tab === 'withdraw') void loadWithdraw();
            else void loadVerify();
          }}
        >
          搜索
        </button>
      </div>

      {loading ? <div className={styles.empty}>加载中...</div> : null}

      {!loading && tab === 'withdraw' ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>用户名</th>
                <th>手机号</th>
                <th>KK币</th>
                <th>折合元</th>
                <th>银行卡</th>
                <th>开户银行</th>
                <th>真实姓名</th>
                <th>身份证</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {withdrawList.length === 0 ? (
                <tr><td colSpan={10} className={styles.empty}>暂无数据</td></tr>
              ) : withdrawList.map((row) => (
                <tr key={row.id}>
                  <td>{row.nickname || '—'}</td>
                  <td>{row.phone || '—'}</td>
                  <td>{row.amount}</td>
                  <td>{row.amountCny}</td>
                  <td>{row.bankCard || '—'}</td>
                  <td>{row.bankBranch || '—'}</td>
                  <td>{row.realName || '—'}</td>
                  <td>{row.idCard || '—'}</td>
                  <td>
                    <span className={`${styles.statusText} ${statusClassName(row.status)}`}>
                      {statusLabel(row.status)}
                    </span>
                  </td>
                  <td>
                    <button type="button" className={styles.linkButton} onClick={() => void openDetail(row.id)}>
                      查看
                    </button>
                    {row.status === 'pending' ? (
                      <>
                        <button type="button" className={styles.linkButton} onClick={() => void handleApproveWithdraw(row.id)}>
                          通过
                        </button>
                        <button
                          type="button"
                          className={styles.linkButton}
                          onClick={() => {
                            setActionId(row.id);
                            setDetail(row);
                            setTimeline([]);
                          }}
                        >
                          驳回
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && tab === 'verify' ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>用户名</th>
                <th>手机号</th>
                <th>Kuran号</th>
                <th>状态</th>
                <th>申请说明</th>
                <th>拒绝说明</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {verifyList.length === 0 ? (
                <tr><td colSpan={7} className={styles.empty}>暂无数据</td></tr>
              ) : verifyList.map((row) => (
                <tr key={row.id}>
                  <td>{row.nickname || '—'}</td>
                  <td>{row.phoneNumber || '—'}</td>
                  <td>{row.userCode || '—'}</td>
                  <td>
                    <span className={`${styles.statusText} ${statusClassName(row.status)}`}>
                      {statusLabel(row.status)}
                    </span>
                  </td>
                  <td>{row.applyRemark || '—'}</td>
                  <td>{row.adminRemark || '—'}</td>
                  <td>
                    {row.status === 'pending' ? (
                      <>
                        <button type="button" className={styles.linkButton} onClick={() => void handleApproveVerify(row.id)}>
                          通过
                        </button>
                        <button type="button" className={styles.linkButton} onClick={() => openVerifyReject(row.id)}>
                          拒绝
                        </button>
                      </>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className={styles.pager}>
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>上一页</button>
        <span>{page} / {totalPages}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>下一页</button>
      </div>

      {detail ? (
        <div className={styles.drawerOverlay} onClick={() => setDetail(null)}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <h3>提现详情 · {detail.withdrawNo}</h3>
              <button type="button" className={styles.close} onClick={() => setDetail(null)}>×</button>
            </div>
            <div className={styles.detailGrid}>
              <div><span>用户</span><strong>{detail.nickname}</strong></div>
              <div><span>手机</span><strong>{detail.phone}</strong></div>
              <div><span>KK币</span><strong>{detail.amount}</strong></div>
              <div><span>人民币</span><strong>¥{detail.amountCny}</strong></div>
              <div><span>真实姓名</span><strong>{detail.realName}</strong></div>
              <div><span>身份证</span><strong>{detail.idCard}</strong></div>
              <div><span>银行卡</span><strong>{detail.bankCard}</strong></div>
              <div><span>开户银行</span><strong>{detail.bankBranch}</strong></div>
              <div>
                <span>状态</span>
                <strong className={`${styles.statusText} ${statusClassName(detail.status)}`}>
                  {statusLabel(detail.status)}
                </strong>
              </div>
            </div>

            {detail.status === 'pending' ? (
              <div className={styles.actionBox}>
                <textarea
                  className={styles.textarea}
                  placeholder="审核备注（驳回必填）"
                  value={rejectRemark}
                  onChange={(e) => setRejectRemark(e.target.value)}
                  rows={3}
                />
                <div className={styles.actionRow}>
                  <button type="button" className={styles.primaryButton} onClick={() => void handleApproveWithdraw(actionId || detail.id)}>
                    审核通过
                  </button>
                  <button type="button" className={styles.dangerButton} onClick={() => void handleRejectWithdraw(actionId || detail.id)}>
                    驳回退钻
                  </button>
                </div>
              </div>
            ) : null}

            <h4 className={styles.timelineTitle}>KK币时间线</h4>
            {timeline.length === 0 ? (
              <div className={styles.empty}>暂无流水</div>
            ) : (
              <ul className={styles.timeline}>
                {timeline.map((item) => (
                  <li key={item.id} className={styles.timelineItem}>
                    <div className={styles.timelineLeft}>
                      <div className={styles.timelineTime}>{formatDiamondTimelineTime(item.createdAt)}</div>
                      <strong className={item.diamonds >= 0 ? styles.plus : styles.minus}>
                        {item.diamonds >= 0 ? '+' : ''}{item.diamonds}
                      </strong>
                    </div>
                    <div className={styles.timelineRight}>
                      {formatDiamondTimelineLog(item)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {verifyRejectId != null ? (
        <div className={styles.modalOverlay} onClick={closeVerifyReject} role="presentation">
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="verify-reject-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalEyebrow}>认证升级 · 拒绝</div>
            <h3 id="verify-reject-title" className={styles.modalTitle}>填写拒绝说明</h3>
            <p className={styles.modalHint}>说明会对创作者可见，请写清原因，便于对方修改后再次申请。</p>
            <textarea
              className={styles.textarea}
              placeholder="例如：资料不完整 / 不符合官方认证条件…"
              value={verifyRejectRemark}
              onChange={(e) => setVerifyRejectRemark(e.target.value)}
              rows={4}
              autoFocus
            />
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={closeVerifyReject}
                disabled={verifyRejectSubmitting}
              >
                取消
              </button>
              <button
                type="button"
                className={styles.dangerSolidButton}
                onClick={() => void handleRejectVerify()}
                disabled={verifyRejectSubmitting}
              >
                {verifyRejectSubmitting ? '提交中…' : '确认拒绝'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default WithdrawAdminManager;
