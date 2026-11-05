import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import gameDetailExtrasApi, {
  type GameIssueFeedback,
  type GameIssueStatus,
  type GameIssueType,
} from '../../api/gameDetailExtrasApi';
import { getApiErrorMessage } from '../../utils/error';
import { resolveEvidenceImageUrl } from '../../utils/evidenceImageUrl';
import styles from './CustomerServiceAdmin.module.css';

const PAGE_SIZE = 20;

const STATUS_LABEL: Record<GameIssueStatus, string> = {
  pending: '待处理',
  in_progress: '处理中',
  replied: '已回复',
  closed: '已关闭',
};

const TYPE_LABEL: Record<GameIssueType, string> = {
  cannot_enter: '无法进入',
  save_broken: '存档异常',
  parse_error: '解析问题',
  payment: '支付相关',
  other: '其他',
};

const formatTime = (value?: string | null) => {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('zh-CN', { hour12: false });
};

/** 功能注释：运营「作品问题」工单；可按作品 fileId 筛选，与全站意见反馈分离 */
const GameIssueAdminManager: React.FC = () => {
  const [status, setStatus] = useState<GameIssueStatus | ''>('pending');
  const [fileId, setFileId] = useState('');
  const [fileIdInput, setFileIdInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [list, setList] = useState<GameIssueFeedback[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<GameIssueFeedback | null>(null);
  const [internalNote, setInternalNote] = useState('');
  const [detailStatus, setDetailStatus] = useState<GameIssueStatus>('pending');
  const [saving, setSaving] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await gameDetailExtrasApi.listIssueFeedbackAdmin({
        status,
        fileId,
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
  }, [status, fileId, keyword, page]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const openDetail = async (id: number) => {
    try {
      const res = await gameDetailExtrasApi.getIssueFeedbackAdmin(id);
      if (!res.data.success || !res.data.data) throw new Error(res.data.message || '加载失败');
      setDetail(res.data.data);
      setInternalNote(res.data.data.internalNote || '');
      setDetailStatus(res.data.data.status);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, '加载详情失败'));
    }
  };

  const saveDetail = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const res = await gameDetailExtrasApi.patchIssueFeedbackAdmin(detail.id, {
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className={styles.panel} data-customer-service="game-issues">
      <div className={styles.card}>
        <div className={styles.badge}>客户服务</div>
        <h2 className={styles.title}>作品问题反馈</h2>
        <p className={styles.desc}>编号 GI-；与全站意见反馈分开，可按作品 ID 筛选。</p>
        <div className={styles.filters}>
          <select
            className={styles.control}
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as GameIssueStatus | '');
            }}
          >
            <option value="">全部状态</option>
            {(Object.keys(STATUS_LABEL) as GameIssueStatus[]).map((key) => (
              <option key={key} value={key}>{STATUS_LABEL[key]}</option>
            ))}
          </select>
          <input
            className={styles.control}
            value={fileIdInput}
            placeholder="作品 fileId"
            onChange={(e) => setFileIdInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1);
                setFileId(fileIdInput.trim());
              }
            }}
          />
          <input
            className={styles.control}
            value={keywordInput}
            placeholder="编号 / 标题 / 内容"
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
              setFileId(fileIdInput.trim());
              setKeyword(keywordInput.trim());
            }}
          >
            搜索
          </button>
        </div>
      </div>

      <div className={styles.card}>
        {loading ? <div className={styles.empty}>加载中…</div> : null}
        {!loading && list.length === 0 ? <div className={styles.empty}>暂无工单</div> : null}
        {!loading && list.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>编号</th>
                  <th>作品</th>
                  <th>类型</th>
                  <th>内容</th>
                  <th>用户</th>
                  <th>状态</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.id} onClick={() => void openDetail(row.id)}>
                    <td>{row.ticketNo}</td>
                    <td title={row.fileId}>{row.gameTitle || row.fileId}</td>
                    <td>{TYPE_LABEL[row.issueType] || row.issueType}</td>
                    <td>{row.content.length > 36 ? `${row.content.slice(0, 36)}…` : row.content}</td>
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
            <p><b>作品</b> {detail.gameTitle || '—'}（{detail.fileId}）</p>
            <p><b>类型</b> {TYPE_LABEL[detail.issueType]}</p>
            <p><b>内容</b> {detail.content}</p>
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
                onChange={(e) => setDetailStatus(e.target.value as GameIssueStatus)}
              >
                {(Object.keys(STATUS_LABEL) as GameIssueStatus[]).map((key) => (
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
          </aside>
        </div>
      ) : null}
    </div>
  );
};

export default GameIssueAdminManager;
