import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import customerServiceApi, {
  type BusinessCooperation,
  type CoopStatus,
  type CoopType,
} from '../../api/customerService/customerServiceApi';
import { getApiErrorMessage } from '../../utils/error';
import { useAuthStore } from '../../store/useAuthStore';
import styles from './CustomerServiceAdmin.module.css';

const PAGE_SIZE = 20;

const STATUS_LABEL: Record<CoopStatus, string> = {
  pending: '待跟进',
  communicating: '沟通中',
  won: '已成交',
  closed: '已关闭',
};

const TYPE_LABEL: Record<CoopType, string> = {
  brand: '品牌合作',
  content: '内容合作',
  channel: '渠道合作',
  procurement: '服务采购',
  other: '其他',
};

const formatTime = (value?: string | null) => {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('zh-CN', { hour12: false });
};

/** 功能注释：运营「商务合作」列表 + 详情（改状态 / 指定跟进人 / 跟进备注） */
const BusinessCoopAdminManager: React.FC = () => {
  const viewer = useAuthStore((s) => s.user?.user);
  const [status, setStatus] = useState<CoopStatus | ''>('pending');
  const [coopType, setCoopType] = useState<CoopType | ''>('');
  const [keyword, setKeyword] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [list, setList] = useState<BusinessCooperation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<BusinessCooperation | null>(null);
  const [detailStatus, setDetailStatus] = useState<CoopStatus>('pending');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await customerServiceApi.listBusinessCoop({
        status,
        coopType,
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
  }, [status, coopType, keyword, page]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const openDetail = async (id: number) => {
    try {
      const res = await customerServiceApi.getBusinessCoop(id);
      if (!res.data.success || !res.data.data) throw new Error(res.data.message || '加载失败');
      setDetail(res.data.data);
      setDetailStatus(res.data.data.status);
      setNote('');
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, '加载详情失败'));
    }
  };

  const saveStatus = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const res = await customerServiceApi.patchBusinessCoop(detail.id, {
        status: detailStatus,
        followerUserId: viewer?.userId || detail.followerUserId,
        followerName: viewer?.nickname || viewer?.name || detail.followerName || '',
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

  const assignSelf = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const res = await customerServiceApi.patchBusinessCoop(detail.id, {
        status: detailStatus,
        followerUserId: viewer?.userId || null,
        followerName: viewer?.nickname || viewer?.name || '',
      });
      if (!res.data.success || !res.data.data) throw new Error(res.data.message || '指定失败');
      setDetail(res.data.data);
      toast.success('已指定当前账号为跟进人');
      void loadList();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, '指定失败'));
    } finally {
      setSaving(false);
    }
  };

  const addNote = async () => {
    if (!detail || !note.trim()) {
      toast.error('请填写跟进备注');
      return;
    }
    setSaving(true);
    try {
      const res = await customerServiceApi.addBusinessCoopNote(detail.id, { note: note.trim() });
      if (!res.data.success || !res.data.data) throw new Error(res.data.message || '备注失败');
      setDetail(res.data.data);
      setNote('');
      toast.success('已添加跟进备注');
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, '备注失败'));
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className={styles.panel} data-customer-service="business">
      <div className={styles.card}>
        <div className={styles.badge}>客户服务</div>
        <h2 className={styles.title}>商务合作</h2>
        <p className={styles.desc}>编号 BC-；支持筛选、指定跟进人与跟进备注。</p>
        <div className={styles.filters}>
          <select
            className={styles.control}
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as CoopStatus | '');
            }}
          >
            <option value="">全部状态</option>
            {(Object.keys(STATUS_LABEL) as CoopStatus[]).map((key) => (
              <option key={key} value={key}>{STATUS_LABEL[key]}</option>
            ))}
          </select>
          <select
            className={styles.control}
            value={coopType}
            onChange={(e) => {
              setPage(1);
              setCoopType(e.target.value as CoopType | '');
            }}
          >
            <option value="">全部类型</option>
            {(Object.keys(TYPE_LABEL) as CoopType[]).map((key) => (
              <option key={key} value={key}>{TYPE_LABEL[key]}</option>
            ))}
          </select>
          <input
            className={styles.control}
            value={keywordInput}
            placeholder="编号 / 联系人 / 公司"
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
        {!loading && list.length === 0 ? <div className={styles.empty}>暂无合作线索</div> : null}
        {!loading && list.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>编号</th>
                  <th>类型</th>
                  <th>联系人</th>
                  <th>公司</th>
                  <th>联系方式</th>
                  <th>状态</th>
                  <th>跟进人</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.id} onClick={() => void openDetail(row.id)}>
                    <td>{row.ticketNo}</td>
                    <td>{TYPE_LABEL[row.coopType] || row.coopType}</td>
                    <td>{row.contactName}</td>
                    <td>{row.companyName}</td>
                    <td>{row.contact}</td>
                    <td>{STATUS_LABEL[row.status] || row.status}</td>
                    <td>{row.followerName || '—'}</td>
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
            <p><b>类型</b> {TYPE_LABEL[detail.coopType]}</p>
            <p><b>联系人</b> {detail.contactName}</p>
            <p><b>公司/个人</b> {detail.companyName}</p>
            <p><b>联系方式</b> {detail.contact}</p>
            <p><b>说明</b> {detail.description}</p>
            <p><b>时间</b> {formatTime(detail.createdAt)}</p>
            <p><b>跟进人</b> {detail.followerName || '未指定'}</p>
            <label className={styles.field}>
              状态
              <select
                className={styles.control}
                value={detailStatus}
                onChange={(e) => setDetailStatus(e.target.value as CoopStatus)}
              >
                {(Object.keys(STATUS_LABEL) as CoopStatus[]).map((key) => (
                  <option key={key} value={key}>{STATUS_LABEL[key]}</option>
                ))}
              </select>
            </label>
            <div className={styles.filters}>
              <button type="button" className={styles.btn} disabled={saving} onClick={() => void saveStatus()}>
                保存状态
              </button>
              <button type="button" className={styles.btn} disabled={saving} onClick={() => void assignSelf()}>
                指定我为跟进人
              </button>
            </div>
            <label className={styles.field}>
              跟进备注
              <textarea className={styles.textarea} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <button type="button" className={styles.btn} disabled={saving} onClick={() => void addNote()}>
              添加备注
            </button>
            {(detail.notes || []).map((item) => (
              <div key={item.id} className={styles.noteItem}>
                <div className={styles.muted}>{formatTime(item.createdAt)} · {item.authorName || item.authorUserId}</div>
                <div>{item.note}</div>
              </div>
            ))}
          </aside>
        </div>
      ) : null}
    </div>
  );
};

export default BusinessCoopAdminManager;
