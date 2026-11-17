import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import operatorDirectMessageApi, {
  type DirectMessageRecipient,
  type OperatorDirectMessage,
} from '../../api/operatorDirectMessage/operatorDirectMessageApi';
import { getApiErrorMessage } from '../../utils/error';
import styles from './CustomerServiceAdmin.module.css';

const PAGE_SIZE = 20;

const formatTime = (value?: string | null) => {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('zh-CN', { hour12: false });
};

/** 功能注释：运营定向站内信——搜人、发送、发送记录 */
const OperatorDirectMessageAdminManager: React.FC = () => {
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [list, setList] = useState<OperatorDirectMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [recipientQuery, setRecipientQuery] = useState('');
  const [recipients, setRecipients] = useState<DirectMessageRecipient[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<DirectMessageRecipient | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await operatorDirectMessageApi.list({
        keyword,
        page,
        pageSize: PAGE_SIZE,
      });
      if (!res.data.success || !res.data.data) throw new Error(res.data.message || '加载失败');
      setList(res.data.data.list || []);
      setTotal(res.data.data.pagination?.total || 0);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, '加载失败'));
      setList([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [keyword, page]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    const q = recipientQuery.trim();
    if (!q) {
      setRecipients([]);
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await operatorDirectMessageApi.searchRecipients(q);
        if (cancelled) return;
        if (!res.data.success || !res.data.data) throw new Error(res.data.message || '搜索失败');
        setRecipients(res.data.data.list || []);
      } catch (error: unknown) {
        if (!cancelled) {
          toast.error(getApiErrorMessage(error, '搜索失败'));
          setRecipients([]);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [recipientQuery]);

  const send = async () => {
    if (!selected) {
      toast.error('请先选择接收用户');
      return;
    }
    if (!title.trim() || !body.trim()) {
      toast.error('请填写标题和正文');
      return;
    }
    setSending(true);
    try {
      const res = await operatorDirectMessageApi.send({
        userId: selected.userId,
        title: title.trim(),
        body: body.trim(),
      });
      if (!res.data.success) throw new Error(res.data.message || '发送失败');
      toast.success('站内信已发送');
      setTitle('');
      setBody('');
      setSelected(null);
      setRecipientQuery('');
      setRecipients([]);
      setPage(1);
      setKeyword('');
      setKeywordInput('');
      await loadList();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, '发送失败'));
    } finally {
      setSending(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className={styles.panel} data-customer-service="direct-message">
      <div className={styles.card}>
        <div className={styles.badge}>消息中心</div>
        <h2 className={styles.title}>定向站内信</h2>
        <p className={styles.desc}>按用户名 / 手机号 / Kuran号搜索后，发送仅该用户可见的站内信。</p>

        <div className={styles.filters}>
          <input
            className={styles.control}
            style={{ minWidth: 240, flex: 1 }}
            value={recipientQuery}
            placeholder="搜索接收用户（昵称 / 手机号 / Kuran号）"
            onChange={(e) => {
              setRecipientQuery(e.target.value);
              setSelected(null);
            }}
          />
        </div>

        {selected ? (
          <p className={styles.desc} style={{ marginTop: 10 }}>
            已选：{selected.nickname || '未命名'} · Kuran号 {selected.userCode || '—'}
            {selected.phoneNumber ? ` · ${selected.phoneNumber}` : ''}
            <button
              type="button"
              className={styles.btnGhost}
              style={{ marginLeft: 10 }}
              onClick={() => {
                setSelected(null);
                setRecipientQuery('');
              }}
            >
              更换
            </button>
          </p>
        ) : null}

        {!selected && recipientQuery.trim() ? (
          <div className={styles.tableWrap} style={{ marginTop: 10 }}>
            {searching ? <div className={styles.empty}>搜索中…</div> : null}
            {!searching && recipients.length === 0 ? <div className={styles.empty}>没有匹配用户</div> : null}
            {!searching && recipients.length > 0 ? (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>昵称</th>
                    <th>Kuran号</th>
                    <th>手机号</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((row) => (
                    <tr key={row.userId}>
                      <td>{row.nickname || '—'}</td>
                      <td>{row.userCode || '—'}</td>
                      <td>{row.phoneNumber || '—'}</td>
                      <td>
                        <button type="button" className={styles.btn} onClick={() => setSelected(row)}>
                          选择
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        ) : null}

        <label className={styles.fieldLabel} style={{ display: 'block', marginTop: 14 }}>
          标题
          <input
            className={styles.control}
            style={{ width: '100%', marginTop: 6, boxSizing: 'border-box' }}
            value={title}
            maxLength={80}
            placeholder="例如：创作者身份开通通知"
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className={styles.fieldLabel} style={{ display: 'block', marginTop: 12 }}>
          正文
          <textarea
            className={styles.textarea}
            style={{ marginTop: 6 }}
            value={body}
            maxLength={2000}
            placeholder="告诉对方可以直接转为创作者，或说明下一步操作…"
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        <div style={{ marginTop: 12 }}>
          <button type="button" className={styles.btn} disabled={sending} onClick={() => void send()}>
            {sending ? '发送中…' : '发送站内信'}
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.title} style={{ fontSize: 18, marginTop: 0 }}>发送记录</h2>
        <div className={styles.filters}>
          <input
            className={styles.control}
            value={keywordInput}
            placeholder="搜索标题 / 正文 / 用户"
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

        <div className={styles.tableWrap} style={{ marginTop: 12 }}>
          {loading ? <div className={styles.empty}>加载中…</div> : null}
          {!loading && list.length === 0 ? <div className={styles.empty}>暂无发送记录</div> : null}
          {!loading && list.length > 0 ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>时间</th>
                  <th>接收人</th>
                  <th>标题</th>
                  <th>发送人</th>
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.id}>
                    <td>{formatTime(row.createdAt)}</td>
                    <td>
                      {row.recipientNickname || '—'}
                      <div className={styles.metaLine}>
                        {row.recipientUserCode || row.userId}
                        {row.recipientPhoneNumber ? ` · ${row.recipientPhoneNumber}` : ''}
                      </div>
                    </td>
                    <td>
                      <strong>{row.title}</strong>
                      <div className={styles.metaLine}>{row.body}</div>
                    </td>
                    <td>{row.createdByNickname || row.createdByUserId || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>

        {totalPages > 1 ? (
          <div className={styles.pager}>
            <button type="button" className={styles.btnGhost} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              上一页
            </button>
            <span>{page} / {totalPages}</span>
            <button
              type="button"
              className={styles.btnGhost}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default OperatorDirectMessageAdminManager;
