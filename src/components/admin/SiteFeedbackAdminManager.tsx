import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import customerServiceApi, {
  type FeedbackStatus,
  type FeedbackType,
  type SiteFeedback,
} from '../../api/customerService/customerServiceApi';
import { getApiErrorMessage } from '../../utils/error';
import { resolveEvidenceImageUrl } from '../../utils/evidenceImageUrl';
import styles from './CustomerServiceAdmin.module.css';

const PAGE_SIZE = 20;

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  pending: '待处理',
  in_progress: '处理中',
  replied: '已回复',
  closed: '已关闭',
};

const TYPE_LABEL: Record<FeedbackType, string> = {
  bug: '功能故障',
  game: '游戏问题',
  payment: '支付问题',
  product: '产品建议',
  other: '其他',
};

const formatTime = (value?: string | null) => {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('zh-CN', { hour12: false });
};

/** 功能注释：运营「意见反馈」列表 + 详情（改状态 / 内部备注 / 站内信回复） */
const SiteFeedbackAdminManager: React.FC = () => {
  const [status, setStatus] = useState<FeedbackStatus | ''>('pending');
  const [feedbackType, setFeedbackType] = useState<FeedbackType | ''>('');
  const [keyword, setKeyword] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [list, setList] = useState<SiteFeedback[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<SiteFeedback | null>(null);
  const [internalNote, setInternalNote] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [detailStatus, setDetailStatus] = useState<FeedbackStatus>('pending');
  const [saving, setSaving] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await customerServiceApi.listFeedback({
        status,
        feedbackType,
        keyword,
        page,
        pageSize: PAGE_SIZE,
      });
      if (!res.data.success || !res.data.data) throw new Error(res.data.message || '加载失败');
      setList(res.data.data.list || []);
      setTotal(res.data.data.total || 0);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, '加载失败'));
      setList([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [status, feedbackType, keyword, page]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const openDetail = async (id: number) => {
    try {
      const res = await customerServiceApi.getFeedback(id);
      if (!res.data.success || !res.data.data) throw new Error(res.data.message || '加载失败');
      setDetail(res.data.data);
      setInternalNote(res.data.data.internalNote || '');
      setDetailStatus(res.data.data.status);
      setReplyBody('');
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, '加载详情失败'));
    }
  };

  const saveDetail = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const res = await customerServiceApi.patchFeedback(detail.id, {
        status: detailStatus,
        internalNote,
      });
      if (!res.data.success || !res.data.data) throw new Error(res.data.message || '保存失败');
      setDetail(res.data.data);
      toast.success('已保存');
      void loadList();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const sendReply = async () => {
    if (!detail || !replyBody.trim()) {
      toast.error('请填写回复内容');
      return;
    }
    setSaving(true);
    try {
      const res = await customerServiceApi.replyFeedback(detail.id, { replyBody: replyBody.trim() });
      if (!res.data.success || !res.data.data) throw new Error(res.data.message || '回复失败');
      setDetail(res.data.data);
      setDetailStatus(res.data.data.status);
      setReplyBody('');
      toast.success(detail.userId ? '已回复并写入站内信' : '已回复（游客无站内信）');
      void loadList();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, '回复失败'));
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className={styles.panel} data-customer-service="feedback">
      <div className={styles.card}>
        <div className={styles.badge}>客户服务</div>
        <h2 className={styles.title}>意见反馈</h2>
        <p className={styles.desc}>编号 FL-；支持筛选、改状态、内部备注与站内信回复。</p>
        <div className={styles.filters}>
          <select
            className={styles.control}
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as FeedbackStatus | '');
            }}
          >
            <option value="">全部状态</option>
            {(Object.keys(STATUS_LABEL) as FeedbackStatus[]).map((key) => (
              <option key={key} value={key}>{STATUS_LABEL[key]}</option>
            ))}
          </select>
          <select
            className={styles.control}
            value={feedbackType}
            onChange={(e) => {
              setPage(1);
              setFeedbackType(e.target.value as FeedbackType | '');
            }}
          >
            <option value="">全部类型</option>
            {(Object.keys(TYPE_LABEL) as FeedbackType[]).map((key) => (
              <option key={key} value={key}>{TYPE_LABEL[key]}</option>
            ))}
          </select>
          <input
            className={styles.control}
            value={keywordInput}
            placeholder="编号 / 内容 / 联系方式"
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1);
                setKeyword(keywordInput.trim());
              }
            }}
          />
          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              setPage(1);
              setKeyword(keywordInput.trim());
            }}
          >
            搜索
          </button>
        </div>
      </div>

      <div className={styles.card}>
        {loading ? <div className={styles.empty}>加载中…</div> : null}
        {!loading && list.length === 0 ? <div className={styles.empty}>暂无反馈</div> : null}
        {!loading && list.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>编号</th>
                  <th>类型</th>
                  <th>内容</th>
                  <th>联系方式</th>
                  <th>用户</th>
                  <th>状态</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.id} onClick={() => void openDetail(row.id)}>
                    <td>{row.ticketNo}</td>
                    <td>{TYPE_LABEL[row.feedbackType] || row.feedbackType}</td>
                    <td>{row.content.length > 36 ? `${row.content.slice(0, 36)}…` : row.content}</td>
                    <td>{row.contact || '—'}</td>
                    <td>{row.userId || '游客'}</td>
                    <td>{STATUS_LABEL[row.status] || row.status}</td>
                    <td>{formatTime(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {totalPages > 1 ? (
          <div className={styles.pager}>
            <button type="button" className={styles.btn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>上一页</button>
            <span>{page} / {totalPages}</span>
            <button type="button" className={styles.btn} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>下一页</button>
          </div>
        ) : null}
      </div>

      {detail ? (
        <div className={styles.mask} onClick={() => setDetail(null)} role="presentation">
          <aside className={styles.drawer} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className={styles.drawerHead}>
              <strong>{detail.ticketNo}</strong>
              <button type="button" className={styles.btn} onClick={() => setDetail(null)}>关闭</button>
            </div>
            <p><b>类型</b> {TYPE_LABEL[detail.feedbackType]}</p>
            <p><b>内容</b> {detail.content}</p>
            <p><b>联系方式</b> {detail.contact || '—'}</p>
            <p><b>用户</b> {detail.userId || '游客'}</p>
            <p><b>时间</b> {formatTime(detail.createdAt)}</p>
            {detail.screenshotUrls?.length ? (
              <div className={styles.shots}>
                {detail.screenshotUrls.map((url) => (
                  <a key={url} href={resolveEvidenceImageUrl(url)} target="_blank" rel="noreferrer">
                    <img src={resolveEvidenceImageUrl(url)} alt="" />
                  </a>
                ))}
              </div>
            ) : null}
            <label className={styles.field}>
              状态
              <select
                className={styles.control}
                value={detailStatus}
                onChange={(e) => setDetailStatus(e.target.value as FeedbackStatus)}
              >
                {(Object.keys(STATUS_LABEL) as FeedbackStatus[]).map((key) => (
                  <option key={key} value={key}>{STATUS_LABEL[key]}</option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              内部备注
              <textarea className={styles.textarea} value={internalNote} onChange={(e) => setInternalNote(e.target.value)} />
            </label>
            <button type="button" className={styles.btn} disabled={saving} onClick={() => void saveDetail()}>
              保存状态/备注
            </button>
            <label className={styles.field}>
              站内信回复用户
              <textarea
                className={styles.textarea}
                value={replyBody}
                placeholder={detail.userId ? '回复内容将进入用户消息中心' : '游客提交无站内信，仅写入工单回复'}
                onChange={(e) => setReplyBody(e.target.value)}
              />
            </label>
            {detail.replyBody ? <p className={styles.muted}>上次回复：{detail.replyBody}</p> : null}
            <button type="button" className={styles.btn} disabled={saving} onClick={() => void sendReply()}>
              发送回复
            </button>
          </aside>
        </div>
      ) : null}
    </div>
  );
};

export default SiteFeedbackAdminManager;
